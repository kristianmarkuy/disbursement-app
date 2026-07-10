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

type RegisterPaymentColumn = {
  key: string;
  label: string;
  subLabel: string;
  matches: (text: string) => boolean;
};

const REGISTER_PAYMENT_COLUMNS: RegisterPaymentColumn[] = [
  {
    key: 'exacting',
    label: 'Exacting Expense',
    subLabel: '(50204010)',
    matches: (text) => text.includes('exacting'),
  },
  {
    key: 'mooe',
    label: 'MOOE Expense',
    subLabel: '(50204010)',
    matches: (text) =>
      text.includes('internet') ||
      text.includes('utility') ||
      text.includes('utilities') ||
      text.includes('mooe'),
  },
  {
    key: 'professional-services',
    label: 'Other Professional Services',
    subLabel: '(50211990)',
    matches: (text) => text.includes('professional service'),
  },
  {
    key: 'telephone',
    label: 'Telephone Expenses-MO',
    subLabel: '(50205020)',
    matches: (text) => text.includes('telephone') || text.includes('load card') || text.includes('communication'),
  },
  {
    key: 'office-supplies',
    label: 'Office Supplies Expense',
    subLabel: '(50203010)',
    matches: (text) => text.includes('office suppl'),
  },
  {
    key: 'other-supplies',
    label: 'Other Supplies & Materials Expense',
    subLabel: '(50203090)',
    matches: (text) => text.includes('supplies') || text.includes('materials') || text.includes('hardware'),
  },
  {
    key: 'training',
    label: 'Training Expenses',
    subLabel: '(50202010)',
    matches: (text) => text.includes('training'),
  },
];

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
    const isCancelledTransaction = (transaction: Transaction) => {
      const text = `${transaction.payee} ${transaction.particulars || ''}`.toLowerCase();
      return text.includes('cancelled') || text.includes('canceled');
    };

    const escapeCell = (value: string | number | null | undefined) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const formatRegisterDate = (date: string) => {
      const d = parseLocalDate(date);
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    };

    const formatRegisterNumber = (amount: number) => {
      if (!Number.isFinite(amount) || amount === 0) return '';
      return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const getTransactionText = (transaction: Transaction) =>
      [
        transaction.payee,
        transaction.particulars,
        transaction.category,
        transaction.fund_source,
        transaction.uacs_code,
        transaction.uacs_code ? uacsLookup[transaction.uacs_code] : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    const getPaymentColumn = (transaction: Transaction) =>
      REGISTER_PAYMENT_COLUMNS.find((column) => column.matches(getTransactionText(transaction)));

    const getAccountDescription = (transaction: Transaction) => {
      if (transaction.uacs_code && uacsLookup[transaction.uacs_code]) {
        return uacsLookup[transaction.uacs_code];
      }

      return transaction.category;
    };

    const registerTotal = quarterTxns.reduce(
      (sum, transaction) =>
        isCancelledTransaction(transaction) ? sum : sum + Number(transaction.amount),
      0
    );

    let runningBalance = registerTotal;
    const transactionRows = quarterTxns
      .map((transaction) => {
        const amount = Number(transaction.amount);
        const cancelled = isCancelledTransaction(transaction);
        const paymentColumn = getPaymentColumn(transaction);
        const balanceAfterPayment = cancelled ? runningBalance : runningBalance - amount;
        const particulars = cancelled
          ? 'CANCELLED'
          : `${transaction.payee}${transaction.particulars ? ` - ${transaction.particulars}` : ''}`;
        const breakdownCells = REGISTER_PAYMENT_COLUMNS.map((column) => {
          const columnAmount =
            !cancelled && paymentColumn?.key === column.key ? formatRegisterNumber(amount) : '';
          return `<td class="number">${columnAmount}</td>`;
        }).join('');
        const otherAmount = !cancelled && !paymentColumn ? formatRegisterNumber(amount) : '';

        runningBalance = balanceAfterPayment;

        return `
          <tr class="${cancelled ? 'cancelled' : ''}">
            <td>${escapeCell(formatRegisterDate(transaction.date))}</td>
            <td>${escapeCell(transaction.dv_number || transaction.check_number || '')}</td>
            <td>${escapeCell(particulars)}</td>
            <td class="number"></td>
            <td class="number">${cancelled ? '' : formatRegisterNumber(amount)}</td>
            <td class="number">${cancelled ? '' : formatRegisterNumber(Math.max(balanceAfterPayment, 0))}</td>
            ${breakdownCells}
            <td>${escapeCell(!cancelled && !paymentColumn ? getAccountDescription(transaction) : '')}</td>
            <td class="code">${escapeCell(!cancelled && !paymentColumn ? transaction.uacs_code || '' : '')}</td>
            <td class="number">${otherAmount}</td>
          </tr>
        `;
      })
      .join('');

    const paymentColumnTotals = REGISTER_PAYMENT_COLUMNS.map((column) =>
      quarterTxns.reduce((sum, transaction) => {
        if (isCancelledTransaction(transaction)) return sum;
        return getPaymentColumn(transaction)?.key === column.key
          ? sum + Number(transaction.amount)
          : sum;
      }, 0)
    );
    const otherTotal = quarterTxns.reduce((sum, transaction) => {
      if (isCancelledTransaction(transaction)) return sum;
      return getPaymentColumn(transaction) ? sum : sum + Number(transaction.amount);
    }, 0);
    const monthLabel = getQuarterMonths(quarter).replace(' - ', '-').toUpperCase();
    const quarterOrdinal = ['1ST', '2ND', '3RD', '4TH'][quarter - 1];
    const exportedAt = new Date().toLocaleDateString('en-PH');
    const paymentHeaderCells = REGISTER_PAYMENT_COLUMNS.map(
      (column) => `
        <th>
          ${escapeCell(column.label)}
          <br />
          <span>${escapeCell(column.subLabel)}</span>
        </th>
      `
    ).join('');
    const paymentTotalCells = paymentColumnTotals
      .map((amount) => `<td class="number total-cell">${formatRegisterNumber(amount)}</td>`)
      .join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8" />
          <style>
            table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10px; }
            td, th { border: 1px solid #000; padding: 2px 4px; vertical-align: middle; }
            th { font-weight: 700; text-align: center; }
            .no-border { border: none; }
            .title { border: none; font-size: 13px; font-weight: 700; text-align: center; text-transform: uppercase; }
            .subtitle { border: none; font-size: 11px; font-weight: 700; text-align: center; text-transform: uppercase; }
            .meta { border: none; font-size: 8px; font-weight: 700; }
            .meta-line { border-bottom: 1px solid #000; font-weight: 400; }
            .header-group { background: #fff; font-weight: 700; text-align: center; }
            .small { font-size: 7px; }
            .number { mso-number-format: "#,##0.00"; text-align: right; white-space: nowrap; }
            .code { mso-number-format: "\\@"; text-align: center; }
            .particulars { width: 360px; }
            .cancelled td { background: #ff0000; color: #000; font-weight: 700; }
            .cash-advance td { font-weight: 700; }
            .total-row td { font-weight: 700; }
            .footer td { border: none; font-size: 8px; text-align: center; }
            .note { border: none; font-size: 7px; text-align: center; }
          </style>
        </head>
        <body>
          <table>
            <colgroup>
              <col style="width: 70px" />
              <col style="width: 105px" />
              <col style="width: 390px" />
              <col style="width: 90px" />
              <col style="width: 90px" />
              <col style="width: 90px" />
              <col style="width: 85px" />
              <col style="width: 85px" />
              <col style="width: 85px" />
              <col style="width: 85px" />
              <col style="width: 85px" />
              <col style="width: 85px" />
              <col style="width: 85px" />
              <col style="width: 175px" />
              <col style="width: 120px" />
              <col style="width: 90px" />
            </colgroup>
            <tr>
              <td colspan="16" class="title">${escapeCell(school?.name || 'School')}</td>
            </tr>
            <tr>
              <td colspan="16" class="subtitle">Cash Disbursements Register</td>
            </tr>
            <tr>
              <td colspan="16" class="subtitle">${escapeCell(monthLabel)} ${year} (${quarterOrdinal} QUARTER)</td>
            </tr>
            <tr>
              <td colspan="3" class="meta">Entity Name: <span class="meta-line">DepEd</span></td>
              <td colspan="8" class="meta"></td>
              <td colspan="5" class="meta">Name of Accountable Officer: <span class="meta-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></td>
            </tr>
            <tr>
              <td colspan="3" class="meta">Sub-Office/District/Division: <span class="meta-line">${escapeCell(school?.division || '')}</span></td>
              <td colspan="8" class="meta"></td>
              <td colspan="5" class="meta">Official Designation: <span class="meta-line">School Head</span></td>
            </tr>
            <tr>
              <td colspan="3" class="meta">Municipality/City/Province: <span class="meta-line">${escapeCell(school?.address || '')}</span></td>
              <td colspan="8" class="meta"></td>
              <td colspan="5" class="meta">Station: <span class="meta-line">${escapeCell(school?.name || '')}</span></td>
            </tr>
            <tr>
              <td colspan="3" class="meta">Fund Cluster: <span class="meta-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></td>
              <td colspan="8" class="meta"></td>
              <td colspan="5" class="meta">Sheet No.: <span class="meta-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></td>
            </tr>
            <tr>
              <td class="no-border" colspan="16">&nbsp;</td>
            </tr>
            <tr>
              <th rowspan="3">Date</th>
              <th rowspan="3">DV/<br />Payroll/<br />Check<br />No.</th>
              <th rowspan="3" class="particulars">PARTICULARS</th>
              <th colspan="3" class="header-group">Advances for<br /><span class="small">(19901010)</span></th>
              <th colspan="10" class="header-group">BREAKDOWN OF PAYMENTS</th>
            </tr>
            <tr>
              <th rowspan="2">Cash<br />Advance</th>
              <th rowspan="2">Payments</th>
              <th rowspan="2">Balance</th>
              ${paymentHeaderCells}
              <th colspan="3">OTHERS</th>
            </tr>
            <tr>
              <th>Account Description</th>
              <th>UACS Object Code</th>
              <th>Amount</th>
            </tr>
            <tr class="cash-advance">
              <td></td>
              <td></td>
              <td>Cash advance of school MOOE from ${escapeCell(monthLabel)} ${year}</td>
              <td class="number">${formatRegisterNumber(registerTotal)}</td>
              <td class="number"></td>
              <td class="number">${formatRegisterNumber(registerTotal)}</td>
              <td colspan="10"></td>
            </tr>
            ${transactionRows}
            <tr class="total-row">
              <td></td>
              <td></td>
              <td style="text-align: right;">TOTAL:</td>
              <td class="number total-cell">${formatRegisterNumber(registerTotal)}</td>
              <td class="number total-cell">${formatRegisterNumber(registerTotal)}</td>
              <td></td>
              ${paymentTotalCells}
              <td></td>
              <td></td>
              <td class="number total-cell">${formatRegisterNumber(otherTotal)}</td>
            </tr>
            <tr>
              <td colspan="9" class="no-border"></td>
              <td colspan="7" class="note">The total of the Advances for Operating Expenses - Payments column must always be equal to the sum of the totals of the Breakdown of Payments columns.</td>
            </tr>
            <tr class="footer">
              <td colspan="6">PREPARED BY:<br /><br /><strong>&nbsp;</strong><br />DISBURSING OFFICER<br />Date: ${escapeCell(exportedAt)}</td>
              <td colspan="5"></td>
              <td colspan="5">RECEIVED BY:<br /><br /><strong>&nbsp;</strong><br />PRE-AUDIT UNIT PERSONNEL<br />Date: ${escapeCell(exportedAt)}</td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `CDR_${school?.code || 'SCHOOL'}_${selectedQuarter}.xls`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Exported formatted Excel register');
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
