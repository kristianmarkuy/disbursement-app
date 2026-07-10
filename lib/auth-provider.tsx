"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  UserProfile,
  UserRole,
  canDeleteSchools,
  canDeleteTransactions,
  canManageSchools,
  canManageTransactions,
  canManageUacs,
  canManageUsers,
  canViewReports,
} from '@/lib/supabase';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: UserRole | null;
  isApproved: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  canManageSchools: boolean;
  canDeleteSchools: boolean;
  canManageTransactions: boolean;
  canDeleteTransactions: boolean;
  canManageUacs: boolean;
  canManageUsers: boolean;
  canViewReports: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadProfile = async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load user profile', error);
      setProfile(null);
      return;
    }

    setProfile((data as UserProfile | null) ?? null);
  };

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      await loadProfile(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      loadProfile(session?.user ?? null).finally(() => setLoading(false));
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName?.trim() || null,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const refreshProfile = async () => {
    await loadProfile(user);
  };

  const role = profile?.role ?? null;
  const isApproved = profile?.approval_status === 'approved';
  const activeRole = isApproved ? role : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isApproved,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        canManageSchools: canManageSchools(activeRole),
        canDeleteSchools: canDeleteSchools(activeRole),
        canManageTransactions: canManageTransactions(activeRole),
        canDeleteTransactions: canDeleteTransactions(activeRole),
        canManageUacs: canManageUacs(activeRole),
        canManageUsers: canManageUsers(activeRole),
        canViewReports: canViewReports(activeRole),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
