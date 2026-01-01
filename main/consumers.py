import json
import base64
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from .models import ChatMessage, Profile


class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.user = self.scope["user"]
        if not self.user.is_authenticated:
            await self.close()
            return

        self.other_user_id = self.scope["url_route"]["kwargs"].get("user_id")
        if not self.other_user_id:
            await self.close()
            return

        uid1 = int(self.user.id)
        uid2 = int(self.other_user_id)
        self.room_name = f"chat_{min(uid1, uid2)}_{max(uid1, uid2)}"

        await self.channel_layer.group_add(self.room_name, self.channel_name)
        await self.accept()

        await self.channel_layer.group_send(self.room_name, {
            "type": "presence",
            "user_id": self.user.id,
            "status": "online",
        })

    async def disconnect(self, close_code):
        if hasattr(self, "room_name"):
            await self.channel_layer.group_discard(
                self.room_name,
                self.channel_name
            )

            await self.channel_layer.group_send(self.room_name, {
                "type": "presence",
                "user_id": self.user.id,
                "status": "offline",
            })



    async def receive(self, text_data=None, bytes_data=None):
        data = json.loads(text_data or "{}")
        dtype = data.get("type")

        sender = self.user
        receiver_user = await self.get_user(int(self.other_user_id))
        sender_profile = await self.get_profile_for_user(sender.id)
        receiver_profile = await self.get_profile_for_user(receiver_user.id)

        # =========================================================
        # 🟢 CHAT / VOICE NOTE / FILE
        # =========================================================
        if dtype in ("text", "file", "audio", "voice_note"):
            client_id = data.get("client_id") or str(uuid.uuid4())
            text = data.get("message") or None

            uploaded_file = None
            voice_note_file = None

            # FILE
            file_b64 = data.get("file_b64")
            filename = data.get("filename")
            if file_b64 and filename:
                try:
                    _, b64 = file_b64.split(",", 1)
                except ValueError:
                    b64 = file_b64
                uploaded_file = ContentFile(base64.b64decode(b64), name=filename)

            # VOICE NOTE
            audio_b64 = data.get("audio")
            if audio_b64:
                try:
                    _, b64 = audio_b64.split(",", 1)
                except ValueError:
                    b64 = audio_b64
                voice_note_file = ContentFile(
                    base64.b64decode(b64),
                    name=f"voice_{sender.id}_{client_id}.webm"
                )

            saved = await self.save_chatmessage(
                sender_profile,
                receiver_profile,
                text=text,
                voice_note=voice_note_file,
                file=uploaded_file,
                client_id=client_id
            )

            await self.channel_layer.group_send(self.room_name, {
                "type": "chat_message",
                "message": saved.text or "",
                "msg_id": saved.id,
                "client_id": client_id,
                "sender_id": sender.id,
                "sender_username": sender.username,
                "timestamp": saved.timestamp.isoformat(),
                "status": saved.status,
                "voice_note": saved.voice_note.url if saved.voice_note else None,
                "file": saved.file.url if saved.file else None,
            })
            return

        # =========================================================
        # 🟡 DELIVERY / SEEN
        # =========================================================
        if dtype in ("delivered", "seen"):
            msg_ids = data.get("msg_ids") or []
            if isinstance(msg_ids, int):
                msg_ids = [msg_ids]

            await self.mark_messages_status(msg_ids, dtype)

            await self.channel_layer.group_send(self.room_name, {
                "type": "delivery_ack",
                "msg_ids": msg_ids,
                "user_id": sender.id,
                "status": dtype
            })
            return

        # =========================================================
        # 🔥 WEBRTC SIGNALING (VOICE / VIDEO CALL)
        # =========================================================
        if dtype in ("call_offer", "call_answer", "ice_candidate", "call_end"):
            await self.channel_layer.group_send(self.room_name, {
                "type": "signal",
                "data": data
            })
            return

    # =========================================================
    # EVENTS SENT TO CLIENT
    # =========================================================

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "message",
            "message": event["message"],
            "msg_id": event["msg_id"],
            "client_id": event["client_id"],
            "sender_id": event["sender_id"],
            "sender_username": event["sender_username"],
            "timestamp": event["timestamp"],
            "status": event["status"],
            "voice_note": event.get("voice_note"),
            "file": event.get("file"),
        }))

    async def delivery_ack(self, event):
        await self.send(text_data=json.dumps({
            "type": "delivery",
            "msg_ids": event["msg_ids"],
            "user_id": event["user_id"],
            "status": event["status"],
        }))

    async def presence(self, event):
        await self.send(text_data=json.dumps({
            "type": "presence",
            "user_id": event["user_id"],
            "status": event["status"],
        }))

    async def signal(self, event):
        # 🚀 Forward WebRTC signaling EXACTLY as sent
        await self.send(text_data=json.dumps(event["data"]))

    # =========================================================
    # DATABASE HELPERS
    # =========================================================

    @database_sync_to_async
    def get_user(self, user_id):
        return User.objects.get(id=user_id)

    @database_sync_to_async
    def get_profile_for_user(self, user_id):
        return Profile.objects.get(user__id=user_id)

    @database_sync_to_async
    def save_chatmessage(self, lecturer_profile, student_profile,
                         text=None, voice_note=None, file=None, client_id=None):

        if lecturer_profile.role == "lecturer":
            lec = lecturer_profile
            stu = student_profile
        elif student_profile.role == "lecturer":
            lec = student_profile
            stu = lecturer_profile
        else:
            lec = lecturer_profile
            stu = student_profile

        sender_side = "lecturer" if lec.user.id == lecturer_profile.user.id else "student"

        return ChatMessage.objects.create(
            sender=sender_side,
            lecturer=lec,
            student=stu,
            text=text,
            voice_note=voice_note,
            file=file,
            client_id=client_id,
            status="sent",
        )

    @database_sync_to_async
    def mark_messages_status(self, msg_ids, status):
        ChatMessage.objects.filter(id__in=msg_ids).update(status=status)
