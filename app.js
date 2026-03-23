// Global variables (avoid duplicates)
window.currentUser = window.currentUser || null;
window.currentChat = window.currentChat || null;
window.messageSubscription = window.messageSubscription || null;
// selectedMusic is declared in features.js

// Initialize app - simplified to avoid conflicts
window.initAppFromJS = async function() {
  console.log('🚀 Initializing app from JS...');
  
  if (!window.sb) {
    console.error('❌ Supabase client not available');
    return;
  }

  // Check for existing session
  const { data: { session } } = await window.sb.auth.getSession();
  if (session?.user) {
    console.log('✅ Found existing session');
    await handleUserSession(session.user);
  }

  console.log('✅ App JS initialized successfully');
};

// Handle user session with follow status sync
async function handleUserSession(user) {
  window.currentUser = user;
  const currentUser = window.currentUser;
  
  // Get or create profile
  let { data: profile, error } = await window.sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error && error.code === 'PGRST116') {
    // Profile doesn't exist, create one
    const { data: newProfile, error: createError } = await window.sb
      .from('profiles')
      .insert({
        id: user.id,
        username: user.email.split('@')[0],
        full_name: user.user_metadata?.full_name || '',
        avatar_url: user.user_metadata?.avatar_url || '',
        bio: user.user_metadata?.bio || '',
        links: user.user_metadata?.links || ''
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating profile:', createError);
      return;
    }
    profile = newProfile;
  }

  if (profile) {
    currentUser.profile = profile;
    
    // Sync follow status from database to localStorage
    try {
      const { data: follows } = await window.sb
        .from('follows')
        .select('followee_id')
        .eq('follower_id', user.id);
      
      const followedUserIds = follows?.map(f => f.followee_id) || [];
      localStorage.setItem('followedUsers', JSON.stringify(followedUserIds));
      console.log('✅ Follow status synced from database:', followedUserIds.length, 'users');
    } catch (syncError) {
      console.error('Error syncing follow status:', syncError);
    }
    
    showAppUI();
    await loadInitialData();
    setupGlobalMessageSubscription();
  }
}

// Show app UI - simplified for dedicated auth page
window.showAppUI = function() {
  document.getElementById('appPanel').classList.remove('hidden');
};

// Load initial data
async function loadInitialData() {
  await Promise.all([
    window.loadStories ? window.loadStories() : Promise.resolve(),
    window.loadFeed ? window.loadFeed() : Promise.resolve(),
    window.loadChats ? window.loadChats() : Promise.resolve()
  ]);
  
  // Load highlights for profile section
  if (window.loadHighlights) {
    await window.loadHighlights();
  }
}

// Setup event listeners - simplified for main app
function setupEventListeners() {
  // Only setup logout handler - login/signup handled in auth.html
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);

  // Enhanced search functionality
  const searchInput = document.getElementById('searchQuery');
  if (searchInput) {
    let searchTimeout;
    
    // Search on input with debounce
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchUsers(e.target.value);
      }, 300);
    });
    
    // Also search on Enter key press
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(searchTimeout);
        searchUsers(e.target.value);
      }
    });
    
    // Load all users when search input is focused and empty
    searchInput.addEventListener('focus', (e) => {
      if (!e.target.value.trim()) {
        loadAllUsers();
      }
    });
  }

  // Message form
  document.getElementById('messageForm')?.addEventListener('submit', handleSendMessage);
  
  // Back to chats
  document.getElementById('backToChats')?.addEventListener('click', () => {
    document.getElementById('chatArea').classList.add('hidden');
    document.getElementById('chatsList').style.display = 'block';
  });

  // Modal close handlers
  setupModalHandlers();
}

// Login/signup handled in HTML - these are helper functions

// Handle logout with data cleanup
async function handleLogout() {
  if (!confirm('Are you sure you want to logout?')) return;
  
  try {
    await window.sb.auth.signOut();
    window.currentUser = null;
    window.currentChat = null;
    
    // Clean up subscriptions
    if (window.messageSubscription) {
      window.messageSubscription.unsubscribe();
      window.messageSubscription = null;
    }
    
    // Clear all cached data including follow status
    localStorage.removeItem('followedUsers');
    localStorage.removeItem('savedChats');
    localStorage.removeItem('chatLockPassword');
    localStorage.removeItem('chatLockEnabled');
    
    // Redirect to auth page
    window.location.href = 'auth.html';
    console.log('✅ Logged out successfully');
    
  } catch (error) {
    console.error('❌ Logout error:', error);
    alert('Failed to logout: ' + error.message);
  }
}

// Load stories - simplified version to avoid conflicts
window.loadStoriesFromApp = async function() {
  if (!window.currentUser) return;

  try {
    // Try with media_type column first
    let { data: stories, error } = await window.sb
      .from('stories')
      .select(`
        *,
        profiles:user_id (username, avatar_url, full_name)
      `)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    // If media_type column doesn't exist, try without it
    if (error && error.message.includes('media_type')) {
      const result = await window.sb
        .from('stories')
        .select(`
          id, user_id, media_url, audience, expires_at, created_at,
          profiles:user_id (username, avatar_url, full_name)
        `)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      
      stories = result.data;
      error = result.error;
    }

    if (error) throw error;

    const storiesRow = document.getElementById('storiesRow');
    if (!storiesRow) return;

    // Get current user profile for "Add Story" button
    const currentProfile = window.currentUser?.profile;

    // Add "Add Story" button with user's avatar
    let html = `
      <div class="story add-story" onclick="openStoryCamera()">
        <div class="ring">
          <div class="avatar">
            <div class="avatar-inner">
              ${currentProfile?.avatar_url && currentProfile.avatar_url.trim() ? 
                `<img src="${currentProfile.avatar_url}" alt="You" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : 
                `<span style="color:#fff;font-weight:600;">${currentProfile?.username?.[0]?.toUpperCase() || 'Y'}</span>`
              }
              <div class="add-icon">+</div>
            </div>
          </div>
        </div>
        <label>Your story</label>
      </div>
    `;

    // Group stories by user
    const userStories = {};
    stories?.forEach(story => {
      const userId = story.user_id;
      if (!userStories[userId]) {
        userStories[userId] = {
          user: story.profiles,
          stories: []
        };
      }
      userStories[userId].stories.push(story);
    });

    // Add user stories with Instagram-like ring
    Object.values(userStories).forEach(({ user, stories }) => {
      const avatar = user?.avatar_url || '';
      const username = user?.username || 'User';
      
      html += `
        <div class="story" onclick="viewStory('${stories[0].user_id}')">
          <div class="ring">
            <div class="avatar">
              <div class="avatar-inner">
                ${avatar ? 
                  `<img src="${avatar}" alt="${username}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : 
                  `<span style="color:#fff;font-weight:600;">${username[0]?.toUpperCase()}</span>`
                }
              </div>
            </div>
          </div>
          <label>${username}</label>
        </div>
      `;
    });

    storiesRow.innerHTML = html;

  } catch (error) {
    console.error('❌ Error loading stories:', error);
    const storiesRow = document.getElementById('storiesRow');
    if (storiesRow) {
      storiesRow.innerHTML = `
        <div class="story add-story" onclick="openStoryCamera()">
          <div class="ring">
            <div class="avatar">
              <div class="avatar-inner">
                <span style="color:#fff;font-weight:600;">+</span>
              </div>
            </div>
          </div>
          <label>Your story</label>
        </div>
      `;
    }
  }
};

// Load feed - simplified version to avoid conflicts (excluding reels/videos)
window.loadFeedFromApp = async function() {
  if (!window.currentUser) return;

  try {
    const { data: posts, error } = await window.sb
      .from('posts')
      .select(`
        *,
        profiles:user_id (username, avatar_url, full_name)
      `)
      .not('media_type', 'eq', 'video')  // Exclude video posts (reels)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const feed = document.getElementById('feed');
    if (!feed) return;

    let html = '';
    posts?.forEach(post => {
      const user = post.profiles;
      
      // Skip video posts as an additional filter
      if (post.image_url && (post.image_url.includes('video') || post.image_url.startsWith('data:video'))) {
        return;
      }
      
      html += `
        <div class="post">
          <div class="post-header">
            <div class="post-avatar">
              ${user?.avatar_url ? `<img src="${user.avatar_url}" alt="${user.username}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" />` : `<span style="width: 32px; height: 32px; border-radius: 50%; background: #e1306c; color: white; display: flex; align-items: center; justify-content: center; font-weight: 600;">${user?.username?.[0]?.toUpperCase() || 'U'}</span>`}
            </div>
            <div class="post-username">${user?.username || 'User'}</div>
            <button class="post-more">⋯</button>
          </div>
          
          ${post.image_url ? `<img src="${post.image_url}" alt="Post" class="post-image" style="width: 100%; max-height: 600px; object-fit: cover;" />` : ''}
          
          <div class="post-actions">
            <button class="post-action" onclick="toggleLike('${post.id}')">❤️</button>
            <button class="post-action" onclick="showComments('${post.id}')">💬</button>
            <button class="post-action" onclick="sharePost('${post.id}')">📤</button>
          </div>
          
          <div class="post-likes">0 likes</div>
          
          ${post.caption ? `<div class="post-caption"><strong>${user?.username || 'User'}</strong> ${post.caption}</div>` : ''}
          <div class="post-timestamp">${formatTime(post.created_at)}</div>
        </div>
      `;
    });

    if (html === '') {
      html = '<div class="no-content">No posts yet. Create your first post!</div>';
    }

    feed.innerHTML = html;

  } catch (error) {
    console.error('❌ Error loading feed:', error);
    const feed = document.getElementById('feed');
    if (feed) {
      feed.innerHTML = '<div class="no-content">Error loading posts. Please try again.</div>';
    }
  }
};

// Load chats - Instagram style with last message preview and saved chats
window.loadChats = async function() {
  if (!window.currentUser) return;
  const currentUser = window.currentUser;

  try {
    // Get all users who have exchanged messages with current user OR followed users
    const { data: following } = await window.sb
      .from('follows')
      .select('followee_id')
      .eq('follower_id', currentUser.id);

    // Get saved chats from localStorage
    const savedChats = JSON.parse(localStorage.getItem('savedChats') || '[]');

    // Also get users who have sent messages to current user
    const { data: messageUsers } = await window.sb
      .from('messages')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

    // Combine followed users, saved chats, and message users
    const allUserIds = new Set();
    const userProfiles = new Map();

    // Add followed users first (priority)
    if (following?.length) {
      for (const follow of following) {
        allUserIds.add(follow.followee_id);
        // Get profile for followed user
        try {
          const { data: profile } = await window.sb
            .from('profiles')
            .select('username, avatar_url, full_name')
            .eq('id', follow.followee_id)
            .single();
          if (profile) {
            userProfiles.set(follow.followee_id, profile);
          }
        } catch (err) {
          console.log('Profile not found for followed user:', follow.followee_id);
        }
      }
    }

    // Add saved chat users
    if (savedChats?.length) {
      for (const savedChat of savedChats) {
        allUserIds.add(savedChat.partnerId);
        if (!userProfiles.has(savedChat.partnerId)) {
          try {
            const { data: profile } = await window.sb
              .from('profiles')
              .select('username, avatar_url, full_name')
              .eq('id', savedChat.partnerId)
              .single();
            if (profile) {
              userProfiles.set(savedChat.partnerId, profile);
            }
          } catch (err) {
            console.log('Profile not found for saved chat user:', savedChat.partnerId);
          }
        }
      }
    }

    // Add users from messages
    if (messageUsers?.length) {
      for (const msg of messageUsers) {
        const otherUserId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
        if (otherUserId !== currentUser.id) {
          allUserIds.add(otherUserId);
          
          // Get profile if not already loaded
          if (!userProfiles.has(otherUserId)) {
            try {
              const { data: profile } = await window.sb
                .from('profiles')
                .select('username, avatar_url, full_name')
                .eq('id', otherUserId)
                .single();
              if (profile) userProfiles.set(otherUserId, profile);
            } catch (err) {
              console.log('Profile not found for user:', otherUserId);
            }
          }
        }
      }
    }

    const chatsList = document.getElementById('chatsList');
    if (!chatsList) return;

    let html = '';
    
    if (allUserIds.size > 0) {
      // Sort users: saved chats first, then followed users, then others
      const sortedUsers = Array.from(allUserIds).sort((a, b) => {
        const aIsSaved = savedChats.some(chat => chat.partnerId === a);
        const bIsSaved = savedChats.some(chat => chat.partnerId === b);
        const aIsFollowed = following?.some(f => f.followee_id === a);
        const bIsFollowed = following?.some(f => f.followee_id === b);
        
        // Saved chats first
        if (aIsSaved && !bIsSaved) return -1;
        if (!aIsSaved && bIsSaved) return 1;
        
        // Then followed users
        if (aIsFollowed && !bIsFollowed) return -1;
        if (!aIsFollowed && bIsFollowed) return 1;
        
        return 0;
      });

      // Get last message for each user
      for (const userId of sortedUsers) {
        const user = userProfiles.get(userId);
        if (!user) continue;
        
        let lastMessage = null;
        let messageTime = '';
        
        try {
          const { data: messages } = await window.sb
            .from('messages')
            .select('content, created_at, sender_id')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`)
            .eq('unsent', false)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (messages?.length) {
            lastMessage = messages[0];
            messageTime = formatTime(lastMessage.created_at);
          }
        } catch (err) {
          console.log('Error getting last message:', err);
        }
        
        const isOnline = Math.random() > 0.5; // Simulate online status
        const isFollowed = following?.some(f => f.followee_id === userId);
        const isSaved = savedChats.some(chat => chat.partnerId === userId);
        
        html += `
          <div class="chat-item" onclick="openChat('${userId}', '${user?.username || 'User'}')">
            <div class="chat-avatar-container">
              <div class="chat-avatar">
                ${user?.avatar_url && user.avatar_url.trim() && user.avatar_url !== 'null' ? 
                  `<img src="${user.avatar_url}" alt="${user.username}" />` : 
                  `<div class="avatar-placeholder">${user?.username?.[0]?.toUpperCase() || 'U'}</div>`
                }
              </div>
              ${isOnline ? '<div class="online-indicator"></div>' : ''}
              ${isSaved ? '<div class="save-indicator" style="position: absolute; bottom: -2px; left: -2px; background: #ffd700; color: black; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 10px; border: 2px solid #000;">💾</div>' : ''}
              ${isFollowed ? '<div class="follow-indicator" style="position: absolute; bottom: -2px; right: -2px; background: #0095f6; color: white; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 10px; border: 2px solid #000;">✓</div>' : ''}
            </div>
            <div class="chat-info">
              <div class="chat-header">
                <div class="chat-name">${user?.username || 'User'}</div>
                <div class="chat-time">${messageTime}</div>
              </div>
              <div class="chat-preview">
                ${lastMessage ? 
                  (lastMessage.sender_id === currentUser.id ? 'You: ' : '') + 
                  (lastMessage.content?.length > 30 ? lastMessage.content.substring(0, 30) + '...' : lastMessage.content || 'Media') 
                  : 'Tap to start chatting'
                }
              </div>
            </div>
          </div>
        `;
      }
    } else {
      html = `
        <div class="empty-chats">
          <div class="empty-icon">💬</div>
          <h3>Your Messages</h3>
          <p>Follow people to start messaging them</p>
          <button class="btn btn-primary" onclick="showSection('search')">Find People</button>
        </div>
      `;
    }

    chatsList.innerHTML = html;

  } catch (error) {
    console.error('❌ Error loading chats:', error);
    const chatsList = document.getElementById('chatsList');
    if (chatsList) {
      chatsList.innerHTML = `
        <div class="empty-chats">
          <div class="empty-icon">⚠️</div>
          <h3>Error Loading Chats</h3>
          <p>Please try again later</p>
        </div>
      `;
    }
  }
}

// Enhanced search users function with persistent follow status
window.searchUsers = async function(query) {
  const currentUser = window.currentUser;
  try {
    let users;
    let error;
    
    if (!query || !query.trim()) {
      // Load all users when no search query
      const result = await window.sb
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      users = result.data;
      error = result.error;
    } else {
      // Search users by username or full name
      const result = await window.sb
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${query.trim()}%,full_name.ilike.%${query.trim()}%`)
        .order('username', { ascending: true })
        .limit(50);
      users = result.data;
      error = result.error;
    }

    if (error) throw error;

    const searchResults = document.getElementById('searchResults');
    if (!searchResults) return;

    let html = '';
    
    if (!query || !query.trim()) {
      html += '<div class="all-users-header"><h3>🌍 All Users on GENZES CHATS</h3><p>Discover and connect with people from around the world</p></div>';
    } else {
      html += `<div class="search-results-header"><h3>🔍 Search Results for "${query}"</h3></div>`;
    }
    
    if (users && users.length > 0) {
      // Get current user's follow status from database (most reliable)
      let followingIds = [];
      if (currentUser) {
        try {
          const { data: follows } = await window.sb
            .from('follows')
            .select('followee_id')
            .eq('follower_id', currentUser.id)
            .in('followee_id', users.map(u => u.id));
          followingIds = follows?.map(f => f.followee_id) || [];
          
          // Update localStorage with current database state
          localStorage.setItem('followedUsers', JSON.stringify(followingIds));
          
        } catch (err) {
          console.log('Error getting follow status from database, using localStorage:', err);
          // Fallback to localStorage if database fails
          followingIds = JSON.parse(localStorage.getItem('followedUsers') || '[]');
        }
      }
      
      users.forEach(user => {
        // Skip current user from results
        if (currentUser && user.id === currentUser.id) return;
        
        const isFollowing = followingIds.includes(user.id);
        
        html += `
          <div class="user-item" onclick="openEnhancedUserProfile('${user.id}', '${user.username}')">
            <div class="user-avatar">
              ${user.avatar_url && user.avatar_url.trim() && user.avatar_url !== 'null' ? 
                `<img src="${user.avatar_url}" alt="${user.username}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;" />` : 
                `<span style="width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 1.2rem;">${user.username?.[0]?.toUpperCase() || 'U'}</span>`
              }
            </div>
            <div class="user-info">
              <div class="user-name">@${user.username}</div>
              <div class="user-fullname">${user.full_name || 'No name provided'}</div>
              ${user.bio ? `<div class="user-bio">${user.bio.length > 50 ? user.bio.substring(0, 50) + '...' : user.bio}</div>` : ''}
            </div>
            <div class="user-actions">
              <button class="btn ${isFollowing ? 'btn-accent' : 'btn-primary'}" onclick="event.stopPropagation(); followUser('${user.id}')" title="${isFollowing ? 'Unfollow' : 'Follow'} ${user.username}">${isFollowing ? 'Following' : 'Follow'}</button>
              <button class="btn btn-secondary" onclick="event.stopPropagation(); startDirectMessage('${user.id}', '${user.username}')" title="Message ${user.username}">Message</button>
            </div>
          </div>
        `;
      });
    } else {
      if (query && query.trim()) {
        html += '<div class="no-results">❌ No users found matching your search</div>';
      } else {
        html += '<div class="no-results">👥 No users found on the platform yet</div>';
      }
    }

    searchResults.innerHTML = html;

  } catch (error) {
    console.error('❌ Error searching users:', error);
    const searchResults = document.getElementById('searchResults');
    if (searchResults) {
      searchResults.innerHTML = '<div class="error-message">❌ Error loading users. Please try again.</div>';
    }
  }
}

// Load all users function
window.loadAllUsers = async function() {
  await searchUsers(''); // Call searchUsers with empty query to load all users
};

// Open chat function - ensure it works globally
window.openChat = async function(partnerId, partnerName) {
  console.log('Opening chat with:', partnerId, partnerName);
  const currentChat = { partnerId, partnerName };
  window.currentChat = currentChat;
  
  // Update UI
  const chatsList = document.getElementById('chatsList');
  const chatArea = document.getElementById('chatArea');
  const chatNameEl = document.querySelector('.chat-name');
  
  if (chatsList) chatsList.style.display = 'none';
  if (chatArea) chatArea.classList.remove('hidden');
  if (chatNameEl) chatNameEl.textContent = partnerName;
  
  // Load messages
  await window.loadMessages(partnerId);
  
  // Setup real-time subscription
  window.setupMessageSubscription(partnerId);
  
  // Focus message input
  const messageInput = document.getElementById('messageInput');
  if (messageInput) {
    setTimeout(() => messageInput.focus(), 100);
  }
};

// Load messages with Instagram-style UI
window.loadMessages = async function(partnerId) {
  const currentUser = window.currentUser;
  try {
    const { data: messages, error } = await window.sb
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUser.id})`)
      .eq('unsent', false)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;

    let html = '';
    let lastDate = '';
    
    messages?.forEach((message, index) => {
      const isMe = message.sender_id === currentUser.id;
      const messageDate = new Date(message.created_at).toDateString();
      const editedText = message.edited ? ' (edited)' : '';
      
      // Add date separator
      if (messageDate !== lastDate) {
        html += `<div class="date-separator">${formatDate(message.created_at)}</div>`;
        lastDate = messageDate;
      }
      
      // Group consecutive messages from same sender
      const prevMessage = messages[index - 1];
      const nextMessage = messages[index + 1];
      const isFirstInGroup = !prevMessage || prevMessage.sender_id !== message.sender_id;
      const isLastInGroup = !nextMessage || nextMessage.sender_id !== message.sender_id;
      
      html += `
        <div class="message-wrapper ${isMe ? 'me' : 'them'}">
          <div class="message ${isFirstInGroup ? 'first' : ''} ${isLastInGroup ? 'last' : ''}" data-message-id="${message.id}">
            <div class="message-content">
              <div class="message-text">${message.content || 'Media'}${editedText}</div>
              ${isLastInGroup ? `<div class="message-time">${formatTime(message.created_at)}</div>` : ''}
            </div>
            ${isMe ? `
              <div class="message-actions">
                <button onclick="editMessage('${message.id}', '${message.content}')" class="message-action-btn" title="Edit">✏️</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });
    
    if (!messages?.length) {
      html = `
        <div class="empty-messages">
          <div class="empty-icon">👋</div>
          <p>Start your conversation</p>
        </div>
      `;
    }

    messagesContainer.innerHTML = html;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

  } catch (error) {
    console.error('❌ Error loading messages:', error);
    const messagesContainer = document.getElementById('messages');
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="empty-messages">
          <div class="empty-icon">⚠️</div>
          <p>Error loading messages</p>
        </div>
      `;
    }
  }
}

// Setup message subscription
window.setupMessageSubscription = function(partnerId) {
  const currentUser = window.currentUser;
  if (window.messageSubscription) {
    window.messageSubscription.unsubscribe();
  }

  window.messageSubscription = window.sb
    .channel('messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `or(and(sender_id.eq.${currentUser.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUser.id}))`
    }, (payload) => {
      const message = payload.new;
      const isMe = message.sender_id === currentUser.id;
      
      const messagesContainer = document.getElementById('messages');
      if (messagesContainer) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isMe ? 'me' : 'them'}`;
        messageDiv.innerHTML = `
          ${message.content || 'Media'}
          <time>${formatTime(message.created_at)}</time>
        `;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    })
    .subscribe();
}

// Handle send message
window.handleSendMessage = async function(e) {
  e.preventDefault();
  
  const currentUser = window.currentUser;
  const currentChat = window.currentChat;
  
  if (!currentChat) return;
  
  const messageInput = document.getElementById('messageInput');
  const content = messageInput.value.trim();
  
  if (!content) return;

  try {
    const { error } = await window.sb
      .from('messages')
      .insert({
        sender_id: currentUser.id,
        receiver_id: currentChat.partnerId,
        content: content
      });

    if (error) throw error;

    messageInput.value = '';
    
    // Reload messages to show new message with proper formatting
    await window.loadMessages(currentChat.partnerId);
    
    // Refresh chats list to show this conversation at the top
    if (window.loadChats) {
      setTimeout(() => window.loadChats(), 100);
    }

  } catch (error) {
    console.error('❌ Error sending message:', error);
    alert('Failed to send message');
  }
}

// Utility functions
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd';
  return date.toLocaleDateString();
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffTime = today - messageDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Modal handlers
function setupModalHandlers() {
  // Close modal handlers
  document.querySelectorAll('.close-btn, .cancel-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) modal.classList.add('hidden');
    });
  });

  // Backdrop click to close
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) modal.classList.add('hidden');
    });
  });
}

// Placeholder functions for features
window.viewStory = function(userId) {
  console.log('View story for user:', userId);
};

window.toggleLike = function(postId) {
  console.log('Toggle like for post:', postId);
};

window.showComments = function(postId) {
  console.log('Show comments for post:', postId);
};

window.sharePost = function(postId) {
  console.log('Share post:', postId);
};

// Follow user function with UI update and persistence
window.followUser = async function(userId) {
  if (!window.currentUser) {
    alert('Please log in to follow users');
    return;
  }
  
  const followBtn = event.target;
  const originalText = followBtn.textContent;
  
  try {
    followBtn.disabled = true;
    followBtn.textContent = 'Loading...';
    
    // Check if already following
    const { data: existingFollow } = await window.sb
      .from('follows')
      .select('follower_id, followee_id')
      .eq('follower_id', window.currentUser.id)
      .eq('followee_id', userId)
      .maybeSingle();
    
    if (existingFollow) {
      // Unfollow
      const { error } = await window.sb
        .from('follows')
        .delete()
        .eq('follower_id', window.currentUser.id)
        .eq('followee_id', userId);
      
      if (error) throw error;
      
      followBtn.textContent = 'Follow';
      followBtn.className = 'btn btn-primary';
      
      // Update localStorage to persist unfollow
      const followedUsers = JSON.parse(localStorage.getItem('followedUsers') || '[]');
      const updatedFollowed = followedUsers.filter(id => id !== userId);
      localStorage.setItem('followedUsers', JSON.stringify(updatedFollowed));
      
    } else {
      // Follow
      const { error } = await window.sb
        .from('follows')
        .insert({
          follower_id: window.currentUser.id,
          followee_id: userId
        });
      
      if (error) throw error;
      
      followBtn.textContent = 'Following';
      followBtn.className = 'btn btn-accent';
      
      // Update localStorage to persist follow
      const followedUsers = JSON.parse(localStorage.getItem('followedUsers') || '[]');
      if (!followedUsers.includes(userId)) {
        followedUsers.push(userId);
        localStorage.setItem('followedUsers', JSON.stringify(followedUsers));
      }
    }
    
    // Immediately refresh messages to show followed users
    if (window.loadChats) {
      window.loadChats();
    }
    
    // Refresh search results to update follow status
    if (window.searchUsers) {
      const searchInput = document.getElementById('searchQuery');
      if (searchInput && searchInput.value.trim()) {
        window.searchUsers(searchInput.value);
      } else {
        window.loadAllUsers();
      }
    }
    
  } catch (error) {
    console.error('Error following user:', error);
    followBtn.textContent = originalText;
    alert('Failed to follow/unfollow user');
  } finally {
    followBtn.disabled = false;
  }
};

// Start direct message function
window.startDirectMessage = function(partnerId, partnerName) {
  console.log('Starting direct message with:', partnerId, partnerName);
  // Switch to messages section
  if (window.showSection) {
    window.showSection('messages');
  } else {
    // Fallback navigation
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-section="messages"]')?.classList.add('active');
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('messagesSection')?.classList.add('active');
  }
  
  // Small delay to ensure section is loaded and then open chat
  setTimeout(async () => {
    await window.openChat(partnerId, partnerName);
    // Refresh chats list to include this new conversation
    setTimeout(() => {
      if (window.loadChats) window.loadChats();
    }, 500);
  }, 300);
};



window.openCreatePostModal = function() {
  document.getElementById('createPostModal').classList.remove('hidden');
};

window.openStoryCamera = function() {
  document.getElementById('storyImageInput').click();
};

window.handleStoryUpload = function(input) {
  const file = input.files?.[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('createStoryModal').classList.remove('hidden');
    const preview = document.getElementById('storyPreview');
    const tag = file.type.startsWith('image/') ? 'img' : 'video';
    const controls = tag === 'video' ? 'controls' : '';
    preview.innerHTML = `<${tag} src="${e.target.result}" ${controls} style="max-width:100%;max-height:200px;border-radius:8px;" />`;
    document.getElementById('storyMedia').files = input.files;
    document.getElementById('storyMediaSelected').textContent = `Selected: ${file.name}`;
  };
  reader.readAsDataURL(file);
};

// Navigation functions - Fixed for Instagram-like UI
window.showSection = function(sectionName) {
  // Update navigation buttons
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-section="${sectionName}"]`)?.classList.add('active');
  
  // Update content sections
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.getElementById(sectionName + 'Section')?.classList.add('active');
  
  // Handle back button visibility
  const backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.style.display = sectionName === 'home' ? 'none' : 'block';
  
  // Load section-specific content
  if (sectionName === 'home') {
    loadFeed();
    loadStories();
  } else if (sectionName === 'search') {
    const searchInput = document.getElementById('searchQuery');
    if (searchInput) {
      searchInput.focus();
      // Load all users immediately when search section is opened
      loadAllUsers();
    }
  } else if (sectionName === 'messages') {
    loadChats();
  } else if (sectionName === 'reels') {
    if (window.loadReels) window.loadReels();
  } else if (sectionName === 'notifications') {
    if (window.loadNotifications) window.loadNotifications();
  } else if (sectionName === 'profile') {
    if (window.loadHighlights) window.loadHighlights();
    loadUserProfile();
  }
};

// Load user profile
async function loadUserProfile() {
  if (!currentUser?.profile) return;
  
  const profileInfo = document.getElementById('profileInfo');
  if (!profileInfo) return;
  
  const profile = currentUser.profile;
  const avatarHtml = profile.avatar_url && profile.avatar_url.trim() ? 
    `<img src="${profile.avatar_url}" alt="${profile.username}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />` : 
    `<span style="color: white; font-weight: 600; font-size: 2rem;">${profile.username?.[0]?.toUpperCase() || 'U'}</span>`;
  
  profileInfo.innerHTML = `
    <div class="profile-stats">
      <div class="profile-avatar-large" style="width: 120px; height: 120px; border-radius: 50%; background: #ddd; display: flex; align-items: center; justify-content: center; overflow: hidden;">
        ${avatarHtml}
      </div>
      <div class="profile-details">
        <h2>${profile.username || 'User'}</h2>
        <p>${profile.full_name || ''}</p>
        <p>${profile.bio || ''}</p>
        ${profile.links ? `<div class="profile-links">${profile.links.split('\n').map(link => `<a href="${link}" target="_blank">${link}</a>`).join('<br>')}</div>` : ''}
      </div>
    </div>
  `;
}

window.goToHome = function() {
  showSection('home');
};

// Global modal functions
window.openCreatePostModal = function() {
  document.getElementById('createPostModal').classList.remove('hidden');
};

window.openCreateStoryModal = function() {
  document.getElementById('createStoryModal').classList.remove('hidden');
};

window.openCreateReelModal = function() {
  document.getElementById('createReelModal').classList.remove('hidden');
};

window.openCreateHighlightModal = function() {
  document.getElementById('createHighlightModal').classList.remove('hidden');
  if (window.loadStoriesForHighlight) window.loadStoriesForHighlight();
};

window.openStoryCamera = function() {
  document.getElementById('storyImageInput').click();
};

window.handleStoryUpload = function(input) {
  const file = input.files?.[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('createStoryModal').classList.remove('hidden');
    const preview = document.getElementById('storyPreview');
    const tag = file.type.startsWith('image/') ? 'img' : 'video';
    const controls = tag === 'video' ? 'controls' : '';
    preview.innerHTML = `<${tag} src="${e.target.result}" ${controls} style="max-width:100%;max-height:200px;border-radius:8px;" />`;
    document.getElementById('storyMedia').files = input.files;
    document.getElementById('storyMediaSelected').textContent = `Selected: ${file.name}`;
  };
  reader.readAsDataURL(file);
};

// Chat lock functionality
window.setupChatLock = function() {
  const password = prompt('Set a password for chat lock:');
  if (password) {
    localStorage.setItem('chatLockPassword', password);
    alert('Chat lock enabled!');
  }
};

// Login/signup buttons handled in HTML with onclick attributes

// Refresh messages function
window.refreshMessages = async function() {
  const refreshBtn = document.getElementById('refreshMessages');
  if (refreshBtn) {
    refreshBtn.style.transform = 'rotate(360deg)';
    refreshBtn.style.transition = 'transform 0.5s';
    setTimeout(() => {
      refreshBtn.style.transform = 'rotate(0deg)';
    }, 500);
  }
  await loadChats();
};

// Global message subscription for new messages from any user
function setupGlobalMessageSubscription() {
  if (window.globalMessageSubscription) {
    window.globalMessageSubscription.unsubscribe();
  }

  window.globalMessageSubscription = window.sb
    .channel('global_messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `receiver_id.eq.${currentUser.id}`
    }, async (payload) => {
      // Refresh chats list when receiving new message from any user
      if (window.loadChats) {
        setTimeout(() => window.loadChats(), 100);
      }
    })
    .subscribe();
}



// Make functions globally available
if (!window.followUser) window.followUser = followUser;
if (!window.refreshMessages) window.refreshMessages = refreshMessages;

// Setup global message subscription when user is logged in
if (currentUser) {
  setupGlobalMessageSubscription();
}

// Don't auto-initialize to avoid conflicts with HTML file
console.log('✅ App.js loaded - functions available');