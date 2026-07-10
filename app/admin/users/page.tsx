"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RequireAuth } from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  APPROVAL_STATUSES,
  ApprovalStatus,
  USER_ROLES,
  UserProfile,
  UserRole,
  supabase,
} from '@/lib/supabase';
import { useAuth } from '@/lib/auth-provider';
import {
  Building2,
  Check,
  Clock3,
  Landmark,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminUsersPage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'all'>('all');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(`Failed to load users: ${error.message}`);
    } else {
      setUsers((data as UserProfile[]) ?? []);
    }
    setLoading(false);
  }, []);

  const counts = useMemo(
    () => ({
      total: users.length,
      pending: users.filter((account) => account.approval_status === 'pending').length,
      approved: users.filter((account) => account.approval_status === 'approved').length,
      rejected: users.filter((account) => account.approval_status === 'rejected').length,
    }),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return users
      .filter((account) => {
        const matchesStatus =
          statusFilter === 'all' || account.approval_status === statusFilter;
        const matchesSearch =
          !query ||
          [account.full_name, account.email, account.role, account.approval_status]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(query));

        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        const statusPriority: Record<ApprovalStatus, number> = {
          pending: 0,
          approved: 1,
          rejected: 2,
        };
        const statusDiff = statusPriority[a.approval_status] - statusPriority[b.approval_status];

        if (statusDiff !== 0) return statusDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [searchTerm, statusFilter, users]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function updateUser(
    target: UserProfile,
    changes: Partial<Pick<UserProfile, 'role' | 'approval_status'>>
  ) {
    if (!user) return;
    if (target.id === user.id && changes.approval_status && changes.approval_status !== 'approved') {
      toast.error('You cannot remove approval from your own admin account');
      return;
    }

    const nextStatus = changes.approval_status ?? target.approval_status;
    const payload = {
      role: changes.role ?? target.role,
      approval_status: nextStatus,
      approved_by: nextStatus === 'pending' ? null : user.id,
      approved_at: nextStatus === 'pending' ? null : new Date().toISOString(),
    };

    setSavingId(target.id);
    const { error } = await supabase
      .from('user_profiles')
      .update(payload)
      .eq('id', target.id);
    setSavingId(null);

    if (error) {
      toast.error(`Failed to update user: ${error.message}`);
      return;
    }

    toast.success('User access updated');
    await fetchUsers();
    if (target.id === user.id) {
      await refreshProfile();
    }
  }

  return (
    <RequireAuth allowedRoles={['admin']}>
      <div className="min-h-screen bg-background">
        <aside className="fixed left-0 top-0 z-40 flex h-screen w-[260px] flex-col border-r border-border bg-white">
          <div className="flex h-[72px] items-center gap-3 border-b border-border px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-primary text-white">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-semibold tracking-tight text-primary">EduFinance</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Admin Portal
              </div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-5">
            <Link
              href="/"
              className="flex h-11 items-center gap-3 rounded px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-primary"
            >
              <Building2 className="h-4 w-4" />
              All Schools
            </Link>
            <Link
              href="/admin/users"
              className="relative flex h-11 items-center gap-3 rounded bg-[hsl(var(--sidebar-accent))] px-4 text-sm font-medium text-[hsl(var(--sidebar-accent-foreground))] before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:bg-primary"
            >
              <ShieldCheck className="h-4 w-4" />
              User Approvals
            </Link>
          </nav>
          <div className="border-t border-border p-4">
            <button
              onClick={signOut}
              className="flex h-9 w-full items-center gap-3 rounded px-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        <main className="ml-[260px]">
          <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-border bg-white px-6">
            <div>
              <h1 className="text-lg font-semibold">User Approvals</h1>
              <p className="text-xs text-muted-foreground">Approve signup requests and assign portal roles.</p>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{profile?.email}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                {(profile?.full_name || profile?.email || 'A').slice(0, 2).toUpperCase()}
              </div>
            </div>
          </header>

          <div className="app-container space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <SummaryCard
                label="Total users"
                value={counts.total}
                description="All portal accounts"
                icon={Users}
              />
              <SummaryCard
                label="Pending"
                value={counts.pending}
                description="Need review"
                icon={Clock3}
                tone="amber"
              />
              <SummaryCard
                label="Approved"
                value={counts.approved}
                description="Can access the portal"
                icon={UserCheck}
                tone="emerald"
              />
              <SummaryCard
                label="Rejected"
                value={counts.rejected}
                description="Access blocked"
                icon={UserX}
                tone="red"
              />
            </div>

            <Card className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Access Review Queue</h2>
                  <p className="text-xs text-muted-foreground">
                    Pending requests are shown first so approvals can be handled quickly.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative sm:w-[280px]">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search name, email, role..."
                      className="h-8 bg-slate-50 pl-8 text-sm"
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) =>
                      setStatusFilter(value as ApprovalStatus | 'all')
                    }
                  >
                    <SelectTrigger className="h-8 sm:w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {APPROVAL_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {formatStatus(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    disabled={loading}
                    onClick={fetchUsers}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Requested</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={5} className="h-32 text-center text-muted-foreground">
                          Loading users...
                        </td>
                      </tr>
                    )}
                    {!loading && users.length === 0 && (
                      <tr>
                        <td colSpan={5} className="h-40 text-center">
                          <EmptyState
                            title="No users yet"
                            description="New signup requests will appear here for review."
                          />
                        </td>
                      </tr>
                    )}
                    {!loading && users.length > 0 && filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="h-40 text-center">
                          <EmptyState
                            title="No matching users"
                            description="Try changing the search text or status filter."
                          />
                        </td>
                      </tr>
                    )}
                    {filteredUsers.map((account) => {
                      const isSaving = savingId === account.id;
                      const isCurrentUser = account.id === user?.id;

                      return (
                        <tr key={account.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                                {getInitials(account)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {account.full_name || 'No name provided'}
                                  </span>
                                  {isCurrentUser && (
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                      You
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {account.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <Select
                              value={account.role}
                              disabled={isSaving}
                              onValueChange={(value) =>
                                updateUser(account, { role: value as UserRole })
                              }
                            >
                              <SelectTrigger className="h-8 w-[120px] text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {USER_ROLES.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {formatRole(role)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={account.approval_status} />
                              <Select
                                value={account.approval_status}
                                disabled={isSaving}
                                onValueChange={(value) =>
                                  updateUser(account, {
                                    approval_status: value as ApprovalStatus,
                                  })
                                }
                              >
                                <SelectTrigger className="h-8 w-[132px] text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {APPROVAL_STATUSES.map((status) => (
                                    <SelectItem key={status} value={status}>
                                      {formatStatus(status)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </td>
                          <td className="whitespace-nowrap text-muted-foreground">
                            <div>{formatDate(account.created_at)}</div>
                            {account.approved_at && (
                              <div className="text-[11px]">
                                Updated {formatDate(account.approved_at)}
                              </div>
                            )}
                          </td>
                          <td className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant={account.approval_status === 'approved' ? 'secondary' : 'outline'}
                                className="h-8 gap-1"
                                disabled={isSaving || account.approval_status === 'approved'}
                                onClick={() =>
                                  updateUser(account, { approval_status: 'approved' })
                                }
                              >
                                <Check className="h-3.5 w-3.5" />
                                {account.approval_status === 'approved' ? 'Approved' : 'Approve'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 text-destructive hover:text-destructive"
                                disabled={
                                  isSaving ||
                                  isCurrentUser ||
                                  account.approval_status === 'rejected'
                                }
                                onClick={() =>
                                  updateUser(account, { approval_status: 'rejected' })
                                }
                              >
                                <X className="h-3.5 w-3.5" />
                                {account.approval_status === 'rejected' ? 'Rejected' : 'Reject'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!loading && users.length > 0 && (
                <div className="flex items-center justify-between border-t bg-slate-50 px-4 py-3 text-xs text-muted-foreground">
                  <span>
                    Showing {filteredUsers.length} of {users.length} users
                  </span>
                  {counts.pending > 0 ? (
                    <span>{counts.pending} pending review</span>
                  ) : (
                    <span>All requests reviewed</span>
                  )}
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>
    </RequireAuth>
  );
}

function SummaryCard({
  label,
  value,
  description,
  icon: Icon,
  tone = 'slate',
}: {
  label: string;
  value: number;
  description: string;
  icon: typeof Users;
  tone?: 'slate' | 'amber' | 'emerald' | 'red';
}) {
  const toneClass =
    tone === 'amber'
      ? 'bg-amber-100 text-amber-700'
      : tone === 'emerald'
        ? 'bg-emerald-100 text-emerald-700'
        : tone === 'red'
          ? 'bg-red-100 text-red-700'
          : 'bg-slate-100 text-slate-700';

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const className =
    status === 'approved'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'rejected'
        ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-700';

  return (
    <Badge variant="secondary" className={`h-5 rounded-full px-2 text-[10px] ${className}`}>
      {formatStatus(status)}
    </Badge>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-sm px-6 py-8">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <ShieldCheck className="h-4 w-4" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function getInitials(account: UserProfile) {
  return (account.full_name || account.email || 'U').slice(0, 2).toUpperCase();
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRole(role: UserRole) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatStatus(status: ApprovalStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
