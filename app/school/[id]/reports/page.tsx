"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { RequireAuth } from '@/components/auth-guard';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { BarChart3, FileSpreadsheet, FileText, Layers, PieChart, Printer } from 'lucide-react';
import {
  supabase,
  School,
  Transaction,
  UacsCode,
  formatCurrency,
  formatDate,
  getQuarter,
  getQuarterLabel,
  getQuarterMonths,
  getQuarterDateRange,
  parseLocalDate,
} from '@/lib/supabase';
import { toast } from 'sonner';

type GroupedTransaction = {
  uacs_code: string;
  uacs_title: string;
  category: string;
  transactions: Transaction[];
  total: number;
};

export default function SchoolReportsPage() {
  const params = useParams();
  const schoolId = params.id as string;

  const [school, setSchool] = useState<School | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [quarterDates, setQuarterDates] = useState<string[]>([]);
  const [uacsCodes, setUacsCodes] = useState<UacsCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuarter, setSelectedQuarter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-Q${getQuarter(now)}`;
  });
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadMeta() {
      const [schoolRes, uacsRes, datesRes] = await Promise.all([
        supabase.from('schools').select('*').eq('id', schoolId).single(),
        supabase.from('uacs_codes').select('*').order('code'),
        supabase.from('transactions').select('date').eq('school_id', schoolId),
      ]);

      if (schoolRes.data) setSchool(schoolRes.data as School);
      if (uacsRes.data) setUacsCodes(uacsRes.data as UacsCode[]);
      if (datesRes.data) setQuarterDates(datesRes.data.map((row) => row.date));
    }
    loadMeta();
  }, [schoolId]);

  useEffect(() => {
    async function loadQuarterTransactions() {
      setLoading(true);
      const [selYear, selQ] = selectedQuarter.split('-');
      const year = parseInt(selYear);
      const quarter = parseInt(selQ.replace('Q', ''));
      const { startDate, endDate } = getQuarterDateRange(quarter, year);

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('school_id', schoolId)
        .gte('date', startDate)
        .lt('date', endDate)
        .order('date', { ascending: true });

      if (error) {
        toast.error(`Failed to load report: ${error.message}`);
      } else {
        setTransactions((data as Transaction[]) ?? []);
      }
      setLoading(false);
    }
    loadQuarterTransactions();
  }, [schoolId, selectedQuarter]);

  const quarterSet = new Set<string>();
  quarterDates.forEach((date) => {
    const d = parseLocalDate(date);
    quarterSet.add(`${d.getFullYear()}-Q${getQuarter(d)}`);
  });
  const now = new Date();
  quarterSet.add(`${now.getFullYear()}-Q${getQuarter(now)}`);
  const quarterOptions = Array.from(quarterSet).sort().reverse();

  const [selYear, selQ] = selectedQuarter.split('-');
  const year = parseInt(selYear);
  const quarter = parseInt(selQ.replace('Q', ''));

  const quarterTxns = transactions;

  const totalAmount = quarterTxns.reduce((s, t) => s + Number(t.amount), 0);

  // Group by UACS code
  const grouped: GroupedTransaction[] = [];
  const groupMap: Record<string, GroupedTransaction> = {};
  const uacsLookup: Record<string, string> = {};
  uacsCodes.forEach((u) => {
    uacsLookup[u.code] = u.title;
  });

  quarterTxns.forEach((t) => {
    const key = t.uacs_code || t.category;
    if (!groupMap[key]) {
      groupMap[key] = {
        uacs_code: t.uacs_code || '\u2014',
        uacs_title: t.uacs_code ? uacsLookup[t.uacs_code] || 'Unknown' : t.category,
        category: t.category,
        transactions: [],
        total: 0,
      };
      grouped.push(groupMap[key]);
    }
    groupMap[key].transactions.push(t);
    groupMap[key].total += Number(t.amount);
  });

  grouped.sort((a, b) => a.uacs_code.localeCompare(b.uacs_code));

  // Category summary
  const categorySummary: Record<string, number> = {};
  quarterTxns.forEach((t) => {
    categorySummary[t.category] = (categorySummary[t.category] || 0) + Number(t.amount);
  });
  const sortedCategories = Object.entries(categorySummary).sort((a, b) => b[1] - a[1]);

  // Fund source summary
  const fundSummary: Record<string, number> = {};
  quarterTxns.forEach((t) => {
    fundSummary[t.fund_source] = (fundSummary[t.fund_source] || 0) + Number(t.amount);
  });
  const sortedFunds = Object.entries(fundSummary).sort((a, b) => b[1] - a[1]);

  function exportToExcel() {
    const headers = [
      'Date',
      'DV Number',
      'Check Number',
      'Payee',
      'Particulars',
      'Amount',
      'Fund Source',
      'UACS Code',
      'Category',
    ];
    const rows = quarterTxns.map((t) => [
      t.date,
      t.dv_number,
      t.check_number || '',
      `"${t.payee}"`,
      `"${t.particulars || ''}"`,
      Number(t.amount).toFixed(2),
      t.fund_source,
      t.uacs_code || '',
      t.category,
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach((r) => {
      csv += r.join(',') + '\n';
    });
    csv += '\n,,,,"TOTAL",' + totalAmount.toFixed(2) + ',,,\n';

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `CDR_${school?.code || 'SCHOOL'}_${selectedQuarter}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Exported to CSV');
  }

  function exportToPDF() {
    window.print();
  }

  return (
    <RequireAuth>
      <AppShell school={school} schoolId={schoolId}>
      <div className="space-y-4">
        <div className="flex items-center justify-between no-print">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Reports & Exports</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Generate, preview, and download financial statements and summaries.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
              <SelectTrigger className="h-8 w-[160px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {quarterOptions.map((q) => (
                  <SelectItem key={q} value={q}>
                    {q.replace('-', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 no-print md:grid-cols-2 xl:grid-cols-4">
          {[
            { title: 'Quarterly Report', icon: PieChart, desc: 'Comprehensive breakdown of income and expenses for the selected quarter.' },
            { title: 'Annual Report', icon: BarChart3, desc: 'End-of-year financial summary, including balance sheet and YTD figures.' },
            { title: 'Category Summary', icon: Layers, desc: 'Aggregated totals by expense and revenue categories for budget tracking.' },
            { title: 'UACS Summary', icon: FileText, desc: 'Unified Account Code Structure compliance report for government auditing.' },
          ].map((report) => (
            <Card key={report.title}>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-blue-50 text-primary">
                    <report.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{report.title}</h2>
                    <p className="mt-2 text-sm leading-5 text-muted-foreground">{report.desc}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportToExcel} className="flex-1 gap-2">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Excel
                  </Button>
                  <Button size="sm" onClick={exportToPDF} className="flex-1 gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="quarterly" className="no-print">
          <TabsList className="h-8">
            <TabsTrigger value="quarterly" className="text-xs">
              Quarterly CDR
            </TabsTrigger>
            <TabsTrigger value="summary" className="text-xs">
              Summary
            </TabsTrigger>
          </TabsList>
          <TabsContent value="quarterly" className="mt-4">
            <div className="flex items-center gap-2 mb-4 no-print">
              <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export to Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPDF} className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Export to PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
            </div>

            <div ref={printRef}>
              <ReportHeader
                school={school}
                quarter={quarter}
                year={year}
              />

              {loading ? (
                <div className="py-12 text-center text-[hsl(var(--muted-foreground))]">
                  Loading...
                </div>
              ) : quarterTxns.length === 0 ? (
                <div className="py-12 text-center text-[hsl(var(--muted-foreground))]">
                  No transactions for {getQuarterLabel(quarter, year)}
                </div>
              ) : (
                <Card className="overflow-hidden">
                  {grouped.map((group, gi) => (
                    <div key={group.uacs_code + gi} className={gi > 0 ? 'mt-4' : ''}>
                      <div className="bg-[hsl(var(--muted))] px-3 py-1.5 border-b border-t first:border-t-0">
                        <span className="text-xs font-semibold">
                          {group.uacs_code} &mdash; {group.uacs_title}
                        </span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))] ml-2">
                          ({group.category})
                        </span>
                      </div>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th className="w-24">Date</th>
                            <th className="w-28">DV No.</th>
                            <th className="w-28">Check No.</th>
                            <th>Payee</th>
                            <th>Particulars</th>
                            <th className="w-28 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.transactions.map((t) => (
                            <tr
                              key={t.id}
                              className="last:border-0"
                            >
                              <td className="whitespace-nowrap">{formatDate(t.date)}</td>
                              <td className="font-mono">{t.dv_number}</td>
                              <td className="font-mono">{t.check_number || '\u2014'}</td>
                              <td className="font-medium">{t.payee}</td>
                              <td className="text-[hsl(var(--muted-foreground))]">
                                {t.particulars || '\u2014'}
                              </td>
                              <td className="number-cell font-medium">
                                {formatCurrency(Number(t.amount))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-[hsl(var(--secondary))] font-semibold">
                            <td colSpan={5} className="py-1.5 px-3 text-right">
                              Subtotal &mdash; {group.uacs_title}
                            </td>
                            <td className="py-1.5 px-3 number-cell">
                              {formatCurrency(group.total)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ))}

                  <div className="border-t-2 bg-[hsl(var(--primary))] text-white px-3 py-2 flex justify-between items-center">
                    <span className="text-sm font-bold uppercase">Grand Total</span>
                    <span className="text-sm font-bold number-cell">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="summary" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold">Total by Category</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Category</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                        <TableHead className="text-xs text-right w-16">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedCategories.map(([cat, amount]) => (
                        <TableRow key={cat}>
                          <TableCell className="text-xs py-1.5">{cat}</TableCell>
                          <TableCell className="text-xs py-1.5 number-cell font-medium">
                            {formatCurrency(amount)}
                          </TableCell>
                          <TableCell className="text-xs py-1.5 number-cell text-[hsl(var(--muted-foreground))]">
                            {totalAmount > 0 ? ((amount / totalAmount) * 100).toFixed(1) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="text-xs font-bold">Total</TableCell>
                        <TableCell className="text-xs number-cell font-bold">
                          {formatCurrency(totalAmount)}
                        </TableCell>
                        <TableCell className="text-xs number-cell font-bold">100%</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold">Total by Fund Source</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Fund Source</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                        <TableHead className="text-xs text-right w-16">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedFunds.map(([fund, amount]) => (
                        <TableRow key={fund}>
                          <TableCell className="text-xs py-1.5">{fund}</TableCell>
                          <TableCell className="text-xs py-1.5 number-cell font-medium">
                            {formatCurrency(amount)}
                          </TableCell>
                          <TableCell className="text-xs py-1.5 number-cell text-[hsl(var(--muted-foreground))]">
                            {totalAmount > 0 ? ((amount / totalAmount) * 100).toFixed(1) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="text-xs font-bold">Total</TableCell>
                        <TableCell className="text-xs number-cell font-bold">
                          {formatCurrency(totalAmount)}
                        </TableCell>
                        <TableCell className="text-xs number-cell font-bold">100%</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center gap-2 mt-4 no-print">
              <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export to Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPDF} className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Export to PDF
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Print-only report */}
        <div className="print-only">
          <ReportHeader school={school} quarter={quarter} year={year} />
          {grouped.map((group, gi) => (
            <div key={group.uacs_code + gi} style={{ marginBottom: 16 }}>
              <div
                style={{
                  background: '#f5f5f5',
                  padding: '6px 12px',
                  fontWeight: 'bold',
                  fontSize: 12,
                  borderBottom: '1px solid #ddd',
                }}
              >
                {group.uacs_code} &mdash; {group.uacs_title} ({group.category})
              </div>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <th style={{ padding: '4px 8px', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '4px 8px', textAlign: 'left' }}>DV No.</th>
                    <th style={{ padding: '4px 8px', textAlign: 'left' }}>Check No.</th>
                    <th style={{ padding: '4px 8px', textAlign: 'left' }}>Payee</th>
                    <th style={{ padding: '4px 8px', textAlign: 'left' }}>Particulars</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {group.transactions.map((t) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '3px 8px' }}>{formatDate(t.date)}</td>
                      <td style={{ padding: '3px 8px' }}>{t.dv_number}</td>
                      <td style={{ padding: '3px 8px' }}>{t.check_number || '\u2014'}</td>
                      <td style={{ padding: '3px 8px' }}>{t.payee}</td>
                      <td style={{ padding: '3px 8px', color: '#666' }}>
                        {t.particulars || '\u2014'}
                      </td>
                      <td
                        style={{
                          padding: '3px 8px',
                          textAlign: 'right',
                          fontFamily: 'monospace',
                        }}
                      >
                        {formatCurrency(Number(t.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#eee', fontWeight: 'bold' }}>
                    <td colSpan={5} style={{ padding: '4px 8px', textAlign: 'right' }}>
                      Subtotal &mdash; {group.uacs_title}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatCurrency(group.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
          <div
            style={{
              borderTop: '2px solid #333',
              background: '#1a3a5c',
              color: '#fff',
              padding: '8px 12px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: 13 }}>
              Grand Total
            </span>
            <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: 13 }}>
              {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>
      </div>
      </AppShell>
    </RequireAuth>
  );
}

function ReportHeader({
  school,
  quarter,
  year,
}: {
  school: School | null;
  quarter: number;
  year: number;
}) {
  return (
    <div className="mb-4">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
          Republic of the Philippines
        </p>
        {school?.division && (
          <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            {school.division}
          </p>
        )}
        <h2 className="text-sm font-bold uppercase tracking-wide mt-1">
          {school?.name || 'School'}
        </h2>
        <p className="text-xs font-semibold uppercase mt-0.5">
          Cash Disbursement Register
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {getQuarterMonths(quarter)} {year}
        </p>
      </div>
      <Separator className="my-3" />
    </div>
  );
}
