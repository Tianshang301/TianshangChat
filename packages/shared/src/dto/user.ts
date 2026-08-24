import { z } from 'zod';

/** Minimal public identity — safe to broadcast anywhere. */
export const UserSummarySchema = z.object({
  id: z.number().int(),
  username: z.string(),
  avatar: z.string().nullable(),
});

export type UserSummary = z.infer<typeof UserSummarySchema>;

/** As returned by GET /api/auth/user (includes creation time). */
export const UserProfileSchema = UserSummarySchema.extend({
  createdAt: z.string().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

/** Online presence entry broadcast in `user-list-update`. */
export const OnlineUserSchema = UserSummarySchema.extend({
  socketId: z.string(),
});

export type OnlineUser = z.infer<typeof OnlineUserSchema>;

export const SearchUsersResponseSchema = z.object({
  success: z.literal(true),
  users: z.array(
    z.object({
      id: z.number().int(),
      username: z.string(),
      avatar: z.string().nullable(),
      created_at: z.string().optional(),
    }),
  ),
});

export type SearchUsersResponse = z.infer<typeof SearchUsersResponseSchema>;
