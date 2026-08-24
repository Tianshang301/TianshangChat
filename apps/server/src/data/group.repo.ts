import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { GroupRole } from '@tianshangchat/shared';
import { alias } from 'drizzle-orm/sqlite-core';
import { db } from '../infra/db.js';
import { groupMembers, groups, users } from '../infra/schema.js';

const creatorUsers = alias(users, 'creator');

export interface GroupBaseRecord {
  id: number;
  name: string;
  creatorId: number;
  maxMembers: number;
  createdAt: string;
}

export interface GroupDetailRecord extends GroupBaseRecord {
  creatorName: string;
  members: GroupMemberRecord[];
}

export interface GroupMemberRecord {
  id: number;
  groupId: number;
  userId: number;
  role: GroupRole;
  joinedAt: string;
  username: string;
  avatar: string | null;
}

/** List-view row: base + creatorName + caller's role + memberCount. */
export interface GroupSummaryRecord extends GroupBaseRecord {
  creatorName: string;
  role: GroupRole;
  memberCount: number;
}

export type RemoveMemberResult = 'member_removed' | 'group_deleted';

export function createGroup(name: string, creatorId: number, memberIds: number[]): GroupDetailRecord {
  const result = db.insert(groups).values({ name, creatorId }).run();
  const groupId = Number(result.lastInsertRowid);

  addMember(groupId, creatorId, 'creator');

  if (memberIds.length > 0) {
    for (const userId of memberIds) {
      if (userId !== creatorId) {
        // Legacy behavior: skip duplicates silently.
        addMember(groupId, userId);
      }
    }
  }

  return findGroupById(groupId) as GroupDetailRecord;
}

export function findGroupById(id: number): GroupDetailRecord | undefined {
  const row = db
    .select({
      id: groups.id,
      name: groups.name,
      creatorId: groups.creatorId,
      maxMembers: groups.maxMembers,
      createdAt: groups.createdAt,
      creatorName: creatorUsers.username,
    })
    .from(groups)
    .innerJoin(creatorUsers, eq(creatorUsers.id, groups.creatorId))
    .where(eq(groups.id, id))
    .get();
  if (!row) return undefined;
  return { ...row, members: getMembers(id) };
}

export function getUserGroups(userId: number): GroupSummaryRecord[] {
  return db
    .select({
      id: groups.id,
      name: groups.name,
      creatorId: groups.creatorId,
      maxMembers: groups.maxMembers,
      createdAt: groups.createdAt,
      creatorName: creatorUsers.username,
      role: groupMembers.role,
      memberCount: sql<number>`(SELECT COUNT(*) FROM group_members WHERE group_id = ${groups.id})`,
    })
    .from(groups)
    .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .innerJoin(creatorUsers, eq(creatorUsers.id, groups.creatorId))
    .where(eq(groupMembers.userId, userId))
    .orderBy(desc(groups.createdAt))
    .all();
}

export function getMembers(groupId: number): GroupMemberRecord[] {
  return (
    db
      .select({
        id: groupMembers.id,
        groupId: groupMembers.groupId,
        userId: groupMembers.userId,
        role: groupMembers.role,
        joinedAt: groupMembers.joinedAt,
        username: users.username,
        avatar: users.avatar,
      })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      // Legacy ordering kept verbatim: `ORDER BY role DESC, joined_at ASC`.
      .where(eq(groupMembers.groupId, groupId))
      .orderBy(desc(groupMembers.role), asc(groupMembers.joinedAt))
      .all()
  );
}

export function addMember(groupId: number, userId: number, role: GroupRole = 'member'): boolean {
  try {
    db.insert(groupMembers).values({ groupId, userId, role }).run();
    return true;
  } catch {
    return false;
  }
}

export function removeMember(groupId: number, userId: number): RemoveMemberResult {
  db.delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .run();

  const remaining = getMemberCount(groupId);
  if (remaining === 0) {
    deleteGroup(groupId);
    return 'group_deleted';
  }
  return 'member_removed';
}

export function isMember(groupId: number, userId: number): boolean {
  const row = db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .get();
  return row !== undefined;
}

export function getMemberRole(groupId: number, userId: number): string | null {
  const row = db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .get();
  return row?.role ?? null;
}

export function setAdminRole(groupId: number, userId: number, isAdmin: boolean): void {
  db.update(groupMembers)
    .set({ role: isAdmin ? 'admin' : 'member' })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .run();
}

export function transferOwnership(groupId: number, newOwnerId: number): void {
  const currentCreatorId = db
    .select({ creatorId: groups.creatorId })
    .from(groups)
    .where(eq(groups.id, groupId))
    .get()?.creatorId;

  if (currentCreatorId === undefined) return;

  db.update(groupMembers)
    .set({ role: 'admin' })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, currentCreatorId)))
    .run();

  db.update(groups).set({ creatorId: newOwnerId }).where(eq(groups.id, groupId)).run();
  db.update(groupMembers)
    .set({ role: 'creator' })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, newOwnerId)))
    .run();
}

export function updateGroupName(groupId: number, name: string): void {
  db.update(groups).set({ name }).where(eq(groups.id, groupId)).run();
}

export function deleteGroup(groupId: number): void {
  db.delete(groupMembers).where(eq(groupMembers.groupId, groupId)).run();
  db.delete(groups).where(eq(groups.id, groupId)).run();
}

export function getMemberCount(groupId: number): number {
  const row = db
    .select({ count: sql<number>`COUNT(*)` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId))
    .get();
  return row?.count ?? 0;
}

export function isFull(groupId: number): boolean {
  const group = db
    .select({ maxMembers: groups.maxMembers })
    .from(groups)
    .where(eq(groups.id, groupId))
    .get();
  if (!group) return true;
  return getMemberCount(groupId) >= group.maxMembers;
}

/** Plain member id list — used for receipt fan-out. */
export function getMemberUserIds(groupId: number): number[] {
  return db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId))
    .all()
    .map((r) => r.userId);
}
