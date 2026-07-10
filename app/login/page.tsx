"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Landmark } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }
    if (mode === 'signup' && !fullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    setLoading(true);
    const { error } =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, fullName);
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (mode === 'signup') {
      toast.success('Account created. Sign in after admin approval.');
      setMode('signin');
      setFullName('');
      setPassword('');
      return;
    }

    toast.success('Welcome back!');
    router.push('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="border-b text-center">
          <div className="flex justify-center mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded bg-primary">
              <Landmark className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-xl text-primary">LedgerOne</CardTitle>
          <CardDescription>
            {mode === 'signin'
              ? 'Admin Portal Cash Disbursement Register'
              : 'Request access to the Cash Disbursement Register'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1">
                <Label htmlFor="full-name" className="text-xs font-semibold uppercase tracking-[0.05em]">Full Name</Label>
                <Input
                  id="full-name"
                  type="text"
                  placeholder="Juan Dela Cruz"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.05em]">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.05em]">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Request Access'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === 'signin' ? "Don't have access yet?" : 'Already approved?'}{' '}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => {
                setMode((current) => (current === 'signin' ? 'signup' : 'signin'));
                setPassword('');
              }}
            >
              {mode === 'signin' ? 'Request an account' : 'Sign in'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
