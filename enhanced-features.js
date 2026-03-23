// Enhanced Features for Instagram Clone
// Includes: Enhanced search, save functionality, message features, chat lock, block users

// Enhanced Global Search - Show all users initially
async function loadAllUsers() {
  try {
    const { data: users, error } = await window.sb
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    const resultsDiv = document.getElementById('searchResults');
    let html = '<div class="all-users-header"><h3>Discover People</h3></div>';
    
    users?.forEach(user => {
      html += `
        <div class="user-item" onclick="openUserProfile('${user.id}', '${user.username}')">
          <div class="user-avatar">
            ${user.avatar_url ? `<img src="${user.avatar_url}" alt="${user.username}" />` : user.username[0]?.toUpperCase()}
          </div>
          <div class="user-info">
            <div class="user-name">${user.username}</div>
            <div class="user-fullname">${user.full_name || ''}</div>
          </div>
          <div class="user-actions">
            <button class="btn btn-primary" onclick="event.stopPropagation(); followUser('${user.id}')">Follow</button>
            <button class="btn btn-secondary" onclick="event.stopPropagation(); openChat('${user.id}', '${user.username}')">Message</button>
          </div>
        </div>
      `;
    });
    
    resultsDiv.innerHTML = html || '<div class="no-results">No users found</div>';
    
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

// Enhanced search with filtering
async function enhancedSearchUsers(query) {
  if (!query || !query.trim()) {
    return;
  }
  
  try {
    const { data: users, error } = await window.sb
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(20);
    
    if (error) throw error;
    
    const resultsDiv = document.getElementById('searchResults');
    let html = '';
    
    users?.forEach(user => {
      html += `
        <div class="user-item" onclick="openUserProfile('${user.id}', '${user.username}')">
          <div class="user-avatar">
            ${user.avatar_url ? `<img src="${user.avatar_url}" alt="${user.username}" />` : user.username[0]?.toUpperCase()}
          </div>
          <div class="user-info">
            <div class="user-name">${user.username}</div>
            <div class="user-fullname">${user.full_name || ''}</div>
          </div>
          <div class="user-actions">
            <button class="btn btn-primary" onclick="event.stopPropagation(); followUser('${user.id}')">Follow</button>
            <button class="btn btn-secondary" onclick="event.stopPropagation(); openChat('${user.id}', '${user.username}')">Message</button>
          </div>
        </div>
      `;
    });
    
    resultsDiv.innerHTML = html || '<div class="no-results">No users found</div>';
    
  } catch (error) {
    console.error('Search error:', error);
  }
}

// Follow/Unfollow functionality
async function followUser(userId) {
  if (!window.currentUser) {
    alert('Please log in to follow users');
    return;
  }
  
  try {
    const { data: existingFollow } = await window.sb
      .from('follows')
      .select('id')
      .eq('follower_id', window.currentUser.id)
      .eq('followee_id', userId)
      .single();
    
    if (existingFollow) {
      // Unfollow
      await window.sb
        .from('follows')
        .delete()
        .eq('follower_id', window.currentUser.id)
        .eq('followee_id', userId);
      alert('Unfollowed!');
    } else {
      // Follow
      await window.sb
        .from('follows')
        .insert({
          follower_id: window.currentUser.id,
          followee_id: userId
        });
      alert('Following!');
    }
    
    // Refresh search results
    const searchQuery = document.getElementById('searchQuery').value;
    if (searchQuery) {
      enhancedSearchUsers(searchQuery);
    } else {
      loadAllUsers();
    }
    
  } catch (error) {
    console.error('Error following user:', error);
  }
}

// Enhanced save functionality - Save to device
async function saveToDevice(postId) {
  try {
    const { data: post, error } = await window.sb
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();
    
    if (error) throw error;
    
    if (post.image_url) {
      // Create download link
      const link = document.createElement('a');
      link.href = post.image_url;
      link.download = `post_${postId}_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert('Post saved to device!');
    } else {
      alert('No media to save');
    }
    
  } catch (error) {
    console.error('Error saving to device:', error);
    alert('Failed to save post');
  }
}

// Enhanced message functionality with edit/unsend
let messageEditMode = {};

async function loadEnhancedMessages(partnerId) {
  try {
    const { data: messages, error } = await window.sb
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${window.currentUser?.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${window.currentUser?.id})`)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    const messagesContainer = document.getElementById('messages');
    let html = '';
    
    messages?.forEach(message => {
      const isMe = message.sender_id === window.currentUser?.id;
      const editedText = message.edited ? ' (edited)' : '';
      
      html += `
        <div class="message ${isMe ? 'me' : 'them'}" data-message-id="${message.id}">
          <div class="message-content">
            ${message.content || 'Media'}${editedText}
            <time>${formatTime(message.created_at)}</time>
          </div>
          ${isMe ? `
            <div class="message-actions">
              <button onclick="editMessage('${message.id}', '${message.content}')" class="edit-btn">✏️</button>
              <button onclick="unsendMessage('${message.id}')" class="unsend-btn">🗑️</button>
            </div>
          ` : ''}
        </div>
      `;
    });
    
    messagesContainer.innerHTML = html;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}

// Edit message functionality
function editMessage(messageId, currentContent) {
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  const contentEl = messageEl.querySelector('.message-content');
  
  if (messageEditMode[messageId]) {
    // Cancel edit
    delete messageEditMode[messageId];
    contentEl.innerHTML = `${currentContent}<time>${contentEl.querySelector('time').outerHTML}</time>`;
    return;
  }
  
  messageEditMode[messageId] = true;
  
  contentEl.innerHTML = `
    <input type="text" value="${currentContent}" class="edit-input" />
    <div class="edit-actions">
      <button onclick="saveEditMessage('${messageId}')" class="save-edit">✓</button>
      <button onclick="cancelEditMessage('${messageId}', '${currentContent}')" class="cancel-edit">✗</button>
    </div>
  `;
  
  contentEl.querySelector('.edit-input').focus();
}

async function saveEditMessage(messageId) {
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  const newContent = messageEl.querySelector('.edit-input').value.trim();
  
  if (!newContent) {
    alert('Message cannot be empty');
    return;
  }
  
  try {
    const { error } = await window.sb
      .from('messages')
      .update({
        content: newContent,
        edited: true,
        edited_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    if (error) throw error;
    
    delete messageEditMode[messageId];
    loadEnhancedMessages(window.currentChat.partnerId);
    
  } catch (error) {
    console.error('Error editing message:', error);
    alert('Failed to edit message');
  }
}

function cancelEditMessage(messageId, originalContent) {
  delete messageEditMode[messageId];
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  const contentEl = messageEl.querySelector('.message-content');
  contentEl.innerHTML = `${originalContent}<time>${contentEl.querySelector('time').outerHTML}</time>`;
}

// Unsend message functionality
async function unsendMessage(messageId) {
  if (!confirm('Unsend this message?')) return;
  
  try {
    const { error } = await window.sb
      .from('messages')
      .delete()
      .eq('id', messageId);
    
    if (error) throw error;
    
    loadEnhancedMessages(window.currentChat.partnerId);
    
  } catch (error) {
    console.error('Error unsending message:', error);
    alert('Failed to unsend message');
  }
}

// Chat lock functionality
function setupChatLock() {
  const password = prompt('Set a password for chat lock:');
  if (password && password.length >= 4) {
    localStorage.setItem('chatLockPassword', btoa(password));
    localStorage.setItem('chatLockEnabled', 'true');
    alert('Chat lock enabled! You will need to enter this password to access messages.');
  } else if (password) {
    alert('Password must be at least 4 characters long');
  }
}

function checkChatLock() {
  const isEnabled = localStorage.getItem('chatLockEnabled') === 'true';
  const storedPassword = localStorage.getItem('chatLockPassword');
  
  if (isEnabled && storedPassword) {
    const enteredPassword = prompt('Enter chat lock password:');
    if (!enteredPassword || btoa(enteredPassword) !== storedPassword) {
      alert('Incorrect password!');
      return false;
    }
  }
  return true;
}

// Block user functionality
async function blockUser(userId) {
  if (!window.currentUser) {
    alert('Please log in first');
    return;
  }
  
  try {
    // Check if user is already blocked
    const { data: existingBlock } = await window.sb
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', window.currentUser.id)
      .eq('blocked_id', userId)
      .single();
    
    if (existingBlock) {
      // User is already blocked, so unblock them
      if (!confirm('Unblock this user?')) return;
      
      const { error } = await window.sb
        .from('blocked_users')
        .delete()
        .eq('blocker_id', window.currentUser.id)
        .eq('blocked_id', userId);
      
      if (error) throw error;
      
      alert('User unblocked successfully');
      
      // Update UI - change button text if it exists
      const blockBtns = document.querySelectorAll(`[onclick*="blockUser('${userId}')"]`);
      blockBtns.forEach(btn => {
        btn.textContent = 'Block';
        btn.style.background = '#dc3545';
      });
      
    } else {
      // Block the user
      if (!confirm('Block this user? They will not be able to message you or see your posts.')) return;
      
      const { error } = await window.sb
        .from('blocked_users')
        .insert({
          blocker_id: window.currentUser.id,
          blocked_id: userId
        });
      
      if (error) throw error;
      
      alert('User blocked successfully');
      
      // Update UI - change button text if it exists
      const blockBtns = document.querySelectorAll(`[onclick*="blockUser('${userId}')"]`);
      blockBtns.forEach(btn => {
        btn.textContent = 'Unblock';
        btn.style.background = '#28a745';
      });
      
      // Close chat if currently chatting with blocked user
      if (window.currentChat && window.currentChat.partnerId === userId) {
        document.getElementById('chatArea').classList.add('hidden');
        document.getElementById('chatsList').style.display = 'block';
        window.currentChat = null;
      }
      
      // Remove from chats list
      if (window.loadChats) {
        setTimeout(() => window.loadChats(), 100);
      }
    }
    
  } catch (error) {
    console.error('Error blocking/unblocking user:', error);
    alert('Failed to block/unblock user: ' + error.message);
  }
}

// Enhanced user profile view
async function openEnhancedUserProfile(userId, username) {
  try {
    // Get user profile
    const { data: profile, error } = await window.sb
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    
    // Get user posts
    const { data: posts } = await window.sb
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(12);
    
    // Create profile modal
    const modal = document.createElement('div');
    modal.className = 'modal user-profile-modal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="closeUserProfile()"></div>
      <div class="modal-dialog user-profile-dialog">
        <div class="modal-header">
          <h3>${profile.username}</h3>
          <button onclick="closeUserProfile()" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="profile-header">
            <div class="profile-avatar-large">
              ${profile.avatar_url ? 
                `<img src="${profile.avatar_url}" alt="${profile.username}" />` : 
                `<span>${profile.username[0]?.toUpperCase()}</span>`
              }
            </div>
            <div class="profile-info">
              <h2>${profile.username}</h2>
              <p>${profile.full_name || ''}</p>
              <p>${profile.bio || ''}</p>
              <div class="profile-actions">
                <button class="btn btn-primary" onclick="followUser('${userId}')">Follow</button>
                <button class="btn btn-secondary" onclick="openChat('${userId}', '${username}')">Message</button>
                <button class="btn btn-danger" onclick="blockUser('${userId}')">Block</button>
              </div>
            </div>
          </div>
          <div class="user-posts-grid">
            ${posts?.map(post => `
              <div class="post-item" onclick="viewPost('${post.id}')">
                ${post.image_url ? 
                  `<img src="${post.image_url}" alt="Post" />` : 
                  '<div class="text-post">📝</div>'
                }
              </div>
            `).join('') || '<div class="no-posts">No posts yet</div>'}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.id = 'userProfileModal';
    
  } catch (error) {
    console.error('Error loading user profile:', error);
    alert('Failed to load user profile');
  }
}

function closeUserProfile() {
  const modal = document.getElementById('userProfileModal');
  if (modal) modal.remove();
}

// Auto-refresh functionality
function setupAutoRefresh() {
  // Refresh feed every 30 seconds
  setInterval(() => {
    if (document.querySelector('.content-section.active')?.id === 'homeSection') {
      loadFeed();
    }
  }, 30000);
  
  // Refresh messages every 5 seconds if in chat
  setInterval(() => {
    if (!document.getElementById('chatArea').classList.contains('hidden') && window.currentChat) {
      loadEnhancedMessages(window.currentChat.partnerId);
    }
  }, 5000);
}

// Enhanced comment functionality
async function loadEnhancedComments(postId) {
  try {
    const { data: comments, error } = await window.sb
      .from('comments')
      .select(`
        *,
        profiles:user_id (username, avatar_url)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    return comments || [];
    
  } catch (error) {
    console.error('Error loading comments:', error);
    return [];
  }
}

// Initialize enhanced features
function initEnhancedFeatures() {
  // Override original search function
  window.searchUsers = enhancedSearchUsers;
  window.openUserProfile = openEnhancedUserProfile;
  window.loadMessages = loadEnhancedMessages;
  
  // Setup auto-refresh
  setupAutoRefresh();
  
  // Load all users when search section is opened
  const searchSection = document.getElementById('searchSection');
  if (searchSection) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (searchSection.classList.contains('active')) {
            loadAllUsers();
          }
        }
      });
    });
    observer.observe(searchSection, { attributes: true });
  }
  
  // Add chat lock check to messages section
  const messagesBtn = document.querySelector('[data-section="messages"]');
  if (messagesBtn) {
    messagesBtn.addEventListener('click', (e) => {
      if (!checkChatLock()) {
        e.stopPropagation();
        e.preventDefault();
      }
    });
  }
  
  // Enhanced save button functionality
  document.addEventListener('click', (e) => {
    if (e.target.matches('.save-btn') || e.target.closest('.save-btn')) {
      const saveBtn = e.target.matches('.save-btn') ? e.target : e.target.closest('.save-btn');
      const postId = saveBtn.dataset.postId;
      
      // Show save options
      const modal = document.createElement('div');
      modal.className = 'modal save-options-modal';
      modal.innerHTML = `
        <div class="modal-backdrop" onclick="closeSaveOptions()"></div>
        <div class="modal-dialog">
          <div class="modal-header">
            <h3>Save Options</h3>
            <button onclick="closeSaveOptions()" class="close-btn">×</button>
          </div>
          <div class="modal-body">
            <button class="save-option" onclick="toggleSave('${postId}'); closeSaveOptions();">
              Save to Collection
            </button>
            <button class="save-option" onclick="saveToDevice('${postId}'); closeSaveOptions();">
              Download to Device
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      modal.id = 'saveOptionsModal';
      
      e.preventDefault();
      e.stopPropagation();
    }
  });
}

function closeSaveOptions() {
  const modal = document.getElementById('saveOptionsModal');
  if (modal) modal.remove();
}

// Make functions globally available
window.followUser = followUser;
window.saveToDevice = saveToDevice;
window.editMessage = editMessage;
window.saveEditMessage = saveEditMessage;
window.cancelEditMessage = cancelEditMessage;
window.unsendMessage = unsendMessage;
window.blockUser = blockUser;
window.openEnhancedUserProfile = openEnhancedUserProfile;
window.closeUserProfile = closeUserProfile;
window.closeSaveOptions = closeSaveOptions;
window.setupChatLock = setupChatLock;
window.checkChatLock = checkChatLock;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEnhancedFeatures);
} else {
  initEnhancedFeatures();
}