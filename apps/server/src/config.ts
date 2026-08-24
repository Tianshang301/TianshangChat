import { z } from 'zod';
import path from 'node:path';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string(),
  DATABASE_PATH: z.string().default('./data/chat.db'),
  UPLOAD_DIR: z.string().default('./uploads'),
});

const KNOWN_PLACEHOLDER_SECRETS = new Set([
  'change-this-to-a-strong-random-secret-key',
  'your-secret-key',
  'your-secret-key-here',
]);

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const env = parsed.data;

if (env.JWT_SECRET.length < 32) {
  console.error(
    'JWT_SECRET must be at least 32 characters. Generate one with:\n' +
      `  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`,
  );
  process.exit(1);
}

if (KNOWN_PLACEHOLDER_SECRETS.has(env.JWT_SECRET)) {
  console.error(
    'JWT_SECRET is a known placeholder value. Refusing to start (tokens would be forgeable).\n' +
      `Generate a strong secret: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`,
  );
  process.exit(1);
}

const serverRoot = path.resolve(__dirname, '..');

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  jwtSecret: env.JWT_SECRET,
  databasePath: path.isAbsolute(env.DATABASE_PATH)
    ? env.DATABASE_PATH
    : path.join(serverRoot, env.DATABASE_PATH),
  uploadDir: path.isAbsolute(env.UPLOAD_DIR) ? env.UPLOAD_DIR : path.join(serverRoot, env.UPLOAD_DIR),
} as const;
