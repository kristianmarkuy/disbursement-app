"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import {
  LayoutDashboard,
  Receipt,
  BookOpen,
  FileText,
  Landmark,
  Building2,
  LogOut,
  HelpCircle,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { School, UserRole } from '@/lib/supabase';

const schoolNavItems = [
  { href: '', label: 'Dashboard', icon: LayoutDashboard, end: true, roles: ['admin', 'officer'] },
  { href: '/transactions', label: 'Transactions', icon: Receipt, roles: ['admin', 'officer'] },
  { href: '/uacs', label: 'UACS Codes', icon: BookOpen, roles: ['admin'] },
  { href: '/reports', label: 'Reports', icon: FileText, roles: ['admin', 'officer', 'viewer'] },
];

interface SidebarProps {
  school: School | null;
  schoolId: string;
}

export function Sidebar({ school, schoolId }: SidebarProps) {
  const pathname = usePathname();
  const basePath = `/school/${schoolId}`;
  const { signOut, role, canManageUsers } = useAuth();
  const visibleNavItems = schoolNavItems.filter(
    (item) => role && item.roles.includes(role as UserRole)
  );

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[260px] flex-col border-r border-border bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
      <div className="flex h-[72px] items-center gap-3 border-b border-border px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground">
          <Landmark className="h-5 w-5" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xl font-semibold tracking-tight text-primary">
            EduFinance
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Admin Portal
          </span>
          <span className="sr-only">{school ? school.name : 'Loading school'}</span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {visibleNavItems.map((item) => {
          const itemHref = `${basePath}${item.href}`;
          const isActive = item.end
            ? pathname === itemHref
            : pathname.startsWith(itemHref);
          return (
            <Link
              key={item.href || 'dashboard'}
              href={itemHref}
              className={cn(
                'relative flex h-11 items-center gap-3 rounded px-4 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:bg-primary'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-primary'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4 space-y-1">
        <Link
          href="/"
          className="flex h-9 items-center gap-3 rounded px-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors"
        >
          <Building2 className="h-4 w-4" />
          All Schools
        </Link>
        {canManageUsers && (
          <Link
            href="/admin/users"
            className="flex h-9 items-center gap-3 rounded px-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors"
          >
            <Users className="h-4 w-4" />
            User Approvals
          </Link>
        )}
        <Link
          href="#"
          className="flex h-9 items-center gap-3 rounded px-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
          Support
        </Link>
        <button
          onClick={signOut}
          className="flex h-9 w-full items-center gap-3 rounded px-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
