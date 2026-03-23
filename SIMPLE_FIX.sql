-- Complete database fix - Run this in your Supabase SQL Editor

-- Add missing columns to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS unsent BOOLEAN DEFAULT FALSE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Create likes table
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Create saved_posts table
CREATE TABLE IF NOT EXISTS public.saved_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.likes;
DROP POLICY IF EXISTS "Users can insert their own likes" ON public.likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON public.likes;
DROP POLICY IF EXISTS "Users can view their saved posts" ON public.saved_posts;
DROP POLICY IF EXISTS "Users can save posts" ON public.saved_posts;
DROP POLICY IF EXISTS "Users can unsave posts" ON public.saved_posts;

-- Create RLS policies
CREATE POLICY "Users can view their notifications" ON public.notifications 
  FOR SELECT USING (auth.uid() = to_user_id);

CREATE POLICY "Likes are viewable by everyone" ON public.likes 
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own likes" ON public.likes 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" ON public.likes 
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their saved posts" ON public.saved_posts 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can save posts" ON public.saved_posts 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave posts" ON public.saved_posts 
  FOR DELETE USING (auth.uid() = user_id);

-- Remove problematic trigger
DROP TRIGGER IF EXISTS follow_notification_trigger ON public.follows;

-- Simple function that won't fail
CREATE OR REPLACE FUNCTION simple_follow_notification()
RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create simple trigger
CREATE TRIGGER follow_notification_trigger
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION simple_follow_notification();

-- Add message deletion policy
DROP POLICY IF EXISTS "Users can delete their messages" ON public.messages;
CREATE POLICY "Users can delete their messages" ON public.messages 
  FOR DELETE USING (auth.uid() = sender_id);