// ==========================================
// CHAT.JS - Frontend code for GitHub
// Will be served via jsDelivr CDN
// ==========================================

const SchoolChat = (function() {
  'use strict';

  // ==========================================
  // SETTINGS - Enter your Apps Script URL here
  // ==========================================
  const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbztNxlj_LViNsErpRkkzM5oLVeHvkqCB1PPBkjxh9HQsdA836fYx_L28n3wZvkRY59g/exec',
    POLL_INTERVAL: 3000, // Message check interval (3 seconds)
    MAX_USERNAME_LENGTH: 20,
    MAX_MESSAGE_LENGTH: 500
  };

  // ==========================================
  // STATE
  // ==========================================
  let state = {
    username: '',
    currentRoom: 'general',
    lastTimestamp: 0,
    pollTimer: null,
    isConnected: false,
    displayedTimestamps: new Set() // Track displayed messages
  };

  // ==========================================
  // DOM ELEMENTS
  // ==========================================
  let elements = {};

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('Chat container not found:', containerId);
      return;
    }

    // Check for saved username
    state.username = localStorage.getItem('chatUsername') || '';

    // Build UI
    renderUI(container);

    // If username exists, go directly to chat
    if (state.username) {
      showChatScreen();
      startPolling();
    }
  }

  // ==========================================
  // UI RENDER
  // ==========================================
  function renderUI(container) {
    container.innerHTML = `
      <div class="school-chat">
        <!-- Login Screen -->
        <div id="chat-login" class="chat-screen">
          <div class="chat-login-box">
            <h2>💬 School Chat</h2>
            <p>Choose a nickname to join the chat</p>
            <input 
              type="text" 
              id="username-input" 
              placeholder="Your nickname..." 
              maxlength="${CONFIG.MAX_USERNAME_LENGTH}"
              autocomplete="off"
            >
            <button id="join-btn">Join</button>
          </div>
        </div>

        <!-- Chat Screen -->
        <div id="chat-main" class="chat-screen" style="display: none;">
          <!-- Header -->
          <div class="chat-header">
            <div class="chat-room-info">
              <span class="chat-room-name">#<span id="room-name">general</span></span>
              <span class="chat-user-badge" id="user-badge"></span>
            </div>
            <div class="chat-header-actions">
              <select id="room-select">
                <option value="general">🏠 General</option>
                <option value="games">🎮 Games</option>
                <option value="homework">📚 Homework Help</option>
                <option value="music">🎵 Music</option>
              </select>
              <button id="logout-btn" title="Logout">🚪</button>
            </div>
          </div>

          <!-- Messages -->
          <div class="chat-messages" id="chat-messages">
            <div class="chat-welcome">
              <p>👋 Welcome to the chat!</p>
              <p class="chat-rules">Be respectful and follow the rules.</p>
            </div>
          </div>

          <!-- Connection Status -->
          <div class="chat-status" id="chat-status">
            <span class="status-dot"></span>
            <span class="status-text">Connecting...</span>
          </div>

          <!-- Message Input -->
          <div class="chat-input-area">
            <input 
              type="text" 
              id="message-input" 
              placeholder="Type your message..." 
              maxlength="${CONFIG.MAX_MESSAGE_LENGTH}"
              autocomplete="off"
            >
            <button id="send-btn">Send</button>
          </div>
        </div>
      </div>
    `;

    // Save element references
    elements = {
      loginScreen: container.querySelector('#chat-login'),
      mainScreen: container.querySelector('#chat-main'),
      usernameInput: container.querySelector('#username-input'),
      joinBtn: container.querySelector('#join-btn'),
      roomSelect: container.querySelector('#room-select'),
      roomName: container.querySelector('#room-name'),
      userBadge: container.querySelector('#user-badge'),
      logoutBtn: container.querySelector('#logout-btn'),
      messagesContainer: container.querySelector('#chat-messages'),
      messageInput: container.querySelector('#message-input'),
      sendBtn: container.querySelector('#send-btn'),
      status: container.querySelector('#chat-status')
    };

    // Event listeners
    bindEvents();
  }

  // ==========================================
  // EVENT BINDINGS
  // ==========================================
  function bindEvents() {
    // Login
    elements.joinBtn.addEventListener('click', handleJoin);
    elements.usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleJoin();
    });

    // Send message
    elements.sendBtn.addEventListener('click', handleSend);
    elements.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSend();
    });

    // Room change
    elements.roomSelect.addEventListener('change', handleRoomChange);

    // Logout
    elements.logoutBtn.addEventListener('click', handleLogout);
  }

  // ==========================================
  // HANDLERS
  // ==========================================
  function handleJoin() {
    const username = elements.usernameInput.value.trim();
    
    if (!username) {
      shakeElement(elements.usernameInput);
      return;
    }

    if (username.length < 2) {
      alert('Nickname must be at least 2 characters');
      return;
    }

    state.username = username;
    localStorage.setItem('chatUsername', username);
    
    showChatScreen();
    startPolling();
  }

  function handleSend() {
    const message = elements.messageInput.value.trim();
    
    if (!message) return;

    // Clear input and disable
    elements.messageInput.value = '';
    elements.messageInput.disabled = true;
    elements.sendBtn.disabled = true;

    sendMessage(message)
      .then(() => {
        // Success - wait a bit then refresh messages
        setTimeout(fetchMessages, 500);
      })
      .catch((error) => {
        console.error('Failed to send message:', error);
        // Restore message
        elements.messageInput.value = message;
        alert('Failed to send message. Please try again.');
      })
      .finally(() => {
        elements.messageInput.disabled = false;
        elements.sendBtn.disabled = false;
        elements.messageInput.focus();
      });
  }

  function handleRoomChange() {
    const newRoom = elements.roomSelect.value;
    state.currentRoom = newRoom;
    state.lastTimestamp = 0;
    state.displayedTimestamps.clear(); // Clear displayed messages for new room
    elements.roomName.textContent = newRoom;
    
    // Clear messages
    elements.messagesContainer.innerHTML = `
      <div class="chat-welcome">
        <p>📍 You joined #${newRoom}</p>
      </div>
    `;
    
    // Fetch new room messages
    fetchMessages();
  }

  function handleLogout() {
    stopPolling();
    state.username = '';
    state.lastTimestamp = 0;
    state.displayedTimestamps.clear();
    localStorage.removeItem('chatUsername');
    
    elements.loginScreen.style.display = 'flex';
    elements.mainScreen.style.display = 'none';
    elements.usernameInput.value = '';
  }

  // ==========================================
  // SCREEN TRANSITIONS
  // ==========================================
  function showChatScreen() {
    elements.loginScreen.style.display = 'none';
    elements.mainScreen.style.display = 'flex';
    elements.userBadge.textContent = state.username;
    elements.messageInput.focus();
  }

  // ==========================================
  // API CALLS
  // ==========================================
  async function sendMessage(message) {
    await fetch(CONFIG.API_URL, {
      method: 'POST',
      mode: 'no-cors', // For CORS bypass
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        room: state.currentRoom,
        username: state.username,
        message: message
      })
    });

    // In no-cors mode response is unreadable, but message is sent
    return true;
  }

  async function fetchMessages() {
    try {
      const url = `${CONFIG.API_URL}?room=${encodeURIComponent(state.currentRoom)}&since=${state.lastTimestamp}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.messages) {
        updateConnectionStatus(true);
        
        if (data.messages.length > 0) {
          // Filter out already displayed messages
          const newMessages = data.messages.filter(msg => {
            return !state.displayedTimestamps.has(msg.timestamp);
          });
          
          if (newMessages.length > 0) {
            renderMessages(newMessages);
            
            // Mark these messages as displayed
            newMessages.forEach(msg => {
              state.displayedTimestamps.add(msg.timestamp);
            });
            
            // Update last timestamp
            state.lastTimestamp = data.messages[data.messages.length - 1].timestamp;
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      updateConnectionStatus(false);
    }
  }

  // ==========================================
  // POLLING
  // ==========================================
  function startPolling() {
    // Initial load
    fetchMessages();
    
    // Periodic check
    state.pollTimer = setInterval(fetchMessages, CONFIG.POLL_INTERVAL);
  }

  function stopPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  // ==========================================
  // UI UPDATES
  // ==========================================
  function renderMessages(messages) {
    messages.forEach(msg => {
      const isOwn = msg.username === state.username;
      const time = new Date(msg.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const messageEl = document.createElement('div');
      messageEl.className = `chat-message ${isOwn ? 'own' : ''}`;
      messageEl.dataset.timestamp = msg.timestamp;
      messageEl.innerHTML = `
        <div class="message-header">
          <span class="message-author">${escapeHtml(msg.username)}</span>
          <span class="message-time">${time}</span>
        </div>
        <div class="message-content">${escapeHtml(msg.message)}</div>
      `;

      elements.messagesContainer.appendChild(messageEl);
    });

    // Scroll to bottom
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
  }

  function updateConnectionStatus(connected) {
    state.isConnected = connected;
    elements.status.className = `chat-status ${connected ? 'connected' : 'disconnected'}`;
    elements.status.querySelector('.status-text').textContent = 
      connected ? 'Connected' : 'Connection lost...';
  }

  // ==========================================
  // UTILITIES
  // ==========================================
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function shakeElement(el) {
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 500);
  }

  // ==========================================
  // PUBLIC API
  // ==========================================
  return {
    init: init,
    setApiUrl: function(url) {
      CONFIG.API_URL = url;
    }
  };

})();

// Auto-init if container exists
document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('school-chat-container');
  if (container) {
    SchoolChat.init('school-chat-container');
  }
});