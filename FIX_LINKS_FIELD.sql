-- First, let's check the actual data type of links column
-- If it's an array type, we need to convert it to TEXT first

-- Step 1: Convert links column to TEXT if it's currently an array
ALTER TABLE public.profiles ALTER COLUMN links TYPE TEXT;

-- Step 2: Clean up malformed data
UPDATE public.profiles 
SET links = NULL 
WHERE links::TEXT = '' 
   OR links::TEXT = '""' 
   OR links::TEXT = '[]' 
   OR links::TEXT = 'null'
   OR links IS NULL;

-- Step 3: Add constraint to prevent empty strings
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS links_not_empty;

ALTER TABLE public.profiles 
ADD CONSTRAINT links_not_empty 
CHECK (links IS NULL OR length(trim(links)) > 0);