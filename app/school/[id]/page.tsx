"use client";

import { useEffect, useState } from 'react';
import { RequireAuth } from '@/components/auth-guard';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  supabase,
  School,
  Transaction,
  formatCurrency,
  formatDate,
  getQuarter,
  getQuarterLabel,
  parseLocalDate,
  getYearDateRange,
} from '@/lib/supabase';
import {
  DollarSign,
  TrendingDown,
  Calendar,
  ArrowRight,
  Receipt,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export default function SchoolDashboard() {
  const params = useParams();
  const schoolId = params.id as string;
  const [school, setSchool] = useState<School | null>(null);
  const [yearTransactions, setYearTransactions] = useState<Transaction[]>([]);
  const [currentYearTransactions, setCurrentYearTransactions] = useState<Transaction[]>([]);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [allTimeTotal, setAllTimeTotal] = useState(0);
  const [allTimeCount, setAllTimeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentQuarter = getQuarter(now);
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter);
  const currentYear = now.getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  useEffect(() => {
    async function load() {
      const { startDate, endDate } = getYearDateRange(selectedYear);
      const currentYearRange = getYearDateRange(currentYear);

      const [schoolRes, totalsRes, yearTxnRes, currentYearTxnRes, recentRes] = await Promise.all([
        supabase.from('schools').select('*').eq('id', schoolId).single(),
        supabase.rpc('get_school_transaction_totals', { p_school_id: schoolId }),
        supabase
          .from('transactions')
          .select('*')
          .eq('school_id', schoolId)
          .gte('date', startDate)
          .lt('date', endDate)
          .order('date', { ascending: false }),
        supabase
          .from('transactions')
          .select('*')
          .eq('school_id', schoolId)
          .gte('date', currentYearRange.startDate)
          .lt('date', currentYearRange.endDate)
          .order('date', { ascending: false }),
        supabase
          .from('transactions')
          .select('*')
          .eq('school_id', schoolId)
          .order('date', { ascending: false })
          .limit(8),
      ]);

      if (schoolRes.data) setSchool(schoolRes.data as School);

      const totals = totalsRes.data?.[0] as
        | { total_amount: number; txn_count: number }
        | undefined;
      if (totals) {
        setAllTimeTotal(Number(totals.total_amount));
        setAllTimeCount(Number(totals.txn_count));
      }

      if (yearTxnRes.data) setYearTransactions(yearTxnRes.data as Transaction[]);
      if (currentYearTxnRes.data) {
        setCurrentYearTransactions(currentYearTxnRes.data as Transaction[]);
      }
      if (recentRes.data) setRecentTxns(recentRes.data as Transaction[]);
      setLoading(false);
    }
    load();
  }, [schoolId, currentYear, selectedYear]);

  useEffect(() => {
    if (selectedYear === currentYear && selectedQuarter > currentQuarter) {
      setSelectedQuarter(currentQuarter);
    }
  }, [currentQuarter, currentYear, selectedQuarter, selectedYear]);

  const currentMonthTxns = currentYearTransactions.filter((t) => {
    const d = parseLocalDate(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === currentYear;
  });

  const currentQuarterTxns = currentYearTransactions.filter((t) => {
    const d = parseLocalDate(t.date);
    return getQuarter(d) === currentQuarter && d.getFullYear() === currentYear;
  });

  const totalThisMonth = currentMonthTxns.reduce((s, t) => s + Number(t.amount), 0);
  const totalThisQuarter = currentQuarterTxns.reduce((s, t) => s + Number(t.amount), 0);

  // Quarterly breakdown for the selected year. Future quarters in the current year are disabled.
  const quarterlyBreakdown = [1, 2, 3, 4].map((q) => {
    const qTxns = yearTransactions.filter((t) => {
      const d = parseLocalDate(t.date);
      return getQuarter(d) === q && d.getFullYear() === selectedYear;
    });
    return {
      quarter: `Q${q}`,
      total: qTxns.reduce((s, t) => s + Number(t.amount), 0),
      count: qTxns.length,
    };
  });

  const selectedQuarterTxns = yearTransactions.filter((t) => {
    const d = parseLocalDate(t.date);
    return getQuarter(d) === selectedQuarter && d.getFullYear() === selectedYear;
  });

  function isFutureQuarter(year: number, quarter: number) {
    return year > currentYear || (year === currentYear && quarter > currentQuarter);
  }

  function goToYear(year: number) {
    setSelectedYear(year);
    if (year === currentYear && selectedQuarter > currentQuarter) {
      setSelectedQuarter(currentQuarter);
    }
  }

  // Category breakdown for selected quarter
  const categoryMap: Record<string, number> = {};
  selectedQuarterTxns.forEach((t) => {
    categoryMap[t.category] = (categoryMap[t.category] || 0) + Number(t.amount);
  });
  const categoryData = Object.entries(categoryMap)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  const CHART_COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  const recentTxnsList = recentTxns;

  return (
    <RequireAuth allowedRoles={['admin', 'officer']}>
      <AppShell school={school} schoolId={schoolId}>
        <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard Overview</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              System-wide cash disbursement metrics and recent activity for {school?.name || 'this school'}.
            </p>
          </div>
          <Badge
            variant="secondary"
            className="bg-[hsl(var(--primary))] text-white text-xs px-3 py-1"
          >
            <Calendar className="mr-1.5 h-3 w-3" />
            {getQuarterLabel(currentQuarter, currentYear)}
          </Badge>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b-0 pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                This Month
              </CardTitle>
              <DollarSign className="h-4 w-4 text-[hsl(var(--primary))]" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold tabular-nums">
                {formatCurrency(totalThisMonth)}
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                {currentMonthTxns.length} transaction{currentMonthTxns.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b-0 pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                This Quarter
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-[hsl(var(--primary))]" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold tabular-nums">
                {formatCurrency(totalThisQuarter)}
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                {currentQuarterTxns.length} transaction{currentQuarterTxns.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b-0 pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                Total Disbursements
              </CardTitle>
              <Receipt className="h-4 w-4 text-[hsl(var(--primary))]" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold tabular-nums">
                {formatCurrency(allTimeTotal)}
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                {allTimeCount} total transaction{allTimeCount !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quarterly Breakdown + Category Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Quarterly Breakdown */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between px-4 py-4">
              <CardTitle className="text-sm font-semibold">
                Quarterly Disbursement Trend
              </CardTitle>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToYear(selectedYear - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded border bg-white text-foreground hover:bg-accent hover:text-primary"
                  aria-label="Previous year"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[4rem] text-center text-xs font-semibold text-muted-foreground">
                  {selectedYear}
                </span>
                <button
                  type="button"
                  onClick={() => goToYear(selectedYear + 1)}
                  disabled={selectedYear >= currentYear}
                  className="flex h-7 w-7 items-center justify-center rounded border bg-white text-foreground hover:bg-accent hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next year"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {quarterlyBreakdown.map((q, i) => {
                  const quarter = i + 1;
                  const disabled = isFutureQuarter(selectedYear, quarter);

                  return (
                    <button
                      type="button"
                      key={q.quarter}
                      onClick={() => setSelectedQuarter(quarter)}
                      disabled={disabled}
                      className={`flex w-full items-center justify-between rounded border py-2 px-3 text-left transition-colors ${
                        selectedQuarter === quarter
                          ? 'border-primary bg-primary text-white'
                          : 'border-border bg-white hover:border-primary/40 hover:bg-accent disabled:bg-muted disabled:text-muted-foreground'
                      }`}
                      aria-pressed={selectedQuarter === quarter}
                    >
                      <div>
                        <span className="text-sm font-medium">{q.quarter}</span>
                        <span className="text-xs ml-2 opacity-70">
                          {disabled
                            ? 'Not available yet'
                            : `${q.count} txn${q.count !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {disabled ? '--' : formatCurrency(q.total)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Category Breakdown Chart */}
          <Card className="lg:col-span-3">
            <CardHeader className="px-4 py-4">
              <CardTitle className="text-sm font-semibold">
                Expense by Category
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Q{selectedQuarter} {selectedYear} distribution
              </p>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={categoryData}
                    layout="vertical"
                    margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      type="number"
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                      fontSize={11}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      fontSize={11}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 6,
                        border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--card))',
                      }}
                    />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {categoryData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-60 text-sm text-[hsl(var(--muted-foreground))]">
                  No data for Q{selectedQuarter} {selectedYear}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
            <Link
              href={`/school/${schoolId}/transactions`}
              className="text-xs text-[hsl(var(--primary))] hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Payee</th>
                    <th>Particulars</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
              {recentTxnsList.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="h-24 text-center text-muted-foreground">
                    No transactions recorded yet.
                  </td>
                </tr>
              )}
              {recentTxnsList.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="font-medium">{t.payee}</td>
                  <td className="max-w-[420px] truncate text-muted-foreground">
                    {t.particulars || t.dv_number}
                  </td>
                  <td className="number-cell font-medium">{formatCurrency(Number(t.amount))}</td>
                </tr>
              ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      </AppShell>
    </RequireAuth>
  );
}
