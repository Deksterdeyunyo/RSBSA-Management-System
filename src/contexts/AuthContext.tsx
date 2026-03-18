import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, signOut: async () => {} });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Session error:', error.message);
          // If there's an error (like invalid refresh token), clear the session
          await supabase.auth.signOut().catch(() => {});
          // Force clear local storage just in case
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
              localStorage.removeItem(key);
            }
          });
          setLoading(false);
          return;
        }
        
        if (session?.user) {
          fetchProfile(session.user.id, session.user.email, session.user.user_metadata?.full_name);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Unexpected session error:', err);
        await supabase.auth.signOut().catch(() => {});
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
            localStorage.removeItem(key);
          }
        });
        setLoading(false);
      }
    };
    
    initSession();

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event as string) === 'TOKEN_REFRESH_FAILED') {
        console.error('Token refresh failed, clearing session');
        await supabase.auth.signOut().catch(() => {});
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
            localStorage.removeItem(key);
          }
        });
        setUser(null);
        setLoading(false);
        return;
      }

      if (session?.user) {
        fetchProfile(session.user.id, session.user.email, session.user.user_metadata?.full_name);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, email?: string, name?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist, create it
          const newProfile = {
            id: userId,
            email: email || 'user@example.com',
            name: name || email?.split('@')[0] || 'User',
            role: 'ADMIN' // Default to ADMIN for development
          };
          
          const { data: createdProfile, error: createError } = await supabase
            .from('profiles')
            .insert([newProfile])
            .select()
            .single();
            
          if (createError) throw createError;
          setUser(createdProfile as User);
          return;
        }
        throw error;
      }
      
      setUser(data as User);
    } catch (error) {
      console.error('Error fetching/creating profile:', error);
      // Fallback for development if profile creation fails
      setUser({
        id: userId,
        email: email || 'dev@example.com',
        role: 'ADMIN',
        name: name || 'Dev Admin',
        created_at: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
