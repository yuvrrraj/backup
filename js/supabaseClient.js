// Supabase client setup using CDN global `supabase`
// Fill in your project credentials below. Get them from your Supabase dashboard.
const SUPABASE_URL = "https://lajhpvyimdrtvnsbrqii.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-BJRG5QNrp3FvDRbuo0GlA_nrQYDbI7";

const GITHUB_PAGES_URL = window.location.origin;

if (!window.supabase) {
  console.error("Supabase JS not loaded. Check the <script> CDN tag in index.html");
}

// Create unique tab ID for session isolation
const TAB_ID = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
const SESSION_KEY = `sb_session_${TAB_ID}`;

// Tab-specific storage that doesn't persist across tabs
const tabStorage = {
  data: new Map(),
  getItem: function(key) {
    return this.data.get(key) || null;
  },
  setItem: function(key, value) {
    this.data.set(key, value);
  },
  removeItem: function(key) {
    this.data.delete(key);
  }
};

window.sb = undefined;
try {
  if (SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY && window.supabase) {
    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        redirectTo: GITHUB_PAGES_URL
      }
    });
    console.log('✅ Supabase client initialized successfully');
    console.log('🌐 Site URL:', GITHUB_PAGES_URL);
    
    // Test connection
    window.sb.from('profiles').select('count').limit(1).then(result => {
      console.log('🔗 Database connection test:', result.error ? '❌ Failed' : '✅ Success');
    });
  } else {
    console.error('❌ Supabase initialization failed: Missing URL, key, or CDN');
  }
} catch (e) {
  console.error('❌ Supabase client error:', e);
}

// Optimized for speed - minimal cleanup
window.addEventListener('beforeunload', () => {
  // Fast cleanup
});

// Connection status indicator
setTimeout(() => {
  if (window.sb) {
    console.log('🚀 App ready with Supabase connection');
  } else {
    console.error('⚠️ App started without Supabase connection');
  }
}, 1000);
