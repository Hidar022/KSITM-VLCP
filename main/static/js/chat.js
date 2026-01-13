// static/js/chat.js
// Required globals: OTHER_USER_ID, CURRENT_USER_ID

//-----start server with 
// daphne -b 127.0.0.1 -p 8000 ksitm_vlcp.asgi:application----//


document.addEventListener("DOMContentLoaded", () => {

    const callTone = new Audio("/static/sounds/call.mp3");
    callTone.loop = true;

    let audioUnlocked = false;
    let _audioUnlockResolve = null;
    const audioUnlockPromise = new Promise((res) => { _audioUnlockResolve = res; });

    function unlockAudio() {
        if (audioUnlocked) return;

        // mark as unlocked optimistically on user gesture
        audioUnlocked = true;

        // try to play once to satisfy browser autoplay policies, then pause
        callTone.play().then(() => {
            callTone.pause();
            callTone.currentTime = 0;
            console.log("🔓 Audio unlocked (play succeeded)");
            if (_audioUnlockResolve) _audioUnlockResolve();
        }).catch((err) => {
            // still resolve so waiting callers can attempt to play
            console.warn("🔇 unlock play blocked", err);
            if (_audioUnlockResolve) _audioUnlockResolve();
        });
    }

    document.addEventListener("click", unlockAudio, { once: true });
        function playCallTone() {
                if (!audioUnlocked) {
                    console.warn("🔇 Audio not unlocked yet, will wait for user gesture");
                    // wait for the unlock gesture (e.g., page click or enable button)
                    audioUnlockPromise.then(() => playCallTone());
                    return;
                }

                // Stop if already playing and reset
                try {
                    callTone.pause();
                    callTone.currentTime = 0;
                } catch (e) { /* ignore */ }

                // Try to play, catch errors
                const playPromise = callTone.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => console.log("🔔 Ringtone playing"))
                        .catch(err => console.warn("❌ Ring blocked", err));
                }
        }


    function stopCallTone() {
        if (!callTone.paused) {
            callTone.pause();
            callTone.currentTime = 0;
        }
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

    // call timer
        function startCallTimer() {
        callSeconds = 0;
        const timerEl = document.getElementById("callTimer");
        timerEl.classList.remove("hidden");
        updateCallTimerDisplay(timerEl);

        callTimerInterval = setInterval(() => {
            callSeconds++;
            updateCallTimerDisplay(timerEl);
        }, 1000);
    }

    function stopCallTimer() {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
        const timerEl = document.getElementById("callTimer");
        timerEl.classList.add("hidden");
        timerEl.textContent = "00:00";
    }

    function updateCallTimerDisplay(el) {
        const mins = String(Math.floor(callSeconds / 60)).padStart(2, "0");
        const secs = String(callSeconds % 60).padStart(2, "0");
        el.textContent = `${mins}:${secs}`;
    }

 /* -------------------- Call UI Helpers -------------------- */
function showCallBox(type = "audio") {
    callBox.classList.add("active");
    callBox.style.pointerEvents = "auto";

    if (type === "video") {
        callBox.classList.add("video-mode");
        localVideo.classList.remove("hidden");
        remoteVideo.classList.remove("hidden");
        document.getElementById("audioCallUI").classList.add("hidden");
    } else {
        callBox.classList.remove("video-mode");
        localVideo.classList.add("hidden");
        remoteVideo.classList.add("hidden");
        document.getElementById("audioCallUI").classList.remove("hidden");
    }
    // make sure buttons reflect the active call state for both sides
    showCallBoxButtons(type);
}

// Ensure the correct buttons are visible when call box shows (both caller & callee)
function showCallBoxButtons(type = "audio") {
    // hide start buttons
    if (callBtn) callBtn.classList.add("hidden");
    if (startVideoCallBtn) startVideoCallBtn.classList.add("hidden");

    // show correct end button
    if (type === "video") {
        if (endVideoCallBtn) endVideoCallBtn.classList.remove("hidden");
        if (endCallBtn) endCallBtn.classList.add("hidden");
    } else {
        if (endCallBtn) endCallBtn.classList.remove("hidden");
        if (endVideoCallBtn) endVideoCallBtn.classList.add("hidden");
    }
}

function hideCallBox() {
    callBox.classList.remove("active", "video-mode");
    callBox.style.pointerEvents = "none";

    localVideo.classList.add("hidden");
    remoteVideo.classList.add("hidden");
    document.getElementById("audioCallUI").classList.add("hidden");
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
    const toggleMicBtn = document.getElementById("toggleMicBtn");


    /* -------------------- State -------------------- */
    let socket;
    let reconnectDelay = 1000;
    let pendingClientMap = {};
    let pendingIceCandidates = [];

    let callSeconds = 0;
    let callTimerInterval = null;


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
    let micEnabled = true;




    const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

 /* -------------------- WebSocket -------------------- */
const WS_PROTOCOL = location.protocol === "https:" ? "wss" : "ws";
const WS_URL = `${WS_PROTOCOL}://${location.host}/ws/chat/${OTHER_USER_ID}/`;

const RING_DURATION = 30000; // 30 seconds
let ringTimeout = null;

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

        /* ---------- Delivered ---------- */
        if (data.type === "delivered") {
            const bubble = pendingClientMap[data.client_id];
            if (!bubble) return;

            const statusEl = bubble.querySelector("[data-status]");
            if (statusEl) statusEl.textContent = "delivered ✔✔";
        }

        /* ---------- Seen ---------- */
        if (data.type === "seen") {
            document.querySelectorAll("[data-status]").forEach(el => {
                if (el.textContent.includes("delivered")) {
                    el.textContent = "seen 👁️";
                }
            });
        }

        /* ---------- Chat Message ---------- */
        if (data.type === "message") {
            handleIncomingMessage(data);
        }

        /* ---------- Call Offer ---------- */
if (data.type === "call_offer") {
    if (data.caller_id == CURRENT_USER_ID) return;

    incomingOffer = data.offer;
    currentCallType = data.call_type || "audio";

    incomingCallBox.classList.remove("hidden");
    setTimeout(() => playCallTone(), 200);

    // If audio isn't unlocked yet (first visit), show an enable-sound button
    if (!audioUnlocked) {
        // avoid duplicating the button
        if (!document.getElementById('enableSoundBtn')) {
            const btn = document.createElement('button');
            btn.id = 'enableSoundBtn';
            btn.textContent = 'Enable sound';
            btn.className = 'px-4 py-2 bg-ks-accent text-white rounded';
            btn.onclick = (ev) => {
                ev.stopPropagation();
                unlockAudio();
                playCallTone();
                btn.remove();
            };

            // append to the incoming call box content area
            incomingCallBox.querySelector('div').appendChild(btn);
        }
    }

    // ⏱ 30s ring timeout (receiver side)
    ringTimeout = setTimeout(() => {
        console.log("📵 Missed call");

        // STOP ringtone
        stopCallTone();

        // Hide incoming call UI
        incomingCallBox.classList.add("hidden");

        // Notify caller they missed the call
        socket.send(JSON.stringify({
            type: "call_missed",
            call_type: currentCallType
        }));

        // Reset state
        incomingOffer = null;
        currentCallType = null;
    }, RING_DURATION);
}
        /* ---------- Call Answer ---------- */
        if (
            data.type === "call_answer" &&
            peerConnection &&
            peerConnection.signalingState === "have-local-offer"
        ) {
            // Stop ringing (caller side)
            if (ringTimeout) {
                clearTimeout(ringTimeout);
                ringTimeout = null;
            }
            stopCallTone();

            // Apply remote SDP answer
            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(data.answer)
            );

            // ✅ Start call timer ONLY when call is connected
            startCallTimer();

            // Add queued ICE candidates
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
            clearTimeout(ringTimeout);
            endCallCleanup(false);
        }

        
        /* ---------- Call Missed (Caller side) ---------- */
        if (data.type === "call_missed") {
            // STOP ringtone if still playing
            stopCallTone();

            // Cleanup UI (End button, etc)
            endCallCleanup(false);

            // Show a message in chat
            const { wrapper } = createBubbleDOM(
                { message: `📵 ${data.call_type} call not answered` },
                true
            );

            messagesBox.appendChild(wrapper);
            messagesBox.scrollTop = messagesBox.scrollHeight;
        }


    };
}

connect();

//----------create message bubble dom---------------//
function createBubbleDOM(payload, isMine, status = "sending...") {
    const wrapper = document.createElement("div");
    wrapper.className = `w-full flex ${isMine ? "justify-end" : "justify-start"}`;

    const bubble = document.createElement("article");

    // System messages get their own style
    if (payload.is_system) {
        bubble.className = "max-w-[75%] p-3 rounded-xl relative bg-gray-300 text-gray-800 text-center italic";
        bubble.textContent = payload.message || "";
    } else {
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
    }

    wrapper.appendChild(bubble);
    return { wrapper, bubble };
}

// -------------------- Incoming messages --------------------
function handleIncomingMessage(data) {
    const isMine = data.sender_id == CURRENT_USER_ID;

    // Check if this is a normal user message
    const isSystem = data.is_system || false; // we will mark system messages

    // If we already have a pending bubble, update its status
    if (!isSystem && data.client_id && pendingClientMap[data.client_id]) {
        const bubble = pendingClientMap[data.client_id];
        const statusEl = bubble.querySelector('[data-status]');
        if (statusEl) statusEl.textContent = "sent ✔";
        delete pendingClientMap[data.client_id];
        return;
    }

    // Create bubble
    const { wrapper } = createBubbleDOM(data, isMine, isMine && !isSystem ? "delivered ✔" : null, isSystem);
    messagesBox.appendChild(wrapper);
    messagesBox.scrollTop = messagesBox.scrollHeight;

    // Notify sender only for real user messages
    if (!isSystem) {
        socket.send(JSON.stringify({
            type: "delivered",
            client_id: data.client_id
        }));
    }
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


 /* -------------------- Accept Incoming Call -------------------- */
acceptCallBtn.onclick = async () => {
    // ensure user gesture unlocks audio so answer flow can play/stop tones
    unlockAudio();
    if (!incomingOffer || isCaller) return;

    // Stop ringing
    clearTimeout(ringTimeout);
    ringTimeout = null;
    stopCallTone();

    startCallTimer();
    showCallBox(currentCallType);

    incomingCallBox.classList.add("hidden");

    const constraints = currentCallType === "video" 
        ? { audio: true, video: true } 
        : { audio: true };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    peerConnection = new RTCPeerConnection(rtcConfig);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Remote tracks
    if (currentCallType === "video") {
        peerConnection.ontrack = e => remoteVideo.srcObject = e.streams[0];
    } else {
        peerConnection.ontrack = e => remoteAudio.srcObject = e.streams[0];
    }

    peerConnection.onicecandidate = e => {
        if (e.candidate) {
            socket.send(JSON.stringify({ type: "ice_candidate", candidate: e.candidate }));
        }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingOffer));

    // Add queued ICE candidates
    for (const c of pendingIceCandidates) {
        await peerConnection.addIceCandidate(c);
    }
    pendingIceCandidates = [];

    // Send answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.send(JSON.stringify({ type: "call_answer", answer }));

    // ✅ Show the correct end button based on call type
    if (currentCallType === "video") {
        endVideoCallBtn.classList.remove("hidden");
        endCallBtn.classList.add("hidden");
    } else {
        endCallBtn.classList.remove("hidden");
        endVideoCallBtn.classList.add("hidden");
    }
};

    /* -------------------- Reject Call -------------------- */
    rejectCallBtn.onclick = () => {
        // unlock audio on reject click (user gesture) so future rings can play
        unlockAudio();
        if (ringTimeout) {
            clearTimeout(ringTimeout);
            ringTimeout = null;
        }
        stopCallTone();

        if (!incomingOffer) return;
        incomingCallBox.classList.add("hidden");
        socket.send(JSON.stringify({ type: "call_end" }));
        incomingOffer = null;
    };

    /* -------------------- End Call -------------------- */
    endCallBtn.onclick = () => endCallCleanup(true);
    endVideoCallBtn.onclick = () => endCallCleanup(true);

    function endCallCleanup(sendSignal = true) {
        // hide incoming call UI as well (covers remote hangup during ringing)
        if (incomingCallBox) incomingCallBox.classList.add("hidden");

        hideCallBox(); 
        peerConnection?.close();
        localStream?.getTracks().forEach(t => t.stop());

        stopCallTimer();

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

        callBtn.classList.remove("hidden");
        startVideoCallBtn.classList.remove("hidden");
        endCallBtn.classList.add("hidden");
        endVideoCallBtn.classList.add("hidden");
        callBox.classList.remove("video-mode");


        // Stop the ringtone whenever the call ends
        stopCallTone();

        if (sendSignal) {
            socket.send(JSON.stringify({ type: "call_end" }));
        }
    }


  // ----------- start AUDIO call ----------- //
callBtn.onclick = async () => {
    unlockAudio();
    isCaller = true;
    currentCallType = "audio";

    endCallBtn.classList.remove("hidden");
    callBtn.classList.add("hidden");
    startVideoCallBtn.classList.add("hidden");

    showCallBox("audio"); // <<< use this

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    peerConnection = new RTCPeerConnection(rtcConfig);
    localStream.getTracks().forEach(track =>
        peerConnection.addTrack(track, localStream)
    );
    peerConnection.ontrack = e => {
        remoteAudio.srcObject = e.streams[0];
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
        call_type: "audio"
    }));

    // ⏱ Caller side ring timeout
    ringTimeout = setTimeout(() => {
        console.log("📵 Call not answered (caller timeout)");

        stopCallTone();
        endCallCleanup(false);

        // ✅ Add system message bubble for missed call
        const { wrapper } = createBubbleDOM(
            { message: "📵 Audio call not answered", is_system: true },
            true
        );
        messagesBox.appendChild(wrapper);
        messagesBox.scrollTop = messagesBox.scrollHeight;

        // Optionally, notify the receiver (if needed)
        socket.send(JSON.stringify({
            type: "call_missed",
            call_type: "audio"
        }));

    }, RING_DURATION);
};



/* -------------------- Start Audio Call -------------------- */
callBtn.onclick = async () => startCall("audio");

/* -------------------- Start Video Call -------------------- */
startVideoCallBtn.onclick = async () => startCall("video");

/* -------------------- Unified Start Call -------------------- */
async function startCall(type) {
    unlockAudio();
    isCaller = true;
    currentCallType = type;

    showCallBox(type);

    if (type === "audio") {
        endCallBtn.classList.remove("hidden");
        callBtn.classList.add("hidden");
    } else {
        endVideoCallBtn.classList.remove("hidden");
        callBtn.classList.add("hidden");
        startVideoCallBtn.classList.add("hidden");
    }

    const constraints = type === "video" 
        ? { audio: true, video: true } 
        : { audio: true };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);

    if (type === "video") {
        localVideo.srcObject = localStream;
        localVideo.muted = true;
    }

    peerConnection = new RTCPeerConnection(rtcConfig);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = e => {
        if (type === "video") remoteVideo.srcObject = e.streams[0];
        else remoteAudio.srcObject = e.streams[0];
    };

    peerConnection.onicecandidate = e => {
        if (e.candidate) {
            socket.send(JSON.stringify({ type: "ice_candidate", candidate: e.candidate }));
        }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.send(JSON.stringify({
        type: "call_offer",
        offer,
        caller_id: CURRENT_USER_ID,
        call_type: type
    }));

    // Caller ring timeout
    ringTimeout = setTimeout(() => {
        console.log("📵 Call not answered (caller timeout)");
        stopCallTone();
        endCallCleanup(false);

        const { wrapper } = createBubbleDOM({
            message: `📵 ${type.charAt(0).toUpperCase() + type.slice(1)} call not answered`,
            is_system: true
        }, true);

        messagesBox.appendChild(wrapper);
        messagesBox.scrollTop = messagesBox.scrollHeight;

        socket.send(JSON.stringify({ type: "call_missed", call_type: type }));
    }, RING_DURATION);
}
    if (toggleMicBtn) {
        toggleMicBtn.onclick = () => {
            if (!localStream) return;

            micEnabled = !micEnabled;

            localStream.getAudioTracks().forEach(track => {
                track.enabled = micEnabled;
            });

            toggleMicBtn.textContent = micEnabled ? "🎤" : "🔇";
        };
    }

});

 