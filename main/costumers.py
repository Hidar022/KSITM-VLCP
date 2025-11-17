import json
import base64
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from .models import ChatMessage, Profile

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # authenticated user required
        self.user = self.scope["user"]
        if not self.user.is_authenticated:
            await self.close()
            return

        self.other_user_id = self.scope['url_route']['kwargs']['user_id']
        # room name deterministic between two users
        uid1 = int(self.user.id)
        uid2 = int(self.other_user_id)
        self.room_name = f'chat_{min(uid1, uid2)}_{max(uid1, uid2)}'

        await self.channel_layer.group_add(self.room_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        data = json.loads(text_data or '{}')
        message = data.get('message', '')
        audio_data = data.get('audio', None)
        filename = data.get('filename', None)

        # resolve users and profiles (sync DB ops via helper)
        sender = self.user
        receiver_user = await self.get_user(int(self.other_user_id))

        # Find Profile objects
        sender_profile = await self.get_profile_for_user(sender.id)
        receiver_profile = await self.get_profile_for_user(receiver_user.id)

        send_content = ""
        if audio_data:
            # Save base64 audio as a ContentFile
            audio_bytes = base64.b64decode(audio_data.split(",")[1])
            content = ContentFile(audio_bytes, name=f"voice_{sender.id}_{receiver_user.id}.webm")
            await self.save_chatmessage(sender_profile, receiver_profile, text="", voice_note=content)
            send_content = "[Voice Message]"
        elif filename:
            # Note: this just records filename. If you want real file upload over WebSocket,
            # you must send base64 content and save like above.
            await self.save_chatmessage(sender_profile, receiver_profile, text=f"[File: {filename}]")
            send_content = f"[File Sent: {filename}]"
        else:
            await self.save_chatmessage(sender_profile, receiver_profile, text=message)
            send_content = message

        # broadcast to group
        await self.channel_layer.group_send(
            self.room_name,
            {
                'type': 'chat_message',
                'message': send_content,
                'sender_id': sender.id,
                'sender_username': sender.username,
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'message': event['message'],
            'sender_id': event['sender_id'],
            'sender': event['sender_username']
        }))

    @database_sync_to_async
    def get_user(self, user_id):
        return User.objects.get(id=user_id)

    @database_sync_to_async
    def get_profile_for_user(self, user_id):
        return Profile.objects.get(user__id=user_id)

    @database_sync_to_async
    def save_chatmessage(self, lecturer_profile, student_profile, text="", voice_note=None, file=None):
        # Who is the lecturer and who is the student? ChatMessage requires lecturer & student profile FKs.
        # Determine roles: if lecturer_profile.role == 'lecturer' then use that, else swap.
        if lecturer_profile.role == 'lecturer':
            lec = lecturer_profile
            stu = student_profile
        elif student_profile.role == 'lecturer':
            lec = student_profile
            stu = lecturer_profile
        else:
            # fallback: assume sender is lecturer if any has role 'lecturer'
            lec = lecturer_profile
            stu = student_profile

        msg = ChatMessage.objects.create(
            sender='lecturer' if lec.user.id == lecturer_profile.user.id else 'student',
            lecturer=lec,
            student=stu,
            text=text or None,
            voice_note=voice_note,
            file=file
        )
        return msg
