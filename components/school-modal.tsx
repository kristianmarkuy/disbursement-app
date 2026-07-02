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
import { supabase, School } from '@/lib/supabase';
import { toast } from 'sonner';

interface SchoolModalProps {
  open: boolean;
  onClose: () => void;
  school?: School | null;
  onSaved: () => void;
}

export function SchoolModal({ open, onClose, school, onSaved }: SchoolModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    address: '',
    division: '',
    region: '',
  });

  const isEdit = !!school;

  useEffect(() => {
    if (school) {
      setForm({
        name: school.name,
        code: school.code,
        address: school.address || '',
        division: school.division || '',
        region: school.region || '',
      });
    } else {
      setForm({ name: '', code: '', address: '', division: '', region: '' });
    }
  }, [school, open]);

  async function handleSave() {
    if (!form.name || !form.code) {
      toast.error('School Name and Code are required');
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      address: form.address.trim() || null,
      division: form.division.trim() || null,
      region: form.region.trim() || null,
    };

    let error;
    if (isEdit) {
      ({ error } = await supabase
        .from('schools')
        .update(payload)
        .eq('id', school!.id));
    } else {
      ({ error } = await supabase.from('schools').insert(payload));
    }

    setSaving(false);
    if (error) {
      toast.error(`Failed to save: ${error.message}`);
      return;
    }
    toast.success(isEdit ? 'School updated' : 'School created');
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {isEdit ? 'Edit School' : 'Add School'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="school-name" className="text-xs">
                School Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="school-name"
                placeholder="San Jose Elementary School"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="school-code" className="text-xs">
                School Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="school-code"
                placeholder="SJES-001"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className="h-8 text-sm font-mono"
                disabled={isEdit}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="school-address" className="text-xs">Address</Label>
            <Input
              id="school-address"
              placeholder="Street, City, Province"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="school-division" className="text-xs">Division</Label>
              <Input
                id="school-division"
                placeholder="Division of Metro Manila"
                value={form.division}
                onChange={(e) => setForm((f) => ({ ...f, division: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="school-region" className="text-xs">Region</Label>
              <Input
                id="school-region"
                placeholder="NCR"
                value={form.region}
                onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create School'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
