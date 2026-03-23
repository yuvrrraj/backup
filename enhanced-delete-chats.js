// Enhanced Delete All Chats Functionality
// This file contains enhanced functions that work with the additional SQL tables

// Enhanced delete all chats function with backup and logging
window.deleteAllChatsEnhanced = async function() {
  if (!window.currentUser) {
    alert('Please log in first');
    return;
  }
  
  if (!confirm('⚠️ WARNING: This will permanently delete ALL your chat messages from the database. A backup will be created. This action cannot be undone. Are you sure?')) {
    return;
  }
  
  // Double confirmation
  if (!confirm('This is your final warning! All messages will be permanently deleted (but backed up). Continue?')) {
    return;
  }
  
  try {
    console.log('Deleting all messages for user with backup:', window.currentUser.id);
    
    // Call the enhanced SQL function
    const { data, error } = await window.sb.rpc('delete_user_messages', {
      p_user_id: window.currentUser.id,
      p_partner_id: null, // null means delete all chats
      p_backup: true // create backup before deletion
    });
    
    if (error) {
      console.error('Enhanced delete error:', error);
      throw error;
    }
    
    console.log('Enhanced delete result:', data);
    
    // Clear all local storage related to chats
    localStorage.removeItem('savedChats');
    localStorage.removeItem('hiddenChats');
    
    // Close current chat if open
    if (window.currentChat) {
      document.getElementById('chatArea').classList.add('hidden');
      document.getElementById('chatsList').style.display = 'block';
      window.currentChat = null;
    }
    
    // Reload chats list
    if (window.loadChats) {
      await window.loadChats();
    }
    
    const result = data || {};
    alert(`✅ All chats deleted successfully!\n📊 Messages deleted: ${result.messages_deleted || 0}\n💾 Messages backed up: ${result.messages_backed_up || 0}`);
    
  } catch (error) {
    console.error('Error deleting all chats:', error);
    alert('❌ Failed to delete all chats: ' + error.message);
  }
};

// Enhanced delete single chat function with backup
window.deleteSingleChatEnhanced = async function(partnerId) {
  if (!window.currentUser || !partnerId) {
    alert('Invalid chat or user');
    return;
  }
  
  if (!confirm('Delete all messages with this user? A backup will be created. This action cannot be undone.')) {
    return;
  }
  
  try {
    console.log('Deleting chat with backup:', partnerId);
    
    // Call the enhanced SQL function
    const { data, error } = await window.sb.rpc('delete_user_messages', {
      p_user_id: window.currentUser.id,
      p_partner_id: partnerId,
      p_backup: true
    });
    
    if (error) {
      console.error('Enhanced delete chat error:', error);
      throw error;
    }
    
    console.log('Enhanced delete chat result:', data);
    
    // Remove from saved chats
    const savedChats = JSON.parse(localStorage.getItem('savedChats') || '[]');
    const filtered = savedChats.filter(chat => chat.partnerId !== partnerId);
    localStorage.setItem('savedChats', JSON.stringify(filtered));
    
    // Close current chat if it's the one being deleted
    if (window.currentChat && window.currentChat.partnerId === partnerId) {
      document.getElementById('chatArea').classList.add('hidden');
      document.getElementById('chatsList').style.display = 'block';
      window.currentChat = null;
    }
    
    // Reload chats list
    if (window.loadChats) {
      await window.loadChats();
    }
    
    const result = data || {};
    alert(`✅ Chat deleted successfully!\n📊 Messages deleted: ${result.messages_deleted || 0}\n💾 Messages backed up: ${result.messages_backed_up || 0}`);
    
  } catch (error) {
    console.error('Error deleting chat:', error);
    alert('❌ Failed to delete chat: ' + error.message);
  }
};

// Function to view deletion history
window.viewDeletionHistory = async function() {
  if (!window.currentUser) {
    alert('Please log in first');
    return;
  }
  
  try {
    const { data: logs, error } = await window.sb
      .from('chat_deletion_logs')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .order('deleted_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    // Create modal to show deletion history
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'deletionHistoryModal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="closeDeletionHistory()"></div>
      <div class="modal-dialog" style="max-width: 600px;">
        <div class="modal-header" style="background: #1a1a1a; color: #fff; border-bottom: 1px solid #333;">
          <h3 style="margin: 0; color: #fff;">📊 Chat Deletion History</h3>
          <button onclick="closeDeletionHistory()" class="close-btn" style="color: #fff;">×</button>
        </div>
        <div class="modal-body" style="background: #1a1a1a; padding: 1.5rem; max-height: 400px; overflow-y: auto;">
          ${logs?.length ? logs.map(log => `
            <div style="background: #2a2a2a; padding: 1rem; margin-bottom: 1rem; border-radius: 8px; border-left: 4px solid ${log.deletion_type === 'all_chats' ? '#ff4757' : '#ffa502'};">
              <div style="color: #fff; font-weight: 600; margin-bottom: 0.5rem;">
                ${log.deletion_type === 'all_chats' ? '🔥 All Chats Deleted' : '💬 Single Chat Deleted'}
              </div>
              <div style="color: #aaa; font-size: 0.9rem;">
                📅 ${new Date(log.deleted_at).toLocaleString()}<br>
                📊 Messages: ${log.messages_count}<br>
                🆔 Log ID: ${log.id.substring(0, 8)}...
              </div>
            </div>
          `).join('') : '<div style="text-align: center; color: #aaa; padding: 2rem;">No deletion history found</div>'}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('Error loading deletion history:', error);
    alert('Failed to load deletion history');
  }
};

// Function to close deletion history modal
window.closeDeletionHistory = function() {
  const modal = document.getElementById('deletionHistoryModal');
  if (modal) modal.remove();
};

// Function to view message backups
window.viewMessageBackups = async function() {
  if (!window.currentUser) {
    alert('Please log in first');
    return;
  }
  
  try {
    const { data: backups, error } = await window.sb
      .from('message_backups')
      .select('*')
      .or(`sender_id.eq.${window.currentUser.id},receiver_id.eq.${window.currentUser.id}`)
      .order('backed_up_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    // Create modal to show message backups
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'messageBackupsModal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="closeMessageBackups()"></div>
      <div class="modal-dialog" style="max-width: 800px;">
        <div class="modal-header" style="background: #1a1a1a; color: #fff; border-bottom: 1px solid #333;">
          <h3 style="margin: 0; color: #fff;">💾 Message Backups</h3>
          <button onclick="closeMessageBackups()" class="close-btn" style="color: #fff;">×</button>
        </div>
        <div class="modal-body" style="background: #1a1a1a; padding: 1.5rem; max-height: 500px; overflow-y: auto;">
          ${backups?.length ? backups.map(backup => `
            <div style="background: #2a2a2a; padding: 1rem; margin-bottom: 1rem; border-radius: 8px;">
              <div style="color: #fff; margin-bottom: 0.5rem;">
                ${backup.content || (backup.file_name ? `📎 ${backup.file_name}` : 'Media message')}
              </div>
              <div style="color: #aaa; font-size: 0.8rem;">
                📅 Original: ${new Date(backup.original_created_at).toLocaleString()}<br>
                💾 Backed up: ${new Date(backup.backed_up_at).toLocaleString()}<br>
                🔄 Reason: ${backup.backup_reason}
              </div>
            </div>
          `).join('') : '<div style="text-align: center; color: #aaa; padding: 2rem;">No message backups found</div>'}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('Error loading message backups:', error);
    alert('Failed to load message backups');
  }
};

// Function to close message backups modal
window.closeMessageBackups = function() {
  const modal = document.getElementById('messageBackupsModal');
  if (modal) modal.remove();
};

// Function to manage user preferences
window.manageChatPreferences = async function() {
  if (!window.currentUser) {
    alert('Please log in first');
    return;
  }
  
  try {
    // Get current preferences
    let { data: prefs, error } = await window.sb
      .from('user_preferences')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    // Create default preferences if none exist
    if (!prefs) {
      prefs = {
        auto_delete_messages: false,
        auto_delete_days: 30,
        chat_backup_enabled: true
      };
    }
    
    // Create preferences modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'chatPreferencesModal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="closeChatPreferences()"></div>
      <div class="modal-dialog" style="max-width: 500px;">
        <div class="modal-header" style="background: #1a1a1a; color: #fff; border-bottom: 1px solid #333;">
          <h3 style="margin: 0; color: #fff;">⚙️ Chat Preferences</h3>
          <button onclick="closeChatPreferences()" class="close-btn" style="color: #fff;">×</button>
        </div>
        <div class="modal-body" style="background: #1a1a1a; padding: 1.5rem;">
          <div style="margin-bottom: 1.5rem;">
            <label style="display: flex; align-items: center; gap: 0.5rem; color: #fff; cursor: pointer;">
              <input type="checkbox" id="autoDeleteMessages" ${prefs.auto_delete_messages ? 'checked' : ''}>
              <span>🗑️ Auto-delete old messages</span>
            </label>
            <div style="color: #aaa; font-size: 0.9rem; margin-top: 0.25rem; margin-left: 1.5rem;">
              Automatically delete messages older than specified days
            </div>
          </div>
          
          <div style="margin-bottom: 1.5rem;">
            <label style="color: #fff; display: block; margin-bottom: 0.5rem;">📅 Auto-delete after (days):</label>
            <input type="number" id="autoDeleteDays" value="${prefs.auto_delete_days}" min="1" max="365" 
                   style="width: 100%; padding: 0.5rem; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px;">
          </div>
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display: flex; align-items: center; gap: 0.5rem; color: #fff; cursor: pointer;">
              <input type="checkbox" id="chatBackupEnabled" ${prefs.chat_backup_enabled ? 'checked' : ''}>
              <span>💾 Enable chat backups</span>
            </label>
            <div style="color: #aaa; font-size: 0.9rem; margin-top: 0.25rem; margin-left: 1.5rem;">
              Create backups before deleting messages
            </div>
          </div>
          
          <div style="display: flex; gap: 1rem; margin-top: 2rem;">
            <button onclick="closeChatPreferences()" style="flex: 1; padding: 0.75rem; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
            <button onclick="saveChatPreferences()" style="flex: 1; padding: 0.75rem; background: #0095f6; color: white; border: none; border-radius: 6px; cursor: pointer;">Save</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('Error loading chat preferences:', error);
    alert('Failed to load chat preferences');
  }
};

// Function to save chat preferences
window.saveChatPreferences = async function() {
  try {
    const preferences = {
      user_id: window.currentUser.id,
      auto_delete_messages: document.getElementById('autoDeleteMessages').checked,
      auto_delete_days: parseInt(document.getElementById('autoDeleteDays').value),
      chat_backup_enabled: document.getElementById('chatBackupEnabled').checked,
      updated_at: new Date().toISOString()
    };
    
    const { error } = await window.sb
      .from('user_preferences')
      .upsert(preferences);
    
    if (error) throw error;
    
    alert('✅ Chat preferences saved successfully!');
    closeChatPreferences();
    
  } catch (error) {
    console.error('Error saving chat preferences:', error);
    alert('❌ Failed to save chat preferences');
  }
};

// Function to close chat preferences modal
window.closeChatPreferences = function() {
  const modal = document.getElementById('chatPreferencesModal');
  if (modal) modal.remove();
};

console.log('✅ Enhanced delete chats functionality loaded');