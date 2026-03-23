// Authentication check for main app
console.log('🔐 Auth check loaded');

// Check authentication immediately
(async function checkAuth() {
    console.log('🔍 Checking authentication status...');
    
    // Wait for Supabase to be ready
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!window.sb && attempts < maxAttempts) {
        console.log('⏳ Waiting for Supabase client...');
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
    }
    
    if (!window.sb) {
        console.log('❌ Supabase client not available, redirecting to auth');
        window.location.href = 'auth.html';
        return;
    }
    
    try {
        const { data: { session }, error } = await window.sb.auth.getSession();
        
        if (error) {
            console.error('❌ Session check error:', error);
            window.location.href = 'auth.html';
            return;
        }
        
        if (!session?.user) {
            console.log('❌ No active session, redirecting to auth');
            window.location.href = 'auth.html';
            return;
        }
        
        console.log('✅ Valid session found:', session.user.email);
        window.currentUser = session.user;
        
        // Ensure profile exists
        await ensureUserProfile(session.user);
        
        // Set up auth state listener
        window.sb.auth.onAuthStateChange((event, session) => {
            console.log('🔄 Auth state changed:', event);
            
            if (event === 'SIGNED_OUT') {
                console.log('👋 User signed out, redirecting to auth');
                window.location.href = 'auth.html';
            }
        });
        
        console.log('✅ Authentication check complete');
        
    } catch (error) {
        console.error('❌ Auth check failed:', error);
        window.location.href = 'auth.html';
    }
})();

// Ensure user profile exists
async function ensureUserProfile(user) {
    try {
        let { data: profile, error: profileError } = await window.sb
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (profileError && profileError.code === 'PGRST116') {
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
                    avatar_url: user.user_metadata?.avatar_url || null,
                    bio: user.user_metadata?.bio || '',
                    links: user.user_metadata?.links || null,
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
        
        if (profile) {
            window.currentUser.profile = profile;
            
            // Sync follow status from database
            try {
                const { data: follows } = await window.sb
                    .from('follows')
                    .select('followee_id')
                    .eq('follower_id', user.id);
                
                const followedUserIds = follows?.map(f => f.followee_id) || [];
                localStorage.setItem('followedUsers', JSON.stringify(followedUserIds));
                console.log('✅ Follow status synced:', followedUserIds.length, 'users');
            } catch (syncError) {
                console.error('⚠️ Error syncing follow status:', syncError);
            }
        }
        
        return profile;
    } catch (error) {
        console.error('❌ Error ensuring profile:', error);
        return null;
    }
}

console.log('✅ Auth check script loaded');