"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { RequireAuth } from '@/components/auth-guard';
import { AppShell } from '@/components/app-shell';
import { UacsModal } from '@/components/uacs-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Search, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { supabase, School, UacsCode, sanitizeSearchTerm } from '@/lib/supabase';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { toast } from 'sonner';

export default function SchoolUacsPage() {
  const params = useParams();
  const schoolId = params.id as string;
  const { canManageUacs } = useAuth();

  const [school, setSchool] = useState<School | null>(null);
  const [codes, setCodes] = useState<UacsCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UacsCode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UacsCode | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('uacs_codes').select('*').order('code');
    const sanitized = sanitizeSearchTerm(debouncedSearch);
    if (sanitized) {
      const term = `%${sanitized}%`;
      query = query.or(
        `code.ilike.${term},title.ilike.${term},description.ilike.${term}`
      );
    }
    const { data, error } = await query;
    if (error) {
      toast.error(`Failed to load UACS codes: ${error.message}`);
    } else if (data) {
      setCodes(data as UacsCode[]);
    }
    setLoading(false);
  }, [debouncedSearch]);

  useEffect(() => {
    supabase.from('schools').select('*').eq('id', schoolId).single().then((res) => {
      if (res.data) setSchool(res.data as School);
    });
  }, [schoolId]);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  function handleAdd() {
    if (!canManageUacs) {
      toast.error('Only admins can manage UACS codes');
      return;
    }
    setEditing(null);
    setModalOpen(true);
  }

  function handleEdit(code: UacsCode) {
    if (!canManageUacs) {
      toast.error('Only admins can manage UACS codes');
      return;
    }
    setEditing(code);
    setModalOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (!canManageUacs) {
      toast.error('Only admins can delete UACS codes');
      setDeleteTarget(null);
      return;
    }
    const { error } = await supabase
      .from('uacs_codes')
      .delete()
      .eq('id', deleteTarget.id);
    if (error) {
      toast.error(`Delete failed: ${error.message}`);
    } else {
      toast.success('UACS code deleted');
      fetchCodes();
    }
    setDeleteTarget(null);
  }

  return (
    <RequireAuth allowedRoles={['admin']}>
      <AppShell school={school} schoolId={schoolId}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">UACS Codes</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Unified Accounts Code Structure Management
            </p>
          </div>
          <Button onClick={handleAdd} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add UACS Code
          </Button>
        </div>

        <div className="max-w-[300px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <Input
              placeholder="Search code or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

        <Card className="overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>UACS Code</th>
                <th>Title</th>
                <th>Description</th>
                <th>Status</th>
                <th className="w-12 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[hsl(var(--muted-foreground))]">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && codes.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[hsl(var(--muted-foreground))]">
                    No UACS codes found.
                  </td>
                </tr>
              )}
              {codes.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono">{c.code}</td>
                  <td className="font-medium">{c.title}</td>
                  <td className="text-[hsl(var(--muted-foreground))]">
                    {c.description || '\u2014'}
                  </td>
                  <td>
                    <Badge
                      variant={c.status === 'active' ? 'default' : 'secondary'}
                      className={
                        c.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0 h-4'
                          : 'text-[10px] px-1.5 py-0 h-4'
                      }
                    >
                      {c.status}
                    </Badge>
                  </td>
                  <td className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(c)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(c)}
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
        </Card>
      </div>

      <UacsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        uacs={editing}
        onSaved={fetchCodes}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete UACS Code</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {deleteTarget?.code} - {deleteTarget?.title}? Transactions referencing this
              code will retain their values.
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
