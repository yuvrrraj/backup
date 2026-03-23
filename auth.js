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
            
            // Ensure profile exists
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
    // Update tab buttons
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update forms
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    
    if (tabName === 'login') {
        document.getElementById('loginForm').classList.add('active');
    } else {
        document.getElementById('signupForm').classList.add('active');
    }
    
    // Clear messages
    hideMessages();
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
    console.log('🔑 Login attempt started');
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const reactivationPassword = document.getElementById('reactivationPassword').value;
    
    if (!email || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    if (!window.sb) {
        showError('Connection error. Please refresh the page.');
        return;
    }
    
    // Show loading state
    setLoginLoading(true);
    hideMessages();
    
    try {
        console.log('🔄 Attempting login with email:', email);
        
        const { data, error } = await window.sb.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            console.error('❌ Login error:', error);
            throw error;
        }
        
        // Check if account is disabled
        const { data: profile } = await window.sb
            .from('profiles')
            .select('is_disabled, reactivation_password')
            .eq('id', data.user.id)
            .single();
        
        if (profile?.is_disabled) {
            console.log('⚠️ Account is disabled, checking reactivation');
            
            if (!reactivationPassword) {
                // Show reactivation field
                document.getElementById('reactivationField').style.display = 'block';
                showError('This account is disabled. Please enter your reactivation password.');
                setLoginLoading(false);
                return;
            }
            
            // Verify reactivation password
            if (btoa(reactivationPassword) !== profile.reactivation_password) {
                showError('Incorrect reactivation password.');
                setLoginLoading(false);
                return;
            }
            
            // Reactivate account
            const { error: reactivateError } = await window.sb
                .from('profiles')
                .update({ 
                    is_disabled: false,
                    disabled_at: null,
                    reactivation_password: null
                })
                .eq('id', data.user.id);
            
            if (reactivateError) {
                console.error('❌ Reactivation error:', reactivateError);
                showError('Failed to reactivate account. Please try again.');
                setLoginLoading(false);
                return;
            }
            
            showSuccess('Account reactivated successfully! Welcome back!');
        }
        
        console.log('✅ Login successful for:', data.user.email);
        // Success handling is done in auth state change listener
        
    } catch (error) {
        console.error('❌ Login failed:', error);
        
        let errorMessage = 'Login failed. Please try again.';
        
        if (error.message.includes('Invalid login credentials')) {
            errorMessage = 'Invalid email or password. Please check your credentials.';
        } else if (error.message.includes('Email not confirmed')) {
            errorMessage = 'Please check your email and confirm your account first.';
        } else if (error.message.includes('Too many requests')) {
            errorMessage = 'Too many login attempts. Please wait a moment and try again.';
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
        
        console.log('✅ User created, creating profile...');
        
        // Create profile if user was created successfully
        if (data.user) {
            const profileData = {
                id: data.user.id,
                username: username,
                full_name: fullname || null,
                bio: bio || null,
                avatar_url: null,
                links: null,
                is_private: false
            };
            
            const { error: profileError } = await window.sb
                .from('profiles')
                .insert(profileData);
            
            if (profileError) {
                console.error('❌ Profile creation error:', profileError);
                // Don't throw here, user account was created successfully
                console.log('⚠️ Profile creation failed, but user account exists');
            } else {
                console.log('✅ Profile created successfully');
            }
        }
        
        showSuccess('Account created successfully! Please check your email to confirm your account, then you can log in.');
        
        // Clear form and switch to login
        document.getElementById('signupForm').reset();
        setTimeout(() => {
            showTab('login');
            document.getElementById('loginEmail').value = email;
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
            // Profile doesn't exist, create one
            console.log('📝 Creating missing profile...');
            
            const username = user.user_metadata?.username || 
                           user.email.split('@')[0] + '_' + Math.random().toString(36).substr(2, 4);
            
            const { data: newProfile, error: createError } = await window.sb
                .from('profiles')
                .insert({
                    id: user.id,
                    username: username,
                    full_name: user.user_metadata?.full_name || '',
                    bio: user.user_metadata?.bio || '',
                    avatar_url: null,
                    links: null,
                    is_private: false
                })
                .select()
                .single();
            
            if (createError) {
                console.error('❌ Error creating profile:', createError);
            } else {
                console.log('✅ Profile created successfully');
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

// Make functions globally available
window.showTab = showTab;
window.togglePassword = togglePassword;

console.log('✅ Auth.js initialized successfully');