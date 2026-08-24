/** Upload path whitelist — the ONLY sanctioned prefixes for user-generated media URLs. */
export const UPLOAD_PATHS = {
  voice: '/uploads/voice/',
  avatars: '/uploads/avatars/',
} as const;

export type UploadKind = keyof typeof UPLOAD_PATHS;

/** Runtime guard shared by server socket handlers and REST routes. */
export function validateUploadPath(url: unknown, prefix: UploadKind): url is string {
  return typeof url === 'string' && url.startsWith(UPLOAD_PATHS[prefix]);
}

export const LIMITS = {
  usernameMin: 3,
  usernameMax: 20,
  usernamePattern: /^[a-zA-Z0-9_]+$/,
  passwordMin: 6,
  /** Hard cap enforced on every text message entering the system (REST + Socket). */
  messageMaxLength: 4000,
  groupNameMin: 1,
  groupNameMax: 50,
  groupDefaultMaxMembers: 1000,
  /** Max members accepted in a create-group member list. */
  createGroupMaxInitialMembers: 200,
  avatarUploadMaxBytes: 1024 * 1024,
  voiceUploadMaxBytes: 10 * 1024 * 1024,
} as const;

export const ROOM_PREFIX = {
  group: 'group-',
} as const;

export function groupRoom(groupId: number): string {
  return `${ROOM_PREFIX.group}${groupId}`;
}
