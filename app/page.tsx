"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { RequireAuth } from '@/components/auth-guard';
import { SchoolModal } from '@/components/school-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
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
  Download,
  Printer,
} from 'lucide-react';
import { supabase, School, SchoolTransactionStats, formatCurrency } from '@/lib/supabase';
import { toast } from 'sonner';
import Link from 'next/link';

type SchoolWithStats = School & {
  txn_count: number;
  total_amount: number;
};

export default function SchoolsPage() {
  const { signOut } = useAuth();
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<School | null>(null);
  const [search, setSearch] = useState('');

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
      .filter((s) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.division || '').toLowerCase().includes(q) ||
          (s.region || '').toLowerCase().includes(q)
        );
      })
      .map((s) => ({
        ...s,
        txn_count: statsMap[s.id]?.count || 0,
        total_amount: statsMap[s.id]?.total || 0,
      }));

    setSchools(enriched);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  function handleAdd() {
    setEditingSchool(null);
    setModalOpen(true);
  }

  function handleEdit(school: School) {
    setEditingSchool(school);
    setModalOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
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
              <div className="text-xl font-semibold tracking-tight text-primary">EduFinance</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Admin Portal
              </div>
            </div>
          </div>
          <div className="px-4 py-5">
            <Button onClick={handleAdd} className="h-10 w-full gap-2">
              <Plus className="h-4 w-4" />
              Add School
            </Button>
          </div>
          <nav className="flex-1 space-y-1 px-3">
            <Link className="relative flex h-11 items-center gap-3 rounded bg-[hsl(var(--sidebar-accent))] px-4 text-sm font-medium text-[hsl(var(--sidebar-accent-foreground))] before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:bg-primary" href="/">
              <Building2 className="h-4 w-4" />
              Select School
            </Link>
            <div className="px-4 pt-3 text-xs leading-5 text-muted-foreground">
              Open a school to access its dashboard, transactions, UACS codes, and reports.
            </div>
          </nav>
          <div className="space-y-1 border-t border-border p-4">
            <Link href="#" className="flex h-9 items-center gap-3 rounded px-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary">
              <HelpCircle className="h-4 w-4" />
              Support
            </Link>
            <button onClick={signOut} className="flex h-9 w-full items-center gap-3 rounded px-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary">
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        <main className="ml-[260px]">
          <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-border bg-white px-6">
            <div className="relative w-full max-w-[520px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search across portal..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-5 text-sm">
              <span className="hidden text-muted-foreground md:inline">
                Select a school to continue
              </span>
              <Bell className="h-4 w-4 text-slate-700" />
              <HelpCircle className="h-4 w-4 text-slate-700" />
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">AD</div>
            </div>
          </header>

          <div className="app-container">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Schools Directory</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage institutional profiles, view transaction history, and update contact information.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                <Button onClick={handleAdd} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add School
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b p-4">
                <div className="relative w-full max-w-[280px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Filter by name or ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <Download className="h-4 w-4" />
                  <Printer className="h-4 w-4" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-10"><span className="block h-4 w-4 rounded-sm border bg-white" /></th>
                      <th>School Name</th>
                      <th>School ID</th>
                      <th>Division / Region</th>
                      <th className="text-right">Txns</th>
                      <th className="text-right">Total Disbursed</th>
                      <th>Last Updated</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={8} className="h-24 text-center text-muted-foreground">Loading schools...</td>
                      </tr>
                    )}
                    {!loading && schools.length === 0 && (
                      <tr>
                        <td colSpan={8} className="h-24 text-center text-muted-foreground">
                          No schools yet. Click &quot;Add School&quot; to get started.
                        </td>
                      </tr>
                    )}
                    {schools.map((s) => (
                      <tr key={s.id}>
                        <td><span className="block h-4 w-4 rounded-sm border bg-white" /></td>
                        <td>
                          <Link href={`/school/${s.id}`} className="font-medium text-primary hover:underline">
                            {s.name}
                          </Link>
                        </td>
                        <td className="font-mono">{s.code}</td>
                        <td className="max-w-[320px] truncate text-muted-foreground">
                          {[s.division, s.region].filter(Boolean).join(', ') || 'Not specified'}
                        </td>
                        <td className="number-cell font-medium">{s.txn_count.toLocaleString()}</td>
                        <td className="number-cell font-medium">{formatCurrency(s.total_amount)}</td>
                        <td className="text-muted-foreground">
                          {s.updated_at ? new Date(s.updated_at).toLocaleString() : 'Recently'}
                        </td>
                        <td className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(s)}>
                                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(s)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex h-12 items-center justify-between border-t px-4 text-xs text-muted-foreground">
                <span>Showing 1 to {schools.length} of {schools.length} entries</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled>Previous</Button>
                  <Button size="sm" className="h-8 w-8 p-0">1</Button>
                  <Button variant="outline" size="sm" disabled>Next</Button>
                </div>
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
