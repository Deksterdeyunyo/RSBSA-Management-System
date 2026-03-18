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
