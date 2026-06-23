-- Add builder_config to profiles table
-- This stores the block-based profile configuration in JSONB format

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS builder_config JSONB DEFAULT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS profiles_builder_config_idx 
ON public.profiles USING GIN (builder_config);

-- Comment for documentation
COMMENT ON COLUMN public.profiles.builder_config IS 
'JSONB configuration for block-based profile builder. Contains theme, blocks, and form definitions.';
