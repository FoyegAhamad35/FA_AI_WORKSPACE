// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Global Variables
let isSpeaking = false;
let currentSpeechUtterance = null;
const STORAGE_KEY = 'faAiChatHistory';
const THEME_KEY = 'faAiTheme';

// Initialize App
function initializeApp() {
    setupEventListeners();
    loadTheme();
    loadChatHistory();
}

// Setup Event Listeners
function setupEventListeners() {
    // Send message
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Hamburger Menu
    const hamburger = document.getElementById('hamburger');
    hamburger.addEventListener('click', toggleSidebar);

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', toggleTheme);

    // Sidebar Navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            handleNavClick(this);
        });
    });
}

// Send Message
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const messageText = messageInput.value.trim();

    if (messageText === '') return;

    // Add user message
    addMessage(messageText, 'user');
    messageInput.value = '';

    // Save to history
    saveMessageToHistory(messageText, 'user');

    // Simulate AI typing
    setTimeout(() => {
        const aiReply = generateAIReply(messageText);
        addMessage(aiReply, 'bot');
        saveMessageToHistory(aiReply, 'bot');
    }, 800);
}

// Add Message to Chat
function addMessage(text, sender) {
    const messagesContainer = document.getElementById('messages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;

    messageDiv.appendChild(contentDiv);

    // Add action row only for bot messages
    if (sender === 'bot') {
        const actionRow = createActionRow();
        messageDiv.appendChild(actionRow);
    }

    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Create Action Row
function createActionRow() {
    const actionRow = document.createElement('div');
    actionRow.className = 'action-row';

    const actions = [
        { id: 'copy', icon: '📋', title: 'Copy' },
        { id: 'like', icon: '👍', title: 'Like' },
        { id: 'voice', icon: '🔊', title: 'Speak' },
        { id: 'share', icon: '🔗', title: 'Share' },
        { id: 'more', icon: '⋮', title: 'More' }
    ];

    actions.forEach(action => {
        const btn = document.createElement('button');
        btn.className = `action-btn ${action.id}-btn`;
        btn.title = action.title;
        btn.innerHTML = `<span>${action.icon}</span>`;
        btn.addEventListener('click', function() {
            handleActionClick(action.id, this, actionRow);
        });
        actionRow.appendChild(btn);
    });

    return actionRow;
}

// Handle Action Click
function handleActionClick(actionId, button, actionRow) {
    const messageContent = actionRow.previousElementSibling.textContent;

    switch(actionId) {
        case 'copy':
            copyToClipboard(messageContent, button);
            break;
        case 'like':
            toggleLike(button);
            break;
        case 'voice':
            toggleVoice(messageContent, button);
            break;
        case 'share':
            shareMessage(messageContent, button);
            break;
        case 'more':
            showMoreOptions(button);
            break;
    }
}

// Copy to Clipboard
function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        const originalEmoji = button.innerHTML;
        button.innerHTML = '<span>✓</span>';
        button.classList.add('active');

        setTimeout(() => {
            button.innerHTML = originalEmoji;
            button.classList.remove('active');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Toggle Like
function toggleLike(button) {
    button.classList.toggle('active');
}

// Toggle Voice (Speak/Stop)
function toggleVoice(text, button) {
    if (isSpeaking) {
        // Stop speaking
        speechSynthesis.cancel();
        isSpeaking = false;
        button.classList.remove('active');
        currentSpeechUtterance = null;
    } else {
        // Start speaking
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onstart = function() {
            isSpeaking = true;
            button.classList.add('active');
        };

        utterance.onend = function() {
            isSpeaking = false;
            button.classList.remove('active');
            currentSpeechUtterance = null;
        };

        utterance.onerror = function() {
            isSpeaking = false;
            button.classList.remove('active');
            currentSpeechUtterance = null;
        };

        currentSpeechUtterance = utterance;
        speechSynthesis.speak(utterance);
    }
}

// Share Message
function shareMessage(text, button) {
    const shareText = `FA AI Workspace: "${text}"`;
    
    if (navigator.share) {
        navigator.share({
            title: 'FA AI Workspace',
            text: shareText
        }).catch(err => console.log('Share cancelled'));
    } else {
        // Fallback: Copy share text
        navigator.clipboard.writeText(shareText).then(() => {
            const originalEmoji = button.innerHTML;
            button.innerHTML = '<span>✓</span>';
            button.classList.add('active');

            setTimeout(() => {
                button.innerHTML = originalEmoji;
                button.classList.remove('active');
            }, 2000);
        });
    }
}

// Show More Options
function showMoreOptions(button) {
    alert('More options coming soon!');
}

// Generate AI Reply (Demo)
function generateAIReply(userMessage) {
    const replies = [
        'That\'s an interesting question! I\'m analyzing your input.',
        'I understand what you\'re saying. This is a demo response.',
        'Great point! I\'m here to assist you with FA AI Workspace.',
        'Thank you for that message. I\'m a demo AI assistant.',
        'I appreciate your message. How can I help you further?',
        'That\'s wonderful! Tell me more about what you need.',
        'I\'m listening. This is a demonstration chatbot UI.',
        'Noted! I\'m ready to help you with your projects.'
    ];

    return replies[Math.floor(Math.random() * replies.length)];
}

// Theme Management
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = localStorage.getItem(THEME_KEY) || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    if (newTheme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }

    localStorage.setItem(THEME_KEY, newTheme);
}

// Load Theme
function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

// Hamburger Menu
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');

    // Close sidebar when clicking outside
    document.addEventListener('click', function closeSidebar(e) {
        if (!e.target.closest('.sidebar') && !e.target.closest('.hamburger')) {
            sidebar.classList.remove('active');
            document.removeEventListener('click', closeSidebar);
        }
    });
}

// Navigation
function handleNavClick(navItem) {
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Add active class to clicked item
    navItem.classList.add('active');

    // Close sidebar on mobile
    const sidebar = document.querySelector('.sidebar');
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('active');
    }

    const chatType = navItem.dataset.chat;
    
    if (chatType === 'new') {
        clearChat();
    } else if (chatType === 'history') {
        // History feature can be expanded in Phase 2
        alert('Chat history feature coming in Phase 2!');
    }
}

// Clear Chat
function clearChat() {
    const messagesContainer = document.getElementById('messages');
    messagesContainer.innerHTML = '';

    // Add initial bot message
    const initialMessage = 'Hello! I\'m FA AI Assistant. How can I help you today?';
    addMessage(initialMessage, 'bot');
    
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEY);
}

// Chat History Management
function saveMessageToHistory(text, sender) {
    let history = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    
    history.push({
        text: text,
        sender: sender,
        timestamp: new Date().toISOString()
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function loadChatHistory() {
    // Chat history will be loaded in Phase 2
    // For now, load initial greeting
    const messagesContainer = document.getElementById('messages');
    if (messagesContainer.children.length === 0) {
        const initialMessage = 'Hello! I\'m FA AI Assistant. How can I help you today?';
        addMessage(initialMessage, 'bot');
    }
}

// Handle Window Resize
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        document.querySelector('.sidebar').classList.remove('active');
    }
});
