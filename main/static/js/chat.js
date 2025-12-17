// static/js/chat.js
// Safe globals expected: OTHER_USER_ID, CURRENT_USER_ID

const WS_PROTOCOL = location.protocol === "https:" ? "wss" : "ws";
const WS_URL = `${WS_PROTOCOL}://${location.host}/ws/chat/${OTHER_USER_ID}/`;

let socket;
let reconnectDelay = 1000;
let shouldReconnect = true;
let pendingClientMap = {};

// voice recording state
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let holdTimer = null;
let currentClientIdForRecording = null;

async function startRecording() {
    if (isRecording) return;

    isRecording = true;
    audioChunks = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);

    const clientId = "c_" + Math.random().toString(36).slice(2, 10);
    currentClientIdForRecording = clientId;

    // pending bubble
    const temp = {
        message: "🎙 Recording...",
        client_id: clientId,
        timestamp: new Date().toISOString(),
        status: "sent"
    };
    const { wrapper, bubble } = createBubbleDOM(temp, true);
    messagesBox.appendChild(wrapper);
    pendingClientMap[clientId] = bubble;
    messagesBox.scrollTop = messagesBox.scrollHeight;

    mediaRecorder.ondataavailable = e => {
        if (e.data.size) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
        if (!audioChunks.length) {
            isRecording = false;
            return;
        }

        const blob = new Blob(audioChunks, { type: "audio/webm" });
        const reader = new FileReader();

        reader.onloadend = () => {
            socket.send(JSON.stringify({
                type: "voice_note",
                audio: reader.result,
                client_id: currentClientIdForRecording
            }));
        };

        reader.readAsDataURL(blob);
        isRecording = false;
    };

    mediaRecorder.start();
}

function stopRecording() {
    if (!mediaRecorder) return;
    if (mediaRecorder.state === "recording") {
        mediaRecorder.stop();
    }
}


// --------------------- WebSocket ---------------------
function connect() {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
        console.log("WS Connected");
        reconnectDelay = 1000;
    };

    socket.onclose = () => {
        if (shouldReconnect) {
            setTimeout(connect, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
        }
    };

    socket.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === "message") handleIncomingMessage(data);
        if (data.type === "delivery") handleDeliveryAck(data.msg_ids, data.status);
    };
}
connect();

// --------------------- UI helpers ---------------------
const messagesBox = document.getElementById("messages");

function formatTS(iso) {
    const d = new Date(iso);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function statusIcon(status) {
    if (status === "sent") return "✓";
    if (status === "delivered") return "✓✓";
    if (status === "seen") return "✓✓ seen";
    return "";
}

// --------------------- Bubble DOM ---------------------
function createBubbleDOM(payload, isMine) {
    const wrapper = document.createElement("div");
    wrapper.className = "w-full flex " + (isMine ? "justify-end" : "justify-start");

    const bubble = document.createElement("article");
    bubble.className =
        "max-w-[75%] p-3 rounded-xl " +
        (isMine ? "bg-blue-600 text-white" : "bg-slate-700 text-white");

    if (payload.msg_id) bubble.dataset.msgId = payload.msg_id;
    if (payload.client_id) bubble.dataset.clientId = payload.client_id;

    if (payload.voice_note) {
        bubble.innerHTML = `
            <audio controls src="${payload.voice_note}"></audio>
            <div class="text-xs text-right mt-1">
                <span class="msg-ts">${formatTS(payload.timestamp)}</span>
                ${isMine ? `<span class="msg-status ml-2">${statusIcon(payload.status)}</span>` : ""}
            </div>
        `;
    } else {
        bubble.innerHTML = `
            <div>${payload.message || ""}</div>
            <div class="text-xs text-right mt-1">
                <span class="msg-ts">${formatTS(payload.timestamp)}</span>
                ${isMine ? `<span class="msg-status ml-2">${statusIcon(payload.status)}</span>` : ""}
            </div>
        `;
    }

    wrapper.appendChild(bubble);
    return { wrapper, bubble };
}

// --------------------- Incoming messages ---------------------
function handleIncomingMessage(data) {
    const isMine = data.sender_id == CURRENT_USER_ID;

    // ✅ PATCH ONLY IF PENDING EXISTS
    if (data.client_id && pendingClientMap[data.client_id]) {
        const bubble = pendingClientMap[data.client_id];

        // ✅ VOICE NOTE ONLY
        if (data.voice_note) {
            bubble.innerHTML = `
                <audio controls src="${data.voice_note}"></audio>
                <div class="text-xs text-right mt-1">
                    <span class="msg-ts">${formatTS(data.timestamp)}</span>
                    ${isMine ? `<span class="msg-status ml-2">${statusIcon(data.status)}</span>` : ""}
                </div>
            `;
        }

        // ✅ TEXT MESSAGE
        else {
            bubble.innerHTML = `
                <div>${data.message || ""}</div>
                <div class="text-xs text-right mt-1">
                    <span class="msg-ts">${formatTS(data.timestamp)}</span>
                    ${isMine ? `<span class="msg-status ml-2">${statusIcon(data.status)}</span>` : ""}
                </div>
            `;
        }

        delete pendingClientMap[data.client_id];
        messagesBox.scrollTop = messagesBox.scrollHeight;
        return;
    }

    // ✅ NEW MESSAGE (NO PENDING)
    const payload = {
        message: data.message,
        voice_note: data.voice_note,
        timestamp: data.timestamp,
        msg_id: data.msg_id,
        status: data.status,
        client_id: data.client_id
    };

    const { wrapper } = createBubbleDOM(payload, isMine);
    messagesBox.appendChild(wrapper);
    messagesBox.scrollTop = messagesBox.scrollHeight;
}


// --------------------- Text sending ---------------------
function sendWithClientId(payload) {
    const client_id = "c_" + Math.random().toString(36).slice(2, 10);
    payload.client_id = client_id;

    const temp = {
        message: payload.message,
        client_id,
        timestamp: new Date().toISOString(),
        status: "sent"
    };

    const { wrapper, bubble } = createBubbleDOM(temp, true);
    messagesBox.appendChild(wrapper);
    pendingClientMap[client_id] = bubble;

    socket.send(JSON.stringify(payload));
}

document.getElementById("sendBtn").onclick = () => {
    const input = document.getElementById("messageInput");
    if (!input.value.trim()) return;
    sendWithClientId({ type: "text", message: input.value.trim() });
    input.value = "";
};

// --------------------- VOICE NOTE (FINAL FIX) ---------------------
async function startRecording() {
    if (isRecording) return;
    isRecording = true;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    const clientId = "c_" + Math.random().toString(36).slice(2, 10);
    currentClientIdForRecording = clientId;

    // pending bubble
    const temp = {
        message: "🎙 Recording...",
        client_id: clientId,
        timestamp: new Date().toISOString(),
        status: "sent"
    };
    const { wrapper, bubble } = createBubbleDOM(temp, true);
    messagesBox.appendChild(wrapper);
    pendingClientMap[clientId] = bubble;
    messagesBox.scrollTop = messagesBox.scrollHeight;

    mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
        if (!audioChunks.length) {
            isRecording = false;
            return;
        }

        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        const reader = new FileReader();

        reader.onloadend = () => {
            socket.send(JSON.stringify({
                type: "voice_note",
                audio: reader.result,
                client_id: currentClientIdForRecording
            }));
        };

        reader.readAsDataURL(audioBlob);
        isRecording = false;
    };

    mediaRecorder.start();
}

function stopRecording() {
    if (!isRecording) return;

    // prevent double stop
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
}


// --------------------- HOLD TO RECORD (FIXED) ---------------------
// mouse
recordBtn.addEventListener("mousedown", () => {
    holdTimer = setTimeout(startRecording, 180);
});

recordBtn.addEventListener("mouseup", stopRecording);
recordBtn.addEventListener("mouseleave", stopRecording);

// touch
recordBtn.addEventListener("touchstart", e => {
    e.preventDefault();
    holdTimer = setTimeout(startRecording, 180);
}, { passive: false });

recordBtn.addEventListener("touchend", e => {
    e.preventDefault();
    clearTimeout(holdTimer);
    stopRecording();
}, { passive: false });

recordBtn.addEventListener("touchcancel", stopRecording);



