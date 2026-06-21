/*
  # Add full_name and phone_number columns to profiles
  # And update the handle_new_user trigger to save them from user metadata.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name    text DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number text DEFAULT NULL;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Only create profile if user has confirmed their account
  IF NEW.confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (
    id, 
    phone_or_email, 
    username, 
    points, 
    avatar_seed, 
    full_name, 
    phone_number
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.phone, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Player' || floor(random() * 9999)::text),
    0,
    NEW.id::text,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone_number', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    phone_number = EXCLUDED.phone_number,
    username = COALESCE(EXCLUDED.full_name, profiles.username);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger to run on both INSERT and UPDATE
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
