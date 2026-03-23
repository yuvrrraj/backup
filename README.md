# Business Chat App (Supabase)

This is a simple business messaging web app using Supabase for auth, profiles with unique usernames, search by username, and 1:1 realtime chat.

## Setup

1. Create a Supabase project at https://supabase.com
2. Copy your Project URL and anon public key into `js/supabaseClient.js`.
- Security: do not expose service keys on the client. Only use the anon public key in `js/supabaseClient.js`.
3. Run the following SQL in your Supabase SQL Editor to create the required tables:

```sql
-- Enable RLS
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.follows ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  links TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  is_disabled BOOLEAN DEFAULT FALSE,
  disabled_at TIMESTAMPTZ,
  reactivation_password TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create posts table with music columns
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  caption TEXT,
  image_url TEXT,
  audience TEXT DEFAULT 'public',
  music_name TEXT,
  music_artist TEXT,
  music_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stories table with music columns
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT DEFAULT 'image',
  audience TEXT DEFAULT 'public',
  music_name TEXT,
  music_artist TEXT,
  music_url TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create likes table
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create follows table
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  followee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, followee_id)
);

-- Create blocked_users table
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- Create scheduled_messages table
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create highlights table
CREATE TABLE IF NOT EXISTS public.highlights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  cover_url TEXT NOT NULL,
  story_ids TEXT[], -- Array of story IDs included in this highlight
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create saved_posts table
CREATE TABLE IF NOT EXISTS public.saved_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Add edit and unsend fields to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS unsent BOOLEAN DEFAULT FALSE;

-- Add file-related columns if they don't exist
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Make content nullable for file messages
ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL;

-- RLS Policies
-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (is_disabled = false OR is_disabled IS NULL);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Messages policies
CREATE POLICY "Users can view messages they sent or received" ON public.messages FOR SELECT USING (
  (auth.uid() = sender_id OR auth.uid() = receiver_id) AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_disabled = false OR profiles.is_disabled IS NULL)
  ) AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = (CASE WHEN auth.uid() = sender_id THEN receiver_id ELSE sender_id END)
    AND (profiles.is_disabled = false OR profiles.is_disabled IS NULL)
  )
);
CREATE POLICY "Users can insert messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Posts policies
CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = posts.user_id 
    AND (profiles.is_disabled = false OR profiles.is_disabled IS NULL)
  )
);
CREATE POLICY "Users can insert their own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- Stories policies
CREATE POLICY "Stories are viewable by everyone" ON public.stories FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = stories.user_id 
    AND (profiles.is_disabled = false OR profiles.is_disabled IS NULL)
  )
);
CREATE POLICY "Users can insert their own stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own stories" ON public.stories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own stories" ON public.stories FOR DELETE USING (auth.uid() = user_id);

-- Likes policies
CREATE POLICY "Likes are viewable by everyone" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own likes" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own likes" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can insert their own comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- Follows policies
CREATE POLICY "Follows are viewable by everyone" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can insert their own follows" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can delete their own follows" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- Blocked users policies
CREATE POLICY "Users can view their blocked users" ON public.blocked_users FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "Users can block others" ON public.blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users can unblock others" ON public.blocked_users FOR DELETE USING (auth.uid() = blocker_id);

-- Scheduled messages policies
CREATE POLICY "Users can view their scheduled messages" ON public.scheduled_messages FOR SELECT USING (auth.uid() = sender_id);
CREATE POLICY "Users can create scheduled messages" ON public.scheduled_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update their scheduled messages" ON public.scheduled_messages FOR UPDATE USING (auth.uid() = sender_id);
CREATE POLICY "Users can delete their scheduled messages" ON public.scheduled_messages FOR DELETE USING (auth.uid() = sender_id);

-- Highlights policies
CREATE POLICY "Highlights are viewable by everyone" ON public.highlights FOR SELECT USING (true);
CREATE POLICY "Users can create their own highlights" ON public.highlights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own highlights" ON public.highlights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own highlights" ON public.highlights FOR DELETE USING (auth.uid() = user_id);

-- Saved posts policies
CREATE POLICY "Users can view their saved posts" ON public.saved_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save posts" ON public.saved_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave posts" ON public.saved_posts FOR DELETE USING (auth.uid() = user_id);
```

## Next steps

- Typing indicators, presence, and read receipts
- Group chats
- File/image uploads (use Supabase Storage)
- Pagination and infinite scroll for messages
- Music integration from external APIs
