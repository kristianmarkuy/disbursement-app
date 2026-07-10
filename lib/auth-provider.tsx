"use client";

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useClerk, useSession, useSignIn, useSignUp, useUser } from '@clerk/nextjs';
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

type ClerkUser = ReturnType<typeof useUser>['user'];
type ClerkSession = ReturnType<typeof useSession>['session'];

type AuthContextType = {
  user: ClerkUser;
  session: ClerkSession;
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

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (error && typeof error === 'object' && 'errors' in error) {
    const clerkError = error as { errors?: Array<{ message?: string }> };
    const message = clerkError.errors?.map((item) => item.message).filter(Boolean).join(', ');

    if (message) {
      return new Error(message);
    }
  }

  return new Error('Authentication failed. Please try again.');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { session } = useSession();
  const { signOut: clerkSignOut } = useClerk();
  const {
    signIn: clerkSignIn,
    setActive: setSignInActive,
    isLoaded: isSignInLoaded,
  } = useSignIn();
  const {
    signUp: clerkSignUp,
    setActive: setSignUpActive,
    isLoaded: isSignUpLoaded,
  } = useSignUp();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const router = useRouter();

  const loadProfile = useCallback(async (hasUser: boolean) => {
    if (!hasUser) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    try {
      const response = await fetch('/api/auth/profile', {
        cache: 'no-store',
      });

      if (!response.ok) {
        setProfile(null);
        return;
      }

      const data = (await response.json()) as { profile: UserProfile | null };
      setProfile(data.profile);
    } catch (error) {
      console.error('Failed to load user profile', error);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isUserLoaded) {
      return;
    }

    loadProfile(Boolean(user));
  }, [isUserLoaded, loadProfile, user]);

  const signIn = async (email: string, password: string) => {
    if (!isSignInLoaded || !clerkSignIn || !setSignInActive) {
      return { error: new Error('Authentication is still loading. Please try again.') };
    }

    try {
      const result = await clerkSignIn.create({
        identifier: email,
        password,
      });

      if (result.status !== 'complete' || !result.createdSessionId) {
        return { error: new Error('Additional verification is required before signing in.') };
      }

      await setSignInActive({ session: result.createdSessionId });
      await loadProfile(true);

      return { error: null };
    } catch (error) {
      return { error: toError(error) };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    if (!isSignUpLoaded || !clerkSignUp || !setSignUpActive) {
      return { error: new Error('Authentication is still loading. Please try again.') };
    }

    try {
      const result = await clerkSignUp.create({
        emailAddress: email,
        password,
        unsafeMetadata: {
          full_name: fullName?.trim() || null,
        },
      });

      if (result.status !== 'complete' || !result.createdSessionId) {
        return {
          error: new Error('Additional verification is required before this account can be created.'),
        };
      }

      await setSignUpActive({ session: result.createdSessionId });
      await loadProfile(true);
      await clerkSignOut();
      setProfile(null);

      return { error: null };
    } catch (error) {
      return { error: toError(error) };
    }
  };

  const signOut = async () => {
    await clerkSignOut();
    setProfile(null);
    router.push('/login');
  };

  const refreshProfile = async () => {
    await loadProfile(Boolean(user));
  };

  const role = profile?.role ?? null;
  const isApproved = profile?.approval_status === 'approved';
  const activeRole = isApproved ? role : null;
  const loading = !isUserLoaded || profileLoading;

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
