-- Database Fix for Story Upload Issues
-- Run this SQL in your Supabase SQL Editor to fix story upload problems

-- Ensure media_type column exists in stories table
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image';

-- Update existing stories without media_type
UPDATE public.stories 
SET media_type = 'image' 
WHERE media_type IS NULL;

-- Ensure all required columns exist
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS audience TEXT DEFAULT 'public';
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS music_name TEXT;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS music_artist TEXT;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS music_url TEXT;

-- Make sure expires_at has a default value for existing records
UPDATE public.stories 
SET expires_at = created_at + INTERVAL '24 hours'
WHERE expires_at IS NULL;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;