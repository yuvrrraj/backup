// Group Chat Functionality
let currentGroup = null;

// Create group
async function createGroup() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-dialog" style="max-width: 500px;">
      <div class="modal-header">
        <h3>Create Group</h3>
        <button onclick="this.closest('.modal').remove()" class="close-btn">×</button>
      </div>
      <div class="modal-form" style="padding: 1rem;">
        <input id="groupName" type="text" placeholder="Group name" style="width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #333; border-radius: 8px; background: #000; color: #fff;">
        <textarea id="groupDescription" placeholder="Group description (optional)" style="width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #333; border-radius: 8px; background: #000; color: #fff; resize: vertical;" rows="3"></textarea>
        
        <h4 style="color: #fff; margin-bottom: 0.5rem;">Add Members</h4>
        <div id="membersList" style="max-height: 200px; overflow-y: auto; border: 1px solid #333; border-radius: 8px; padding: 0.5rem;">
          <div style="text-align: center; color: #666;">Loading friends...</div>
        </div>
        
        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          <button onclick="this.closest('.modal').remove()" style="flex: 1; padding: 0.75rem; background: #333; color: white; border: none; border-radius: 8px; cursor: pointer;">Cancel</button>
          <button onclick="submitCreateGroup()" style="flex: 1; padding: 0.75rem; background: #0095f6; color: white; border: none; border-radius: 8px; cursor: pointer;">Create Group</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  loadFriendsForGroup();
}

// Load friends for group creation
async function loadFriendsForGroup() {
  try {
    const { data: following } = await window.sb.from('follows')
      .select('followee_id, profiles!follows_followee_id_fkey(username, avatar_url)')
      .eq('follower_id', window.currentUser.id)
      .eq('approved', true);
    
    const membersList = document.getElementById('membersList');
    if (!membersList) return;
    
    if (!following || following.length === 0) {
      membersList.innerHTML = '<div style="text-align: center; color: #666; padding: 1rem;">No friends to add</div>';
      return;
    }
    
    membersList.innerHTML = following.map(follow => {
      const user = follow.profiles;
      const initial = user?.username?.charAt(0).toUpperCase() || 'U';
      
      return `
        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; border-radius: 6px;">
          <input type="checkbox" value="${follow.followee_id}" name="groupMembers" style="margin: 0;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: ${user?.avatar_url ? `url('${user.avatar_url}') center/cover` : '#333'}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 0.8rem;">
            ${user?.avatar_url ? '' : initial}
          </div>
          <div style="color: #fff;">@${user?.username || 'user'}</div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Load friends error:', error);
  }
}

// Submit group creation
async function submitCreateGroup() {
  const groupName = document.getElementById('groupName')?.value?.trim();
  const groupDescription = document.getElementById('groupDescription')?.value?.trim();
  const selectedMembers = Array.from(document.querySelectorAll('input[name="groupMembers"]:checked')).map(cb => cb.value);
  
  if (!groupName) {
    alert('Please enter a group name');
    return;
  }
  
  if (selectedMembers.length === 0) {
    alert('Please select at least one member');
    return;
  }
  
  try {
    // Create group
    const { data: group, error } = await window.sb.from('groups').insert({
      name: groupName,
      description: groupDescription,
      created_by: window.currentUser.id,
      members: [window.currentUser.id, ...selectedMembers]
    }).select().single();
    
    if (error) throw error;
    
    // Add group members
    const memberInserts = [window.currentUser.id, ...selectedMembers].map(memberId => ({
      group_id: group.id,
      user_id: memberId,
      role: memberId === window.currentUser.id ? 'admin' : 'member'
    }));
    
    await window.sb.from('group_members').insert(memberInserts);
    
    alert('Group created successfully!');
    document.querySelector('.modal:last-child')?.remove();
    loadGroups();
  } catch (error) {
    console.error('Create group error:', error);
    alert('Failed to create group');
  }
}

// Load groups
async function loadGroups() {
  try {
    const { data: groups } = await window.sb.from('group_members')
      .select('groups(id, name, description, created_at)')
      .eq('user_id', window.currentUser.id);
    
    const groupsList = document.getElementById('groupsList');
    if (!groupsList) return;
    
    if (!groups || groups.length === 0) {
      groupsList.innerHTML = '<div style="text-align: center; color: #666; padding: 2rem;">No groups yet</div>';
      return;
    }
    
    groupsList.innerHTML = groups.map(groupMember => {
      const group = groupMember.groups;
      return `
        <div onclick="openGroupChat('${group.id}', '${group.name}')" style="display: flex; align-items: center; gap: 1rem; padding: 1rem; border-bottom: 1px solid #333; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#111'" onmouseout="this.style.background='#000'">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
            ${group.name.charAt(0).toUpperCase()}
          </div>
          <div style="flex: 1;">
            <div style="font-weight: bold; color: #fff;">${group.name}</div>
            <div style="font-size: 0.9em; color: #999;">Group • ${new Date(group.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Load groups error:', error);
  }
}

// Open group chat
async function openGroupChat(groupId, groupName) {
  currentGroup = { id: groupId, name: groupName };
  
  // Switch to group chat view
  document.getElementById('chatsList').style.display = 'none';
  document.getElementById('chatArea').classList.remove('hidden');
  
  // Update chat header
  const chatNameEl = document.querySelector('.chat-name');
  if (chatNameEl) chatNameEl.textContent = groupName;
  
  // Load group messages
  loadGroupMessages(groupId);
}

// Load group messages
async function loadGroupMessages(groupId) {
  try {
    const { data: messages } = await window.sb.from('group_messages')
      .select('*, profiles(username, avatar_url)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(50);
    
    const messagesEl = document.getElementById('messages');
    if (!messagesEl) return;
    
    messagesEl.innerHTML = '';
    
    (messages || []).forEach(msg => {
      const user = msg.profiles;
      const isMe = msg.sender_id === window.currentUser.id;
      const initial = user?.username?.charAt(0).toUpperCase() || 'U';
      
      const div = document.createElement('div');
      div.className = `message ${isMe ? 'me' : 'them'}`;
      div.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 0.5rem; ${isMe ? 'flex-direction: row-reverse;' : ''}">
          ${!isMe ? `
            <div style="width: 32px; height: 32px; border-radius: 50%; background: ${user?.avatar_url ? `url('${user.avatar_url}') center/cover` : '#333'}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">
              ${user?.avatar_url ? '' : initial}
            </div>
          ` : ''}
          <div style="flex: 1;">
            ${!isMe ? `<div style="font-size: 0.8em; color: #666; margin-bottom: 0.25rem;">@${user?.username || 'user'}</div>` : ''}
            <div style="color: ${isMe ? 'white' : '#fff'}; font-weight: 500;">${msg.content}</div>
            <time style="color: rgba(255,255,255,0.7); font-size: 0.7em;">${new Date(msg.created_at).toLocaleTimeString()}</time>
          </div>
        </div>
      `;
      messagesEl.appendChild(div);
    });
    
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } catch (error) {
    console.error('Load group messages error:', error);
  }
}

// Send group message
async function sendGroupMessage(content) {
  if (!currentGroup || !content.trim()) return;
  
  try {
    await window.sb.from('group_messages').insert({
      group_id: currentGroup.id,
      sender_id: window.currentUser.id,
      content: content.trim()
    });
    
    loadGroupMessages(currentGroup.id);
  } catch (error) {
    console.error('Send group message error:', error);
  }
}