// Instagram-like Reels Viewer
let currentReelIndex = 0;
let totalReels = 0;
let touchStartY = 0;
let touchEndY = 0;

// Initialize reel viewer
function initReelViewer(reelsCount) {
  totalReels = reelsCount;
  currentReelIndex = 0;
  
  // Add touch/swipe listeners
  const reelsContainer = document.getElementById('reelsContainer');
  if (reelsContainer) {
    reelsContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    reelsContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
    reelsContainer.addEventListener('wheel', handleWheel, { passive: false });
  }
  
  // Auto-play first reel
  playCurrentReel();
}

// Handle touch start
function handleTouchStart(e) {
  touchStartY = e.touches[0].clientY;
}

// Handle touch end
function handleTouchEnd(e) {
  touchEndY = e.changedTouches[0].clientY;
  handleSwipe();
}

// Handle mouse wheel
function handleWheel(e) {
  e.preventDefault();
  if (e.deltaY > 0) {
    nextReel();
  } else {
    previousReel();
  }
}

// Handle swipe gesture
function handleSwipe() {
  const swipeThreshold = 50;
  const diff = touchStartY - touchEndY;
  
  if (Math.abs(diff) > swipeThreshold) {
    if (diff > 0) {
      nextReel(); // Swipe up - next reel
    } else {
      previousReel(); // Swipe down - previous reel
    }
  }
}

// Go to next reel
function nextReel() {
  if (currentReelIndex < totalReels - 1) {
    currentReelIndex++;
    updateReelPosition();
    playCurrentReel();
  }
}

// Go to previous reel
function previousReel() {
  if (currentReelIndex > 0) {
    currentReelIndex--;
    updateReelPosition();
    playCurrentReel();
  }
}

// Update reel position
function updateReelPosition() {
  const reelsContainer = document.getElementById('reelsContainer');
  if (reelsContainer) {
    const translateY = -currentReelIndex * 100;
    reelsContainer.style.transform = `translateY(${translateY}%)`;
  }
}

// Play current reel
function playCurrentReel() {
  // Pause all videos
  document.querySelectorAll('.reel-slide video').forEach(video => {
    video.pause();
  });
  
  // Play current video
  const currentVideo = document.getElementById(`reelVideo${currentReelIndex}`);
  if (currentVideo) {
    currentVideo.play().catch(() => console.log('Autoplay blocked'));
  }
}

// Toggle play/pause
function togglePlayPause(video) {
  if (video.paused) {
    video.play();
  } else {
    video.pause();
  }
}

// Toggle mute/unmute
function toggleMute(videoId) {
  const video = document.getElementById(videoId);
  const muteBtn = document.getElementById(`muteBtn${videoId.replace('reelVideo', '')}`);
  
  if (video && muteBtn) {
    video.muted = !video.muted;
    muteBtn.textContent = video.muted ? '🔇' : '🔊';
  }
}

// Toggle reel like
async function toggleReelLike(reelId, button) {
  if (!window.currentUser) return;
  
  try {
    const { data: existingLike } = await window.sb.from('reels_likes')
      .select('id')
      .eq('reel_id', reelId)
      .eq('user_id', window.currentUser.id)
      .single();
    
    const likeCount = button.querySelector('div');
    const heartIcon = button.querySelector('svg path');
    
    if (existingLike) {
      await window.sb.from('reels_likes').delete().eq('id', existingLike.id);
      heartIcon.setAttribute('fill', 'none');
      button.style.color = 'white';
      likeCount.textContent = Math.max(0, parseInt(likeCount.textContent) - 1);
    } else {
      await window.sb.from('reels_likes').insert({ reel_id: reelId, user_id: window.currentUser.id });
      heartIcon.setAttribute('fill', 'currentColor');
      button.style.color = '#ff3040';
      likeCount.textContent = parseInt(likeCount.textContent) + 1;
    }
  } catch (error) {
    console.error('Like error:', error);
  }
}

// Open reel comments
function openReelComments(reelId) {
  // Create comments modal
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-dialog" style="max-width: 500px; max-height: 80vh;">
      <div class="modal-header">
        <h3>Comments</h3>
        <button onclick="this.closest('.modal').remove()" class="close-btn">×</button>
      </div>
      <div class="modal-form">
        <div id="reelCommentsList" style="max-height: 400px; overflow-y: auto; padding: 1rem;">
          <div style="text-align: center; color: #666;">Loading comments...</div>
        </div>
        <div style="display: flex; gap: 0.5rem; padding: 1rem; border-top: 1px solid #333;">
          <input id="reelCommentInput" type="text" placeholder="Add a comment..." style="flex: 1; padding: 0.5rem; border: 1px solid #333; border-radius: 20px; background: #000; color: #fff;">
          <button onclick="addReelComment('${reelId}')" style="background: #0095f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 20px; cursor: pointer;">Post</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  loadReelComments(reelId);
}

// Load reel comments
async function loadReelComments(reelId) {
  try {
    const { data: comments } = await window.sb.from('reels_comments')
      .select('*, profiles(username, avatar_url)')
      .eq('reel_id', reelId)
      .order('created_at', { ascending: true });
    
    const commentsList = document.getElementById('reelCommentsList');
    if (!commentsList) return;
    
    if (!comments || comments.length === 0) {
      commentsList.innerHTML = '<div style="text-align: center; color: #666; padding: 2rem;">No comments yet</div>';
      return;
    }
    
    commentsList.innerHTML = comments.map(comment => {
      const user = comment.profiles;
      const initial = user?.username?.charAt(0).toUpperCase() || 'U';
      
      return `
        <div style="display: flex; gap: 0.75rem; margin-bottom: 1rem;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: ${user?.avatar_url ? `url('${user.avatar_url}') center/cover` : '#333'}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 0.8rem;">
            ${user?.avatar_url ? '' : initial}
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #fff; margin-bottom: 0.25rem;">@${user?.username || 'user'}</div>
            <div style="color: #fff;">${comment.content}</div>
            <div style="color: #666; font-size: 0.8rem; margin-top: 0.25rem;">${new Date(comment.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Load comments error:', error);
  }
}

// Add reel comment
async function addReelComment(reelId) {
  const input = document.getElementById('reelCommentInput');
  const content = input?.value?.trim();
  
  if (!content || !window.currentUser) return;
  
  try {
    await window.sb.from('reels_comments').insert({
      reel_id: reelId,
      user_id: window.currentUser.id,
      content
    });
    
    input.value = '';
    loadReelComments(reelId);
  } catch (error) {
    console.error('Comment error:', error);
  }
}

// Share reel to friends
function shareReelToFriends(reelId) {
  // Create share modal
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-dialog" style="max-width: 400px;">
      <div class="modal-header">
        <h3>Share Reel</h3>
        <button onclick="this.closest('.modal').remove()" class="close-btn">×</button>
      </div>
      <div class="modal-form" style="padding: 1rem;">
        <div id="friendsList" style="max-height: 300px; overflow-y: auto;">
          <div style="text-align: center; color: #666;">Loading friends...</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  loadFriendsForShare(reelId);
}

// Load friends for sharing
async function loadFriendsForShare(reelId) {
  try {
    const { data: following } = await window.sb.from('follows')
      .select('followee_id, profiles!follows_followee_id_fkey(username, avatar_url)')
      .eq('follower_id', window.currentUser.id)
      .eq('approved', true);
    
    const friendsList = document.getElementById('friendsList');
    if (!friendsList) return;
    
    if (!following || following.length === 0) {
      friendsList.innerHTML = '<div style="text-align: center; color: #666; padding: 2rem;">No friends to share with</div>';
      return;
    }
    
    friendsList.innerHTML = following.map(follow => {
      const user = follow.profiles;
      const initial = user?.username?.charAt(0).toUpperCase() || 'U';
      
      return `
        <div onclick="shareReelToUser('${reelId}', '${follow.followee_id}', '${user?.username}')" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; cursor: pointer; border-radius: 8px; transition: background 0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='transparent'">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: ${user?.avatar_url ? `url('${user.avatar_url}') center/cover` : '#333'}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
            ${user?.avatar_url ? '' : initial}
          </div>
          <div style="flex: 1; color: #fff;">@${user?.username || 'user'}</div>
          <div style="color: #0095f6; font-size: 0.9rem;">Send</div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Load friends error:', error);
  }
}

// Share reel to specific user
async function shareReelToUser(reelId, userId, username) {
  try {
    await window.sb.from('messages').insert({
      sender_id: window.currentUser.id,
      receiver_id: userId,
      content: `Check out this reel! 🎬`,
      file_url: `reel:${reelId}`,
      file_type: 'reel'
    });
    
    alert(`Reel shared with @${username}!`);
    document.querySelector('.modal:last-child')?.remove();
  } catch (error) {
    console.error('Share error:', error);
    alert('Failed to share reel');
  }
}