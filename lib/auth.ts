import 'server-only';
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { UserProfile, UserRole, ApprovalStatus } from '@/lib/supabase';

type DbUserProfile = Awaited<ReturnType<typeof prisma.userProfile.findUnique>>;

function toUserProfile(profile: NonNullable<DbUserProfile>): UserProfile {
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.fullName,
    role: profile.role as UserRole,
    approval_status: profile.approvalStatus as ApprovalStatus,
    approved_by: profile.approvedBy,
    approved_at: profile.approvedAt?.toISOString() ?? null,
    created_at: profile.createdAt.toISOString(),
    updated_at: profile.updatedAt.toISOString(),
  };
}

export async function getCurrentUserProfile(options: { createIfMissing?: boolean } = {}) {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const existingProfile = await prisma.userProfile.findUnique({
    where: { clerkUserId: userId },
  });

  if (existingProfile || !options.createIfMissing) {
    return existingProfile ? toUserProfile(existingProfile) : null;
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? '';
  const fullName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ').trim();
  const metadataFullName =
    typeof clerkUser?.unsafeMetadata?.full_name === 'string'
      ? clerkUser.unsafeMetadata.full_name.trim()
      : '';

  const approvedAdmin = await prisma.userProfile.findFirst({
    where: {
      role: 'admin',
      approvalStatus: 'approved',
    },
    select: { id: true },
  });

  const createdProfile = await prisma.userProfile.create({
    data: {
      clerkUserId: userId,
      email,
      fullName: fullName || metadataFullName || null,
      role: approvedAdmin ? 'viewer' : 'admin',
      approvalStatus: approvedAdmin ? 'pending' : 'approved',
      approvedAt: approvedAdmin ? null : new Date(),
    },
  });

  return toUserProfile(createdProfile);
}
