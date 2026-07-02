"use client";

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase, Transaction, UacsCode, CATEGORIES, FUND_SOURCES } from '@/lib/supabase';
import { toast } from 'sonner';

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  schoolId: string;
  transaction?: Transaction | null;
  onSaved: () => void;
}

export function TransactionModal({ open, onClose, schoolId, transaction, onSaved }: TransactionModalProps) {
  const [uacsCodes, setUacsCodes] = useState<UacsCode[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    dv_number: '',
    check_number: '',
    payee: '',
    particulars: '',
    amount: '',
    fund_source: 'General Fund',
    uacs_code: '',
    category: 'Others',
  });

  const isEdit = !!transaction;

  useEffect(() => {
    if (transaction) {
      setForm({
        date: transaction.date,
        dv_number: transaction.dv_number,
        check_number: transaction.check_number || '',
        payee: transaction.payee,
        particulars: transaction.particulars || '',
        amount: Number(transaction.amount).toFixed(2),
        fund_source: transaction.fund_source,
        uacs_code: transaction.uacs_code || '',
        category: transaction.category,
      });
    } else {
      setForm({
        date: new Date().toISOString().split('T')[0],
        dv_number: '',
        check_number: '',
        payee: '',
        particulars: '',
        amount: '',
        fund_source: 'General Fund',
        uacs_code: '',
        category: 'Others',
      });
    }
  }, [transaction, open]);

  useEffect(() => {
    fetchUacs();
  }, []);

  async function fetchUacs() {
    const { data } = await supabase
      .from('uacs_codes')
      .select('*')
      .eq('status', 'active')
      .order('code');
    if (data) setUacsCodes(data as UacsCode[]);
  }

  function handleAmountChange(value: string) {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setForm((f) => ({ ...f, amount: cleaned }));
  }

  async function handleSave() {
    if (!form.date || !form.dv_number || !form.payee || !form.amount) {
      toast.error('Please fill in required fields: Date, DV Number, Payee, Amount');
      return;
    }

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }

    setSaving(true);

    const payload = {
      school_id: schoolId,
      date: form.date,
      dv_number: form.dv_number.trim(),
      check_number: form.check_number.trim() || null,
      payee: form.payee.trim(),
      particulars: form.particulars.trim() || null,
      amount,
      fund_source: form.fund_source,
      uacs_code: form.uacs_code || null,
      category: form.category,
    };

    let error;
    if (isEdit) {
      ({ error } = await supabase
        .from('transactions')
        .update({
          date: payload.date,
          dv_number: payload.dv_number,
          check_number: payload.check_number,
          payee: payload.payee,
          particulars: payload.particulars,
          amount: payload.amount,
          fund_source: payload.fund_source,
          uacs_code: payload.uacs_code,
          category: payload.category,
        })
        .eq('id', transaction!.id));
    } else {
      ({ error } = await supabase.from('transactions').insert(payload));
    }

    setSaving(false);

    if (error) {
      toast.error(`Failed to save: ${error.message}`);
      return;
    }

    toast.success(isEdit ? 'Transaction updated' : 'Transaction added');
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {isEdit ? 'Edit Transaction' : 'Add Transaction'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="date" className="text-xs">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dv_number" className="text-xs">
                DV Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dv_number"
                placeholder="DV-2025-001"
                value={form.dv_number}
                onChange={(e) => setForm((f) => ({ ...f, dv_number: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="check_number" className="text-xs">Check Number</Label>
              <Input
                id="check_number"
                placeholder="CHK-001001"
                value={form.check_number}
                onChange={(e) => setForm((f) => ({ ...f, check_number: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="amount" className="text-xs">
                Amount (PHP) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="amount"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="h-8 text-sm number-cell"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="payee" className="text-xs">
              Payee <span className="text-destructive">*</span>
            </Label>
            <Input
              id="payee"
              placeholder="Full name of payee"
              value={form.payee}
              onChange={(e) => setForm((f) => ({ ...f, payee: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="particulars" className="text-xs">Particulars</Label>
            <Input
              id="particulars"
              placeholder="Description of disbursement"
              value={form.particulars}
              onChange={(e) => setForm((f) => ({ ...f, particulars: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fund Source</Label>
              <Select
                value={form.fund_source}
                onValueChange={(v) => setForm((f) => ({ ...f, fund_source: v }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUND_SOURCES.map((fs) => (
                    <SelectItem key={fs} value={fs}>{fs}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">UACS Code</Label>
              <Select
                value={form.uacs_code}
                onValueChange={(v) => {
                  const selected = uacsCodes.find((u) => u.code === v);
                  setForm((f) => ({
                    ...f,
                    uacs_code: v,
                    category: selected ? mapUacsToCategory(selected.code) : f.category,
                  }));
                }}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select UACS" />
                </SelectTrigger>
                <SelectContent>
                  {uacsCodes.map((u) => (
                    <SelectItem key={u.code} value={u.code}>
                      <span className="font-mono">{u.code}</span> - {u.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Transaction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function mapUacsToCategory(code: string): string {
  if (code.includes('301')) return 'Personal Services';
  if (code.includes('401')) return 'Travel';
  if (code.includes('402')) return 'Maintenance';
  if (code.includes('403')) return 'Maintenance';
  if (code.includes('405')) return 'Maintenance';
  if (code.includes('408')) return 'Training';
  if (code.includes('501')) return 'Capital Outlay';
  if (code.includes('502')) return 'Capital Outlay';
  if (code.includes('101')) return 'Subsidy';
  if (code.includes('801')) return 'Interest Payments';
  return 'Others';
}
