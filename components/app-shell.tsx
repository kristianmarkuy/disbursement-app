"use client";

import { Sidebar } from '@/components/sidebar';
import { School } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-provider';
import { Bell, HelpCircle, Search } from 'lucide-react';

interface AppShellProps {
  school: School | null;
  schoolId: string;
  children: React.ReactNode;
}

export function AppShell({ school, schoolId, children }: AppShellProps) {
  const { profile } = useAuth();
  const initials = (profile?.full_name || profile?.email || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar school={school} schoolId={schoolId} />
      <main className="ml-[260px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-border bg-white px-6">
          <div className="relative w-full max-w-[520px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 w-full rounded border border-input bg-slate-50 pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
              placeholder="Search records, payees, schools..."
            />
          </div>
          <div className="flex items-center gap-5 text-sm">
            <div className="hidden items-center gap-2 border-r border-border pr-5 text-muted-foreground md:flex">
              <span>Current School:</span>
              <span className="font-medium text-foreground">{school?.name || 'Loading...'}</span>
            </div>
            <button className="text-slate-700 hover:text-primary" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </button>
            <button className="text-slate-700 hover:text-primary" aria-label="Help">
              <HelpCircle className="h-4 w-4" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
              {initials}
            </div>
          </div>
        </header>
        <div className="app-container">{children}</div>
      </main>
    </div>
  );
}
