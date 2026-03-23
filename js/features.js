// Features.js - Complete Instagram-like features
console.log('📱 Loading features...');

// Global variables for features
let selectedMusic = null;
let currentStoryIndex = 0;
let storyViewers = [];
let currentStoryViewer = null;
let reelsData = [];
let highlightsData = [];

// Post creation functionality
document.addEventListener('DOMContentLoaded', function() {
  // Post creation form
  const createPostForm = document.getElementById('createPostForm');
  createPostForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      alert('Please log in first');
      return;
    }
    
    const file = document.getElementById('postImage')?.files?.[0];
    const caption = document.getElementById('postCaption')?.value?.trim();
    
    if (!file) {
      alert('Please choose an image or video');
      return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent || 'Post';
    
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading...';
      
      // Convert file to base64
      const base64Data = await convertToBase64(file);
      
      const postData = {
        user_id: currentUser.id,
        image_url: base64Data,
        caption: caption || '',
        media_type: file.type.startsWith('video/') ? 'video' : 'image',
        audience: document.getElementById('postAudience')?.value || 'public'
      };
      
      // Add music if selected
      if (selectedMusic) {
        postData.music_name = selectedMusic.name;
        postData.music_artist = selectedMusic.artist;
        postData.music_url = selectedMusic.preview_url;
      }
      
      const { error } = await window.sb.from('posts').insert(postData);
      if (error) throw error;
      
      // Close modal and reset form
      document.getElementById('createPostModal').classList.add('hidden');
      createPostForm.reset();
      document.getElementById('postPreview').innerHTML = '';
      document.getElementById('mediaSelected').textContent = '';
      selectedMusic = null;
      
      // Reload feed
      if (window.loadFeed) await window.loadFeed();
      
      alert('Post created successfully!');
      
    } catch (error) {
      console.error('Post creation failed:', error);
      alert('Failed to create post. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  // Story creation form
  const createStoryForm = document.getElementById('createStoryForm');
  createStoryForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      alert('Please log in first');
      return;
    }
    
    const file = document.getElementById('storyMedia')?.files?.[0];
    if (!file) {
      alert('Please choose a media file for your story');
      return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent || 'Share Story';
    
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading...';
      
      const base64Data = await convertToBase64(file);
      const duration = parseInt(document.getElementById('storyDuration')?.value || '24');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + duration);
      
      // First try with media_type column
      let storyData = {
        user_id: currentUser.id,
        media_url: base64Data,
        media_type: file.type.startsWith('video/') ? 'video' : 'image',
        audience: document.getElementById('storyAudience')?.value || 'public',
        expires_at: expiresAt.toISOString()
      };
      
      let { error } = await window.sb.from('stories').insert(storyData);
      
      // If media_type column doesn't exist, try without it
      if (error && error.message.includes('media_type')) {
        console.log('media_type column not found, trying without it...');
        storyData = {
          user_id: currentUser.id,
          media_url: base64Data,
          audience: document.getElementById('storyAudience')?.value || 'public',
          expires_at: expiresAt.toISOString()
        };
        
        const result = await window.sb.from('stories').insert(storyData);
        error = result.error;
      }
      
      if (error) throw error;
      
      // Close modal and reset form
      document.getElementById('createStoryModal').classList.add('hidden');
      createStoryForm.reset();
      document.getElementById('storyPreview').innerHTML = '';
      document.getElementById('storyMediaSelected').textContent = '';
      
      // Reload stories
      if (window.loadStories) await window.loadStories();
      
      alert('Story shared successfully!');
      
    } catch (error) {
      console.error('Story creation failed:', error);
      let errorMessage = 'Failed to share story. Please try again.';
      
      if (error.message.includes('media_type')) {
        errorMessage = 'Database schema issue. Please run the DATABASE_FIX.sql script in your Supabase SQL Editor.';
      } else if (error.message.includes('expires_at')) {
        errorMessage = 'Invalid expiration time. Please try again.';
      } else if (error.message.includes('user_id')) {
        errorMessage = 'Please log in again and try.';
      } else if (error.message.includes('media_url')) {
        errorMessage = 'Failed to process media file. Please try a different file.';
      }
      
      alert(errorMessage);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  // File upload handlers
  document.getElementById('btnPickMedia')?.addEventListener('click', () => {
    document.getElementById('postImage').click();
  });

  document.getElementById('btnPickStoryMedia')?.addEventListener('click', () => {
    document.getElementById('storyMedia').click();
  });

  // File preview handlers
  document.getElementById('postImage')?.addEventListener('change', (e) => {
    handleFilePreview(e.target, 'postPreview', 'mediaSelected');
  });

  document.getElementById('storyMedia')?.addEventListener('change', (e) => {
    handleFilePreview(e.target, 'storyPreview', 'storyMediaSelected');
  });
});

// Convert file to base64 with compression
function convertToBase64(file, maxSizeMB = 5) {
  return new Promise((resolve, reject) => {
    // Check file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      reject(new Error(`File too large. Maximum size is ${maxSizeMB}MB`));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // For images, compress if needed
      if (file.type.startsWith('image/') && result.length > 500000) {
        compressImage(result, 0.8).then(resolve).catch(() => resolve(result));
      } else {
        resolve(result);
      }
    };
    reader.onerror = (error) => {
      console.error('File reading error:', error);
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

// Compress image
function compressImage(base64, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      try {
        const maxWidth = 1080;
        const maxHeight = 1080;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (error) {
        console.error('Image compression failed:', error);
        resolve(base64); // Return original if compression fails
      }
    };
    
    img.onerror = () => {
      console.error('Image loading failed for compression');
      resolve(base64); // Return original if loading fails
    };
    
    img.src = base64;
  });
}

// Handle file preview
function handleFilePreview(input, previewId, selectedId) {
  const file = input.files?.[0];
  if (!file) return;
  
  // Validate file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg'];
  if (!validTypes.includes(file.type)) {
    alert('Please select a valid image or video file (JPEG, PNG, GIF, WebP, MP4, WebM, OGG)');
    input.value = '';
    return;
  }
  
  // Check file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    alert('File too large. Maximum size is 10MB.');
    input.value = '';
    return;
  }
  
  const preview = document.getElementById(previewId);
  const selected = document.getElementById(selectedId);
  
  if (preview) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const tag = file.type.startsWith('image/') ? 'img' : 'video';
      const controls = tag === 'video' ? 'controls' : '';
      preview.innerHTML = `<${tag} src="${e.target.result}" ${controls} style="max-width:100%;max-height:200px;border-radius:8px;" />`;
    };
    reader.onerror = () => {
      alert('Error reading file. Please try again.');
      input.value = '';
    };
    reader.readAsDataURL(file);
  }
  
  if (selected) {
    selected.textContent = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`;
  }
}

// Like functionality
window.toggleLike = async function(postId) {
  if (!currentUser) {
    alert('Please log in to like posts');
    return;
  }

  try {
    // Check if already liked
    const { data: existingLike } = await window.sb
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (existingLike) {
      // Unlike
      await window.sb
        .from('likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', currentUser.id);
    } else {
      // Like
      await window.sb
        .from('likes')
        .insert({
          post_id: postId,
          user_id: currentUser.id
        });
    }

    // Reload feed to update like status
    if (window.loadFeed) await window.loadFeed();

  } catch (error) {
    console.error('Error toggling like:', error);
  }
};

// Comment functionality
window.showComments = function(postId) {
  console.log('Show comments for post:', postId);
  // TODO: Implement comments modal
};

// Share functionality with Instagram-like options
window.sharePost = function(postId) {
  // Create share modal
  const modal = document.createElement('div');
  modal.id = 'shareModal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="closeShareModal()"></div>
    <div class="modal-dialog share-modal">
      <div class="modal-header">
        <h3>Share</h3>
        <button onclick="closeShareModal()" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="share-options">
          <div class="share-option" onclick="shareToWhatsApp('${postId}')">
            <div class="share-icon whatsapp">📱</div>
            <span>WhatsApp</span>
          </div>
          <div class="share-option" onclick="shareToMessages('${postId}')">
            <div class="share-icon messages">💬</div>
            <span>Messages</span>
          </div>
          <div class="share-option" onclick="shareToInstagram('${postId}')">
            <div class="share-icon instagram">📷</div>
            <span>Instagram</span>
          </div>
          <div class="share-option" onclick="shareToTwitter('${postId}')">
            <div class="share-icon twitter">🐦</div>
            <span>Twitter</span>
          </div>
          <div class="share-option" onclick="shareToFacebook('${postId}')">
            <div class="share-icon facebook">📘</div>
            <span>Facebook</span>
          </div>
          <div class="share-option" onclick="copyPostLink('${postId}')">
            <div class="share-icon copy">🔗</div>
            <span>Copy Link</span>
          </div>
          <div class="share-option" onclick="shareViaEmail('${postId}')">
            <div class="share-icon email">📧</div>
            <span>Email</span>
          </div>
          <div class="share-option" onclick="shareToStory('${postId}')">
            <div class="share-icon story">📖</div>
            <span>Add to Story</span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
};

// Close share modal
window.closeShareModal = function() {
  const modal = document.getElementById('shareModal');
  if (modal) modal.remove();
};

// Share to WhatsApp
window.shareToWhatsApp = function(postId) {
  const postUrl = `${window.location.origin}${window.location.pathname}#post-${postId}`;
  const text = encodeURIComponent(`Check out this post: ${postUrl}`);
  const whatsappUrl = `https://wa.me/?text=${text}`;
  window.open(whatsappUrl, '_blank');
  closeShareModal();
};

// Share to Messages (SMS)
window.shareToMessages = function(postId) {
  const postUrl = `${window.location.origin}${window.location.pathname}#post-${postId}`;
  const text = encodeURIComponent(`Check out this post: ${postUrl}`);
  const smsUrl = `sms:?body=${text}`;
  window.open(smsUrl, '_blank');
  closeShareModal();
};

// Share to Instagram
window.shareToInstagram = function(postId) {
  const postUrl = `${window.location.origin}${window.location.pathname}#post-${postId}`;
  // Instagram doesn't support direct URL sharing, so copy to clipboard
  navigator.clipboard.writeText(postUrl).then(() => {
    alert('Link copied! You can now paste it in Instagram.');
  }).catch(() => {
    alert('Please copy this link manually: ' + postUrl);
  });
  closeShareModal();
};

// Share to Twitter
window.shareToTwitter = function(postId) {
  const postUrl = `${window.location.origin}${window.location.pathname}#post-${postId}`;
  const text = encodeURIComponent('Check out this post!');
  const twitterUrl = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(postUrl)}`;
  window.open(twitterUrl, '_blank');
  closeShareModal();
};

// Share to Facebook
window.shareToFacebook = function(postId) {
  const postUrl = `${window.location.origin}${window.location.pathname}#post-${postId}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
  window.open(facebookUrl, '_blank');
  closeShareModal();
};

// Copy post link
window.copyPostLink = function(postId) {
  const postUrl = `${window.location.origin}${window.location.pathname}#post-${postId}`;
  navigator.clipboard.writeText(postUrl).then(() => {
    alert('Link copied to clipboard!');
  }).catch(() => {
    alert('Please copy this link manually: ' + postUrl);
  });
  closeShareModal();
};

// Share via email
window.shareViaEmail = function(postId) {
  const postUrl = `${window.location.origin}${window.location.pathname}#post-${postId}`;
  const subject = encodeURIComponent('Check out this post');
  const body = encodeURIComponent(`I thought you might like this post: ${postUrl}`);
  const emailUrl = `mailto:?subject=${subject}&body=${body}`;
  window.open(emailUrl, '_blank');
  closeShareModal();
};

// Share to story
window.shareToStory = function(postId) {
  // This would typically open the story creation modal with the post content
  alert('Feature coming soon: Share to your story!');
  closeShareModal();
};

// Story viewing functionality
window.viewStory = async function(userId) {
  try {
    // Try with all columns first
    let { data: stories, error } = await window.sb
      .from('stories')
      .select(`
        *,
        profiles:user_id (username, avatar_url, full_name)
      `)
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });

    // If media_type column doesn't exist, try without it
    if (error && error.message.includes('media_type')) {
      const result = await window.sb
        .from('stories')
        .select(`
          id, user_id, media_url, audience, expires_at, created_at,
          profiles:user_id (username, avatar_url, full_name)
        `)
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });
      
      stories = result.data;
      error = result.error;
      
      // Add default media_type for compatibility
      if (stories) {
        stories = stories.map(story => ({
          ...story,
          media_type: story.media_url?.includes('video') ? 'video' : 'image'
        }));
      }
    }

    if (error) throw error;
    if (!stories || stories.length === 0) return;

    currentStoryViewer = {
      stories: stories,
      currentIndex: 0,
      userId: userId
    };

    showStoryViewer();
  } catch (error) {
    console.error('Error loading stories:', error);
  }
};

// Show story viewer modal
function showStoryViewer() {
  const modal = document.createElement('div');
  modal.id = 'storyViewerModal';
  modal.className = 'story-viewer-modal';
  modal.innerHTML = `
    <div class="story-viewer-backdrop" onclick="closeStoryViewer()"></div>
    <div class="story-viewer-container">
      <div class="story-viewer-header">
        <div class="story-viewer-user">
          <div class="story-viewer-avatar"></div>
          <div class="story-viewer-info">
            <div class="story-viewer-username"></div>
            <div class="story-viewer-time"></div>
          </div>
        </div>
        <button class="story-viewer-close" onclick="closeStoryViewer()">×</button>
      </div>
      <div class="story-viewer-progress">
        <div class="story-progress-bars"></div>
      </div>
      <div class="story-viewer-content">
        <div class="story-viewer-media"></div>
        <button class="story-nav story-prev" onclick="prevStory()">‹</button>
        <button class="story-nav story-next" onclick="nextStory()">›</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  updateStoryViewer();
  
  // Auto advance stories
  startStoryTimer();
}

// Update story viewer content
function updateStoryViewer() {
  if (!currentStoryViewer) return;
  
  const story = currentStoryViewer.stories[currentStoryViewer.currentIndex];
  const user = story.profiles;
  
  // Update user info
  const avatar = document.querySelector('.story-viewer-avatar');
  const username = document.querySelector('.story-viewer-username');
  const time = document.querySelector('.story-viewer-time');
  
  avatar.innerHTML = user?.avatar_url ? 
    `<img src="${user.avatar_url}" alt="${user.username}" />` : 
    user?.username?.[0]?.toUpperCase() || 'U';
  username.textContent = user?.username || 'User';
  time.textContent = window.formatTime(story.created_at);
  
  // Update progress bars
  const progressBars = document.querySelector('.story-progress-bars');
  progressBars.innerHTML = currentStoryViewer.stories.map((_, index) => 
    `<div class="story-progress-bar ${index < currentStoryViewer.currentIndex ? 'completed' : index === currentStoryViewer.currentIndex ? 'active' : ''}"></div>`
  ).join('');
  
  // Update media
  const media = document.querySelector('.story-viewer-media');
  const isVideo = story.media_type === 'video' || story.media_url?.includes('video');
  media.innerHTML = isVideo ? 
    `<video src="${story.media_url}" autoplay muted loop />` :
    `<img src="${story.media_url}" alt="Story" />`;
}

// Story navigation
let storyTimer;
function startStoryTimer() {
  clearTimeout(storyTimer);
  storyTimer = setTimeout(() => {
    nextStory();
  }, 5000);
}

window.nextStory = function() {
  if (!currentStoryViewer) return;
  
  if (currentStoryViewer.currentIndex < currentStoryViewer.stories.length - 1) {
    currentStoryViewer.currentIndex++;
    updateStoryViewer();
    startStoryTimer();
  } else {
    closeStoryViewer();
  }
};

window.prevStory = function() {
  if (!currentStoryViewer) return;
  
  if (currentStoryViewer.currentIndex > 0) {
    currentStoryViewer.currentIndex--;
    updateStoryViewer();
    startStoryTimer();
  }
};

window.closeStoryViewer = function() {
  clearTimeout(storyTimer);
  const modal = document.getElementById('storyViewerModal');
  if (modal) modal.remove();
  currentStoryViewer = null;
};

// Settings functionality
document.getElementById('openSettings')?.addEventListener('click', () => {
  document.getElementById('settingsModal').classList.remove('hidden');
  loadUserSettings();
});

// Edit Profile functionality
window.showEditProfile = function() {
  document.getElementById('settingsModal').classList.add('hidden');
  document.getElementById('editProfileModal').classList.remove('hidden');
  loadEditProfileData();
};

window.closeEditProfile = function() {
  document.getElementById('editProfileModal').classList.add('hidden');
};

window.selectProfilePic = function() {
  document.getElementById('profilePicInput').click();
};

// Profile picture upload handler
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('profilePicInput')?.addEventListener('change', handleProfilePicUpload);
  document.getElementById('editProfileForm')?.addEventListener('submit', handleEditProfileSubmit);
  
  // Bio character counter
  document.getElementById('edit_bio')?.addEventListener('input', (e) => {
    const count = e.target.value.length;
    document.getElementById('bioCount').textContent = count;
  });
});

async function handleProfilePicUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  
  // Validate file
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }
  
  if (file.size > 5 * 1024 * 1024) {
    alert('Image too large. Maximum size is 5MB.');
    return;
  }
  
  try {
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('profilePicPreview');
      const placeholder = document.getElementById('profilePicPlaceholder');
      
      preview.src = e.target.result;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
    
  } catch (error) {
    console.error('Error handling profile pic:', error);
    alert('Error processing image. Please try again.');
  }
}

async function loadEditProfileData() {
  if (!currentUser?.profile) return;
  
  const profile = currentUser.profile;
  document.getElementById('edit_username').value = profile.username || '';
  document.getElementById('edit_fullname').value = profile.full_name || '';
  document.getElementById('edit_bio').value = profile.bio || '';
  document.getElementById('edit_links').value = profile.links || '';
  document.getElementById('edit_private').checked = profile.is_private || false;
  
  // Load current profile picture
  const preview = document.getElementById('profilePicPreview');
  const placeholder = document.getElementById('profilePicPlaceholder');
  
  if (profile.avatar_url && profile.avatar_url.trim()) {
    preview.src = profile.avatar_url;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    preview.style.display = 'none';
    placeholder.style.display = 'flex';
  }
  
  // Update bio counter
  document.getElementById('bioCount').textContent = (profile.bio || '').length;
}

async function handleEditProfileSubmit(e) {
  e.preventDefault();
  
  if (!currentUser) return;
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  
  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    
    let avatarUrl = currentUser.profile?.avatar_url || '';
    
    // Handle profile picture upload
    const fileInput = document.getElementById('profilePicInput');
    if (fileInput.files?.[0]) {
      const file = fileInput.files[0];
      const base64Data = await convertToBase64(file, 5); // 5MB limit
      avatarUrl = base64Data;
    }
    
    const formData = {
      username: document.getElementById('edit_username').value.trim(),
      full_name: document.getElementById('edit_fullname').value.trim(),
      avatar_url: avatarUrl || '',
      bio: document.getElementById('edit_bio').value.trim(),
      links: document.getElementById('edit_links').value.trim(),
      is_private: document.getElementById('edit_private').checked
    };
    
    // Validate username
    if (!formData.username) {
      alert('Username is required');
      return;
    }
    
    const { error } = await window.sb
      .from('profiles')
      .update(formData)
      .eq('id', currentUser.id);
      
    if (error) throw error;
    
    // Update current user profile
    currentUser.profile = { ...currentUser.profile, ...formData };
    
    // Update UI
    updateProfileUI();
    
    document.getElementById('editProfileModal').classList.add('hidden');
    alert('Profile updated successfully!');
    
  } catch (error) {
    console.error('Error updating profile:', error);
    if (error.message.includes('username')) {
      alert('Username already taken. Please choose a different one.');
    } else {
      alert('Failed to update profile. Please try again.');
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

function updateProfileUI() {
  if (!currentUser?.profile) return;
  
  const profile = currentUser.profile;
  
  // Update profile elements
  const usernameElements = document.querySelectorAll('#profileUsername, .profile-username');
  usernameElements.forEach(el => el.textContent = `@${profile.username || 'user'}`);
  
  const fullNameElements = document.querySelectorAll('#profileFullName, .profile-fullname');
  fullNameElements.forEach(el => el.textContent = profile.full_name || '');
  
  const bioElements = document.querySelectorAll('#profileBio, .profile-bio');
  bioElements.forEach(el => el.textContent = profile.bio || '');
  
  // Update all avatar elements throughout the app
  const avatarElements = document.querySelectorAll('.profile-avatar, .user-avatar, .post-avatar');
  avatarElements.forEach(el => {
    if (profile.avatar_url && profile.avatar_url.trim()) {
      // If element has an img child, update it
      const img = el.querySelector('img');
      if (img) {
        img.src = profile.avatar_url;
        img.style.display = 'block';
      } else {
        // Create img element if it doesn't exist
        el.innerHTML = `<img src="${profile.avatar_url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`;
      }
    } else {
      // Show username initial if no avatar
      const initial = profile.username?.[0]?.toUpperCase() || 'U';
      el.innerHTML = `<span style="color: white; font-weight: 600; font-size: 1.2em;">${initial}</span>`;
    }
  });
  
  // Update stories avatar specifically - FIXED to update the "Your story" section
  const addStoryAvatar = document.querySelector('.story.add-story .avatar-inner');
  if (addStoryAvatar) {
    if (profile.avatar_url && profile.avatar_url.trim()) {
      addStoryAvatar.innerHTML = `
        <img src="${profile.avatar_url}" alt="You" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />
        <div class="add-icon" style="position:absolute;bottom:-2px;right:-2px;background:#007bff;color:white;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid #000;font-weight:bold;">+</div>
      `;
    } else {
      const initial = profile.username?.[0]?.toUpperCase() || 'Y';
      addStoryAvatar.innerHTML = `
        <span style="color:#fff;font-weight:600;font-size:1.2em;">${initial}</span>
        <div class="add-icon" style="position:absolute;bottom:-2px;right:-2px;background:#007bff;color:white;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid #000;font-weight:bold;">+</div>
      `;
    }
  }
  
  // Update other story avatars
  const storyAvatars = document.querySelectorAll('.story:not(.add-story) .avatar .avatar-inner');
  storyAvatars.forEach(el => {
    if (profile.avatar_url && profile.avatar_url.trim()) {
      el.innerHTML = `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    } else {
      const initial = profile.username?.[0]?.toUpperCase() || 'Y';
      el.innerHTML = `<span style="color:#fff;font-weight:600;">${initial}</span>`;
    }
  });
  
  // Update profile section avatar
  const profileAvatar = document.getElementById('profileAvatar');
  if (profileAvatar) {
    if (profile.avatar_url && profile.avatar_url.trim()) {
      profileAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="${profile.username}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    } else {
      const initial = profile.username?.[0]?.toUpperCase() || 'U';
      profileAvatar.innerHTML = `<span id="profileInitial" style="color: white; font-weight: 600; font-size: 2rem;">${initial}</span>`;
    }
  }
}

async function loadUserSettings() {
  if (!currentUser?.profile) return;
  
  const profile = currentUser.profile;
  // Settings modal is now just a menu, individual forms handle their own data loading
}

// Settings modal functions
window.closeSettings = function() {
  document.getElementById('settingsModal').classList.add('hidden');
};

window.showPrivacySettings = function() {
  alert('Privacy settings coming soon!');
};

window.showNotificationSettings = function() {
  alert('Notification settings coming soon!');
};

window.showSavedPosts = function() {
  alert('Saved posts coming soon!');
};

window.showCloseFriends = function() {
  alert('Close friends coming soon!');
};

window.logout = async function() {
  if (confirm('Are you sure you want to log out?')) {
    try {
      await window.sb.auth.signOut();
      currentUser = null;
      document.getElementById('settingsModal').classList.add('hidden');
      showLoginUI();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
};

// Notification functionality
window.loadNotifications = async function(type = 'all') {
  if (!currentUser) return;
  
  try {
    let query = window.sb
      .from('notifications')
      .select(`
        *,
        from_user:from_user_id (username, avatar_url),
        post:post_id (image_url)
      `)
      .eq('to_user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (type !== 'all') {
      query = query.eq('type', type);
    }
    
    const { data: notifications, error } = await query;
    if (error) throw error;
    
    const notificationsList = document.getElementById('notificationsList');
    if (!notificationsList) return;
    
    let html = '';
    notifications?.forEach(notification => {
      const fromUser = notification.from_user;
      const post = notification.post;
      
      let message = '';
      let icon = '';
      
      switch (notification.type) {
        case 'like':
          message = 'liked your post';
          icon = '❤️';
          break;
        case 'comment':
          message = 'commented on your post';
          icon = '💬';
          break;
        case 'follow':
          message = 'started following you';
          icon = '👤';
          break;
        default:
          message = notification.message || 'interacted with your content';
          icon = '🔔';
      }
      
      html += `
        <div class="notification-item ${!notification.read ? 'unread' : ''}">
          <div class="notification-avatar-wrapper">
            <div class="notification-avatar">
              ${fromUser?.avatar_url ? `<img src="${fromUser.avatar_url}" alt="${fromUser.username}" />` : (fromUser?.username?.[0]?.toUpperCase() || 'U')}
            </div>
            <div class="notification-icon">${icon}</div>
          </div>
          
          <div class="notification-content">
            <div class="notification-text">
              <span class="username">${fromUser?.username || 'Someone'}</span> ${message}
            </div>
            <div class="notification-time">${window.formatTime(notification.created_at)}</div>
          </div>
          
          ${post?.image_url ? `<img src="${post.image_url}" alt="Post" class="notification-media" />` : ''}
        </div>
      `;
    });
    
    notificationsList.innerHTML = html || '<div class="no-content">No notifications yet</div>';
    
  } catch (error) {
    console.error('Error loading notifications:', error);
  }
};

// Setup notification tabs
function setupNotificationTabs() {
  document.querySelectorAll('.notification-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.notification-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const type = tab.dataset.tab;
      window.loadNotifications(type);
    });
  });
}

// Initialize notification tabs
document.addEventListener('DOMContentLoaded', setupNotificationTabs);

// Reels functionality - only video content
window.loadReels = async function() {
  try {
    const { data: reels, error } = await window.sb
      .from('posts')
      .select(`
        *,
        profiles:user_id (username, avatar_url, full_name),
        likes:likes(user_id),
        comments:comments(count)
      `)
      .eq('media_type', 'video')  // Only video posts for reels
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const reelsContainer = document.getElementById('reelsFeed');
    if (!reelsContainer) return;

    let html = '';
    reels?.forEach(reel => {
      const user = reel.profiles;
      const isLiked = reel.likes?.some(like => like.user_id === currentUser?.id);
      const likesCount = reel.likes?.length || 0;
      const commentsCount = reel.comments?.length || 0;
      
      html += `
        <div class="reel-item" data-reel-id="${reel.id}">
          <div class="reel-header">
            <div class="reel-user-info">
              <div class="reel-avatar">
                ${user?.avatar_url ? `<img src="${user.avatar_url}" alt="${user.username}" />` : (user?.username?.[0]?.toUpperCase() || 'U')}
              </div>
              <div class="reel-username">@${user?.username || 'user'}</div>
            </div>
            <div class="reel-more-container">
              <button class="reel-more" onclick="toggleReelMenu(event, '${reel.id}', '${reel.user_id}', '${user?.username || 'User'}')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </button>
              <div class="reel-menu" id="reelMenu-${reel.id}">
                <button class="reel-menu-item" onclick="visitUserProfile('${reel.user_id}', '${user?.username || 'User'}')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                  Visit Profile
                </button>
                <button class="reel-menu-item" onclick="startDirectMessage('${reel.user_id}', '${user?.username || 'User'}')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                  </svg>
                  Message
                </button>
                <button class="reel-menu-item" onclick="followUserFromPost('${reel.user_id}', '${user?.username || 'User'}')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                  Follow
                </button>
              </div>
            </div>
          </div>
          
          <div class="reel-video-container">
            ${reel.image_url.includes('video') || reel.image_url.includes('.mp4') ? 
              `<video src="${reel.image_url}" loop muted playsinline onclick="toggleReelPlay(this)" />` :
              `<img src="${reel.image_url}" alt="Reel" />`
            }
          </div>
          
          <div class="reel-sidebar">
            <div class="reel-actions">
              <button class="reel-action ${isLiked ? 'liked' : ''}" onclick="toggleLike('${reel.id}')">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="${isLiked ? '#ff3040' : 'none'}" stroke="${isLiked ? '#ff3040' : '#ffffff'}" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <span>${likesCount}</span>
              </button>
              
              <button class="reel-action" onclick="showComments('${reel.id}')">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span>${commentsCount}</span>
              </button>
              
              <button class="reel-action" onclick="sharePost('${reel.id}')">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16,6 12,2 8,6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
              </button>
              
              <button class="reel-action" onclick="savePost('${reel.id}')">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="reel-info">
            ${reel.caption ? `<div class="reel-caption">${reel.caption}</div>` : ''}
            ${reel.music_name ? `
              <div class="reel-music">
                🎵 ${reel.music_name} - ${reel.music_artist || 'Unknown'}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });

    reelsContainer.innerHTML = html || '<div class="no-content">No reels yet. Create your first reel!</div>';
    reelsData = reels || [];

  } catch (error) {
    console.error('Error loading reels:', error);
  }
};

// Toggle reel play/pause
window.toggleReelPlay = function(video) {
  if (video.paused) {
    // Pause all other videos
    document.querySelectorAll('.reel-item video').forEach(v => {
      if (v !== video) v.pause();
    });
    video.play();
  } else {
    video.pause();
  }
};

// Reel creation form
document.addEventListener('DOMContentLoaded', function() {
  const createReelForm = document.getElementById('createReelForm');
  createReelForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      alert('Please log in first');
      return;
    }
    
    const file = document.getElementById('reelVideo')?.files?.[0];
    if (!file) {
      alert('Please choose a video file');
      return;
    }
    
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent || 'Share Reel';
    
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading...';
      
      const base64Data = await convertToBase64(file, 10); // 10MB limit for videos
      
      const reelData = {
        user_id: currentUser.id,
        image_url: base64Data,
        caption: document.getElementById('reelCaption')?.value?.trim() || '',
        media_type: 'video',
        audience: document.getElementById('reelAudience')?.value || 'public'
      };
      
      const { error } = await window.sb.from('posts').insert(reelData);
      if (error) throw error;
      
      // Close modal and reset form
      document.getElementById('createReelModal').classList.add('hidden');
      createReelForm.reset();
      document.getElementById('reelPreview').innerHTML = '';
      document.getElementById('reelVideoSelected').textContent = '';
      
      // Switch to reels section and reload
      window.showSection('reels');
      await window.loadReels();
      
      alert('Reel created successfully!');
      
    } catch (error) {
      console.error('Reel creation failed:', error);
      alert('Failed to create reel: ' + error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
  
  // Reel video upload handler
  document.getElementById('btnPickReelVideo')?.addEventListener('click', () => {
    document.getElementById('reelVideo').click();
  });
  
  document.getElementById('reelVideo')?.addEventListener('change', (e) => {
    handleFilePreview(e.target, 'reelPreview', 'reelVideoSelected');
  });
});

// Navigation helper
document.addEventListener('DOMContentLoaded', function() {
  // Bottom navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      if (section && window.showSection) {
        window.showSection(section);
      }
    });
  });
});

// Utility functions
window.formatTime = function(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
  return Math.floor(diff / 86400000) + 'd';
};

// Highlights functionality
window.loadHighlights = async function() {
  if (!currentUser) return;
  
  try {
    const { data: highlights, error } = await window.sb
      .from('highlights')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const highlightsRow = document.getElementById('highlightsRow');
    if (!highlightsRow) return;

    let html = '';
    highlights?.forEach(highlight => {
      html += `
        <div class="highlight-item" onclick="viewHighlight('${highlight.id}')">
          <div class="highlight-avatar">
            <img src="${highlight.cover_url}" alt="${highlight.name}" />
          </div>
          <span class="highlight-name">${highlight.name}</span>
        </div>
      `;
    });

    highlightsRow.innerHTML = html;
    highlightsData = highlights || [];

  } catch (error) {
    console.error('Error loading highlights:', error);
  }
};

// View highlight
window.viewHighlight = async function(highlightId) {
  const highlight = highlightsData.find(h => h.id === highlightId);
  if (!highlight || !highlight.story_ids) return;
  
  try {
    const { data: stories, error } = await window.sb
      .from('stories')
      .select(`
        *,
        profiles:user_id (username, avatar_url, full_name)
      `)
      .in('id', highlight.story_ids)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!stories || stories.length === 0) return;

    currentStoryViewer = {
      stories: stories,
      currentIndex: 0,
      userId: currentUser.id,
      isHighlight: true,
      highlightName: highlight.name
    };

    showStoryViewer();
  } catch (error) {
    console.error('Error loading highlight stories:', error);
  }
};

// Highlight creation form
document.addEventListener('DOMContentLoaded', function() {
  const createHighlightForm = document.getElementById('createHighlightForm');
  createHighlightForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      alert('Please log in first');
      return;
    }
    
    const name = document.getElementById('highlightName')?.value?.trim();
    const coverFile = document.getElementById('highlightCover')?.files?.[0];
    
    if (!name || !coverFile) {
      alert('Please enter a name and choose a cover image');
      return;
    }
    
    const selectedStories = Array.from(document.querySelectorAll('input[name="selectedStories"]:checked'))
      .map(checkbox => checkbox.value);
    
    if (selectedStories.length === 0) {
      alert('Please select at least one story');
      return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent || 'Create Highlight';
    
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';
      
      const coverData = await convertToBase64(coverFile);
      
      const highlightData = {
        user_id: currentUser.id,
        name: name,
        cover_url: coverData,
        story_ids: selectedStories
      };
      
      const { error } = await window.sb.from('highlights').insert(highlightData);
      if (error) throw error;
      
      // Close modal and reset form
      document.getElementById('createHighlightModal').classList.add('hidden');
      createHighlightForm.reset();
      document.getElementById('highlightPreview').innerHTML = '';
      document.getElementById('highlightCoverSelected').textContent = '';
      
      // Reload highlights
      await window.loadHighlights();
      
      alert('Highlight created successfully!');
      
    } catch (error) {
      console.error('Highlight creation failed:', error);
      alert('Failed to create highlight: ' + error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
  
  // Highlight cover upload handler
  document.getElementById('btnPickHighlightCover')?.addEventListener('click', () => {
    document.getElementById('highlightCover').click();
  });
  
  document.getElementById('highlightCover')?.addEventListener('change', (e) => {
    handleFilePreview(e.target, 'highlightPreview', 'highlightCoverSelected');
  });
});

// Load stories for highlight selection
window.loadStoriesForHighlight = async function() {
  if (!currentUser) return;
  
  try {
    const { data: stories, error } = await window.sb
      .from('stories')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const storiesSelection = document.getElementById('storiesSelection');
    if (!storiesSelection) return;

    let html = '';
    stories?.forEach(story => {
      html += `
        <div class="story-selection-item">
          <input type="checkbox" name="selectedStories" value="${story.id}" id="story-${story.id}" />
          <label for="story-${story.id}">
            <div class="story-selection-preview">
              ${(story.media_type === 'video' || story.media_url?.includes('video')) ? 
                `<video src="${story.media_url}" muted />` :
                `<img src="${story.media_url}" alt="Story" />`
              }
            </div>
            <div class="story-selection-time">${window.formatTime(story.created_at)}</div>
          </label>
        </div>
      `;
    });

    storiesSelection.innerHTML = html || '<div class="no-content">No stories available</div>';

  } catch (error) {
    console.error('Error loading stories for highlight:', error);
  }
};

// Comments functionality
window.showComments = async function(postId) {
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

    // Create comments modal
    const modal = document.createElement('div');
    modal.id = 'commentsModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="closeCommentsModal()"></div>
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Comments</h3>
          <button onclick="closeCommentsModal()" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="comments-list" id="commentsList">
            ${comments?.map(comment => `
              <div class="comment-item">
                <div class="comment-avatar">
                  ${comment.profiles?.avatar_url ? 
                    `<img src="${comment.profiles.avatar_url}" alt="${comment.profiles.username}" />` :
                    (comment.profiles?.username?.[0]?.toUpperCase() || 'U')
                  }
                </div>
                <div class="comment-content">
                  <div class="comment-text">
                    <span class="comment-username">${comment.profiles?.username || 'User'}</span>
                    ${comment.content}
                  </div>
                  <div class="comment-time">${window.formatTime(comment.created_at)}</div>
                </div>
              </div>
            `).join('') || '<div class="no-content">No comments yet</div>'}
          </div>
          <form class="comment-form" onsubmit="addComment(event, '${postId}')">
            <input type="text" placeholder="Add a comment..." required />
            <button type="submit">Post</button>
          </form>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  } catch (error) {
    console.error('Error loading comments:', error);
  }
};

// Close comments modal
window.closeCommentsModal = function() {
  const modal = document.getElementById('commentsModal');
  if (modal) modal.remove();
};

// Add comment
window.addComment = async function(event, postId) {
  event.preventDefault();
  
  if (!currentUser) {
    alert('Please log in to comment');
    return;
  }
  
  const form = event.target;
  const input = form.querySelector('input');
  const content = input.value.trim();
  
  if (!content) return;
  
  try {
    const { error } = await window.sb
      .from('comments')
      .insert({
        post_id: postId,
        user_id: currentUser.id,
        content: content
      });
    
    if (error) throw error;
    
    input.value = '';
    
    // Refresh comments
    closeCommentsModal();
    showComments(postId);
    
  } catch (error) {
    console.error('Error adding comment:', error);
    alert('Failed to add comment');
  }
};

// Save post functionality
window.savePost = async function(postId) {
  if (!currentUser) {
    alert('Please log in to save posts');
    return;
  }
  
  try {
    // Check if already saved
    const { data: existingSave } = await window.sb
      .from('saved_posts')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', currentUser.id)
      .maybeSingle();
    
    if (existingSave) {
      // Unsave
      await window.sb
        .from('saved_posts')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', currentUser.id);
      alert('Post removed from saved');
    } else {
      // Save
      await window.sb
        .from('saved_posts')
        .insert({
          post_id: postId,
          user_id: currentUser.id
        });
      alert('Post saved!');
    }
  } catch (error) {
    console.error('Error saving post:', error);
  }
};

// Modal backdrop click handlers
document.addEventListener('DOMContentLoaded', function() {
  // Close modals when clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        const modal = backdrop.closest('.modal');
        if (modal) modal.classList.add('hidden');
      }
    });
  });
});

// Toggle reel menu
window.toggleReelMenu = function(event, reelId, userId, username) {
  event.stopPropagation();
  
  // Close all other menus
  document.querySelectorAll('.reel-menu').forEach(menu => {
    if (menu.id !== `reelMenu-${reelId}`) {
      menu.classList.remove('show');
    }
  });
  
  const menu = document.getElementById(`reelMenu-${reelId}`);
  if (menu) {
    menu.classList.toggle('show');
  }
};

// Close reel menus when clicking outside
document.addEventListener('click', (event) => {
  if (!event.target.closest('.reel-more-container')) {
    document.querySelectorAll('.reel-menu').forEach(menu => {
      menu.classList.remove('show');
    });
  }
});

console.log('✅ Features loaded successfully');