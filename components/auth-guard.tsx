"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { UserRole } from '@/lib/supabase';

type RequireAuthProps = {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
};

export function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const { user, loading, profile, isApproved, role, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="text-sm text-[hsl(var(--muted-foreground))]">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!profile || !isApproved) {
    const isRejected = profile?.approval_status === 'rejected';

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">
            {isRejected ? 'Access request rejected' : 'Approval pending'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRejected
              ? 'Your account is not approved for this portal. Contact an administrator if this is unexpected.'
              : 'An administrator needs to approve your account before you can access EduFinance.'}
          </p>
          <button
            type="button"
            onClick={signOut}
            className="mt-5 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">Access restricted</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your role does not have permission to open this section.
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mt-5 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to schools
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
