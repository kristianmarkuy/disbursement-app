"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { RequireAuth } from '@/components/auth-guard';
import { SchoolModal } from '@/components/school-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Building2,
  LogOut,
  Landmark,
  HelpCircle,
  Bell,
  Users,
  ArrowRight,
  BarChart3,
  WalletCards,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase, School, SchoolTransactionStats, formatCurrency } from '@/lib/supabase';
import { toast } from 'sonner';
import Link from 'next/link';

type SchoolWithStats = School & {
  txn_count: number;
  total_amount: number;
};

export default function SchoolsPage() {
  const {
    signOut,
    profile,
    canManageSchools,
    canDeleteSchools,
    canManageUsers,
  } = useAuth();
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<School | null>(null);
  const [search, setSearch] = useState('');
  const [loadingSampleData, setLoadingSampleData] = useState(false);

  const fetchSchools = useCallback(async () => {
    setLoading(true);

    const [schoolRes, statsRes] = await Promise.all([
      supabase.from('schools').select('*').order('name'),
      supabase.rpc('get_school_transaction_stats'),
    ]);

    if (schoolRes.error) {
      toast.error(`Failed to load schools: ${schoolRes.error.message}`);
      setLoading(false);
      return;
    }

    const schoolData = schoolRes.data as School[] | null;
    if (!schoolData) {
      setLoading(false);
      return;
    }

    const statsMap: Record<string, { count: number; total: number }> = {};
    if (statsRes.data) {
      (statsRes.data as SchoolTransactionStats[]).forEach((row) => {
        statsMap[row.school_id] = {
          count: Number(row.txn_count),
          total: Number(row.total_amount),
        };
      });
    }

    const enriched: SchoolWithStats[] = schoolData
      .map((s) => ({
        ...s,
        txn_count: statsMap[s.id]?.count || 0,
        total_amount: statsMap[s.id]?.total || 0,
      }));

    setSchools(enriched);
    setLoading(false);
  }, []);

  const filteredSchools = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return schools;

    return schools.filter((school) =>
      [
        school.name,
        school.code,
        school.division,
        school.region,
        school.address,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    );
  }, [schools, search]);

  const directoryStats = useMemo(
    () => ({
      schools: schools.length,
      transactions: schools.reduce((total, school) => total + school.txn_count, 0),
      disbursed: schools.reduce((total, school) => total + school.total_amount, 0),
    }),
    [schools]
  );

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  function handleAdd() {
    if (!canManageSchools) {
      toast.error('Your role cannot manage schools');
      return;
    }
    setEditingSchool(null);
    setModalOpen(true);
  }

  function handleEdit(school: School) {
    if (!canManageSchools) {
      toast.error('Your role cannot manage schools');
      return;
    }
    setEditingSchool(school);
    setModalOpen(true);
  }

  async function handleLoadSampleData() {
    if (!canManageSchools) {
      toast.error('Your role cannot create sample data');
      return;
    }

    setLoadingSampleData(true);

    const sampleSchoolCode = 'CBTN-SAMPLE';
    const { data: existingSchool, error: existingSchoolError } = await supabase
      .from('schools')
      .select('*')
      .eq('code', sampleSchoolCode)
      .maybeSingle();

    if (existingSchoolError) {
      toast.error(`Failed to check sample school: ${existingSchoolError.message}`);
      setLoadingSampleData(false);
      return;
    }

    let sampleSchool = existingSchool as School | null;

    if (!sampleSchool) {
      const { data: insertedSchool, error: schoolError } = await supabase
        .from('schools')
        .insert({
          name: 'Cabatuan Elementary School',
          code: sampleSchoolCode,
          address: 'Cabatuan City',
          division: 'Schools Division of Cabayog City / Quezon District',
          region: 'Region VIII',
        })
        .select('*')
        .single();

      if (schoolError) {
        toast.error(`Failed to create sample school: ${schoolError.message}`);
        setLoadingSampleData(false);
        return;
      }

      sampleSchool = insertedSchool as School;
    }

    const { count, error: countError } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', sampleSchool.id)
      .gte('date', '2026-01-01')
      .lt('date', '2026-04-01');

    if (countError) {
      toast.error(`Failed to check sample transactions: ${countError.message}`);
      setLoadingSampleData(false);
      return;
    }

    if ((count ?? 0) > 0) {
      toast.info('Sample Q1 2026 data already exists');
      await fetchSchools();
      setLoadingSampleData(false);
      return;
    }

    const sampleTransactions = [
      {
        date: '2026-01-05',
        dv_number: '1506991',
        check_number: '1506991',
        payee: 'Samara Electric Cooperative, Inc.',
        particulars: 'Electricity bill for January 2026',
        amount: 4319.26,
        fund_source: 'General Fund',
        uacs_code: '5020403000',
        category: 'Maintenance',
      },
      {
        date: '2026-01-20',
        dv_number: '1506992',
        check_number: '1506992',
        payee: 'Leah R. Vargas',
        particulars: 'Salary of utility staff for January and February 2026',
        amount: 16000,
        fund_source: 'General Fund',
        uacs_code: '5020301000',
        category: 'Personal Services',
      },
      {
        date: '2026-01-25',
        dv_number: '1506993',
        check_number: '1506993',
        payee: 'Reneboy M. Gaviola',
        particulars: 'Internet bill for January 2026',
        amount: 2000,
        fund_source: 'General Fund',
        uacs_code: '5020403000',
        category: 'Maintenance',
      },
      {
        date: '2026-02-05',
        dv_number: '1506994',
        check_number: '1506994',
        payee: 'Bernard M. Mallari Jr.',
        particulars: 'Internet bill for February 2026',
        amount: 3000,
        fund_source: 'General Fund',
        uacs_code: '5020403000',
        category: 'Maintenance',
      },
      {
        date: '2026-02-10',
        dv_number: '1506995',
        check_number: '1506995',
        payee: 'Sonja M. Cuizon',
        particulars: 'Reimbursement of grasscutter supplies and materials',
        amount: 1000,
        fund_source: 'General Fund',
        uacs_code: '5020402000',
        category: 'Maintenance',
      },
      {
        date: '2026-02-15',
        dv_number: '1506996',
        check_number: '1506996',
        payee: 'Sonja M. Cuizon',
        particulars: 'Reimbursement for landline telephone expenses',
        amount: 700,
        fund_source: 'General Fund',
        uacs_code: '5020403000',
        category: 'Maintenance',
      },
      {
        date: '2026-02-20',
        dv_number: '1506997',
        check_number: '1506997',
        payee: 'CANCELLED',
        particulars: 'Cancelled check entry',
        amount: 0,
        fund_source: 'General Fund',
        uacs_code: null,
        category: 'Others',
      },
      {
        date: '2026-03-05',
        dv_number: '1507000',
        check_number: '1507000',
        payee: 'Uragon Everbuilt Trading',
        particulars: 'Hardware supplies',
        amount: 27465,
        fund_source: 'General Fund',
        uacs_code: '5020402000',
        category: 'Maintenance',
      },
      {
        date: '2026-03-09',
        dv_number: '1507001',
        check_number: '1507001',
        payee: 'Allworld Communications-Epson Ink & Sets',
        particulars: 'Office supplies and ink sets',
        amount: 9800,
        fund_source: 'General Fund',
        uacs_code: '5020402000',
        category: 'Maintenance',
      },
      {
        date: '2026-03-12',
        dv_number: '1507002',
        check_number: '1507002',
        payee: 'Sonja M. Cuizon',
        particulars: 'Payment of laborer repair home',
        amount: 14000,
        fund_source: 'General Fund',
        uacs_code: '5020405000',
        category: 'Maintenance',
      },
      {
        date: '2026-03-18',
        dv_number: '1507003',
        check_number: '1507003',
        payee: 'Sonja M. Cuizon',
        particulars: 'Load allowance for admin phone',
        amount: 2000,
        fund_source: 'General Fund',
        uacs_code: '5020403000',
        category: 'Maintenance',
      },
      {
        date: '2026-03-20',
        dv_number: '1507004',
        check_number: '1507004',
        payee: 'Rinal E. Comota',
        particulars: 'Travel expense',
        amount: 2550,
        fund_source: 'General Fund',
        uacs_code: '5020401000',
        category: 'Travel',
      },
      {
        date: '2026-03-27',
        dv_number: '1507005',
        check_number: '1507005',
        payee: 'Sonja M. Cuizon',
        particulars: 'Reimbursement of school supplies for school and office use',
        amount: 247,
        fund_source: 'General Fund',
        uacs_code: '5020402000',
        category: 'Maintenance',
      },
      {
        date: '2026-03-30',
        dv_number: '1507006',
        check_number: '1507006',
        payee: 'Carl Ralph E. Honrales',
        particulars: 'Installation of windows for Grade 1 to 3 rooms',
        amount: 5000,
        fund_source: 'General Fund',
        uacs_code: '5020405000',
        category: 'Maintenance',
      },
      {
        date: '2026-03-31',
        dv_number: '1507007',
        check_number: '1507007',
        payee: 'Sonja M. Cuizon',
        particulars: 'Reimbursement of ten load cards',
        amount: 690,
        fund_source: 'General Fund',
        uacs_code: '5020403000',
        category: 'Maintenance',
      },
    ].map((transaction) => ({
      ...transaction,
      school_id: sampleSchool!.id,
    }));

    const { error: transactionError } = await supabase
      .from('transactions')
      .insert(sampleTransactions);

    if (transactionError) {
      toast.error(`Failed to create sample transactions: ${transactionError.message}`);
      setLoadingSampleData(false);
      return;
    }

    toast.success('Sample Q1 2026 data created');
    await fetchSchools();
    setLoadingSampleData(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (!canDeleteSchools) {
      toast.error('Only admins can delete schools');
      setDeleteTarget(null);
      return;
    }
    const { error } = await supabase
      .from('schools')
      .delete()
      .eq('id', deleteTarget.id);
    if (error) {
      toast.error(`Delete failed: ${error.message}`);
    } else {
      toast.success('School deleted');
      fetchSchools();
    }
    setDeleteTarget(null);
  }

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <aside className="fixed left-0 top-0 z-40 flex h-screen w-[260px] flex-col border-r border-border bg-white">
          <div className="flex h-[72px] items-center gap-3 border-b border-border px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-primary text-white">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-semibold tracking-tight text-primary">LedgerOne</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Admin Portal
              </div>
            </div>
          </div>
          <div className="px-4 py-5">
            {canManageSchools ? (
              <Button onClick={handleAdd} className="h-10 w-full gap-2">
                <Plus className="h-4 w-4" />
                Add School
              </Button>
            ) : (
              <div className="rounded border bg-muted p-3 text-xs leading-5 text-muted-foreground">
                Viewer access is limited to reports.
              </div>
            )}
          </div>
          <nav className="flex-1 space-y-1 px-3">
            <Link className="group relative flex h-11 items-center gap-3 rounded bg-[hsl(var(--sidebar-accent))] px-4 text-sm font-medium text-[hsl(var(--sidebar-accent-foreground))] before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:bg-primary" href="/">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground">
                <Building2 className="h-4 w-4" aria-hidden="true" />
              </span>
              Select School
            </Link>
            {canManageUsers && (
              <Link className="group flex h-11 items-center gap-3 rounded px-4 text-sm font-medium text-foreground hover:bg-muted hover:text-primary" href="/admin/users">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Users className="h-4 w-4" aria-hidden="true" />
                </span>
                User Approvals
              </Link>
            )}
            <div className="px-4 pt-3 text-xs leading-5 text-muted-foreground">
              {canManageSchools
                ? 'Open a school to access its dashboard, transactions, UACS codes, and reports.'
                : 'Choose a school to view its reports.'}
            </div>
          </nav>
          <div className="space-y-1 border-t border-border p-4">
            <Link href="#" className="group flex h-9 items-center gap-3 rounded px-3 text-sm text-foreground hover:bg-muted hover:text-primary">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <HelpCircle className="h-4 w-4" aria-hidden="true" />
              </span>
              Support
            </Link>
            <button onClick={signOut} className="group flex h-9 w-full items-center gap-3 rounded px-3 text-sm text-foreground hover:bg-muted hover:text-primary">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </span>
              Logout
            </button>
          </div>
        </aside>

        <main className="ml-[260px]">
          <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-border bg-white px-6">
            <div className="relative w-full max-w-[520px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search schools..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-5 text-sm">
              <span className="hidden text-muted-foreground md:inline">
                Select a school to continue
              </span>
              <Bell className="h-4 w-4 text-foreground" />
              <HelpCircle className="h-4 w-4 text-foreground" />
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
                {(profile?.full_name || profile?.email || 'U').slice(0, 2).toUpperCase()}
              </div>
            </div>
          </header>

          <div className="app-container space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <Badge variant="secondary" className="mb-3 rounded-full bg-accent px-3 py-1 text-primary">
                  Schools Directory
                </Badge>
                <h1 className="text-3xl font-semibold tracking-tight">Select a school workspace</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {canManageSchools
                    ? 'Manage school profiles, open transaction workspaces, and review disbursement activity from one place.'
                    : 'Choose a school to view the reports available to your account.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canManageSchools && (
                  <Button onClick={handleAdd} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add School
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <DirectoryMetric
                label="Schools"
                value={directoryStats.schools.toLocaleString()}
                description="Active records in your directory"
                icon={Building2}
              />
              <DirectoryMetric
                label="Transactions"
                value={directoryStats.transactions.toLocaleString()}
                description="Linked disbursement entries"
                icon={BarChart3}
              />
              <DirectoryMetric
                label="Total Disbursed"
                value={formatCurrency(directoryStats.disbursed)}
                description="Across all listed schools"
                icon={WalletCards}
              />
            </div>

            <Card className="overflow-hidden border-primary/10">
              <div className="flex flex-col gap-3 border-b bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-sm font-semibold">School Workspaces</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {loading
                      ? 'Loading directory records...'
                      : `Showing ${filteredSchools.length} of ${schools.length} schools`}
                  </p>
                </div>
                <div className="relative w-full lg:max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search school, ID, division, or region..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-10 bg-muted pl-10 focus:bg-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>School</th>
                      <th>School ID</th>
                      <th>Division / Region</th>
                      <th>Txns</th>
                      <th>Total Disbursed</th>
                      <th>Last Updated</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading &&
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index}>
                          <td colSpan={7} className="h-14">
                            <div className="h-4 w-full animate-pulse rounded bg-muted" />
                          </td>
                        </tr>
                      ))}
                    {!loading && schools.length === 0 && (
                      <DirectoryEmptyState
                        title="No schools have been added yet"
                        description={
                          canManageSchools
                            ? 'Create the first school workspace to start tracking disbursement records.'
                            : 'There are no school records available for your account yet.'
                        }
                        action={
                          canManageSchools ? (
                            <Button onClick={handleAdd} size="sm" className="mt-4 gap-2">
                              <Plus className="h-4 w-4" />
                              Add School
                            </Button>
                          ) : null
                        }
                      />
                    )}
                    {!loading && schools.length > 0 && filteredSchools.length === 0 && (
                      <DirectoryEmptyState
                        title="No schools match your search"
                        description="Try searching by school name, school ID, division, region, or address."
                        action={
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSearch('')}
                            className="mt-4"
                          >
                            Clear Search
                          </Button>
                        }
                      />
                    )}
                    {filteredSchools.map((school) => {
                      const schoolHref = canManageSchools
                        ? `/school/${school.id}`
                        : `/school/${school.id}/reports`;
                      const location = [school.division, school.region].filter(Boolean).join(', ');

                      return (
                        <tr key={school.id} className="group">
                          <td>
                            <Link href={schoolHref} className="flex items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                <Building2 className="h-4 w-4" aria-hidden="true" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-primary group-hover:underline">
                                  {school.name}
                                </span>
                                <span className="block truncate text-[11px] text-muted-foreground">
                                  {school.address || 'No address provided'}
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td>
                            <Badge variant="outline" className="rounded-full font-mono">
                              {school.code}
                            </Badge>
                          </td>
                          <td className="max-w-[320px] truncate text-muted-foreground">
                            {location || 'Not specified'}
                          </td>
                          <td className="font-medium tabular-nums">
                            {school.txn_count.toLocaleString()}
                          </td>
                          <td className="font-medium tabular-nums">
                            {formatCurrency(school.total_amount)}
                          </td>
                          <td className="text-muted-foreground">
                            {school.updated_at
                              ? new Date(school.updated_at).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'Recently'}
                          </td>
                          <td>
                            <div className="flex items-center gap-1">
                              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                                <Link href={schoolHref}>
                                  Open
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                              {(canManageSchools || canDeleteSchools) && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {canManageSchools && (
                                      <DropdownMenuItem onClick={() => handleEdit(school)}>
                                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                                      </DropdownMenuItem>
                                    )}
                                    {canDeleteSchools && (
                                      <DropdownMenuItem
                                        onClick={() => setDeleteTarget(school)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-2 border-t bg-muted/50 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {loading
                    ? 'Loading schools...'
                    : `Showing ${filteredSchools.length} of ${schools.length} schools`}
                </span>
                <span>
                  {search.trim() ? `Filtered by "${search.trim()}"` : 'Search filters apply instantly'}
                </span>
              </div>
            </Card>
          </div>
        </main>

      <SchoolModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        school={editingSchool}
        onSaved={fetchSchools}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete School</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deleteTarget?.name}&quot;? All transactions for this school will also be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </RequireAuth>
  );
}

function DirectoryMetric({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-accent text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
    </Card>
  );
}

function DirectoryEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={7} className="h-56 text-center">
        <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-8">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-accent text-primary">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          {action}
        </div>
      </td>
    </tr>
  );
}
