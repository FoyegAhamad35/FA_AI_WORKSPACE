"use strict";

const WORKER_API_URL = "https://fa-ai-workspace-api.foyegahamad35.workers.dev";

const STORAGE_KEY = "fa_ai_workspace_messages_worker_v1";
const THEME_KEY = "fa_ai_workspace_theme_v1";

const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const themeBtn = document.getElementById("themeBtn");
const drawerThemeBtn = document.getElementById("drawerThemeBtn");

const menuBtn = document.getElementById("menuBtn");
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const closeDrawerBtn = document.getElementById("closeDrawerBtn");
const newChatBtn = document.getElementById("newChatBtn");
const clearChatBtn = document.getElementById("clearChatBtn");

const toastEl = document.getElementById("toast");

let messages = [];
let speakingMessageId = null;
let toastTimer = null;
let isBusy = false;

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function setMobileHeight() {
  document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
}

function getTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function showToast(text) {
  clearTimeout(toastTimer);
  toastEl.textContent = text;
  toastEl.classList.add("show");

  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 1500);
}

function defaultMessages() {
  return [
    {
      id: createId(),
      role: "assistant",
      text: "Hello! I'm FA AI Assistant. Cloudflare Worker connection is ready.",
      time: getTime()
    }
  ];
}

function loadMessages() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultMessages();

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultMessages();
    }

    return parsed;
  } catch {
    return defaultMessages();
  }
}

function saveMessages() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const theme = savedTheme === "light" ? "light" : "dark";
  applyTheme(theme);
}

function applyTheme(theme) {
  const isLight = theme === "light";

  document.body.classList.toggle("light", isLight);
  themeBtn.textContent = isLight ? "☀️" : "🌙";
  drawerThemeBtn.textContent = isLight ? "☀️ Light Theme" : "🌙 Dark Theme";

  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const isLight = document.body.classList.contains("light");
  applyTheme(isLight ? "dark" : "light");
}

function openDrawer() {
  drawer.classList.add("open");
  drawerOverlay.classList.add("show");
  drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawerOverlay.classList.remove("show");
  drawer.setAttribute("aria-hidden", "true");
}

function setBusy(status) {
  isBusy = status;
  messageInput.disabled = status;
  sendBtn.disabled = status;
  sendBtn.textContent = status ? "…" : "➤";

  if (!status) {
    messageInput.focus();
  }
}

function addMessage(role, text, type = "normal") {
  messages.push({
    id: createId(),
    role,
    text,
    type,
    time: getTime()
  });

  saveMessages();
  renderMessages();
}

function renderMessages() {
  messagesEl.innerHTML = "";

  messages.forEach((message) => {
    const article = document.createElement("article");
    article.className = `message ${message.role}`;

    if (message.type === "error") {
      article.classList.add("error");
    }

    article.dataset.id = message.id;

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = message.text;

    const time = document.createElement("div");
    time.className = "message-time";
    time.textContent = message.time || getTime();

    article.appendChild(bubble);
    article.appendChild(time);

    if (message.role === "assistant") {
      article.appendChild(createActionRow(message));
    }

    messagesEl.appendChild(article);
  });

  updateVoiceButtons();
  scrollToBottom();
}

function createActionRow(message) {
  const row = document.createElement("div");
  row.className = "action-row";

  const actions = [
    { action: "copy", icon: "📋", title: "Copy" },
    { action: "like", icon: "👍", title: "Like" },
    { action: "voice", icon: "🔊", title: "Voice" },
    { action: "share", icon: "🔗", title: "Share" },
    { action: "more", icon: "⋮", title: "More" }
  ];

  actions.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action-btn ${item.action}-btn`;
    button.dataset.action = item.action;
    button.dataset.messageId = message.id;
    button.title = item.title;
    button.setAttribute("aria-label", item.title);
    button.textContent = item.icon;

    row.appendChild(button);
  });

  return row;
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

function getMessageById(id) {
  return messages.find((message) => message.id === id);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      showToast("Copied");
      return;
    }

    const temp = document.createElement("textarea");
    temp.value = text;
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.focus();
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);

    showToast("Copied");
  } catch {
    showToast("Copy failed");
  }
}

function stopVoice() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  speakingMessageId = null;
  updateVoiceButtons();
}

function speakText(message) {
  if (!("speechSynthesis" in window)) {
    showToast("Voice not supported");
    return;
  }

  if (speakingMessageId === message.id) {
    stopVoice();
    return;
  }

  stopVoice();

  const utterance = new SpeechSynthesisUtterance(message.text);
  utterance.lang = "en-US";
  utterance.rate = 1;
  utterance.pitch = 1;

  speakingMessageId = message.id;
  updateVoiceButtons();

  utterance.onend = () => {
    speakingMessageId = null;
    updateVoiceButtons();
  };

  utterance.onerror = () => {
    speakingMessageId = null;
    updateVoiceButtons();
    showToast("Voice stopped");
  };

  window.speechSynthesis.speak(utterance);
}

function updateVoiceButtons() {
  const buttons = document.querySelectorAll(".voice-btn");

  buttons.forEach((button) => {
    const isActive = button.dataset.messageId === speakingMessageId;
    button.classList.toggle("active", isActive);
    button.textContent = isActive ? "⏹️" : "🔊";
    button.title = isActive ? "Stop voice" : "Speak";
  });
}

async function shareText(text) {
  try {
    if (navigator.share) {
      await navigator.share({
        title: "FA AI WORKSPACE",
        text
      });
      return;
    }

    await copyText(text);
    showToast("Share copied");
  } catch {
    showToast("Share cancelled");
  }
}

function showTyping() {
  const typingMessage = document.createElement("article");
  typingMessage.className = "message assistant";
  typingMessage.id = "typingMessage";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const typing = document.createElement("div");
  typing.className = "typing";
  typing.innerHTML = "<span></span><span></span><span></span>";

  bubble.appendChild(typing);
  typingMessage.appendChild(bubble);
  messagesEl.appendChild(typingMessage);

  scrollToBottom();
}

function hideTyping() {
  const typingMessage = document.getElementById("typingMessage");
  if (typingMessage) typingMessage.remove();
}

async function getAIResponse(userText) {
  const cleanText = userText.trim();

  if (cleanText.length < 2) {
    return "Please write a little more so I can understand your message.";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(WORKER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: cleanText
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Worker error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "Worker returned failed response");
    }

    return data.reply || "Worker connected, but no reply was returned.";
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new Error("Worker request timed out. Please try again.");
    }

    throw error;
  }
}

function resetChat() {
  stopVoice();
  messages = defaultMessages();
  saveMessages();
  renderMessages();
}

async function handleSubmit(event) {
  event.preventDefault();

  if (isBusy) return;

  const text = messageInput.value.trim();
  if (!text) return;

  addMessage("user", text);
  messageInput.value = "";

  setBusy(true);
  showTyping();

  try {
    const reply = await getAIResponse(text);
    hideTyping();
    addMessage("assistant", reply);
  } catch (error) {
    console.error(error);
    hideTyping();
    addMessage(
      "assistant",
      "Cloudflare Worker connection failed. Please check the Worker URL and try again.",
      "error"
    );
  } finally {
    setBusy(false);
  }
}

function handleActionClick(event) {
  const button = event.target.closest(".action-btn");
  if (!button) return;

  const action = button.dataset.action;
  const messageId = button.dataset.messageId;
  const message = getMessageById(messageId);

  if (!message) return;

  if (action === "copy") {
    copyText(message.text);
  }

  if (action === "like") {
    button.classList.toggle("active");
    showToast(button.classList.contains("active") ? "Liked" : "Like removed");
  }

  if (action === "voice") {
    speakText(message);
  }

  if (action === "share") {
    shareText(message.text);
  }

  if (action === "more") {
    showToast("More options later");
  }
}

function init() {
  setMobileHeight();
  loadTheme();

  messages = loadMessages();
  renderMessages();

  chatForm.addEventListener("submit", handleSubmit);
  messagesEl.addEventListener("click", handleActionClick);

  themeBtn.addEventListener("click", toggleTheme);
  drawerThemeBtn.addEventListener("click", toggleTheme);

  menuBtn.addEventListener("click", openDrawer);
  closeDrawerBtn.addEventListener("click", closeDrawer);
  drawerOverlay.addEventListener("click", closeDrawer);

  newChatBtn.addEventListener("click", () => {
    resetChat();
    closeDrawer();
    showToast("New chat started");
  });

  clearChatBtn.addEventListener("click", () => {
    resetChat();
    closeDrawer();
    showToast("Chat cleared");
  });

  window.addEventListener("resize", setMobileHeight);

  window.addEventListener("orientationchange", () => {
    setTimeout(setMobileHeight, 250);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopVoice();
  });
}

init();
