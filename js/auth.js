// Dedicated authentication JavaScript file
console.log('🔐 Auth.js loaded');

// Wait for DOM and Supabase to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Auth DOM loaded');
    
    // Wait for Supabase client
    const initAuth = () => {
        if (window.sb) {
            console.log('✅ Supabase client ready for auth');
            setupAuthEventListeners();
            checkExistingSession();
        } else {
            console.log('⏳ Waiting for Supabase client...');
            setTimeout(initAuth, 500);
        }
    };
    
    setTimeout(initAuth, 100);
});

// Check for existing session
async function checkExistingSession() {
    try {
        const { data: { session }, error } = await window.sb.auth.getSession();
        
        if (error) {
            console.error('Session check error:', error);
            return;
        }
        
        if (session?.user) {
            console.log('✅ Existing session found, redirecting to app');
            showSuccess('Already logged in! Redirecting...');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        }
    } catch (error) {
        console.error('Session check failed:', error);
    }
}

// Setup event listeners
function setupAuthEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        console.log('✅ Login form listener added');
    }
    
    // Signup form
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
        console.log('✅ Signup form listener added');
    }
    
    // Auth state listener
    window.sb.auth.onAuthStateChange(async (event, session) => {
        console.log('🔄 Auth state changed:', event);
        
        if (event === 'SIGNED_IN' && session?.user) {
            console.log('✅ User signed in:', session.user.email);
            showSuccess('Login successful! Redirecting...');
            
            // Create profile now that user is authenticated
            await ensureUserProfile(session.user);
            
            // Redirect to main app
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        }
    });
}

// Tab switching
function showTab(tabName) {
    document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabName === 'login' ? 'loginTab' : 'signupTab')?.classList.add('active');
    
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    document.getElementById(tabName === 'login' ? 'loginForm' : 'signupForm').classList.add('active');
    
    hideMessages();
}

function switchToLogin(prefillEmail) {
    showTab('login');
    if (prefillEmail) document.getElementById('loginEmail').value = prefillEmail;
}

// Password toggle
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = event.target;
    
    if (input.type === 'password') {
        input.type = 'text';
        button.textContent = '🙈';
    } else {
        input.type = 'password';
        button.textContent = '👁';
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    let identifier = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!identifier || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    if (!window.sb) {
        showError('Connection error. Please refresh the page.');
        return;
    }
    
    setLoginLoading(true);
    hideMessages();
    
    try {
        // If no @ symbol, treat as username — look up the email
        if (!identifier.includes('@')) {
            const { data: profile, error: lookupError } = await window.sb
                .from('profiles')
                .select('id')
                .eq('username', identifier)
                .maybeSingle();
            
            if (lookupError || !profile) {
                showError('Username not found. Please check and try again.');
                setLoginLoading(false);
                return;
            }
            
            // Get email from auth.users via a workaround:
            // sign in is email-based, so we store email in profiles
            // Instead, use the user id to fetch email via admin — not available client side.
            // Workaround: store email in profiles table.
            const { data: profileFull } = await window.sb
                .from('profiles')
                .select('email')
                .eq('username', identifier)
                .maybeSingle();
            
            if (!profileFull?.email) {
                showError('Cannot login with username — please use your email address.');
                setLoginLoading(false);
                return;
            }
            
            identifier = profileFull.email;
        }
        
        const { data, error } = await window.sb.auth.signInWithPassword({
            email: identifier,
            password
        });
        
        if (error) throw error;
        
        console.log('✅ Login successful for:', data.user.email);
        
    } catch (error) {
        let errorMessage = 'Login failed. Please try again.';
        if (error.message.includes('Invalid login credentials')) {
            errorMessage = 'Invalid credentials. Please check and try again.';
        } else if (error.message.includes('Email not confirmed')) {
            errorMessage = 'Please confirm your email first.';
        } else if (error.message.includes('Too many requests')) {
            errorMessage = 'Too many attempts. Please wait and try again.';
        }
        showError(errorMessage);
        setLoginLoading(false);
    }
}

// Handle signup
async function handleSignup(e) {
    e.preventDefault();
    console.log('📝 Signup attempt started');
    
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const username = document.getElementById('signupUsername').value.trim();
    const fullname = document.getElementById('signupFullname').value.trim();
    const bio = document.getElementById('signupBio').value.trim();
    
    if (!email || !password || !username) {
        showError('Please fill in all required fields');
        return;
    }
    
    if (password.length < 6) {
        showError('Password must be at least 6 characters long');
        return;
    }
    
    if (username.length < 3) {
        showError('Username must be at least 3 characters long');
        return;
    }
    
    if (!window.sb) {
        showError('Connection error. Please refresh the page.');
        return;
    }
    
    // Show loading state
    setSignupLoading(true);
    hideMessages();
    
    try {
        console.log('🔄 Checking username availability:', username);
        
        // Check if username is already taken
        const { data: existingUser, error: checkError } = await window.sb
            .from('profiles')
            .select('username')
            .eq('username', username)
            .single();
        
        if (checkError && checkError.code !== 'PGRST116') {
            console.error('❌ Username check error:', checkError);
            throw new Error('Error checking username availability');
        }
        
        if (existingUser) {
            showError('Username already taken. Please choose a different one.');
            setSignupLoading(false);
            return;
        }
        
        console.log('🔄 Creating user account...');
        
        // Create auth user
        const { data, error } = await window.sb.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: username,
                    full_name: fullname,
                    bio: bio
                }
            }
        });
        
        if (error) {
            console.error('❌ Signup error:', error);
            throw error;
        }
        
        console.log('✅ User created - pending email confirmation');
        
        // Upload avatar if selected, now that we have the user ID
        let avatar_url = null;
        if (data.user) {
            avatar_url = await uploadSignupAvatar(data.user.id);
        }

        // Store pending profile data to create after email confirmation
        if (data.user) {
            localStorage.setItem('pendingProfile', JSON.stringify({
                id: data.user.id,
                username,
                full_name: fullname || null,
                bio: bio || null,
                avatar_url
            }));
        }
        
        showSuccess('Account created! Check your email to confirm, then log in.');
        
        // Clear form and switch to login
        document.getElementById('signupForm').reset();
        const loginEmail = email;
        setTimeout(() => {
            switchToLogin(loginEmail);
        }, 2000);
        
    } catch (error) {
        console.error('❌ Signup failed:', error);
        
        let errorMessage = 'Signup failed. Please try again.';
        
        if (error.message.includes('User already registered')) {
            errorMessage = 'An account with this email already exists. Please log in instead.';
        } else if (error.message.includes('Password should be at least 6 characters')) {
            errorMessage = 'Password must be at least 6 characters long.';
        } else if (error.message.includes('Invalid email')) {
            errorMessage = 'Please enter a valid email address.';
        } else if (error.message.includes('Username already taken')) {
            errorMessage = 'Username already taken. Please choose a different one.';
        }
        
        showError(errorMessage);
    } finally {
        setSignupLoading(false);
    }
}

// Ensure user profile exists
async function ensureUserProfile(user) {
    try {
        console.log('🔄 Ensuring profile exists for user:', user.id);
        
        let { data: profile, error } = await window.sb
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (error && error.code === 'PGRST116') {
            console.log('📝 Creating missing profile...');
            
            // Use pending profile data from signup if available
            const pending = JSON.parse(localStorage.getItem('pendingProfile') || 'null');
            const username = (pending?.id === user.id && pending?.username)
                ? pending.username
                : (user.user_metadata?.username || user.email.split('@')[0] + '_' + Math.random().toString(36).substr(2, 4));
            
            const { data: newProfile, error: createError } = await window.sb
                .from('profiles')
                .insert({
                    id: user.id,
                    email: user.email,
                    username,
                    full_name: pending?.full_name || user.user_metadata?.full_name || '',
                    bio: pending?.bio || user.user_metadata?.bio || '',
                    avatar_url: pending?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || null
                })
                .select()
                .single();
            
            if (createError) {
                console.error('❌ Error creating profile:', createError);
            } else {
                console.log('✅ Profile created successfully');
                localStorage.removeItem('pendingProfile');
                profile = newProfile;
            }
        }
        
        return profile;
    } catch (error) {
        console.error('❌ Error ensuring profile:', error);
        return null;
    }
}

// UI Helper functions
function setLoginLoading(loading) {
    const btn = document.getElementById('loginBtn');
    const text = document.getElementById('loginBtnText');
    const loader = document.getElementById('loginBtnLoader');
    
    if (loading) {
        btn.disabled = true;
        text.style.display = 'none';
        loader.style.display = 'inline-block';
    } else {
        btn.disabled = false;
        text.style.display = 'inline';
        loader.style.display = 'none';
    }
}

function setSignupLoading(loading) {
    const btn = document.getElementById('signupBtn');
    const text = document.getElementById('signupBtnText');
    const loader = document.getElementById('signupBtnLoader');
    
    if (loading) {
        btn.disabled = true;
        text.style.display = 'none';
        loader.style.display = 'inline-block';
    } else {
        btn.disabled = false;
        text.style.display = 'inline';
        loader.style.display = 'none';
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    
    successDiv.style.display = 'none';
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    
    errorDiv.style.display = 'none';
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}

function hideMessages() {
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('successMessage').style.display = 'none';
}

// Signup avatar preview
window.previewSignupAvatar = function(input) {
    const file = input.files?.[0];
    if (!file) return;
    const preview = document.getElementById('signupAvatarPreview');
    const reader = new FileReader();
    reader.onload = e => {
        preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    };
    reader.readAsDataURL(file);
};

async function uploadSignupAvatar(userId) {
    const input = document.getElementById('signupAvatar');
    const file = input.files?.[0];
    if (!file) return null;

    const status = document.getElementById('signupAvatarStatus');
    status.textContent = 'Uploading photo...';

    const ext = file.name.split('.').pop();
    const path = `${userId}/avatar.${ext}`;
    const { error } = await window.sb.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
    if (error) { status.textContent = 'Photo upload failed (skipped)'; return null; }

    const { data } = window.sb.storage.from('avatars').getPublicUrl(path);
    status.textContent = '✓ Photo uploaded';
    return data.publicUrl;
}

// Google OAuth
async function handleGoogleLogin() {
    if (!window.sb) { showError('Connection error. Please refresh.'); return; }
    const { error } = await window.sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'https://69c0e9118c372932ccfe92ec--precious-kringle-c11d18.netlify.app/index.html' }
    });
    if (error) showError('Google login failed: ' + error.message);
}
window.handleGoogleLogin = handleGoogleLogin;

// Make functions globally available
window.showTab = showTab;
window.togglePassword = togglePassword;

console.log('✅ Auth.js initialized successfully');