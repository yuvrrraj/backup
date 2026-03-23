// Chat Lock System
let chatLockPasscode = localStorage.getItem('chatLockPasscode');
let lockedChats = JSON.parse(localStorage.getItem('lockedChats') || '[]');
let failedAttempts = JSON.parse(localStorage.getItem('chatLockAttempts') || '{}');

// Setup chat lock
function setupChatLock() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-dialog" style="max-width: 400px;">
      <div class="modal-header">
        <h3>Chat Lock Setup</h3>
        <button onclick="this.closest('.modal').remove()" class="close-btn">×</button>
      </div>
      <div class="modal-form" style="padding: 1rem;">
        ${chatLockPasscode ? `
          <div style="color: #0095f6; text-align: center; margin-bottom: 1rem;">✅ Chat Lock is enabled</div>
          <button onclick="changePasscode()" style="width: 100%; padding: 0.75rem; background: #333; color: white; border: none; border-radius: 8px; cursor: pointer; margin-bottom: 0.5rem;">Change Passcode</button>
          <button onclick="selectChatsToLock()" style="width: 100%; padding: 0.75rem; background: #0095f6; color: white; border: none; border-radius: 8px; cursor: pointer; margin-bottom: 0.5rem;">Select Chats to Lock</button>
          <button onclick="disableChatLock()" style="width: 100%; padding: 0.75rem; background: #dc3545; color: white; border: none; border-radius: 8px; cursor: pointer;">Disable Chat Lock</button>
        ` : `
          <div style="color: #666; text-align: center; margin-bottom: 1rem;">Set up a 4-digit passcode to lock private chats</div>
          <input id="newPasscode" type="password" placeholder="Enter 4-digit passcode" maxlength="4" style="width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #333; border-radius: 8px; background: #000; color: #fff; text-align: center; font-size: 1.2rem;">
          <input id="confirmPasscode" type="password" placeholder="Confirm passcode" maxlength="4" style="width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #333; border-radius: 8px; background: #000; color: #fff; text-align: center; font-size: 1.2rem;">
          <button onclick="enableChatLock()" style="width: 100%; padding: 0.75rem; background: #0095f6; color: white; border: none; border-radius: 8px; cursor: pointer;">Enable Chat Lock</button>
        `}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Enable chat lock
function enableChatLock() {
  const newPasscode = document.getElementById('newPasscode')?.value;
  const confirmPasscode = document.getElementById('confirmPasscode')?.value;

  if (!newPasscode || newPasscode.length !== 4 || !/^\d{4}$/.test(newPasscode)) {
    alert('Please enter a 4-digit numeric passcode');
    return;
  }

  if (newPasscode !== confirmPasscode) {
    alert('Passcodes do not match');
    return;
  }

  chatLockPasscode = newPasscode;
  localStorage.setItem('chatLockPasscode', chatLockPasscode);

  alert('Chat Lock enabled successfully!');
  document.querySelector('.modal:last-child')?.remove();
}

// Change passcode
function changePasscode() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-dialog" style="max-width: 400px;">
      <div class="modal-header">
        <h3>Change Passcode</h3>
        <button onclick="this.closest('.modal').remove()" class="close-btn">×</button>
      </div>
      <div class="modal-form" style="padding: 1rem;">
        <input id="currentPasscode" type="password" placeholder="Current passcode" maxlength="4" style="width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #333; border-radius: 8px; background: #000; color: #fff; text-align: center; font-size: 1.2rem;">
        <input id="newPasscode" type="password" placeholder="New passcode" maxlength="4" style="width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #333; border-radius: 8px; background: #000; color: #fff; text-align: center; font-size: 1.2rem;">
        <input id="confirmNewPasscode" type="password" placeholder="Confirm new passcode" maxlength="4" style="width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #333; border-radius: 8px; background: #000; color: #fff; text-align: center; font-size: 1.2rem;">
        <button onclick="submitChangePasscode()" style="width: 100%; padding: 0.75rem; background: #0095f6; color: white; border: none; border-radius: 8px; cursor: pointer;">Change Passcode</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Submit passcode change
function submitChangePasscode() {
  const currentPasscode = document.getElementById('currentPasscode')?.value;
  const newPasscode = document.getElementById('newPasscode')?.value;
  const confirmNewPasscode = document.getElementById('confirmNewPasscode')?.value;

  if (currentPasscode !== chatLockPasscode) {
    alert('Current passcode is incorrect');
    return;
  }

  if (!newPasscode || newPasscode.length !== 4 || !/^\d{4}$/.test(newPasscode)) {
    alert('Please enter a 4-digit numeric passcode');
    return;
  }

  if (newPasscode !== confirmNewPasscode) {
    alert('New passcodes do not match');
    return;
  }

  chatLockPasscode = newPasscode;
  localStorage.setItem('chatLockPasscode', chatLockPasscode);

  alert('Passcode changed successfully!');
  document.querySelector('.modal:last-child')?.remove();
}

// Select chats to lock
function selectChatsToLock() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-dialog" style="max-width: 500px;">
      <div class="modal-header">
        <h3>Select Chats to Lock</h3>
        <button onclick="this.closest('.modal').remove()" class="close-btn">×</button>
      </div>
      <div class="modal-form" style="padding: 1rem;">
        <div id="chatLockList" style="max-height: 400px; overflow-y: auto;">
          <div style="text-align: center; color: #666;">Loading chats...</div>
        </div>
        <button onclick="saveChatLockSelection()" style="width: 100%; padding: 0.75rem; background: #0095f6; color: white; border: none; border-radius: 8px; cursor: pointer; margin-top: 1rem;">Save Selection</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  loadChatsForLocking();
}

// Load chats for locking
async function loadChatsForLocking() {
  try {
    // Get recent messages to show active chats
    const { data: recentMessages } = await window.sb.from('messages')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${window.currentUser.id},receiver_id.eq.${window.currentUser.id}`)
      .order('created_at', { ascending: false })
      .limit(100);

    const userChats = new Map();
    recentMessages?.forEach(msg => {
      const otherUserId = msg.sender_id === window.currentUser.id ? msg.receiver_id : msg.sender_id;
      if (!userChats.has(otherUserId)) {
        userChats.set(otherUserId, true);
      }
    });

    if (userChats.size === 0) {
      document.getElementById('chatLockList').innerHTML = '<div style="text-align: center; color: #666; padding: 2rem;">No chats found</div>';
      return;
    }

    const { data: profiles } = await window.sb.from('profiles')
      .select('id, username, avatar_url')
      .in('id', Array.from(userChats.keys()));

    const chatLockList = document.getElementById('chatLockList');
    if (!chatLockList) return;

    chatLockList.innerHTML = (profiles || []).map(user => {
      const initial = user.username?.charAt(0).toUpperCase() || 'U';
      const isLocked = lockedChats.includes(user.id);

      return `
        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-radius: 8px;">
          <input type="checkbox" value="${user.id}" name="lockChats" ${isLocked ? 'checked' : ''} style="margin: 0;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: ${user.avatar_url ? `url('${user.avatar_url}') center/cover` : '#333'}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
            ${user.avatar_url ? '' : initial}
          </div>
          <div style="flex: 1; color: #fff;">@${user.username}</div>
          ${isLocked ? '<div style="color: #ffc107;">🔒</div>' : ''}
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Load chats error:', error);
  }
}

// Save chat lock selection
function saveChatLockSelection() {
  const selectedChats = Array.from(document.querySelectorAll('input[name="lockChats"]:checked')).map(cb => cb.value);
  lockedChats = selectedChats;
  localStorage.setItem('lockedChats', JSON.stringify(lockedChats));

  alert(`${selectedChats.length} chat(s) locked successfully!`);
  document.querySelector('.modal:last-child')?.remove();
}

// Disable chat lock
function disableChatLock() {
  if (confirm('Are you sure you want to disable Chat Lock? All locked chats will become accessible.')) {
    localStorage.removeItem('chatLockPasscode');
    localStorage.removeItem('lockedChats');
    localStorage.removeItem('chatLockAttempts');
    chatLockPasscode = null;
    lockedChats = [];
    failedAttempts = {};

    alert('Chat Lock disabled successfully!');
    document.querySelector('.modal:last-child')?.remove();
  }
}

// Check if chat is locked
function isChatLocked(userId) {
  return chatLockPasscode && lockedChats.includes(userId);
}

// Verify passcode for locked chat
function verifyPasscodeForChat(userId, username) {
  // Generate a unique key for this user and current session
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const attemptKey = `${userId}_${currentDate}`;

  const attempts = failedAttempts[attemptKey] || 0;

  if (attempts >= 3) {
    alert('Too many failed attempts. This chat has been permanently deleted for security.');
    deleteChatPermanently(userId);
    return false;
  }

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-dialog" style="max-width: 350px;">
      <div class="modal-header">
        <h3>🔒 Locked Chat</h3>
      </div>
      <div class="modal-form" style="padding: 1rem; text-align: center;">
        <div style="color: #fff; margin-bottom: 1rem;">Enter passcode to access chat with @${username}</div>
        <input id="chatPasscodeInput" type="password" placeholder="••••" maxlength="4" style="width: 100px; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #333; border-radius: 8px; background: #000; color: #fff; text-align: center; font-size: 1.5rem;">
        <div style="color: #dc3545; font-size: 0.9rem; margin-bottom: 1rem;">Attempts remaining: ${3 - attempts}</div>
        <div style="display: flex; gap: 0.5rem;">
          <button onclick="this.closest('.modal').remove()" style="flex: 1; padding: 0.75rem; background: #333; color: white; border: none; border-radius: 8px; cursor: pointer;">Cancel</button>
          <button onclick="submitChatPasscode('${userId}', '${username}', '${attemptKey}')" style="flex: 1; padding: 0.75rem; background: #0095f6; color: white; border: none; border-radius: 8px; cursor: pointer;">Unlock</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Focus on input
  setTimeout(() => {
    document.getElementById('chatPasscodeInput')?.focus();
  }, 100);

  return false;
}

// Submit chat passcode
function submitChatPasscode(userId, username, attemptKey) {
  const enteredPasscode = document.getElementById('chatPasscodeInput')?.value;

  if (enteredPasscode === chatLockPasscode) {
    // Correct passcode
    document.querySelector('.modal:last-child')?.remove();
    // Reset attempts for this chat
    delete failedAttempts[attemptKey];
    localStorage.setItem('chatLockAttempts', JSON.stringify(failedAttempts));
    // Open the chat
    window.openChat(userId, username);
  } else {
    // Wrong passcode - only increment if they actually entered something
    if (enteredPasscode && enteredPasscode.trim()) {
      const attempts = (failedAttempts[attemptKey] || 0) + 1;
      failedAttempts[attemptKey] = attempts;
      localStorage.setItem('chatLockAttempts', JSON.stringify(failedAttempts));

      if (attempts >= 3) {
        alert('Too many failed attempts. This chat will be permanently deleted for security.');
        deleteChatPermanently(userId);
        document.querySelector('.modal:last-child')?.remove();
      } else {
        alert(`Wrong passcode. ${3 - attempts} attempts remaining.`);
        document.getElementById('chatPasscodeInput').value = '';
        document.getElementById('chatPasscodeInput').focus();
      }
    } else {
      // User canceled or entered empty passcode - don't increment attempts
      alert('Please enter your passcode to continue.');
      document.getElementById('chatPasscodeInput').focus();
    }
  }
}

// Delete chat permanently
async function deleteChatPermanently(userId) {
  try {
    // Delete all messages with this user
    await window.sb.from('messages')
      .delete()
      .or(`and(sender_id.eq.${window.currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${window.currentUser.id})`);

    // Remove from locked chats
    lockedChats = lockedChats.filter(id => id !== userId);
    localStorage.setItem('lockedChats', JSON.stringify(lockedChats));

    alert('Chat permanently deleted for security reasons.');

    // Reload chats list
    if (window.loadChats) {
      window.loadChats();
    }
  } catch (error) {
    console.error('Delete chat error:', error);
  }
}

// Make functions globally available
window.isChatLocked = isChatLocked;
window.verifyPasscodeForChat = verifyPasscodeForChat;
window.setupChatLock = setupChatLock;
