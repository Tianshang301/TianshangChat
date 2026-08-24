import { z } from 'zod';
import { LIMITS } from '../constants.js';
import { UserSummarySchema } from './user.js';

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

export const RegisterRequestSchema = z.object({
  username: z
    .string()
    .trim()
    .min(LIMITS.usernameMin)
    .max(LIMITS.usernameMax)
    .regex(LIMITS.usernamePattern),
  password: z.string().min(LIMITS.passwordMin),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  username: z.string().min(1).max(LIMITS.usernameMax),
  password: z.string().min(1),
  remember: z.boolean().optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/* ------------------------------------------------------------------ */
/* Responses                                                           */
/* ------------------------------------------------------------------ */

export const RegisterResponseSchema = z.object({
  success: z.literal(true),
  user: z.object({ id: z.number().int(), username: z.string() }),
});

export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

export const LoginResponseSchema = z.object({
  success: z.literal(true),
  token: z.string(),
  user: UserSummarySchema,
  expiresIn: z.enum(['24h', '7d']),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const VerifyResponseSchema = z.object({
  success: z.literal(true),
  user: z.object({ id: z.number().int(), username: z.string() }),
});

export type VerifyResponse = z.infer<typeof VerifyResponseSchema>;

export const OkResponseSchema = z.object({ success: z.literal(true) });

export type OkResponse = z.infer<typeof OkResponseSchema>;
