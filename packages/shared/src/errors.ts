/**
 * Canonical protocol error codes.
 * Server maps internal failures onto these; clients branch on them (never on prose strings).
 */
export const ErrorCode = {
  ValidationFailed: 'VALIDATION_FAILED',
  InvalidCredentials: 'INVALID_CREDENTIALS',
  UsernameExists: 'USERNAME_EXISTS',
  Unauthorized: 'UNAUTHORIZED',
  TokenInvalid: 'TOKEN_INVALID',
  NotAuthenticated: 'NOT_AUTHENTICATED',
  NotFound: 'NOT_FOUND',
  Forbidden: 'FORBIDDEN',
  GroupNotFound: 'GROUP_NOT_FOUND',
  GroupFull: 'GROUP_FULL',
  AlreadyMember: 'ALREADY_IN_GROUP',
  NotMember: 'NOT_A_MEMBER',
  CreatorCannotLeave: 'CREATOR_CANNOT_LEAVE',
  CannotRemoveCreator: 'CANNOT_REMOVE_CREATOR',
  InvalidAudioUrl: 'INVALID_AUDIO_URL',
  InvalidAvatarUrl: 'INVALID_AVATAR_URL',
  RateLimited: 'RATE_LIMITED',
  Internal: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Uniform error envelope used by both REST (`{error, code}`) and Socket (`error` / `auth-error`). */
export interface ProtocolError {
  error: string;
  code?: ErrorCode;
  details?: unknown;
}

export function protocolError(
  error: string,
  code?: ErrorCode,
  details?: unknown,
): ProtocolError {
  const out: ProtocolError = { error };
  if (code !== undefined) out.code = code;
  if (details !== undefined) out.details = details;
  return out;
}
