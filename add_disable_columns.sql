-- Add disabled account columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reactivation_password TEXT;

-- Update RLS policies to hide disabled accounts
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (is_disabled = false OR is_disabled IS NULL);

DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = posts.user_id 
    AND (profiles.is_disabled = false OR profiles.is_disabled IS NULL)
  )
);

DROP POLICY IF EXISTS "Users can view messages they sent or received" ON public.messages;
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