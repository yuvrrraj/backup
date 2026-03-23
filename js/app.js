// ── State ──
window.currentUser = null;
window.currentChat = null;
window.messageSubscription = null;
window.presenceSubscription = null;
window.userPresence = new Map();

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  if (!window.sb) {
    setTimeout(init, 1000);
  } else {
    init();
  }

  // Chat search
  const chatSearch = document.getElementById('chatSearchInput');
  chatSearch.addEventListener('input', e => {
    const q = e.target.value.trim();
    document.getElementById('clearChatSearch').classList.toggle('hidden', !q);
    if (q) {
      document.getElementById('searchResults').classList.remove('hidden');
      searchUsersInline(q);
    } else {
      clearChatSearch();
    }
  });

  // Global search
  const globalSearch = document.getElementById('globalSearchInput');
  let searchTimer;
  globalSearch.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => searchUsersGlobal(e.target.value.trim()), 300);
  });

  // Message form enter key
  document.getElementById('messageInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('messageForm').dispatchEvent(new Event('submit'));
    }
  });
});

async function init() {
  if (!window.sb) { showError(); return; }
  const { data: { session } } = await window.sb.auth.getSession();
  if (!session?.user) {
    window.location.href = 'auth.html';
    return;
  }
  window.currentUser = session.user;
  await ensureProfile(session.user);
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('appPanel').classList.remove('hidden');
  loadProfileUI();
  loadChats();
  setupPresence();
  setupChatListSubscription();
}

function showError() {
  document.getElementById('loadingScreen').innerHTML =
    '<p style="color:#ff4757">Connection failed. <button onclick="location.reload()" style="color:#667eea;background:none;border:none;cursor:pointer;">Retry</button></p>';
}

async function ensureProfile(user) {
  const { data: profile, error } = await window.sb
    .from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) {
    const username = user.email.split('@')[0] + '_' + Math.random().toString(36).substr(2, 4);
    const { data: newProfile } = await window.sb
      .from('profiles')
      .insert({ id: user.id, email: user.email, username, full_name: '', bio: '', avatar_url: '' })
      .select().single();
    if (newProfile) window.currentUser.profile = newProfile;
  } else {
    window.currentUser.profile = profile;
  }
}

// ── Navigation ──
window.showSection = function(name) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.getElementById(name + 'Section').classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-section="${name}"]`).classList.add('active');

  if (name === 'messages') loadChats();
  if (name === 'search') {
    document.getElementById('globalSearchInput').focus();
    searchUsersGlobal('');
  }
  if (name === 'profile') { loadProfileUI(); }
};

// ── Chats List ──
window.loadChats = async function() {
  if (!window.currentUser) return;
  const uid = window.currentUser.id;

  const { data: msgs } = await window.sb
    .from('messages')
    .select('sender_id, receiver_id, content, created_at')
    .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
    .order('created_at', { ascending: false });

  const { data: blocked } = await window.sb
    .from('blocked_users').select('blocked_id').eq('blocker_id', uid);
  const blockedIds = new Set((blocked || []).map(b => b.blocked_id));

  const { data: hiddenRows } = await window.sb
    .from('hidden_chats').select('partner_id').eq('user_id', uid);
  const hiddenIds = new Set((hiddenRows || []).map(h => h.partner_id));

  const seen = new Set();
  const partners = [];
  for (const m of (msgs || [])) {
    const pid = m.sender_id === uid ? m.receiver_id : m.sender_id;
    if (!seen.has(pid) && !blockedIds.has(pid) && !hiddenIds.has(pid) && pid !== uid) {
      seen.add(pid);
      partners.push({ pid, lastMsg: m });
    }
  }

  const container = document.getElementById('chatsList');
  if (!partners.length) {
    container.innerHTML = `<div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
      <p>No chats yet.<br>Search for users to start messaging.</p>
      <button onclick="showSection('search')" style="margin-top:0.5rem;padding:0.65rem 1.5rem;background:linear-gradient(135deg,#667eea,#764ba2);border:none;color:#fff;border-radius:20px;cursor:pointer;font-weight:600;font-size:0.9rem;">Start Conversation</button>
    </div>`;
    return;
  }

  let html = '';
  for (const { pid, lastMsg } of partners) {
    const { data: p } = await window.sb.from('profiles').select('username,avatar_url').eq('id', pid).maybeSingle();
    if (!p) continue;
    const presence = window.userPresence.get(pid);
    const isOnline = presence?.online || false;
    const preview = lastMsg.content
      ? (lastMsg.sender_id === uid ? 'You: ' : '') + (lastMsg.content.length > 35 ? lastMsg.content.slice(0, 35) + '…' : lastMsg.content)
      : 'Media';
    html += `
      <div class="chat-item" onclick="openChat('${pid}','${escHtml(p.username)}')" oncontextmenu="showChatCtx(event,'${pid}','${escHtml(p.username)}')" ontouchstart="_ctStart(event,'${pid}','${escHtml(p.username)}')" ontouchend="_ctEnd()" ontouchmove="_ctEnd()">
        <div class="chat-avatar">
          ${p.avatar_url ? `<img src="${escHtml(p.avatar_url)}" alt="">` : p.username[0].toUpperCase()}
          ${isOnline ? '<div class="online-dot"></div>' : ''}
        </div>
        <div class="chat-info">
          <div class="chat-name">${escHtml(p.username)}</div>
          <div class="chat-preview">${escHtml(preview)}</div>
        </div>
        <div class="chat-meta">
          <div class="chat-time">${fmtTime(lastMsg.created_at)}</div>
        </div>
      </div>`;
  }
  container.innerHTML = html;
};

// ── Search (inline in chat tab) ──
async function searchUsersInline(q) {
  const uid = window.currentUser?.id;
  const { data: users } = await window.sb
    .from('profiles').select('id,username,avatar_url,full_name')
    .ilike('username', `%${q}%`).neq('id', uid).limit(20);

  const container = document.getElementById('searchResults');
  if (!users?.length) { container.innerHTML = '<div class="empty-state"><p>No users found</p></div>'; return; }

  container.innerHTML = users.map(u => `
    <div class="user-item" onclick="openChat('${u.id}','${escHtml(u.username)}');clearChatSearch()">
      <div class="chat-avatar" style="width:40px;height:40px;font-size:0.9rem;flex-shrink:0;">
        ${u.avatar_url ? `<img src="${escHtml(u.avatar_url)}" alt="">` : u.username[0].toUpperCase()}
      </div>
      <div class="user-info">
        <div class="user-name">${escHtml(u.username)}</div>
        ${u.full_name ? `<div class="user-sub">${escHtml(u.full_name)}</div>` : ''}
      </div>
    </div>`).join('');
}

window.clearChatSearch = function() {
  document.getElementById('chatSearchInput').value = '';
  document.getElementById('clearChatSearch').classList.add('hidden');
  document.getElementById('searchResults').classList.add('hidden');
  document.getElementById('searchResults').innerHTML = '';
};

// ── Search (global search tab) ──
async function searchUsersGlobal(q) {
  const uid = window.currentUser?.id;
  let query = window.sb.from('profiles').select('id,username,avatar_url,full_name,bio').neq('id', uid).limit(30);
  if (q) query = query.ilike('username', `%${q}%`);

  const { data: users } = await query;
  const container = document.getElementById('globalSearchResults');

  if (!users?.length) {
    container.innerHTML = '<div class="empty-state"><p>No users found</p></div>';
    return;
  }

  // Get blocked list to show correct button state
  const { data: blocked } = await window.sb.from('blocked_users').select('blocked_id').eq('blocker_id', uid);
  const blockedIds = new Set((blocked || []).map(b => b.blocked_id));

  container.innerHTML = users.map(u => {
    const isBlocked = blockedIds.has(u.id);
    return `
    <div class="user-item">
      <div class="chat-avatar" style="width:46px;height:46px;flex-shrink:0;" onclick="openChat('${u.id}','${escHtml(u.username)}');showSection('messages')">
        ${u.avatar_url ? `<img src="${escHtml(u.avatar_url)}" alt="">` : u.username[0].toUpperCase()}
      </div>
      <div class="user-info" style="flex:1;" onclick="openChat('${u.id}','${escHtml(u.username)}');showSection('messages')">
        <div class="user-name">${escHtml(u.username)}</div>
        <div class="user-sub">${u.full_name ? escHtml(u.full_name) : ''}${u.bio ? ' · ' + escHtml(u.bio.slice(0, 40)) : ''}</div>
      </div>
      <div style="display:flex;gap:0.4rem;flex-shrink:0;">
        <button class="btn-outline" style="font-size:0.78rem;padding:0.4rem 0.8rem;" onclick="openChat('${u.id}','${escHtml(u.username)}');showSection('messages')">Message</button>
        ${isBlocked
          ? `<button class="btn-outline" style="font-size:0.78rem;padding:0.4rem 0.8rem;color:#4CAF50;border-color:#4CAF50;" onclick="unblockUser('${u.id}','${escHtml(u.username)}');searchUsersGlobal(document.getElementById('globalSearchInput').value.trim())">Unblock</button>`
          : `<button class="btn-outline" style="font-size:0.78rem;padding:0.4rem 0.8rem;color:#ff4757;border-color:#ff4757;" onclick="blockUserFromSearch('${u.id}','${escHtml(u.username)}')">Block</button>`
        }
      </div>
    </div>`;
  }).join('');
}

// ── Open Chat ──
window.openChat = async function(partnerId, partnerName) {
  if (window.messageSubscription) {
    window.messageSubscription.unsubscribe();
    window.messageSubscription = null;
  }

  window.currentChat = { partnerId, partnerName };

  // Update header
  document.getElementById('chatHeaderName').textContent = partnerName;
  const presence = window.userPresence.get(partnerId);
  const statusEl = document.getElementById('chatHeaderStatus');
  if (presence?.online) {
    statusEl.textContent = 'Online';
    statusEl.className = 'chat-header-status online';
  } else {
    statusEl.textContent = presence?.lastSeen ? `Last seen ${fmtTime(presence.lastSeen)}` : 'Offline';
    statusEl.className = 'chat-header-status';
  }

  // Avatar + username from profile
  const { data: p } = await window.sb.from('profiles').select('avatar_url,username,full_name').eq('id', partnerId).maybeSingle();
  const avatarEl = document.getElementById('chatHeaderAvatar');
  avatarEl.innerHTML = p?.avatar_url
    ? `<img src="${escHtml(p.avatar_url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : (p?.username?.[0] || partnerName[0]).toUpperCase();
  document.getElementById('chatHeaderName').textContent = p?.username || partnerName;

  document.getElementById('chatArea').classList.remove('hidden');
  document.getElementById('messages').innerHTML = '';

  await loadMessages(partnerId);
  setupMessageSubscription(partnerId);
  setTimeout(() => document.getElementById('messageInput').focus(), 100);
};

window.closeChat = function() {
  if (window.messageSubscription) {
    window.messageSubscription.unsubscribe();
    window.messageSubscription = null;
  }
  // Clear typing state
  clearTimeout(typingTimer);
  if (isTyping) { isTyping = false; sendTyping(window.currentChat?.partnerId, false); }
  document.getElementById('messageInput').oninput = null;
  showTypingIndicator(false);
  window.currentChat = null;
  document.getElementById('chatArea').classList.add('hidden');
  loadChats();
};

// ── Load Messages ──
async function loadMessages(partnerId) {
  const uid = window.currentUser.id;
  const { data: messages, error } = await window.sb
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${uid},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${uid})`)
    .eq('unsent', false)
    .order('created_at', { ascending: true });

  if (error) { console.error(error); return; }

  const container = document.getElementById('messages');
  if (!messages?.length) {
    container.innerHTML = `<div class="empty-messages">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
      <p>No messages yet.<br>Say hello! 👋</p>
    </div>`;
    return;
  }

  let html = '';
  let lastDate = '';
  messages.forEach(msg => {
    const isMe = msg.sender_id === uid;
    const dateStr = new Date(msg.created_at).toDateString();
    if (dateStr !== lastDate) {
      html += `<div class="date-separator">${fmtDate(msg.created_at)}</div>`;
      lastDate = dateStr;
    }
    html += `
      <div class="message-wrapper ${isMe ? 'me' : 'them'}" data-id="${msg.id}" data-type="${msg.file_type || 'text'}" data-sender="${msg.sender_id}" data-content="${escHtml(msg.content || '')}" data-url="${escHtml(msg.file_url || '')}" data-fname="${escHtml(msg.file_name || '')}">
        <div class="message" oncontextmenu="showMsgMenu(event,this.parentElement)" ontouchstart="_tmStart(event,this.parentElement)" ontouchend="_tmEnd()" ontouchmove="_tmEnd()">
          ${renderMsgContent(msg)}
          <div class="message-time">${fmtTime(msg.created_at)}</div>
        </div>
      </div>`;
  });
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

// ── Send Message ──
window.sendMessage = async function(e) {
  e.preventDefault();
  if (!window.currentChat) return;
  const input = document.getElementById('messageInput');
  const btn = document.getElementById('sendBtn');
  const content = input.value.trim();
  if (!content) return;

  input.value = '';
  input.disabled = true;
  btn.disabled = true;

  // Optimistically append own message immediately
  const container = document.getElementById('messages');
  const empty = container.querySelector('.empty-messages');
  if (empty) empty.remove();
  const now = new Date().toISOString();
  const div = document.createElement('div');
  div.className = 'message-wrapper me';
  div.innerHTML = `<div class="message">${escHtml(content)}<div class="message-time">now</div></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  const { error } = await window.sb.from('messages').insert({
    sender_id: window.currentUser.id,
    receiver_id: window.currentChat.partnerId,
    content
  });

  input.disabled = false;
  btn.disabled = false;
  input.focus();

  if (error) {
    div.remove(); // remove optimistic message on failure
    input.value = content;
    showToast('Failed to send');
  }
};

// ── Typing indicator ──
let typingTimer = null;
let isTyping = false;

async function sendTyping(partnerId, typing) {
  await window.sb.from('user_presence').upsert({
    user_id: window.currentUser.id,
    is_online: true,
    last_seen: new Date().toISOString(),
    typing_to: typing ? partnerId : null
  });
}

function handleTypingInput(partnerId) {
  if (!isTyping) {
    isTyping = true;
    sendTyping(partnerId, true);
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    isTyping = false;
    sendTyping(partnerId, false);
  }, 2000);
}

function showTypingIndicator(show) {
  const el = document.getElementById('typingIndicator');
  if (!el) return;
  if (show) {
    el.classList.remove('hidden');
    el.innerHTML = `<span class="typing-dots"><span></span><span></span><span></span></span>`;
    document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
  } else {
    el.classList.add('hidden');
    el.innerHTML = '';
  }
}

// ── Real-time subscription ──
function setupMessageSubscription(partnerId) {
  const uid = window.currentUser.id;
  // Consistent channel name regardless of who opened chat
  const channelName = `chat-${[uid, partnerId].sort().join('-')}`;
  window.messageSubscription = window.sb
    .channel(channelName)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `receiver_id=eq.${uid}`
    }, payload => {
      const msg = payload.new;
      if (msg.sender_id !== partnerId) return;

      showTypingIndicator(false);

      const container = document.getElementById('messages');
      if (!container) return;

      const empty = container.querySelector('.empty-messages');
      if (empty) empty.remove();

      const div = document.createElement('div');
      div.className = 'message-wrapper them';
      div.dataset.id = msg.id; div.dataset.type = msg.file_type || 'text'; div.dataset.sender = msg.sender_id; div.dataset.content = msg.content || ''; div.dataset.url = msg.file_url || ''; div.dataset.fname = msg.file_name || '';
      div.innerHTML = `<div class="message" oncontextmenu="showMsgMenu(event,this.parentElement)" ontouchstart="_tmStart(event,this.parentElement)" ontouchend="_tmEnd()" ontouchmove="_tmEnd()">${renderMsgContent(msg)}<div class="message-time">${fmtTime(msg.created_at)}</div></div>`;
      div.style.opacity = '0';
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
      requestAnimationFrame(() => { div.style.transition = 'opacity 0.2s'; div.style.opacity = '1'; });
      playPing();
    })
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'user_presence',
      filter: `user_id=eq.${partnerId}`
    }, payload => {
      const r = payload.new;
      const isTypingToMe = r.typing_to === uid;
      showTypingIndicator(isTypingToMe);
    })
    .subscribe();

  // Hook typing events on input
  const input = document.getElementById('messageInput');
  input.oninput = () => handleTypingInput(partnerId);
}

function setupChatListSubscription() {
  const uid = window.currentUser.id;
  window.sb.channel('chat-list-updates')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const msg = payload.new;
      if (msg.receiver_id === uid || msg.sender_id === uid) {
        if (!window.currentChat || (msg.sender_id !== window.currentChat.partnerId && msg.receiver_id !== window.currentChat.partnerId)) {
          loadChats();
        }
      }
    })
    .subscribe();
}

// ── Presence ──
function setupPresence() {
  updatePresence(true);
  setInterval(() => { if (!document.hidden) updatePresence(true); }, 30000);
  document.addEventListener('visibilitychange', () => updatePresence(!document.hidden));
  window.addEventListener('beforeunload', () => updatePresence(false));
  loadPresence();

  window.presenceSubscription = window.sb
    .channel('presence-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, payload => {
      const r = payload.new || payload.old;
      if (!r) return;
      const isOnline = r.is_online && (Date.now() - new Date(r.last_seen).getTime()) < 120000;
      window.userPresence.set(r.user_id, { online: isOnline, lastSeen: new Date(r.last_seen) });
      updatePresenceUI();
    })
    .subscribe();
}

async function updatePresence(isOnline) {
  if (!window.currentUser) return;
  await window.sb.from('user_presence').upsert({
    user_id: window.currentUser.id,
    is_online: isOnline,
    last_seen: new Date().toISOString()
  });
}

async function loadPresence() {
  const { data } = await window.sb.from('user_presence').select('*');
  window.userPresence.clear();
  (data || []).forEach(p => {
    const isOnline = p.is_online && (Date.now() - new Date(p.last_seen).getTime()) < 120000;
    window.userPresence.set(p.user_id, { online: isOnline, lastSeen: new Date(p.last_seen) });
  });
  updatePresenceUI();
}

function updatePresenceUI() {
  if (window.currentChat) {
    const p = window.userPresence.get(window.currentChat.partnerId);
    const statusEl = document.getElementById('chatHeaderStatus');
    if (statusEl) {
      if (p?.online) { statusEl.textContent = 'Online'; statusEl.className = 'chat-header-status online'; }
      else { statusEl.textContent = p?.lastSeen ? `Last seen ${fmtTime(p.lastSeen)}` : 'Offline'; statusEl.className = 'chat-header-status'; }
    }
  }
}

// ── Block User ──
window.blockCurrentUser = async function() {
  if (!window.currentChat) return;
  if (!confirm(`Block ${window.currentChat.partnerName}?`)) return;
  await window.sb.from('blocked_users').insert({
    blocker_id: window.currentUser.id,
    blocked_id: window.currentChat.partnerId
  });
  showToast(`${window.currentChat.partnerName} blocked`);
  closeChat();
};

window.blockUserFromSearch = async function(userId, username) {
  if (!confirm(`Block ${username}?`)) return;
  const { error } = await window.sb.from('blocked_users').insert({
    blocker_id: window.currentUser.id,
    blocked_id: userId
  });
  if (error) { showToast('Already blocked'); return; }
  showToast(`${username} blocked`);
  searchUsersGlobal(document.getElementById('globalSearchInput').value.trim());
};

window.showBlockedUsers = async function() {
  const container = document.getElementById('blockedUsersList');
  const isVisible = container.style.display !== 'none';
  if (isVisible) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  const { data } = await window.sb.from('blocked_users').select('blocked_id').eq('blocker_id', window.currentUser.id);
  if (!data?.length) { container.innerHTML = '<div class="empty-state"><p>No blocked users</p></div>'; return; }
  let html = '';
  for (const b of data) {
    const { data: p } = await window.sb.from('profiles').select('username,avatar_url').eq('id', b.blocked_id).maybeSingle();
    if (!p) continue;
    html += `<div class="user-item">
      <div class="chat-avatar" style="width:42px;height:42px;flex-shrink:0;">${p.avatar_url ? `<img src="${escHtml(p.avatar_url)}" alt="">` : p.username[0].toUpperCase()}</div>
      <div class="user-info" style="flex:1;"><div class="user-name">${escHtml(p.username)}</div></div>
      <button class="btn-outline" style="font-size:0.78rem;padding:0.4rem 0.8rem;color:#4CAF50;border-color:#4CAF50;" onclick="unblockUser('${b.blocked_id}','${escHtml(p.username)}')">Unblock</button>
    </div>`;
  }
  container.innerHTML = html;
};

// ── Message Context Menu ──
let _tmTimer = null;
window._tmStart = function(e, wrapper) { _tmTimer = setTimeout(() => { _tmEnd(); showMsgMenu(e, wrapper); }, 500); };
window._tmEnd = function() { clearTimeout(_tmTimer); };

window.showMsgMenu = function(e, wrapper) {
  e.preventDefault();
  document.querySelectorAll('.msg-ctx-menu').forEach(m => m.remove());
  const isMe = wrapper.dataset.sender === window.currentUser.id;
  const type = wrapper.dataset.type;
  const isText = type === 'text';
  const items = [];
  if (isText) items.push(`<div class="msg-ctx-item" onclick="copyMsg('${wrapper.dataset.id}')">📋 Copy</div>`);
  if (isMe && isText) items.push(`<div class="msg-ctx-item" onclick="editMsg('${wrapper.dataset.id}')">✏️ Edit</div>`);
  if (isMe) items.push(`<div class="msg-ctx-item danger" onclick="unsendMsg('${wrapper.dataset.id}')">🗑️ Unsend</div>`);
  items.push(`<div class="msg-ctx-item" onclick="forwardMsg('${wrapper.dataset.id}')">➡️ Forward</div>`);
  const menu = document.createElement('div');
  menu.className = 'msg-ctx-menu';
  menu.innerHTML = items.join('');
  document.body.appendChild(menu);
  const x = Math.min(e.clientX || e.touches?.[0]?.clientX || 0, window.innerWidth - 160);
  const y = Math.min(e.clientY || e.touches?.[0]?.clientY || 0, window.innerHeight - menu.offsetHeight - 10);
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 10);
};

window.copyMsg = function(id) {
  const w = document.querySelector(`[data-id="${id}"]`);
  navigator.clipboard.writeText(w?.dataset.content || '').then(() => showToast('Copied'));
};

window.editMsg = function(id) {
  const w = document.querySelector(`[data-id="${id}"]`);
  if (!w) return;
  const bubble = w.querySelector('.message');
  const old = w.dataset.content;
  bubble.innerHTML = `<input id="editInline_${id}" value="${escHtml(old)}" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);border-radius:8px;padding:0.4rem 0.6rem;color:#fff;width:100%;font-size:0.95rem;outline:none;">
    <div style="display:flex;gap:0.5rem;margin-top:0.4rem;justify-content:flex-end;">
      <button onclick="cancelEdit('${id}','${escHtml(old)}')" style="background:rgba(255,255,255,0.1);border:none;color:#fff;padding:0.3rem 0.7rem;border-radius:6px;cursor:pointer;">Cancel</button>
      <button onclick="saveEdit('${id}')" style="background:#667eea;border:none;color:#fff;padding:0.3rem 0.7rem;border-radius:6px;cursor:pointer;">Save</button>
    </div>`;
  document.getElementById(`editInline_${id}`)?.focus();
};

window.cancelEdit = function(id, old) {
  const w = document.querySelector(`[data-id="${id}"]`);
  if (!w) return;
  const msg = { content: old, edited: w.querySelector('[data-edited]') !== null, file_type: null };
  w.querySelector('.message').innerHTML = `${escHtml(old)}<div class="message-time">${w.querySelector('.message-time')?.textContent || ''}</div>`;
};

window.saveEdit = async function(id) {
  const input = document.getElementById(`editInline_${id}`);
  const newContent = input?.value.trim();
  if (!newContent) return;
  const { error } = await window.sb.from('messages').update({ content: newContent, edited: true, edited_at: new Date().toISOString() }).eq('id', id).eq('sender_id', window.currentUser.id);
  if (error) { showToast('Edit failed'); return; }
  const w = document.querySelector(`[data-id="${id}"]`);
  w.dataset.content = newContent;
  w.querySelector('.message').innerHTML = `${escHtml(newContent)} <span style="font-size:0.7rem;opacity:0.6">(edited)</span><div class="message-time">${w.querySelector('.message-time')?.textContent || 'now'}</div>`;
};

window.unsendMsg = async function(id) {
  const { error } = await window.sb.from('messages').update({ unsent: true }).eq('id', id).eq('sender_id', window.currentUser.id);
  if (error) { showToast('Failed'); return; }
  document.querySelector(`[data-id="${id}"]`)?.remove();
  showToast('Message unsent');
};

window.forwardMsg = async function(id) {
  const w = document.querySelector(`[data-id="${id}"]`);
  if (!w) return;
  const uid = window.currentUser.id;
  const { data: msgs } = await window.sb.from('messages').select('sender_id,receiver_id').or(`sender_id.eq.${uid},receiver_id.eq.${uid}`).order('created_at', { ascending: false });
  const seen = new Set(); const partners = [];
  for (const m of (msgs || [])) {
    const pid = m.sender_id === uid ? m.receiver_id : m.sender_id;
    if (!seen.has(pid) && pid !== uid) { seen.add(pid); partners.push(pid); }
  }
  const profiles = partners.length ? (await window.sb.from('profiles').select('id,username,avatar_url').in('id', partners)).data || [] : [];
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay'; overlay.style.zIndex = '10000';
  overlay.innerHTML = `<div class="modal-sheet" style="max-height:70vh;overflow-y:auto;">
    <h3 style="margin-bottom:1rem;">Forward to</h3>
    ${profiles.map(p => `<div class="user-item" style="cursor:pointer;" onclick="_doForward('${id}','${p.id}','${escHtml(p.username)}');this.closest('.modal-overlay').remove()">
      <div class="chat-avatar" style="width:42px;height:42px;flex-shrink:0;">${p.avatar_url ? `<img src="${escHtml(p.avatar_url)}" alt="">` : p.username[0].toUpperCase()}</div>
      <div class="user-info"><div class="user-name">${escHtml(p.username)}</div></div>
    </div>`).join('') || '<p style="opacity:0.5;padding:1rem;">No conversations yet</p>'}
    <button class="btn-cancel" style="margin-top:1rem;width:100%;" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
  </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
};

window._doForward = async function(id, toId, toName) {
  const w = document.querySelector(`[data-id="${id}"]`);
  if (!w) return;
  const type = w.dataset.type;
  const payload = { sender_id: window.currentUser.id, receiver_id: toId };
  if (type === 'text') payload.content = w.dataset.content;
  else { payload.file_url = w.dataset.url; payload.file_type = type; payload.file_name = w.dataset.fname; payload.content = null; }
  await window.sb.from('messages').insert(payload);
  showToast(`Forwarded to ${toName}`);
};

window.unblockUser = async function(userId, username) {
  await window.sb.from('blocked_users').delete().eq('blocker_id', window.currentUser.id).eq('blocked_id', userId);
  showToast(`${username} unblocked`);
  document.getElementById('blockedUsersList').style.display = 'none';
  showBlockedUsers();
  searchUsersGlobal(document.getElementById('globalSearchInput').value.trim());
};

// ── ImageKit (replaced by Supabase Storage) ──
window._pendingAvatarUrl = null;

window.handleAvatarSelect = async function(input) {
  const file = input.files?.[0];
  if (!file) return;

  const status = document.getElementById('avatarUploadStatus');
  const preview = document.getElementById('avatarPreview');
  status.textContent = 'Uploading...';
  status.style.color = '#8e8e8e';

  try {
    const ext = file.name.split('.').pop();
    const path = `${window.currentUser.id}/avatar.${ext}`;

    const { error: uploadError } = await window.sb.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = window.sb.storage.from('avatars').getPublicUrl(path);
    window._pendingAvatarUrl = data.publicUrl;

    preview.innerHTML = `<img src="${data.publicUrl}?t=${Date.now()}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    status.textContent = '✓ Photo ready';
    status.style.color = '#4CAF50';
  } catch (err) {
    console.error('Avatar upload error:', err);
    status.textContent = 'Upload failed. Try again.';
    status.style.color = '#ff4757';
  }
};

function loadProfileUI() {
  const p = window.currentUser?.profile;
  if (!p) return;
  const avatarEl = document.getElementById('profileAvatar');
  avatarEl.innerHTML = p.avatar_url ? `<img src="${escHtml(p.avatar_url)}" alt="">` : (p.username?.[0]?.toUpperCase() || 'U');
  document.getElementById('profileUsername').textContent = p.username || '';
  document.getElementById('profileFullname').textContent = p.full_name || '';
  document.getElementById('profileBio').textContent = p.bio || '';
  // Update nav profile pic
  const navPic = document.getElementById('navProfilePic');
  if (navPic) {
    navPic.innerHTML = p.avatar_url
      ? `<img src="${escHtml(p.avatar_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : (p.username?.[0]?.toUpperCase() || 'U');
  }
}

window.openEditProfile = function() {
  const p = window.currentUser?.profile;
  if (!p) return;
  window._pendingAvatarUrl = null;
  document.getElementById('editUsername').value = p.username || '';
  document.getElementById('editFullname').value = p.full_name || '';
  document.getElementById('editBio').value = p.bio || '';
  // Show current avatar in preview
  const preview = document.getElementById('avatarPreview');
  preview.innerHTML = p.avatar_url
    ? `<img src="${escHtml(p.avatar_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : (p.username?.[0]?.toUpperCase() || 'U');
  const status = document.getElementById('avatarUploadStatus');
  status.textContent = '';
  status.style.color = '#8e8e8e';
  document.getElementById('editProfileModal').classList.remove('hidden');
};

window.closeEditProfile = function() {
  document.getElementById('editProfileModal').classList.add('hidden');
};

window.saveProfile = async function() {
  const username = document.getElementById('editUsername').value.trim();
  const full_name = document.getElementById('editFullname').value.trim();
  const bio = document.getElementById('editBio').value.trim();
  // Use newly uploaded URL, or keep existing
  const avatar_url = window._pendingAvatarUrl || window.currentUser.profile?.avatar_url || '';

  if (!username) { showToast('Username required'); return; }

  if (username !== window.currentUser.profile?.username) {
    const { data: existing } = await window.sb.from('profiles').select('id').eq('username', username).maybeSingle();
    if (existing) { showToast('Username already taken'); return; }
  }

  const { error } = await window.sb.from('profiles')
    .update({ username, full_name, bio, avatar_url, updated_at: new Date().toISOString() })
    .eq('id', window.currentUser.id);

  if (error) { showToast('Failed to save'); return; }

  // Sync to Supabase Auth user_metadata so it reflects on next login
  await window.sb.auth.updateUser({
    data: { username, full_name, bio, avatar_url }
  });

  window.currentUser.profile = { ...window.currentUser.profile, username, full_name, bio, avatar_url };
  window._pendingAvatarUrl = null;
  closeEditProfile();
  loadProfileUI();
  showToast('Profile updated');
};

// ── Settings ──
window.openSettings = function() { document.getElementById('settingsModal').classList.remove('hidden'); };
window.closeSettings = function() { document.getElementById('settingsModal').classList.add('hidden'); };

// ── Chat context menu (hide) ──
let _ctTimer = null;
window._ctStart = function(e, pid, name) { _ctTimer = setTimeout(() => { _ctEnd(); showChatCtx(e, pid, name); }, 500); };
window._ctEnd = function() { clearTimeout(_ctTimer); };
window.showChatCtx = function(e, pid, name) {
  e.preventDefault();
  document.querySelectorAll('.msg-ctx-menu').forEach(m => m.remove());
  const menu = document.createElement('div');
  menu.className = 'msg-ctx-menu';
  menu.innerHTML = `<div class="msg-ctx-item" onclick="hideChat('${pid}','${escHtml(name)}')">🔒 Hide Chat</div>`;
  document.body.appendChild(menu);
  const x = Math.min(e.clientX || e.touches?.[0]?.clientX || 0, window.innerWidth - 160);
  const y = Math.min(e.clientY || e.touches?.[0]?.clientY || 0, window.innerHeight - 80);
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 10);
};

// ── Hidden Chats ──
async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

window.hideChat = async function(pid, name) {
  const uid = window.currentUser.id;
  const { data: prof } = await window.sb.from('profiles').select('hidden_chat_pin').eq('id', uid).maybeSingle();
  if (!prof?.hidden_chat_pin) {
    _showSetPinUI(pid, name);
  } else {
    _showEnterPinUI('hide', pid, name);
  }
};

function _pinModal(title, bodyHtml) {
  document.querySelectorAll('.pin-modal').forEach(m => m.remove());
  const d = document.createElement('div');
  d.className = 'modal-overlay pin-modal';
  d.style.zIndex = '10001';
  d.innerHTML = `<div class="modal-card" style="max-width:320px;width:90%;">
    <h3 style="margin-bottom:1rem;">${title}</h3>${bodyHtml}</div>`;
  document.body.appendChild(d);
  return d;
}

function _showSetPinUI(pid, name) {
  const d = _pinModal('Set Hidden Chats Password',
    `<p style="font-size:0.85rem;opacity:0.7;margin-bottom:1rem;">Create a password to protect hidden chats.</p>
    <input id="pinNew" type="password" placeholder="New password" style="width:100%;padding:0.7rem;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:#fff;font-size:1rem;margin-bottom:0.7rem;outline:none;">
    <input id="pinConfirm" type="password" placeholder="Confirm password" style="width:100%;padding:0.7rem;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:#fff;font-size:1rem;margin-bottom:0.3rem;outline:none;">
    <div id="pinErr" style="color:#ff5555;font-size:0.8rem;min-height:1.2rem;margin-bottom:0.7rem;"></div>
    <div style="display:flex;gap:0.7rem;">
      <button class="btn-cancel" style="flex:1;" onclick="this.closest('.pin-modal').remove()">Cancel</button>
      <button class="btn-primary" style="flex:1;" onclick="_confirmSetPin('${pid}','${escHtml(name)}')">✓ Set</button>
    </div>`);
}

window._confirmSetPin = async function(pid, name) {
  const p1 = document.getElementById('pinNew').value;
  const p2 = document.getElementById('pinConfirm').value;
  const err = document.getElementById('pinErr');
  if (!p1 || p1.length < 4) { err.textContent = 'Min 4 characters'; return; }
  if (p1 !== p2) { err.textContent = 'Passwords do not match'; return; }
  const hash = await hashPin(p1);
  await window.sb.from('profiles').update({ hidden_chat_pin: hash }).eq('id', window.currentUser.id);
  document.querySelector('.pin-modal')?.remove();
  if (pid) await _doHideChat(pid, name);
};

function _showEnterPinUI(mode, pid, name) {
  const d = _pinModal(mode === 'hide' ? 'Enter Password to Hide' : mode === 'view' ? 'Hidden Chats' : 'Enter Password',
    `<input id="pinEnter" type="password" placeholder="Enter password" style="width:100%;padding:0.7rem;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:#fff;font-size:1rem;margin-bottom:0.3rem;outline:none;">
    <div id="pinErr" style="color:#ff5555;font-size:0.8rem;min-height:1.2rem;margin-bottom:0.7rem;"></div>
    <div style="display:flex;gap:0.7rem;margin-bottom:0.5rem;">
      <button class="btn-cancel" style="flex:1;" onclick="this.closest('.pin-modal').remove()">Cancel</button>
      <button class="btn-primary" style="flex:1;" onclick="_verifyPin('${mode}','${pid||''}','${escHtml(name||'')}')">✓ Unlock</button>
    </div>
    <div style="text-align:center;"><button onclick="_forgotHiddenPin()" style="background:none;border:none;color:#667eea;font-size:0.82rem;cursor:pointer;">Forgot password?</button></div>`);
  setTimeout(() => document.getElementById('pinEnter')?.focus(), 100);
}

window._verifyPin = async function(mode, pid, name) {
  const entered = document.getElementById('pinEnter').value;
  const err = document.getElementById('pinErr');
  if (!entered) { err.textContent = 'Enter password'; return; }
  const { data: prof } = await window.sb.from('profiles').select('hidden_chat_pin').eq('id', window.currentUser.id).maybeSingle();
  const hash = await hashPin(entered);
  if (hash !== prof?.hidden_chat_pin) { err.textContent = 'Incorrect password'; return; }
  document.querySelector('.pin-modal')?.remove();
  if (mode === 'hide') await _doHideChat(pid, name);
  else if (mode === 'view') await _showHiddenChatsList();
  else if (mode === 'unhide') await _doUnhideChat(pid, name);
};

async function _doHideChat(pid, name) {
  await window.sb.from('hidden_chats').upsert({ user_id: window.currentUser.id, partner_id: pid }, { onConflict: 'user_id,partner_id' });
  showToast(`${name} hidden`);
  loadChats();
}

async function _doUnhideChat(pid, name) {
  await window.sb.from('hidden_chats').delete().eq('user_id', window.currentUser.id).eq('partner_id', pid);
  showToast(`${name} unhidden`);
  document.getElementById('hiddenChatsModal').classList.add('hidden');
  loadChats();
}

window.openHiddenChats = async function() {
  closeSettings();
  const { data: prof } = await window.sb.from('profiles').select('hidden_chat_pin').eq('id', window.currentUser.id).maybeSingle();
  if (!prof?.hidden_chat_pin) {
    _showSetPinUI(null, null);
  } else {
    _showEnterPinUI('view', null, null);
  }
};

window.closeHiddenChats = function() { document.getElementById('hiddenChatsModal').classList.add('hidden'); };

async function _showHiddenChatsList() {
  const uid = window.currentUser.id;
  const { data: rows } = await window.sb.from('hidden_chats').select('partner_id').eq('user_id', uid);
  const modal = document.getElementById('hiddenChatsModal');
  const body = document.getElementById('hcBody');
  modal.classList.remove('hidden');
  if (!rows?.length) { body.innerHTML = '<p style="opacity:0.5;padding:1rem 0;">No hidden chats</p>'; return; }
  let html = '';
  for (const r of rows) {
    const { data: p } = await window.sb.from('profiles').select('username,avatar_url').eq('id', r.partner_id).maybeSingle();
    if (!p) continue;
    html += `<div class="user-item">
      <div class="chat-avatar" style="width:42px;height:42px;flex-shrink:0;cursor:pointer;" onclick="document.getElementById('hiddenChatsModal').classList.add('hidden');openChat('${r.partner_id}','${escHtml(p.username)}')">
        ${p.avatar_url ? `<img src="${escHtml(p.avatar_url)}" alt="">` : p.username[0].toUpperCase()}
      </div>
      <div class="user-info" style="flex:1;cursor:pointer;" onclick="document.getElementById('hiddenChatsModal').classList.add('hidden');openChat('${r.partner_id}','${escHtml(p.username)}')">
        <div class="user-name">${escHtml(p.username)}</div>
      </div>
      <button class="btn-outline" style="font-size:0.78rem;padding:0.4rem 0.8rem;color:#4CAF50;border-color:#4CAF50;" onclick="_showEnterPinUI('unhide','${r.partner_id}','${escHtml(p.username)}')">🔓 Unhide</button>
    </div>`;
  }
  body.innerHTML = html;
}

// ── Forgot Hidden Chat PIN ──
window._forgotHiddenPin = function() {
  document.querySelector('.pin-modal')?.remove();
  const d = _pinModal('Forgot Password',
    `<p style="font-size:0.85rem;opacity:0.7;margin-bottom:1rem;">Enter your account login password to reset.</p>
    <input id="loginPassCheck" type="password" placeholder="Login password" style="width:100%;padding:0.7rem;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:#fff;font-size:1rem;margin-bottom:0.3rem;outline:none;">
    <div id="pinErr" style="color:#ff5555;font-size:0.8rem;min-height:1.2rem;margin-bottom:0.7rem;"></div>
    <div style="display:flex;gap:0.7rem;">
      <button class="btn-cancel" style="flex:1;" onclick="this.closest('.pin-modal').remove()">Cancel</button>
      <button class="btn-primary" style="flex:1;" onclick="_verifyLoginForPin()">Verify</button>
    </div>`);
};

window._verifyLoginForPin = async function() {
  const pass = document.getElementById('loginPassCheck').value;
  const err = document.getElementById('pinErr');
  if (!pass) { err.textContent = 'Enter your login password'; return; }
  const email = window.currentUser.email;
  const { error } = await window.sb.auth.signInWithPassword({ email, password: pass });
  if (error) { err.textContent = 'Incorrect password'; return; }
  document.querySelector('.pin-modal')?.remove();
  _showNewPinAfterVerify();
};

function _showNewPinAfterVerify() {
  _pinModal('Set New Password',
    `<input id="pinNew" type="password" placeholder="New password" style="width:100%;padding:0.7rem;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:#fff;font-size:1rem;margin-bottom:0.7rem;outline:none;">
    <input id="pinConfirm" type="password" placeholder="Confirm password" style="width:100%;padding:0.7rem;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:#fff;font-size:1rem;margin-bottom:0.3rem;outline:none;">
    <div id="pinErr" style="color:#ff5555;font-size:0.8rem;min-height:1.2rem;margin-bottom:0.7rem;"></div>
    <div style="display:flex;gap:0.7rem;">
      <button class="btn-cancel" style="flex:1;" onclick="this.closest('.pin-modal').remove()">Cancel</button>
      <button class="btn-primary" style="flex:1;" onclick="_confirmSetPin(null,null)">✓ Save</button>
    </div>`);
}

// ── Logout ──
window.logout = async function() {
  await updatePresence(false);
  if (window.messageSubscription) window.messageSubscription.unsubscribe();
  if (window.presenceSubscription) window.presenceSubscription.unsubscribe();
  await window.sb.auth.signOut();
  window.location.href = 'auth.html';
};

// ── Helpers ──
function fmtTime(ts) {
  const d = new Date(ts), now = new Date(), diff = now - d;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function fmtDate(ts) {
  const d = new Date(ts), now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - msgDay) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function playPing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  } catch (_) {}
}

function renderMsgContent(msg) {
  if (msg.file_type === 'audio') return buildAudioPlayer(msg.file_url);
  if (msg.file_type === 'image') return `<div class="image-message"><img src="${escHtml(msg.file_url)}" style="cursor:zoom-in" onclick="(function(u,n){var lb=document.getElementById('imgLightbox');document.getElementById('imgLightboxImg').src=u;document.getElementById('imgLightboxDl').href=u;document.getElementById('imgLightboxDl').download=n||'image';lb.style.display='flex';}('${escHtml(msg.file_url)}','${escHtml(msg.file_name||'image')}'))"></div>`;
  if (msg.file_type === 'doc') return `<div class="doc-message"><svg width="20" height="20" viewBox="0 0 24 24" fill="#FF9800"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg><span style="flex:1;">${escHtml(msg.file_name || 'Document')}</span><a href="${escHtml(msg.file_url)}" download="${escHtml(msg.file_name || 'document')}" onclick="event.stopPropagation()" style="color:#FF9800;text-decoration:none;"><svg width="18" height="18" viewBox="0 0 24 24" fill="#FF9800"><path d="M19 9h-4V3H9v6H5l7 7 7-7zm-7 9H5v2h14v-2h-7z"/></svg></a></div>`;
  return escHtml(msg.content || '') + (msg.edited ? ' <span style="font-size:0.7rem;opacity:0.6">(edited)</span>' : '');
}

const SPEEDS = [1, 1.5, 2];
function buildAudioPlayer(url) {
  const id = 'ap_' + Math.random().toString(36).substr(2, 8);
  // 20 bars with random heights for waveform look
  const bars = Array.from({length: 20}, () => {
    const h = 4 + Math.floor(Math.random() * 20);
    return `<div class="bar" style="height:${h}px"></div>`;
  }).join('');
  return `
    <div class="audio-player" id="${id}">
      <audio src="${escHtml(url)}" preload="metadata" style="display:none;"></audio>
      <button class="audio-play-btn" onclick="toggleAudio('${id}')">
        <svg class="play-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        <svg class="pause-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
      </button>
      <div class="audio-waveform" onclick="seekAudio('${id}', event)">${bars}</div>
      <span class="audio-duration">0:00</span>
      <button class="audio-speed-btn" onclick="cycleSpeed('${id}')">1x</button>
    </div>`;
}

window.toggleAudio = function(id) {
  const wrap = document.getElementById(id);
  if (!wrap) return;
  const audio = wrap.querySelector('audio');
  const playIcon = wrap.querySelector('.play-icon');
  const pauseIcon = wrap.querySelector('.pause-icon');
  // Pause all other players
  document.querySelectorAll('.audio-player audio').forEach(a => {
    if (a !== audio && !a.paused) {
      a.pause();
      const w = a.closest('.audio-player');
      if (w) { w.querySelector('.play-icon').style.display=''; w.querySelector('.pause-icon').style.display='none'; }
    }
  });
  if (audio.paused) {
    audio.play();
    playIcon.style.display = 'none'; pauseIcon.style.display = '';
  } else {
    audio.pause();
    playIcon.style.display = ''; pauseIcon.style.display = 'none';
  }
  audio.ontimeupdate = () => updateAudioProgress(id);
  audio.onended = () => {
    playIcon.style.display = ''; pauseIcon.style.display = 'none';
    wrap.querySelectorAll('.bar').forEach(b => b.classList.remove('played'));
    wrap.querySelector('.audio-duration').textContent = fmtAudioTime(audio.duration);
  };
  audio.onloadedmetadata = () => {
    wrap.querySelector('.audio-duration').textContent = fmtAudioTime(audio.duration);
  };
};

function updateAudioProgress(id) {
  const wrap = document.getElementById(id);
  if (!wrap) return;
  const audio = wrap.querySelector('audio');
  const bars = wrap.querySelectorAll('.bar');
  const pct = audio.duration ? audio.currentTime / audio.duration : 0;
  const played = Math.floor(pct * bars.length);
  bars.forEach((b, i) => b.classList.toggle('played', i < played));
  wrap.querySelector('.audio-duration').textContent = fmtAudioTime(audio.currentTime);
}

window.seekAudio = function(id, e) {
  const wrap = document.getElementById(id);
  if (!wrap) return;
  const audio = wrap.querySelector('audio');
  const waveform = wrap.querySelector('.audio-waveform');
  const rect = waveform.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  audio.currentTime = pct * audio.duration;
  updateAudioProgress(id);
};

window.cycleSpeed = function(id) {
  const wrap = document.getElementById(id);
  if (!wrap) return;
  const audio = wrap.querySelector('audio');
  const btn = wrap.querySelector('.audio-speed-btn');
  const cur = SPEEDS.indexOf(audio.playbackRate);
  const next = SPEEDS[(cur + 1) % SPEEDS.length];
  audio.playbackRate = next;
  btn.textContent = next + 'x';
};

function fmtAudioTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  return m + ':' + Math.floor(s % 60).toString().padStart(2, '0');
}

// ── Attachment Menu ──
window.toggleAttachMenu = function() {
  const menu = document.getElementById('attachMenu');
  menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
};
function closeAttachMenu() { document.getElementById('attachMenu').style.display = 'none'; }
let _camStream = null, _camFacing = 'environment';
window.openCamera = async function() {
  closeAttachMenu();
  const modal = document.getElementById('cameraModal');
  modal.style.display = 'flex';
  await _startCam();
};
async function _startCam() {
  if (_camStream) { _camStream.getTracks().forEach(t => t.stop()); }
  try {
    _camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: _camFacing }, audio: false });
    document.getElementById('cameraVideo').srcObject = _camStream;
  } catch(e) { showToast('Camera access denied'); closeCameraModal(); }
}
window.flipCamera = async function() {
  _camFacing = _camFacing === 'environment' ? 'user' : 'environment';
  await _startCam();
};
window.capturePhoto = function() {
  const video = document.getElementById('cameraVideo');
  const canvas = document.getElementById('cameraCanvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob(async blob => {
    closeCameraModal();
    const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const input = document.getElementById('cameraInput');
    input.files = dt.files;
    await handleImageUpload(input);
  }, 'image/jpeg', 0.92);
};
window.closeCameraModal = function() {
  if (_camStream) { _camStream.getTracks().forEach(t => t.stop()); _camStream = null; }
  document.getElementById('cameraModal').style.display = 'none';
};
window.openGallery = function() { closeAttachMenu(); document.getElementById('galleryInput').click(); };
window.openDocs = function() { closeAttachMenu(); document.getElementById('docsInput').click(); };

document.addEventListener('click', e => {
  const menu = document.getElementById('attachMenu');
  const btn = document.getElementById('attachBtn');
  if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) menu.style.display = 'none';
});

async function uploadToCloudinary(file, preset, resourceType) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', preset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/diw8k8qsk/${resourceType}/upload`, { method: 'POST', body: formData });
  const data = await res.json();
  if (!data.secure_url) throw new Error(data.error?.message || 'Upload failed');
  return data.secure_url;
}

function optimisticMsg(html) {
  if (!window.currentChat) return;
  const container = document.getElementById('messages');
  const empty = container.querySelector('.empty-messages');
  if (empty) empty.remove();
  const div = document.createElement('div');
  div.className = 'message-wrapper me';
  div.innerHTML = `<div class="message">${html}<div class="message-time">now</div></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

window.handleImageUpload = async function(input) {
  const file = input.files?.[0];
  if (!file || !window.currentChat) return;
  input.value = '';
  showToast('Sending image...');
  try {
    const url = await uploadToCloudinary(file, 'images genzes', 'image');
    optimisticMsg(`<div class="image-message"><img src="${url}" style="cursor:zoom-in" onclick="(function(u,n){var lb=document.getElementById('imgLightbox');document.getElementById('imgLightboxImg').src=u;document.getElementById('imgLightboxDl').href=u;document.getElementById('imgLightboxDl').download=n||'image';lb.style.display='flex';}('${url}','${escHtml(file.name)}'))"></div>`);
    await window.sb.from('messages').insert({ sender_id: window.currentUser.id, receiver_id: window.currentChat.partnerId, content: null, file_url: url, file_type: 'image', file_name: file.name });
  } catch (err) { showToast('Failed to send image'); }
};

window.handleDocUpload = async function(input) {
  const file = input.files?.[0];
  if (!file || !window.currentChat) return;
  input.value = '';
  showToast('Sending document...');
  try {
    const url = await uploadToCloudinary(file, 'docs genzes', 'auto');
    optimisticMsg(`<div class="doc-message"><svg width="20" height="20" viewBox="0 0 24 24" fill="#FF9800"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg><span style="flex:1;">${escHtml(file.name)}</span><a href="${url}" download="${escHtml(file.name)}" onclick="event.stopPropagation()" style="color:#FF9800;text-decoration:none;"><svg width="18" height="18" viewBox="0 0 24 24" fill="#FF9800"><path d="M19 9h-4V3H9v6H5l7 7 7-7zm-7 9H5v2h14v-2h-7z"/></svg></a></div>`);
    await window.sb.from('messages').insert({ sender_id: window.currentUser.id, receiver_id: window.currentChat.partnerId, content: null, file_url: url, file_type: 'doc', file_name: file.name });
  } catch (err) { console.error('Doc upload error:', err); showToast('Failed: ' + err.message); }
};

let mediaRecorder = null;
let audioChunks = [];
let recordingInterval = null;
let recordingSeconds = 0;

window.toggleRecording = async function() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopAndSendAudio();
  } else {
    await startRecording();
  }
};

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.start();

    document.getElementById('micBtn').classList.add('recording');
    document.getElementById('recordingBar').classList.add('active');
    document.getElementById('messageInput').disabled = true;

    recordingSeconds = 0;
    document.getElementById('recordingTimer').textContent = '0:00';
    recordingInterval = setInterval(() => {
      recordingSeconds++;
      const m = Math.floor(recordingSeconds / 60);
      const s = recordingSeconds % 60;
      document.getElementById('recordingTimer').textContent = `${m}:${s.toString().padStart(2,'0')}`;
      if (recordingSeconds >= 120) stopAndSendAudio(); // 2 min max
    }, 1000);
  } catch (err) {
    showToast('Microphone access denied');
  }
}

window.cancelRecording = function() {
  if (mediaRecorder) {
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
    mediaRecorder = null;
  }
  clearInterval(recordingInterval);
  audioChunks = [];
  document.getElementById('micBtn').classList.remove('recording');
  document.getElementById('recordingBar').classList.remove('active');
  document.getElementById('messageInput').disabled = false;
};

window.stopAndSendAudio = function() {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') return;
  mediaRecorder.onstop = async () => {
    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
    mediaRecorder = null;
    clearInterval(recordingInterval);
    document.getElementById('micBtn').classList.remove('recording');
    document.getElementById('recordingBar').classList.remove('active');
    document.getElementById('messageInput').disabled = false;
    await uploadAndSendAudio(blob);
  };
  mediaRecorder.stop();
};

async function uploadAndSendAudio(blob) {
  if (!window.currentChat) return;
  showToast('Sending audio...');

  const formData = new FormData();
  formData.append('file', blob, 'audio.webm');
  formData.append('upload_preset', 'audio genzes');
  formData.append('resource_type', 'video'); // Cloudinary uses 'video' for audio

  try {
    const res = await fetch('https://api.cloudinary.com/v1_1/diw8k8qsk/video/upload', {
      method: 'POST', body: formData
    });
    const data = await res.json();
    if (!data.secure_url) throw new Error('Upload failed');

    // Optimistically show in chat
    const container = document.getElementById('messages');
    const empty = container.querySelector('.empty-messages');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.className = 'message-wrapper me';
    div.innerHTML = `<div class="message">${buildAudioPlayer(data.secure_url)}<div class="message-time">now</div></div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    await window.sb.from('messages').insert({
      sender_id: window.currentUser.id,
      receiver_id: window.currentChat.partnerId,
      content: null,
      file_url: data.secure_url,
      file_type: 'audio',
      file_name: 'Voice message'
    });
  } catch (err) {
    console.error(err);
    showToast('Failed to send audio');
  }
}

console.log('✅ App.js loaded');
