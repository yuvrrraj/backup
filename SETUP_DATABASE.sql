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
  edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  unsent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create posts table
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

-- Create stories table
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
  story_ids TEXT[],
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

-- Basic RLS Policies (simplified to avoid syntax errors)
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "posts_select" ON public.posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "posts_delete" ON public.posts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "stories_select" ON public.stories FOR SELECT USING (true);
CREATE POLICY "stories_insert" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stories_update" ON public.stories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "stories_delete" ON public.stories FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "likes_select" ON public.likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete" ON public.likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "comments_select" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON public.comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "follows_select" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

CREATE POLICY "blocked_users_select" ON public.blocked_users FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "blocked_users_insert" ON public.blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocked_users_delete" ON public.blocked_users FOR DELETE USING (auth.uid() = blocker_id);

CREATE POLICY "scheduled_messages_select" ON public.scheduled_messages FOR SELECT USING (auth.uid() = sender_id);
CREATE POLICY "scheduled_messages_insert" ON public.scheduled_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "scheduled_messages_update" ON public.scheduled_messages FOR UPDATE USING (auth.uid() = sender_id);
CREATE POLICY "scheduled_messages_delete" ON public.scheduled_messages FOR DELETE USING (auth.uid() = sender_id);

CREATE POLICY "highlights_select" ON public.highlights FOR SELECT USING (true);
CREATE POLICY "highlights_insert" ON public.highlights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "highlights_update" ON public.highlights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "highlights_delete" ON public.highlights FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "saved_posts_select" ON public.saved_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_posts_insert" ON public.saved_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_posts_delete" ON public.saved_posts FOR DELETE USING (auth.uid() = user_id);