-- Create custom types
CREATE TYPE user_role AS ENUM ('ADMIN', 'STAFF', 'ENCODER', 'VIEWER');
CREATE TYPE inventory_category AS ENUM ('SEEDS', 'FERTILIZER_ORGANIC', 'FERTILIZER_INORGANIC', 'DEWORMING', 'ANTI_RABIES', 'PESTICIDES');

-- Create profiles table (links to Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  role user_role DEFAULT 'VIEWER'::user_role,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create inventory table
CREATE TABLE inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category inventory_category NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  batch_number TEXT,
  expiration_date DATE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create recipients table
CREATE TABLE recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rsbsa_number TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  barangay TEXT NOT NULL,
  municipality TEXT NOT NULL,
  province TEXT NOT NULL,
  contact_number TEXT,
  farm_area_hectares NUMERIC NOT NULL DEFAULT 0,
  commodity TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create distributions table
CREATE TABLE distributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID REFERENCES recipients(id) ON DELETE RESTRICT NOT NULL,
  inventory_id UUID REFERENCES inventory(id) ON DELETE RESTRICT NOT NULL,
  quantity NUMERIC NOT NULL,
  date_distributed TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  distributed_by UUID REFERENCES profiles(id) ON DELETE RESTRICT NOT NULL,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;

-- Create basic policies (Allow all for authenticated users for now)
-- In a production environment, you should restrict these based on the user's role
CREATE POLICY "Allow authenticated full access to profiles" ON profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to inventory" ON inventory FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to recipients" ON recipients FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to distributions" ON distributions FOR ALL TO authenticated USING (true);

-- Create a trigger to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'VIEWER'::user_role);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a secure RPC function to create users without triggering email confirmation
-- and without logging out the current admin user
CREATE OR REPLACE FUNCTION public.create_user(
  user_email TEXT,
  user_password TEXT,
  user_name TEXT,
  user_role user_role
) RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Check if the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'::user_role
  ) THEN
    RAISE EXCEPTION 'Only administrators can create new users';
  END IF;

  -- Generate a new UUID for the user
  new_user_id := gen_random_uuid();
  
  -- Insert into auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    user_email,
    crypt(user_password, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', user_name),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

  -- Insert their identity so they can log in with email/password
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    format('{"sub":"%s","email":"%s"}', new_user_id::text, user_email)::jsonb,
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  -- The trigger on_auth_user_created will automatically create the profile
  -- But we want to set the specific role, so we update it
  UPDATE public.profiles
  SET role = user_role
  WHERE id = new_user_id;

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a secure RPC function to delete users completely
CREATE OR REPLACE FUNCTION public.delete_user(user_id UUID)
RETURNS void AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'::user_role
  ) THEN
    RAISE EXCEPTION 'Only administrators can delete users';
  END IF;

  -- Delete the user from auth.users (this will cascade to public.profiles)
  DELETE FROM auth.users WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
