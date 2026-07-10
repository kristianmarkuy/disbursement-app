"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { RequireAuth } from '@/components/auth-guard';
import { AppShell } from '@/components/app-shell';
import { TransactionModal } from '@/components/transaction-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react';
import {
  supabase,
  School,
  Transaction,
  formatCurrency,
  formatDate,
  getQuarterDateRange,
  getYearDateRange,
  sanitizeSearchTerm,
  CATEGORIES,
  FUND_SOURCES,
} from '@/lib/supabase';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

export default function SchoolTransactionsPage() {
  const params = useParams();
  const schoolId = params.id as string;
  const { canManageTransactions, canDeleteTransactions } = useAuth();

  const [school, setSchool] = useState<School | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [fundSourceFilter, setFundSourceFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Quarter tab
  const now = new Date();
  const currentYear = now.getFullYear();
  const [yearFilter, setYearFilter] = useState<string>(String(currentYear));
  const [quarterTab, setQuarterTab] = useState<string>('all');

  const hasActiveFilters =
    categoryFilter !== 'all' || fundSourceFilter !== 'all' || dateFrom || dateTo;

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    // Quarter filter
    if (quarterTab !== 'all' && yearFilter) {
      const q = parseInt(quarterTab);
      const y = parseInt(yearFilter);
      const { startDate, endDate } = getQuarterDateRange(q, y);
      query = query.gte('date', startDate).lt('date', endDate);
    } else if (yearFilter) {
      const y = parseInt(yearFilter);
      const { startDate, endDate } = getYearDateRange(y);
      query = query.gte('date', startDate).lt('date', endDate);
    }

    const sanitizedSearch = sanitizeSearchTerm(debouncedSearch);
    if (sanitizedSearch) {
      const term = `%${sanitizedSearch}%`;
      query = query.or(
        `payee.ilike.${term},dv_number.ilike.${term},uacs_code.ilike.${term}`
      );
    }
    if (categoryFilter !== 'all') {
      query = query.eq('category', categoryFilter);
    }
    if (fundSourceFilter !== 'all') {
      query = query.eq('fund_source', fundSourceFilter);
    }
    if (dateFrom) {
      query = query.gte('date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('date', dateTo);
    }

    query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, count } = await query;
    if (data) setTransactions(data as Transaction[]);
    if (count !== null) setTotalCount(count);
    setLoading(false);
  }, [schoolId, debouncedSearch, categoryFilter, fundSourceFilter, dateFrom, dateTo, page, quarterTab, yearFilter]);

  useEffect(() => {
    supabase.from('schools').select('*').eq('id', schoolId).single().then((res) => {
      if (res.data) setSchool(res.data as School);
    });
  }, [schoolId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  function handleAdd() {
    if (!canManageTransactions) {
      toast.error('Your role cannot manage transactions');
      return;
    }
    setEditingTxn(null);
    setModalOpen(true);
  }

  function handleEdit(txn: Transaction) {
    if (!canManageTransactions) {
      toast.error('Your role cannot manage transactions');
      return;
    }
    setEditingTxn(txn);
    setModalOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (!canDeleteTransactions) {
      toast.error('Only admins can delete transactions');
      setDeleteTarget(null);
      return;
    }
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', deleteTarget.id);
    if (error) {
      toast.error(`Delete failed: ${error.message}`);
    } else {
      toast.success('Transaction deleted');
      fetchTransactions();
    }
    setDeleteTarget(null);
  }

  function clearFilters() {
    setCategoryFilter('all');
    setFundSourceFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(0);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const pageTotal = transactions.reduce((s, t) => s + Number(t.amount), 0);

  return (
    <RequireAuth allowedRoles={['admin', 'officer']}>
      <AppShell school={school} schoolId={schoolId}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Transactions</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Cash Disbursement Register
            </p>
          </div>
          {canManageTransactions && (
            <Button onClick={handleAdd} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Transaction
            </Button>
          )}
        </div>

        {/* Quarter Tabs + Year */}
        <div className="flex items-center gap-3">
          <Tabs
            value={quarterTab}
            onValueChange={(v) => {
              setQuarterTab(v);
              setPage(0);
            }}
          >
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-3">All</TabsTrigger>
              <TabsTrigger value="1" className="text-xs px-3">Q1</TabsTrigger>
              <TabsTrigger value="2" className="text-xs px-3">Q2</TabsTrigger>
              <TabsTrigger value="3" className="text-xs px-3">Q3</TabsTrigger>
              <TabsTrigger value="4" className="text-xs px-3">Q4</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select
            value={yearFilter}
            onValueChange={(v) => {
              setYearFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-8 w-[90px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {quarterTab !== 'all' && (
            <Badge variant="secondary" className="text-xs bg-[hsl(var(--primary))] text-white">
              Q{quarterTab} {yearFilter}: Jan–{quarterTab === '1' ? 'Mar' : quarterTab === '2' ? 'Jun' : quarterTab === '3' ? 'Sep' : 'Dec'}
            </Badge>
          )}
        </div>

        {/* Filters Bar */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-[320px]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
              <Input
                placeholder="Search payee, DV number, UACS..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="h-8 pl-8 text-sm"
              />
            </div>

            <Select
              value={categoryFilter}
              onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}
            >
              <SelectTrigger className="h-8 w-[150px] text-sm">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={fundSourceFilter}
              onValueChange={(v) => { setFundSourceFilter(v); setPage(0); }}
            >
              <SelectTrigger className="h-8 w-[140px] text-sm">
                <SelectValue placeholder="Fund Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Funds</SelectItem>
                {FUND_SOURCES.map((fs) => (
                  <SelectItem key={fs} value={fs}>{fs}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
              className="h-8 w-[130px] text-sm"
              placeholder="From"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
              className="h-8 w-[130px] text-sm"
              placeholder="To"
            />

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1 text-xs">
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
          </div>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>DV Number</th>
                  <th>Check Number</th>
                  <th>Payee</th>
                  <th>Particulars</th>
                  <th className="text-right">Amount</th>
                  <th>Fund Source</th>
                  <th>UACS</th>
                  <th>Category</th>
                  <th className="w-12 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-[hsl(var(--muted-foreground))]">
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading && transactions.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-[hsl(var(--muted-foreground))]">
                      No transactions found. Click &quot;Add Transaction&quot; to begin.
                    </td>
                  </tr>
                )}
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="whitespace-nowrap font-mono">{t.dv_number}</td>
                    <td className="whitespace-nowrap font-mono">{t.check_number || '\u2014'}</td>
                    <td className="max-w-[180px] truncate font-medium">{t.payee}</td>
                    <td className="max-w-[240px] truncate text-[hsl(var(--muted-foreground))]">
                      {t.particulars || '\u2014'}
                    </td>
                    <td className="whitespace-nowrap number-cell font-medium">
                      {formatCurrency(Number(t.amount))}
                    </td>
                    <td className="whitespace-nowrap">{t.fund_source}</td>
                    <td className="whitespace-nowrap font-mono">{t.uacs_code || '\u2014'}</td>
                    <td className="whitespace-nowrap">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        {t.category}
                      </Badge>
                    </td>
                    <td className="text-center">
                      {canManageTransactions || canDeleteTransactions ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canManageTransactions && (
                              <DropdownMenuItem onClick={() => handleEdit(t)}>
                                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                              </DropdownMenuItem>
                            )}
                            {canDeleteTransactions && (
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(t)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              {transactions.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 bg-[hsl(var(--muted))] font-medium">
                    <td colSpan={5} className="py-2 px-3 text-xs">Page Total</td>
                    <td className="py-2 px-3 number-cell text-xs font-semibold">
                      {formatCurrency(pageTotal)}
                    </td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Showing {transactions.length} of {totalCount} entries
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-[hsl(var(--muted-foreground))] px-2">
              Page {page + 1} of {Math.max(1, totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        schoolId={schoolId}
        transaction={editingTxn}
        onSaved={fetchTransactions}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete DV {deleteTarget?.dv_number} for{' '}
              {deleteTarget?.payee}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </AppShell>
    </RequireAuth>
  );
}
