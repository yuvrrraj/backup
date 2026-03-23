-- Complete Instagram-like Database Schema
-- Run this in your Supabase SQL Editor

-- Enable RLS on all tables
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saved_posts ENABLE ROW LEVEL SECURITY;

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

-- Create highlights table
CREATE TABLE IF NOT EXISTS public.highlights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  cover_url TEXT NOT NULL,
  story_ids TEXT[], -- Array of story IDs
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

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- 'like', 'comment', 'follow', 'mention'
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create saved_posts table
CREATE TABLE IF NOT EXISTS public.saved_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Create blocked_users table
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- RLS Policies

-- Profiles policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Posts policies
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;

CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can insert their own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- Stories policies
DROP POLICY IF EXISTS "Stories are viewable by everyone" ON public.stories;
DROP POLICY IF EXISTS "Users can insert their own stories" ON public.stories;
DROP POLICY IF EXISTS "Users can update their own stories" ON public.stories;
DROP POLICY IF EXISTS "Users can delete their own stories" ON public.stories;

CREATE POLICY "Stories are viewable by everyone" ON public.stories FOR SELECT USING (true);
CREATE POLICY "Users can insert their own stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own stories" ON public.stories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own stories" ON public.stories FOR DELETE USING (auth.uid() = user_id);

-- Highlights policies
DROP POLICY IF EXISTS "Highlights are viewable by everyone" ON public.highlights;
DROP POLICY IF EXISTS "Users can create their own highlights" ON public.highlights;
DROP POLICY IF EXISTS "Users can update their own highlights" ON public.highlights;
DROP POLICY IF EXISTS "Users can delete their own highlights" ON public.highlights;

CREATE POLICY "Highlights are viewable by everyone" ON public.highlights FOR SELECT USING (true);
CREATE POLICY "Users can create their own highlights" ON public.highlights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own highlights" ON public.highlights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own highlights" ON public.highlights FOR DELETE USING (auth.uid() = user_id);

-- Likes policies
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.likes;
DROP POLICY IF EXISTS "Users can insert their own likes" ON public.likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON public.likes;

CREATE POLICY "Likes are viewable by everyone" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own likes" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own likes" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- Comments policies
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;

CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can insert their own comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- Follows policies
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON public.follows;
DROP POLICY IF EXISTS "Users can insert their own follows" ON public.follows;
DROP POLICY IF EXISTS "Users can delete their own follows" ON public.follows;

CREATE POLICY "Follows are viewable by everyone" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can insert their own follows" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can delete their own follows" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- Messages policies
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;

CREATE POLICY "Users can view messages they sent or received" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can insert messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Notifications policies
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;

CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT USING (auth.uid() = to_user_id);
CREATE POLICY "Users can create notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Users can update their notifications" ON public.notifications FOR UPDATE USING (auth.uid() = to_user_id);

-- Saved posts policies
DROP POLICY IF EXISTS "Users can view their saved posts" ON public.saved_posts;
DROP POLICY IF EXISTS "Users can save posts" ON public.saved_posts;
DROP POLICY IF EXISTS "Users can unsave posts" ON public.saved_posts;

CREATE POLICY "Users can view their saved posts" ON public.saved_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save posts" ON public.saved_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave posts" ON public.saved_posts FOR DELETE USING (auth.uid() = user_id);

-- Blocked users policies
DROP POLICY IF EXISTS "Users can view their blocked users" ON public.blocked_users;
DROP POLICY IF EXISTS "Users can block others" ON public.blocked_users;
DROP POLICY IF EXISTS "Users can unblock others" ON public.blocked_users;

CREATE POLICY "Users can view their blocked users" ON public.blocked_users FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "Users can block others" ON public.blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users can unblock others" ON public.blocked_users FOR DELETE USING (auth.uid() = blocker_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON public.stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON public.likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON public.messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_to_user ON public.notifications(to_user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON public.follows(followee_id);

-- Functions for automatic notifications
CREATE OR REPLACE FUNCTION create_like_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Don't create notification if user likes their own post
  IF NEW.user_id != (SELECT user_id FROM posts WHERE id = NEW.post_id) THEN
    INSERT INTO notifications (to_user_id, from_user_id, type, post_id)
    VALUES (
      (SELECT user_id FROM posts WHERE id = NEW.post_id),
      NEW.user_id,
      'like',
      NEW.post_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Don't create notification if user comments on their own post
  IF NEW.user_id != (SELECT user_id FROM posts WHERE id = NEW.post_id) THEN
    INSERT INTO notifications (to_user_id, from_user_id, type, post_id)
    VALUES (
      (SELECT user_id FROM posts WHERE id = NEW.post_id),
      NEW.user_id,
      'comment',
      NEW.post_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_follow_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (to_user_id, from_user_id, type)
  VALUES (NEW.followee_id, NEW.follower_id, 'follow');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS like_notification_trigger ON public.likes;
DROP TRIGGER IF EXISTS comment_notification_trigger ON public.comments;
DROP TRIGGER IF EXISTS follow_notification_trigger ON public.follows;

CREATE TRIGGER like_notification_trigger
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION create_like_notification();

CREATE TRIGGER comment_notification_trigger
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION create_comment_notification();

CREATE TRIGGER follow_notification_trigger
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION create_follow_notification();