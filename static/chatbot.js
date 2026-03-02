// ---------------- DARK MODE ----------------
const darkModeToggle = document.getElementById("darkModeToggle");

// Load preference
if (darkModeToggle && localStorage.getItem("darkMode") === "enabled") {
  document.body.classList.add("dark");
  darkModeToggle.textContent = "☀";
}

// Toggle dark mode
if (darkModeToggle) {
  darkModeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    if (document.body.classList.contains("dark")) {
      localStorage.setItem("darkMode", "enabled");
      darkModeToggle.textContent = "☀";
    } else {
      localStorage.setItem("darkMode", "disabled");
      darkModeToggle.textContent = "🌙";
    }
  });
}

// ---------------- CHATBOT UI ----------------
const messagesDiv = document.getElementById("messages");
const inputBox = document.getElementById("user-input");
const sendBtn = document.getElementById("sendBtn");
const micBtn = document.getElementById("micBtn");

// Track chosen language
let selectedLanguage = "English";
let selectedLangCode = "en-IN";

if (inputBox) {
  inputBox.addEventListener("input", () => {
    sendBtn.disabled = inputBox.value.trim() === "";
  });
}

function appendMessage(text, sender) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", sender);
  msgDiv.textContent = text;
  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function showTyping() {
  const typingDiv = document.createElement("div");
  typingDiv.classList.add("message", "bot");
  typingDiv.textContent = "Typing...";
  typingDiv.id = "typing";
  messagesDiv.appendChild(typingDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function removeTyping() {
  const typingDiv = document.getElementById("typing");
  if (typingDiv) typingDiv.remove();
}

// ---------------- BACKGROUND MUSIC ----------------
const bgMusic = document.getElementById("bg-music");
const musicToggle = document.getElementById("musicToggle");

// volumes
let normalVolume = 0.05; // soft background volume
let duckVolume = 0.01;   // when bot speaks

function duckMusic() {
  if (bgMusic && !bgMusic.paused) {
    bgMusic.volume = duckVolume;
  }
}

function restoreMusic() {
  if (bgMusic && !bgMusic.paused) {
    bgMusic.volume = normalVolume;
  }
}

function playBgMusic() {
  if (bgMusic) {
    bgMusic.volume = normalVolume;
    bgMusic.play().then(() => {
      if (musicToggle) {
        musicToggle.textContent = "🔊";
        musicToggle.classList.add("active");
      }
    }).catch(err => {
      console.log("Autoplay blocked, waiting for user action:", err);
    });
  }
}

function pauseBgMusic() {
  if (bgMusic) {
    bgMusic.pause();
    if (musicToggle) {
      musicToggle.textContent = "🔇";
      musicToggle.classList.remove("active");
    }
  }
}

// Start music when user selects a language
document.querySelectorAll(".lang-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedLanguage = btn.dataset.lang;
    if (selectedLanguage === "Hindi") selectedLangCode = "hi-IN";
    else if (selectedLanguage === "Marathi") selectedLangCode = "mr-IN";
    else if (selectedLanguage === "Spanish") selectedLangCode = "es-ES";
    else selectedLangCode = "en-IN";

    document.querySelector(".language-options").style.display = "none";
    appendMessage(`Great! Let's talk in ${selectedLanguage}.`, "bot");

    playBgMusic(); // 🔥 Auto-start music
  });
});

// Music toggle button
if (musicToggle) {
  musicToggle.addEventListener("click", () => {
    if (bgMusic.paused) {
      playBgMusic();
    } else {
      pauseBgMusic();
    }
  });
}

// ---------------- HTTP helpers ----------------
async function callChatAPI(message) {
  const payload = {
    message: message,
    lang_name: selectedLanguage,
    lang_code: selectedLangCode
  };

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error("Chat API error: " + text);
  }
  return res.json();
}

// ---------------- Send text message flow ----------------
async function sendTextMessage() {
  if (!inputBox) return;
  const text = inputBox.value.trim();
  if (!text) return;

  appendMessage(text, "user");
  inputBox.value = "";
  sendBtn.disabled = true;

  showTyping();
  try {
    const data = await callChatAPI(text);
    removeTyping();
    appendMessage(data.reply, "bot");

    if (data.tts_base64) {
      const audio = new Audio("data:audio/mp3;base64," + data.tts_base64);
      duckMusic();
      await audio.play().catch(() => {});
      audio.onended = restoreMusic;
    } else if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(data.reply);
      u.lang = selectedLangCode;
      duckMusic();
      speechSynthesis.speak(u);
      u.onend = restoreMusic;
    }
  } catch (err) {
    removeTyping();
    appendMessage("⚠ Error: " + err.message, "bot");
    console.error(err);
  } finally {
    sendBtn.disabled = false;
  }
}

if (sendBtn) sendBtn.addEventListener("click", sendTextMessage);
if (inputBox) {
  inputBox.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !sendBtn.disabled) sendTextMessage();
  });
}

// ---------------- Microphone recording ----------------
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

function updateMicButtonState() {
  if (!micBtn) return;
  micBtn.classList.toggle("recording", isRecording);
  micBtn.textContent = isRecording ? "🎙️ Stop" : "🎤 Speak";
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    alert("Microphone not supported in this browser.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];

    // Check supported MIME type
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data?.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: mimeType });
      stopStream(stream);
      await sendAudioBlob(blob);
    };

    mediaRecorder.start();
    isRecording = true;
    updateMicButtonState();
  } catch (err) {
    console.error("getUserMedia error:", err);
    alert("Could not access microphone: " + err.message);
  }
}

function stopStream(stream) {
  stream.getTracks().forEach(track => track.stop());
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  isRecording = false;
  updateMicButtonState();
}

if (micBtn) {
  micBtn.addEventListener("click", () => {
    if (isRecording) stopRecording();
    else startRecording();
  });
}

// ---------------- Send audio to server ----------------
async function sendAudioBlob(blob) {
  showTyping();
  try {
    const form = new FormData();
    form.append("audio", blob, "voice.webm");

    const res = await fetch("/api/speech_to_text", {
      method: "POST",
      body: form
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error("Speech-to-text error: " + txt);
    }

    const json = await res.json();
    const recognized = json.text || "";

    if (!recognized) {
      removeTyping();
      appendMessage("⚠ Could not transcribe audio.", "bot");
      return;
    }

    appendMessage(recognized, "user");

    const data = await callChatAPI(recognized);
    removeTyping();
    appendMessage(data.reply, "bot");

    if (data.tts_base64) {
      const audio = new Audio("data:audio/mp3;base64," + data.tts_base64);
      duckMusic();
      await audio.play().catch(() => {});
      audio.onended = restoreMusic;
    } else if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(data.reply);
      u.lang = selectedLangCode;
      duckMusic();
      speechSynthesis.speak(u);
      u.onend = restoreMusic;
    }
  } catch (err) {
    removeTyping();
    appendMessage("⚠ Error with voice: " + (err.message || err), "bot");
    console.error(err);
  }
}




