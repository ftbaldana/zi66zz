// ==========================================
// CHAT.JS - OPTIMIZED VERSION
// ==========================================

const SchoolChat = (function() {
  'use strict';

  const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbzUGrNW2FihF4Lq9jf20YPQTrFsmtXbq93RI81ulHSNRh5kfaUix9lQww5qsT2PeBuN/exec',
    POLL_INTERVAL: 5000, // 5 seconds (was 3)
    RETRY_DELAY: 10000,  // 10 seconds on error
    MAX_RETRIES: 3,
    MAX_USERNAME_LENGTH: 20,
    MAX_MESSAGE_LENGTH: 500
  };

  let state = {
    username: '',
    currentRoom: 'general',
    lastTimestamp: 0,
    pollTimer: null,
    isConnected: false,
    displayedTimestamps: new Set(),
    retryCount: 0,
    isFetching: false // Prevent overlapping requests
  };

  let elements = {};

  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('Chat container not found:', containerId);
      return;
    }

    state.username = localStorage.getItem('chatUsername') || '';
    renderUI(container);

    if (state.username) {
      showChatScreen();
      startPolling();
    }
  }

  function renderUI(container) {
    container.innerHTML = `
      <div class="school-chat">
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

        <div id="chat-main" class="chat-screen" style="display: none;">
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

          <div class="chat-messages" id="chat-messages">
            <div class="chat-welcome">
              <p>👋 Welcome to the chat!</p>
              <p class="chat-rules">Be respectful and follow the rules.</p>
            </div>
          </div>

          <div class="chat-status" id="chat-status">
            <span class="status-dot"></span>
            <span class="status-text">Connecting...</span>
          </div>

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

    bindEvents();
  }

  function bindEvents() {
    elements.joinBtn.addEventListener('click', handleJoin);
    elements.usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleJoin();
    });

    elements.sendBtn.addEventListener('click', handleSend);
    elements.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSend();
    });

    elements.roomSelect.addEventListener('change', handleRoomChange);
    elements.logoutBtn.addEventListener('click', handleLogout);
  }

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
    state.displayedTimestamps.clear();
    state.lastTimestamp = 0;
    state.retryCount = 0;
    localStorage.setItem('chatUsername', username);
    
    showChatScreen();
    startPolling();
  }

  function handleSend() {
    const message = elements.messageInput.value.trim();
    if (!message) return;

    elements.messageInput.value = '';
    elements.messageInput.disabled = true;
    elements.sendBtn.disabled = true;

    sendMessage(message)
      .then(() => {
        setTimeout(fetchMessages, 800);
      })
      .catch((error) => {
        console.error('Failed to send:', error);
        elements.messageInput.value = message;
        alert('Failed to send. Please try again.');
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
    state.displayedTimestamps.clear();
    elements.roomName.textContent = newRoom;
    
    elements.messagesContainer.innerHTML = `
      <div class="chat-welcome">
        <p>📍 You joined #${newRoom}</p>
      </div>
    `;
    
    fetchMessages();
  }

  function handleLogout() {
    stopPolling();
    state.username = '';
    state.lastTimestamp = 0;
    state.displayedTimestamps.clear();
    state.retryCount = 0;
    localStorage.removeItem('chatUsername');
    
    elements.messagesContainer.innerHTML = `
      <div class="chat-welcome">
        <p>👋 Welcome to the chat!</p>
        <p class="chat-rules">Be respectful and follow the rules.</p>
      </div>
    `;
    
    elements.loginScreen.style.display = 'flex';
    elements.mainScreen.style.display = 'none';
    elements.usernameInput.value = '';
  }

  function showChatScreen() {
    elements.loginScreen.style.display = 'none';
    elements.mainScreen.style.display = 'flex';
    elements.userBadge.textContent = state.username;
    elements.messageInput.focus();
    
    elements.messagesContainer.innerHTML = `
      <div class="chat-welcome">
        <p>👋 Welcome, ${escapeHtml(state.username)}!</p>
        <p class="chat-rules">Be respectful and follow the rules.</p>
      </div>
    `;
  }

  async function sendMessage(message) {
    await fetch(CONFIG.API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: state.currentRoom,
        username: state.username,
        message: message
      })
    });
    return true;
  }

  async function fetchMessages() {
    // Prevent overlapping requests
    if (state.isFetching) return;
    state.isFetching = true;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const url = `${CONFIG.API_URL}?room=${encodeURIComponent(state.currentRoom)}&since=${state.lastTimestamp}`;
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      const data = await response.json();

      if (data.success && data.messages) {
        updateConnectionStatus(true);
        state.retryCount = 0;
        
        if (data.messages.length > 0) {
          const newMessages = data.messages.filter(msg => {
            return !state.displayedTimestamps.has(msg.timestamp);
          });
          
          if (newMessages.length > 0) {
            renderMessages(newMessages);
            newMessages.forEach(msg => state.displayedTimestamps.add(msg.timestamp));
            state.lastTimestamp = data.messages[data.messages.length - 1].timestamp;
          }
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
      state.retryCount++;
      
      if (state.retryCount >= CONFIG.MAX_RETRIES) {
        updateConnectionStatus(false);
      }
    } finally {
      state.isFetching = false;
    }
  }

  function startPolling() {
    fetchMessages();
    
    // Use dynamic interval based on connection status
    state.pollTimer = setInterval(() => {
      const interval = state.isConnected ? CONFIG.POLL_INTERVAL : CONFIG.RETRY_DELAY;
      fetchMessages();
    }, CONFIG.POLL_INTERVAL);
  }

  function stopPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

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

    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
  }

  function updateConnectionStatus(connected) {
    state.isConnected = connected;
    elements.status.className = `chat-status ${connected ? 'connected' : 'disconnected'}`;
    elements.status.querySelector('.status-text').textContent = 
      connected ? 'Connected' : 'Reconnecting...';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function shakeElement(el) {
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 500);
  }

  return {
    init: init,
    setApiUrl: function(url) { CONFIG.API_URL = url; }
  };

})();

document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('school-chat-container');
  if (container) {
    SchoolChat.init('school-chat-container');
  }
});