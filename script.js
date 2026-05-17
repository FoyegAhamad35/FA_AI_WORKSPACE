"use strict";

const WORKER_API_URL = "https://fa-ai-workspace-api.foyegahamad35.workers.dev";

const STORAGE_KEY = "fa_ai_workspace_messages_context_v2";
const THEME_KEY = "fa_ai_workspace_theme_v1";

const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const stopBtn = document.getElementById("stopBtn");

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
let currentController = null;
let stopRequested = false;
let activeRequestId = 0;

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
  }, 1600);
}

function defaultMessages() {
  return [
    {
      id: createId(),
      role: "assistant",
      text: "Hello! I'm FA AI Assistant. Beautiful reply formatting is ready.",
      type: "normal",
      time: getTime()
    }
  ];
}

function loadMessages() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return defaultMessages();
    }

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

  if (status) {
    messageInput.disabled = true;
    sendBtn.disabled = true;
    sendBtn.classList.add("hidden");
    stopBtn.classList.remove("hidden");
    stopBtn.disabled = false;
  } else {
    messageInput.disabled = false;
    sendBtn.disabled = false;
    stopBtn.disabled = false;
    stopBtn.classList.add("hidden");
    sendBtn.classList.remove("hidden");
    currentController = null;
    stopRequested = false;
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

function appendInlineFormatted(parent, text) {
  const source = String(text || "");
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;

  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parent.appendChild(document.createTextNode(source.slice(lastIndex, match.index)));
    }

    if (match[2]) {
      const strong = document.createElement("strong");
      strong.textContent = match[2];
      parent.appendChild(strong);
    }

    if (match[3]) {
      const code = document.createElement("code");
      code.className = "inline-code";
      code.textContent = match[3];
      parent.appendChild(code);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < source.length) {
    parent.appendChild(document.createTextNode(source.slice(lastIndex)));
  }
}

function appendCodeBlock(container, codeText, language) {
  const block = document.createElement("div");
  block.className = "code-block";

  const label = document.createElement("div");
  label.className = "code-label";
  label.textContent = language ? language.toUpperCase() : "CODE";

  const pre = document.createElement("pre");
  const code = document.createElement("code");

  code.textContent = codeText.trimEnd();

  pre.appendChild(code);
  block.appendChild(label);
  block.appendChild(pre);
  container.appendChild(block);
}

function appendPlainFormatted(container, text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");

  let paragraphLines = [];
  let currentList = null;
  let currentListType = "";

  function flushParagraph() {
    const paragraphText = paragraphLines.join(" ").trim();

    if (paragraphText) {
      const p = document.createElement("p");
      appendInlineFormatted(p, paragraphText);
      container.appendChild(p);
    }

    paragraphLines = [];
  }

  function createList(type) {
    if (!currentList || currentListType !== type) {
      currentList = document.createElement(type);
      currentList.className = type === "ol" ? "number-list" : "bullet-list";
      currentListType = type;
      container.appendChild(currentList);
    }

    return currentList;
  }

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      currentList = null;
      currentListType = "";
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      currentList = null;
      currentListType = "";

      const heading = document.createElement("p");
      heading.className = "formatted-heading";
      appendInlineFormatted(heading, headingMatch[2]);
      container.appendChild(heading);
      return;
    }

    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();

      const list = createList("ul");
      const li = document.createElement("li");
      appendInlineFormatted(li, bulletMatch[1]);
      list.appendChild(li);
      return;
    }

    const numberMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (numberMatch) {
      flushParagraph();

      const list = createList("ol");
      const li = document.createElement("li");
      appendInlineFormatted(li, numberMatch[1]);
      list.appendChild(li);
      return;
    }

    currentList = null;
    currentListType = "";
    paragraphLines.push(trimmed);
  });

  flushParagraph();
}

function formatAssistantText(text) {
  const wrapper = document.createElement("div");
  wrapper.className = "formatted-content";

  const source = String(text || "");
  const codeFencePattern = /```([a-zA-Z0-9_-]*)\s*\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeFencePattern.exec(source)) !== null) {
    const before = source.slice(lastIndex, match.index);

    if (before.trim()) {
      appendPlainFormatted(wrapper, before);
    }

    appendCodeBlock(wrapper, match[2], match[1]);
    lastIndex = codeFencePattern.lastIndex;
  }

  const after = source.slice(lastIndex);

  if (after.trim()) {
    appendPlainFormatted(wrapper, after);
  }

  if (!wrapper.childNodes.length) {
    const p = document.createElement("p");
    p.textContent = source;
    wrapper.appendChild(p);
  }

  return wrapper;
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

    if (message.role === "assistant" && message.type !== "error") {
      bubble.classList.add("formatted");
      bubble.appendChild(formatAssistantText(message.text));
    } else {
      bubble.textContent = message.text;
    }

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

  if (typingMessage) {
    typingMessage.remove();
  }
}

function normalizeRole(role) {
  if (role === "user") return "user";
  if (role === "assistant") return "assistant";
  return null;
}

function buildRecentContext() {
  return messages
    .filter((message) => {
      return (
        normalizeRole(message.role) &&
        message.type !== "error" &&
        typeof message.text === "string" &&
        message.text.trim().length > 0
      );
    })
    .slice(-14)
    .map((message) => ({
      role: normalizeRole(message.role),
      content: message.text.trim().slice(0, 1200)
    }));
}

function stopGenerating() {
  if (!isBusy || !currentController) {
    return;
  }

  stopRequested = true;
  stopBtn.disabled = true;
  hideTyping();
  showToast("Stopped");
  currentController.abort();
}

function getFriendlyError(error) {
  const message = String(error?.message || "").toLowerCase();

  if (stopRequested || error?.name === "AbortError") {
    return "";
  }

  if (message.includes("timed out") || message.includes("timeout")) {
    return "Request timed out. Please try again.";
  }

  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Network connection problem. Please check internet and try again.";
  }

  if (message.includes("429")) {
    return "AI service is busy or rate limited. Please wait a moment and try again.";
  }

  if (message.includes("401") || message.includes("403") || message.includes("api key")) {
    return "AI connection permission problem. Please check the Worker API key secret.";
  }

  if (message.includes("500") || message.includes("502") || message.includes("503") || message.includes("504")) {
    return "AI server is temporarily unavailable. Please try again shortly.";
  }

  if (error?.message) {
    return `AI connection error: ${error.message}`;
  }

  return "AI connection error. Please try again.";
}

async function getAIResponse(userText) {
  const cleanText = userText.trim();

  if (cleanText.length < 2) {
    return "Please write a little more so I can understand your message.";
  }

  const recentContext = buildRecentContext();
  const controller = new AbortController();

  currentController = controller;

  let timeoutTriggered = false;

  const timeoutId = setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, 30000);

  try {
    const response = await fetch(WORKER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: cleanText,
        messages: recentContext
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok || !data.ok) {
      const error = new Error(data.error || `Worker error: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return data.reply || "AI response received, but no text was returned.";
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      if (timeoutTriggered) {
        throw new Error("Request timed out. Please try again.");
      }

      throw error;
    }

    throw error;
  }
}

function resetChat() {
  activeRequestId += 1;

  if (currentController) {
    stopRequested = true;
    currentController.abort();
  }

  stopVoice();
  hideTyping();
  messages = defaultMessages();
  saveMessages();
  renderMessages();
  setBusy(false);
}

async function handleSubmit(event) {
  event.preventDefault();

  if (isBusy) return;

  const text = messageInput.value.trim();

  if (!text) return;

  const requestId = activeRequestId + 1;
  activeRequestId = requestId;

  addMessage("user", text);
  messageInput.value = "";

  setBusy(true);
  showTyping();

  try {
    const reply = await getAIResponse(text);

    if (requestId !== activeRequestId) {
      return;
    }

    hideTyping();

    if (!stopRequested) {
      addMessage("assistant", reply);
    }
  } catch (error) {
    if (requestId !== activeRequestId) {
      return;
    }

    hideTyping();

    const friendlyError = getFriendlyError(error);

    if (friendlyError) {
      addMessage("assistant", friendlyError, "error");
    }
  } finally {
    if (requestId === activeRequestId) {
      setBusy(false);
    }
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
  setBusy(false);

  chatForm.addEventListener("submit", handleSubmit);
  messagesEl.addEventListener("click", handleActionClick);

  stopBtn.addEventListener("click", stopGenerating);

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
    if (document.hidden) {
      stopVoice();
    }
  });
}

init();
