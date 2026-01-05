// static/js/chat.js
// Required globals: OTHER_USER_ID, CURRENT_USER_ID

//-----start server with 
// daphne -b 127.0.0.1 -p 8000 ksitm_vlcp.asgi:application----//


document.addEventListener("DOMContentLoaded", () => {

    if (OTHER_USER_ID === null) {
        console.warn("ℹ️ No chat selected yet.");
        return;
    }

    document.querySelectorAll('.custom-audio-player').forEach(player => {
    const src = player.dataset.src;
    const audio = new Audio(src);
    const playBtn = player.querySelector('.play-pause-btn');
    const progressBar = player.querySelector('.progress-bar');
    const durationEl = player.querySelector('.duration');

    let isPlaying = false;

    // Update duration
    audio.addEventListener('loadedmetadata', () => {
        const mins = Math.floor(audio.duration / 60);
        const secs = Math.floor(audio.duration % 60).toString().padStart(2,'0');
        durationEl.textContent = `${mins}:${secs}`;
    });

    // Update progress
    audio.addEventListener('timeupdate', () => {
        const percent = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = percent + '%';
    });

    // Play/pause toggle
    playBtn.addEventListener('click', () => {
        if(isPlaying){
            audio.pause();
            playBtn.textContent = '▶️';
        } else {
            audio.play();
            playBtn.textContent = '⏸️';
        }
        isPlaying = !isPlaying;
    });

    // Reset when finished
    audio.addEventListener('ended', () => {
        isPlaying = false;
        playBtn.textContent = '▶️';
        progressBar.style.width = '0%';
    });
});

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
    let recordTimer = null;
    let recordSeconds = 0;



    const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

    /* -------------------- WebSocket -------------------- */
    const WS_PROTOCOL = location.protocol === "https:" ? "wss" : "ws";
    const WS_URL = `${WS_PROTOCOL}://${location.host}/ws/chat/${OTHER_USER_ID}/`;

    function connect() {
        socket = new WebSocket(WS_URL);

                socket.onopen = () => {
            console.log("✅ WebSocket connected");
            reconnectDelay = 1000;

            window.addEventListener("focus", () => {
                socket.send(JSON.stringify({ type: "seen" }));
            });
        };


        socket.onclose = () => {
            console.warn("⚠️ WebSocket closed, reconnecting...");
            setTimeout(connect, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
        };

        socket.onmessage = async (e) => {
            const data = JSON.parse(e.data);

            if (data.type === "delivered") {
            const bubble = pendingClientMap[data.client_id];
            if (!bubble) return;

            const statusEl = bubble.querySelector('[data-status]');
            if (statusEl) statusEl.textContent = "delivered ✔✔";
        }

            if (data.type === "seen") {
        document.querySelectorAll('[data-status]').forEach(el => {
            if (el.textContent.includes("delivered")) {
                el.textContent = "seen 👁️";
            }
        });
    }



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
    function createBubbleDOM(payload, isMine, status = "sending...") {
        const wrapper = document.createElement("div");
        wrapper.className = `w-full flex ${isMine ? "justify-end" : "justify-start"}`;

        const bubble = document.createElement("article");
        bubble.className =
            "max-w-[75%] p-3 rounded-xl relative message-bubble " +
            (isMine ? "bg-orange-500 text-white" : "bg-slate-700 text-white");

        let content = "";

        if (payload.voice_note) {
            content = `<audio controls src="${payload.voice_note}"></audio>`;
        } else {
            content = `<div class="message-text">${payload.message || ""}</div>`;
        }

        bubble.innerHTML = `
            ${content}
            ${
                isMine
                    ? `<span class="msg-status text-xs absolute bottom-1 right-2 opacity-70" data-status>
                        ${status}
                    </span>`
                    : ""
            }
        `;

        wrapper.appendChild(bubble);
        return { wrapper, bubble };
    }




    function handleIncomingMessage(data) {
        const isMine = data.sender_id == CURRENT_USER_ID;

        if (data.client_id && pendingClientMap[data.client_id]) {
        const bubble = pendingClientMap[data.client_id];

        const statusEl = bubble.querySelector('[data-status]');
        if (statusEl) statusEl.textContent = "sent ✔";

        delete pendingClientMap[data.client_id];
        return;


        }


        const { wrapper } = createBubbleDOM(data, isMine);
        messagesBox.appendChild(wrapper);
        messagesBox.scrollTop = messagesBox.scrollHeight;

        // notify sender that message was delivered
        socket.send(JSON.stringify({
            type: "delivered",
            client_id: data.client_id
        }));

    }



    /* -------------------- Send Text -------------------- */
    sendBtn.onclick = () => {
        if (!messageInput.value.trim()) return;

        const client_id = "c_" + Math.random().toString(36).slice(2, 10);

        const { wrapper, bubble } = createBubbleDOM(
            { message: messageInput.value },
            true,
            "sending..."
        );

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
                clearInterval(recordTimer);
                recordTimer = null;

                console.log("⏹ Recorder stopped");

                const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
                const audioURL = URL.createObjectURL(audioBlob);

                const client_id = "c_" + Math.random().toString(36).slice(2, 10);
                const { wrapper, bubble } = createBubbleDOM(
                { voice_note: audioURL },
                true,
                "sending..."
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
            recordSeconds = 0;
            recordBtn.innerText = "⏹ 0:00";

            recordTimer = setInterval(() => {
                recordSeconds++;
                const mins = Math.floor(recordSeconds / 60);
                const secs = String(recordSeconds % 60).padStart(2, "0");
                recordBtn.innerText = `⏹ ${mins}:${secs}`;
            }, 1000);

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

 