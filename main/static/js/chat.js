// static/js/chat.js
// Required globals: OTHER_USER_ID, CURRENT_USER_ID

//-----start server with 
// daphne -b 127.0.0.1 -p 8000 ksitm_vlcp.asgi:application----//


document.addEventListener("DOMContentLoaded", () => {

    if (OTHER_USER_ID === null) {
        console.warn("ℹ️ No chat selected yet.");
        return;
    }


    /* -------------------- UI Elements -------------------- */
    const messagesBox = document.getElementById("messages");
    const sendBtn = document.getElementById("sendBtn");
    const messageInput = document.getElementById("messageInput");
    const recordBtn = document.getElementById("recordBtn");

    const callBtn = document.getElementById("startAudioCall");
    const endCallBtn = document.getElementById("endCallBtn");

    const incomingCallBox = document.getElementById("incomingCallBox");
    const acceptCallBtn = document.getElementById("acceptCall");
    const rejectCallBtn = document.getElementById("rejectCall");

    const remoteAudio = document.getElementById("remoteAudio");

    const startVideoCallBtn = document.getElementById("startVideoCall");

    const localVideo = document.getElementById("localVideo");
    const remoteVideo = document.getElementById("remoteVideo");
    const endVideoCallBtn = document.getElementById("endVideoCallBtn");
    const callBox = document.getElementById("callBox");
     const audioInput = document.getElementById("audioInput");


    /* -------------------- State -------------------- */
    let socket;
    let reconnectDelay = 1000;
    let pendingClientMap = {};
    let pendingIceCandidates = [];


    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;
    let currentClientIdForRecording = null;

    let peerConnection = null;
    let localStream = null;
    let incomingOffer = null;
    let isCaller = false;
    let currentCallType = null; // "audio" or "video"



    const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

    /* -------------------- WebSocket -------------------- */
    const WS_PROTOCOL = location.protocol === "https:" ? "wss" : "ws";
    const WS_URL = `${WS_PROTOCOL}://${location.host}/ws/chat/${OTHER_USER_ID}/`;

    function connect() {
        socket = new WebSocket(WS_URL);

        socket.onopen = () => {
            console.log("✅ WebSocket connected");
            reconnectDelay = 1000;
        };

        socket.onclose = () => {
            console.warn("⚠️ WebSocket closed, reconnecting...");
            setTimeout(connect, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
        };

        socket.onmessage = async (e) => {
            const data = JSON.parse(e.data);

            /* ---------- Chat messages ---------- */
            if (data.type === "message") handleIncomingMessage(data);

                /* ---------- Call Offer ---------- */
                    if (data.type === "call_offer") {
            if (data.caller_id == CURRENT_USER_ID) return;

            incomingOffer = data.offer;
            currentCallType = data.call_type || "audio";

            incomingCallBox.classList.remove("hidden");
        }

            /* ---------- Call Answer ---------- */
           if (
                data.type === "call_answer" &&
                peerConnection &&
                peerConnection.signalingState === "have-local-offer"
            ) {
                await peerConnection.setRemoteDescription(
                    new RTCSessionDescription(data.answer)
                );

            for (const c of pendingIceCandidates) {
                await peerConnection.addIceCandidate(c);
            }
            pendingIceCandidates = [];
            }


            /* ---------- ICE Candidate ---------- */
            if (data.type === "ice_candidate") {
            if (peerConnection && peerConnection.remoteDescription) {
                await peerConnection.addIceCandidate(data.candidate);
            } else {
                pendingIceCandidates.push(data.candidate);
            }
        }


            /* ---------- Call End ---------- */
            if (data.type === "call_end") {
                endCallCleanup(false);
            }
        };
    }

    connect();

    /* -------------------- Helpers -------------------- */
    function formatTS(iso) {
        const d = new Date(iso);
        return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    }

    function createBubbleDOM(payload, isMine) {
        const wrapper = document.createElement("div");
        wrapper.className = `w-full flex ${isMine ? "justify-end" : "justify-start"}`;

        const bubble = document.createElement("article");
        bubble.className =
            "max-w-[75%] p-3 rounded-xl " +
            (isMine ? "bg-blue-600 text-white" : "bg-slate-700 text-white");

        bubble.innerHTML = payload.voice_note
            ? `<audio controls src="${payload.voice_note}"></audio>`
            : `<div>${payload.message || ""}</div>`;

        wrapper.appendChild(bubble);
        return { wrapper, bubble };
    }

    function handleIncomingMessage(data) {
        const isMine = data.sender_id == CURRENT_USER_ID;

        if (data.client_id && pendingClientMap[data.client_id]) {
            const bubble = pendingClientMap[data.client_id];
            bubble.innerHTML = data.voice_note
                ? `<audio controls src="${data.voice_note}"></audio>`
                : `<div>${data.message}</div>`;
            delete pendingClientMap[data.client_id];
            return;
        }

        const { wrapper } = createBubbleDOM(data, isMine);
        messagesBox.appendChild(wrapper);
        messagesBox.scrollTop = messagesBox.scrollHeight;
    }

    /* -------------------- Send Text -------------------- */
    sendBtn.onclick = () => {
        if (!messageInput.value.trim()) return;

        const client_id = "c_" + Math.random().toString(36).slice(2, 10);

        const { wrapper, bubble } = createBubbleDOM({
            message: messageInput.value,
            timestamp: new Date().toISOString()
        }, true);

        messagesBox.appendChild(wrapper);
        messagesBox.scrollTop = messagesBox.scrollHeight;

        pendingClientMap[client_id] = bubble;

        socket.send(JSON.stringify({
            type: "text",
            message: messageInput.value,
            client_id
        }));

        messageInput.value = "";
    };

   /* -------------------- Voice Note (WhatsApp style) -------------------- */
recordBtn.addEventListener("click", async () => {
    console.log("🎙 Click | isRecording:", isRecording);

    try {
        if (!isRecording) {
            // ▶ START RECORDING
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            isRecording = true;

            // ✅ VISUAL STATE
            recordBtn.classList.add("recording");
            recordBtn.innerText = "⏹";

            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

            mediaRecorder.onstop = async () => {
                console.log("⏹ Recorder stopped");

                const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
                const audioURL = URL.createObjectURL(audioBlob);

                const client_id = "c_" + Math.random().toString(36).slice(2, 10);
                const { wrapper, bubble } = createBubbleDOM(
                    { voice_note: audioURL },
                    true
                );

                messagesBox.appendChild(wrapper);
                messagesBox.scrollTop = messagesBox.scrollHeight;
                pendingClientMap[client_id] = bubble;

                const reader = new FileReader();
                reader.onload = () => {
                    socket.send(JSON.stringify({
                        type: "voice_note",
                        client_id,
                        audio_data: reader.result.split(",")[1],
                        mime_type: audioBlob.type
                    }));
                };
                reader.readAsDataURL(audioBlob);

                stream.getTracks().forEach(t => t.stop());

                // ✅ RESET STATE
                isRecording = false;
                recordBtn.classList.remove("recording");
                recordBtn.innerText = "🎙";
                mediaRecorder = null;
            };

            mediaRecorder.start();

        } else {
            // ⏹ STOP RECORDING
            if (mediaRecorder && mediaRecorder.state !== "inactive") {
                mediaRecorder.stop();
            }
        }
    } catch (err) {
        console.error("❌ Mic error:", err);
        isRecording = false;
        recordBtn.classList.remove("recording");
        recordBtn.innerText = "🎙";
    }
});


    /* -------------------- Accept Call -------------------- */
    acceptCallBtn.onclick = async () => {
        if (!incomingOffer || isCaller) return;

        incomingCallBox.classList.add("hidden");

        if (currentCallType === "video") {
            startVideoCallBtn.classList.add("hidden");
        }


        const constraints =
            currentCallType === "video"
                ? { audio: true, video: true }
                : { audio: true };

        localStream = await navigator.mediaDevices.getUserMedia(constraints);

        peerConnection = new RTCPeerConnection(rtcConfig);

        localStream.getTracks().forEach(t =>
            peerConnection.addTrack(t, localStream)
        );

        if (currentCallType === "video") {

            callBox.classList.remove("hidden"); 
            endVideoCallBtn.classList.remove("hidden");


            localVideo.srcObject = localStream;
            localVideo.classList.remove("hidden");
            

            peerConnection.ontrack = e => {
                remoteVideo.srcObject = e.streams[0];
                remoteVideo.classList.remove("hidden");
            };
        } else {
            peerConnection.ontrack = e => {
                remoteAudio.srcObject = e.streams[0];
            };
        }

        peerConnection.onicecandidate = e => {
            if (e.candidate) {
                socket.send(JSON.stringify({
                    type: "ice_candidate",
                    candidate: e.candidate
                }));
            }
        };

        await peerConnection.setRemoteDescription(incomingOffer);

        for (const c of pendingIceCandidates) {
            await peerConnection.addIceCandidate(c);
        }

        pendingIceCandidates = [];

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.send(JSON.stringify({
            type: "call_answer",
            answer
        }));

        endCallBtn.classList.remove("hidden");
                if (currentCallType === "video") {
            callBtn.classList.add("hidden");
        }

    };



    /* -------------------- Reject Call -------------------- */
    rejectCallBtn.onclick = () => {
        if (!incomingOffer) return;
        incomingCallBox.classList.add("hidden");
        socket.send(JSON.stringify({ type: "call_end" }));
        incomingOffer = null;
    };

    /* -------------------- End Call -------------------- */
    endCallBtn.onclick = () => endCallCleanup(true);
    endVideoCallBtn.onclick = () => endCallCleanup(true);


        function endCallCleanup(sendSignal = true) {
        peerConnection?.close();
        localStream?.getTracks().forEach(t => t.stop());

        peerConnection = null;
        localStream = null;
        incomingOffer = null;
        isCaller = false;
        currentCallType = null;

        remoteAudio.srcObject = null;

        if (localVideo) {
            localVideo.srcObject = null;
            localVideo.classList.add("hidden");
        }

        if (remoteVideo) {
            remoteVideo.srcObject = null;
            remoteVideo.classList.add("hidden");
        }

        callBox.classList.add("hidden"); 
        callBtn.classList.remove("hidden");
        startVideoCallBtn.classList.remove("hidden");
        endCallBtn.classList.add("hidden");
        endVideoCallBtn.classList.add("hidden");


        if (sendSignal) {
            socket.send(JSON.stringify({ type: "call_end" }));
        }
    }


           //-----------start video call----------//
        startVideoCallBtn.onclick = async () => {
            isCaller = true;            // ✅ ADD
            currentCallType = "video";  // ✅ ADD

            endVideoCallBtn.classList.remove("hidden");
            callBtn.classList.add("hidden");
            startVideoCallBtn.classList.add("hidden");


            localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            });

            localVideo.srcObject = localStream;
            localVideo.classList.remove("hidden");

            peerConnection = new RTCPeerConnection(rtcConfig);

            localStream.getTracks().forEach(track =>
                peerConnection.addTrack(track, localStream)
            );

            peerConnection.ontrack = e => {
                remoteVideo.srcObject = e.streams[0];
                remoteVideo.classList.remove("hidden");
                
            };

            peerConnection.onicecandidate = e => {
                if (e.candidate) {
                    socket.send(JSON.stringify({
                        type: "ice_candidate",
                        candidate: e.candidate
                    }));
                }
            };

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            socket.send(JSON.stringify({
            type: "call_offer",
            offer,
            caller_id: CURRENT_USER_ID,
            call_type: "video"
        }));

        };

});

 