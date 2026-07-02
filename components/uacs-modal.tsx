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
import { supabase, UacsCode } from '@/lib/supabase';
import { toast } from 'sonner';

interface UacsModalProps {
  open: boolean;
  onClose: () => void;
  uacs?: UacsCode | null;
  onSaved: () => void;
}

export function UacsModal({ open, onClose, uacs, onSaved }: UacsModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    title: '',
    description: '',
    status: 'active' as 'active' | 'inactive',
  });

  const isEdit = !!uacs;

  useEffect(() => {
    if (uacs) {
      setForm({
        code: uacs.code,
        title: uacs.title,
        description: uacs.description || '',
        status: uacs.status,
      });
    } else {
      setForm({ code: '', title: '', description: '', status: 'active' });
    }
  }, [uacs, open]);

  async function handleSave() {
    if (!form.code || !form.title) {
      toast.error('UACS Code and Title are required');
      return;
    }

    setSaving(true);
    const payload = {
      code: form.code.trim(),
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
    };

    let error;
    if (isEdit) {
      ({ error } = await supabase
        .from('uacs_codes')
        .update(payload)
        .eq('id', uacs!.id));
    } else {
      ({ error } = await supabase.from('uacs_codes').insert(payload));
    }

    setSaving(false);
    if (error) {
      toast.error(`Failed to save: ${error.message}`);
      return;
    }
    toast.success(isEdit ? 'UACS code updated' : 'UACS code added');
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {isEdit ? 'Edit UACS Code' : 'Add UACS Code'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="uacs-code" className="text-xs">
              UACS Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="uacs-code"
              placeholder="5020301000"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              className="h-8 text-sm font-mono"
              disabled={isEdit}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="uacs-title" className="text-xs">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="uacs-title"
              placeholder="Personal Services - Salaries"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="uacs-desc" className="text-xs">
              Description
            </Label>
            <Input
              id="uacs-desc"
              placeholder="Brief description of this UACS code"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v as 'active' | 'inactive' }))}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Code'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
