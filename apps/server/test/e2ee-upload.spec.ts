import { beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import {
  authGet,
  authPost,
  authPut,
  buildTestApp,
  loginUser,
  registerUser,
  uniq,
  type Session,
  type TestEnv,
} from './helpers';

describe('E2EE bundles', () => {
  let env: TestEnv;
  let alice: Session;
  let bob: Session;

  const validBundle = {
    ikPub: 'A'.repeat(44),
    edPub: 'B'.repeat(44),
    spkPub: 'C'.repeat(44),
    spkSig: 'D'.repeat(88),
  };

  beforeAll(async () => {
    env = await buildTestApp();
    const a = uniq('e2alice');
    const b = uniq('e2bob');
    await registerUser(env.app, a);
    await registerUser(env.app, b);
    alice = await loginUser(env.app, a);
    bob = await loginUser(env.app, b);
  });

  it('404s when the peer has not published a bundle', async () => {
    const res = await authGet(env.app, `/api/e2ee/bundle/${bob.userId}`, alice.token);
    expect(res.status).toBe(404);
  });

  it('rejects malformed payloads via Zod', async () => {
    const res = await authPut(env.app, '/api/e2ee/bundle', { ikPub: 'x' }, alice.token);
    expect(res.status).toBe(400);
  });

  it('publishes then fetches the exact bundle', async () => {
    const put = await authPut(env.app, '/api/e2ee/bundle', validBundle, bob.token);
    expect(put.status).toBe(200);

    const get = await authGet(env.app, `/api/e2ee/bundle/${bob.userId}`, alice.token);
    expect(get.status).toBe(200);
    expect(get.body.bundle).toEqual(validBundle);

    // rotate: same user re-publishes, fetch returns the new value
    const rotated = { ...validBundle, spkPub: 'E'.repeat(44) };
    await authPut(env.app, '/api/e2ee/bundle', rotated, bob.token);
    const get2 = await authGet(env.app, `/api/e2ee/bundle/${bob.userId}`, alice.token);
    expect(get2.body.bundle.spkPub).toBe('E'.repeat(44));
  });
});

describe('uploads', () => {
  let env: TestEnv;
  let session: Session;

  beforeAll(async () => {
    env = await buildTestApp();
    const u = uniq('uploader');
    await registerUser(env.app, u);
    session = await loginUser(env.app, u);
  });

  it('accepts a small PNG avatar and returns whitelisted URL', async () => {
    // minimal 1x1 PNG
    const png = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082',
      'hex',
    );
    const res = await supertest(env.app)
      .post('/api/upload/avatar')
      .set('Authorization', `Bearer ${session.token}`)
      .attach('avatar', png, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(String(res.body.url)).toMatch(/^\/uploads\/avatars\//);
  });

  it('rejects non-image avatar payloads', async () => {
    const res = await supertest(env.app)
      .post('/api/upload/avatar')
      .set('Authorization', `Bearer ${session.token}`)
      .attach('avatar', Buffer.from('not an image'), { filename: 'a.txt', contentType: 'text/plain' });
    expect([400, 500]).toContain(res.status); // multer filter error surfaces as 500 via error middleware
  });

  it('accepts webm voice uploads onto the voice whitelist', async () => {
    const webm = Buffer.from('1a45dfa3', 'hex'); // EBML magic header bytes
    const res = await supertest(env.app)
      .post('/api/upload/voice')
      .set('Authorization', `Bearer ${session.token}`)
      .attach('voice', webm, { filename: 'v.webm', contentType: 'audio/webm' });
    expect(res.status).toBe(200);
    expect(String(res.body.url)).toMatch(/^\/uploads\/voice\//);
  });
});
