import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth';

export async function GET() {
  const profile = await getCurrentUserProfile({ createIfMissing: true });

  if (!profile) {
    return NextResponse.json({ profile: null }, { status: 401 });
  }

  return NextResponse.json({ profile });
}
