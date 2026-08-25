import { beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import {
  authGet,
  authPost,
  buildTestApp,
  loginUser,
  registerUser,
  uniq,
  type TestEnv,
} from './helpers';

describe('auth endpoints', () => {
  let env: TestEnv;

  beforeAll(async () => {
    env = await buildTestApp();
  });

  it('rejects invalid registration payloads via Zod', async () => {
    const res = await supertest(env.app).post('/api/auth/register').send({
      username: 'ab', // too short
      password: 'x',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('registers a user and rejects duplicates with 400', async () => {
    const username = uniq('auth');
    await registerUser(env.app, username);

    const dup = await supertest(env.app)
      .post('/api/auth/register')
      .send({ username, password: 'secret123' });
    expect(dup.status).toBe(400);
    expect(dup.body.code).toBe('USERNAME_EXISTS');
  });

  it('logs in and returns token + user summary', async () => {
    const username = uniq('login');
    await registerUser(env.app, username);
    const session = await loginUser(env.app, username);

    expect(session.token).toBeTruthy();
    expect(session.username).toBe(username);
    expect(session.userId).toBeGreaterThan(0);
  });

  it('rejects wrong password with INVALID_CREDENTIALS', async () => {
    const username = uniq('wrongpw');
    await registerUser(env.app, username);
    const res = await supertest(env.app)
      .post('/api/auth/login')
      .send({ username, password: 'not-the-password' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('verifies tokens then invalidates them on logout', async () => {
    const username = uniq('flow');
    await registerUser(env.app, username);
    const session = await loginUser(env.app, username);

    const verified = await authGet(env.app, '/api/auth/verify', session.token);
    expect(verified.status).toBe(200);
    expect(verified.body.user.username).toBe(username);

    const profile = await authGet(env.app, '/api/auth/user', session.token);
    expect(profile.status).toBe(200);
    expect(profile.body.user.createdAt).toBeTruthy();

    const logout = await authPost(env.app, '/api/auth/logout', {}, session.token);
    expect(logout.status).toBe(200);

    const afterLogout = await authGet(env.app, '/api/auth/verify', session.token);
    expect(afterLogout.status).toBe(401);
  });

  it('guards protected routes without a bearer token', async () => {
    const res = await authGet(env.app, '/api/auth/verify', '');
    expect(res.status).toBe(401);
  });
});
