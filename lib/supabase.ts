export { supabase, createClient } from './supabase/client';

export type School = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  division: string | null;
  region: string | null;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: string;
  school_id: string;
  date: string;
  dv_number: string;
  check_number: string | null;
  payee: string;
  particulars: string | null;
  amount: number;
  fund_source: string;
  uacs_code: string | null;
  category: string;
  created_at: string;
  updated_at: string;
};

export type UacsCode = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

export type UserRole = 'admin' | 'officer' | 'viewer';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SchoolTransactionStats = {
  school_id: string;
  txn_count: number;
  total_amount: number;
};

export const USER_ROLES: UserRole[] = ['admin', 'officer', 'viewer'];

export const APPROVAL_STATUSES: ApprovalStatus[] = ['pending', 'approved', 'rejected'];

export function canManageSchools(role?: UserRole | null): boolean {
  return role === 'admin' || role === 'officer';
}

export function canDeleteSchools(role?: UserRole | null): boolean {
  return role === 'admin';
}

export function canManageTransactions(role?: UserRole | null): boolean {
  return role === 'admin' || role === 'officer';
}

export function canDeleteTransactions(role?: UserRole | null): boolean {
  return role === 'admin';
}

export function canManageUacs(role?: UserRole | null): boolean {
  return role === 'admin';
}

export function canManageUsers(role?: UserRole | null): boolean {
  return role === 'admin';
}

export function canViewReports(role?: UserRole | null): boolean {
  return role === 'admin' || role === 'officer' || role === 'viewer';
}

export const CATEGORIES = [
  'Personal Services',
  'Maintenance',
  'Travel',
  'Training',
  'Capital Outlay',
  'Subsidy',
  'Interest Payments',
  'Others',
] as const;

export const FUND_SOURCES = [
  'General Fund',
  'Special Fund',
  'Trust Fund',
  'Foreign Assisted',
] as const;

/** Parse YYYY-MM-DD as a local calendar date (avoids UTC timezone shift). */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getQuarter(date: string | Date): number {
  const d = typeof date === 'string' ? parseLocalDate(date) : date;
  return Math.floor(d.getMonth() / 3) + 1;
}

export function getQuarterLabel(quarter: number, year: number): string {
  return `Q${quarter} ${year}`;
}

export function getQuarterMonths(quarter: number): string {
  const months: Record<number, string> = {
    1: 'January - March',
    2: 'April - June',
    3: 'July - September',
    4: 'October - December',
  };
  return months[quarter];
}

/** Inclusive start, exclusive end — safe for all four quarters including Q4. */
export function getQuarterDateRange(
  quarter: number,
  year: number
): { startDate: string; endDate: string } {
  const startMonth = (quarter - 1) * 3;
  const startDate = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`;
  const nextQuarterMonth = startMonth + 3;

  if (nextQuarterMonth >= 12) {
    return { startDate, endDate: `${year + 1}-01-01` };
  }

  return {
    startDate,
    endDate: `${year}-${String(nextQuarterMonth + 1).padStart(2, '0')}-01`,
  };
}

export function getYearDateRange(year: number): { startDate: string; endDate: string } {
  return { startDate: `${year}-01-01`, endDate: `${year + 1}-01-01` };
}

/** Strip characters that break PostgREST .or() filter syntax. */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[%_,\\]/g, '').trim();
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string): string {
  if (!date) return '';
  const d = parseLocalDate(date);
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}
