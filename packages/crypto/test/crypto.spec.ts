import { describe, expect, it } from 'vitest';
import { x25519, ed25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import {
  concatBytes,
  finalizeIdentity,
  generateIdentity,
  generateSignedPreKey,
  initAsInitiator,
  initAsResponder,
  sealWithRatchet,
  openWithRatchet,
  serializeRatchet,
  deserializeRatchet,
  x3dhInitiate,
  x3dhRespond,
  verifyBundle,
  generateSenderKey,
  senderKeyEncrypt,
  senderKeyDecrypt,
} from '../src/index.js';

const hex = (s: string) => Uint8Array.from(s.match(/.{2}/g)!.map((b) => parseInt(b, 16)));

describe('KAT: RFC 7748 §5.2 X25519 Diffie-Hellman', () => {
  it('derives the published shared secret', () => {
    const alicePriv = hex(
      '77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a',
    );
    const bobPub = hex(
      'de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f',
    );
    const shared = x25519.getSharedSecret(alicePriv, bobPub);
    expect(
      Buffer.from(shared).toString('hex'),
    ).toBe('4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742');
  });
});

describe('KAT: RFC 5869 HKDF-SHA256 Test Case 1', () => {
  it('matches published OKM', () => {
    const ikm = hex('0b'.repeat(22));
    const salt = hex('000102030405060708090a0b0c');
    const info = hex('f0f1f2f3f4f5f6f7f8f9');
    // noble hkdf(hash, ikm, salt, info, len)
    const okm = hkdf(sha256, ikm, salt, info, 42);
    expect(Buffer.from(okm).toString('hex')).toBe(
      '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865',
    );
  });
});

describe('X3DH + Double Ratchet interop', () => {
  function setup() {
    const alice = finalizeIdentity(generateIdentity());
    const bob = finalizeIdentity(generateIdentity());
    const spkB = generateSignedPreKey(bob.ed.priv);
    const bundle = { ikPub: bob.ik.pub, edPub: bob.ed.pub, spkPub: spkB.pub, spkSig: spkB.sig };
    const init = x3dhInitiate(alice.ik.priv, bundle);
    const ra = initAsInitiator(init.sk, spkB.pub);
    const skB = x3dhRespond(bob.ik.priv, spkB.priv, init.header);
    const rb = initAsResponder(skB, { priv: spkB.priv, pub: spkB.pub });
    return { ra, rb };
  }

  it('establishes a session and exchanges messages both directions', ({ }) => {
    const { ra, rb } = setup();
    const m1 = String(sealWithRatchet(ra, { t: 'text', body: 'hello' }));
    expect(m1.startsWith('e2ee:v1.')).toBe(true);
    expect(openWithRatchet(rb, m1).body).toBe('hello');

    const r1 = String(sealWithRatchet(rb, { t: 'text', body: 'reply' }));
    expect(openWithRatchet(ra, r1).body).toBe('reply');

    let log: string[] = [];
    let a = ra;
    let b = rb;
    for (let i = 0; i < 8; i++) {
      const from = i % 2 ? b : a;
      const to = i % 2 ? a : b;
      const env = String(sealWithRatchet(from, { t: 'text', body: `m${i}` }));
      log.push(openWithRatchet(to, env).body as string);
    }
    expect(log.join(',')).toBe('m0,m1,m2,m3,m4,m5,m6,m7');
  });

  it('survives state serialization round-trips mid-session', () => {
    const { ra, rb } = setup();
    void openWithRatchet(rb, String(sealWithRatchet(ra, { t: 'text', body: 'x' })));
    void openWithRatchet(ra, String(sealWithRatchet(rb, { t: 'text', body: 'y' })));
    const a2 = deserializeRatchet(serializeRatchet(ra));
    const b2 = deserializeRatchet(serializeRatchet(rb));
    expect(openWithRatchet(b2, String(sealWithRatchet(a2, { t: 'text', body: 'z' }))).body).toBe('z');
    expect(openWithRatchet(a2, String(sealWithRatchet(b2, { t: 'text', body: 'w' }))).body).toBe('w');
  });

  it('handles out-of-order delivery via skipped message keys', () => {
    const { ra, rb } = setup();
    void openWithRatchet(rb, String(sealWithRatchet(ra, { t: 'text', body: 'seed' })));
    void openWithRatchet(ra, String(sealWithRatchet(rb, { t: 'text', body: 'ack' })));
    const e = [
      String(sealWithRatchet(ra, { t: 'text', body: 'o1' })),
      String(sealWithRatchet(ra, { t: 'text', body: 'o2' })),
      String(sealWithRatchet(ra, { t: 'text', body: 'o3' })),
    ];
    expect(openWithRatchet(rb, e[2]).body).toBe('o3');
    expect(openWithRatchet(rb, e[1]).body).toBe('o2');
    expect(openWithRatchet(rb, e[0]).body).toBe('o1');
  });

  it('rejects tampered ciphertext (GCM tag)', () => {
    const { ra, rb } = setup();
    void openWithRatchet(rb, String(sealWithRatchet(ra, { t: 'text', body: 'seed' })));
    const env = String(sealWithRatchet(ra, { t: 'text', body: 'tamper' }));
    const flipped = env.endsWith('AA') ? `${env.slice(0, -2)}AB` : `${env.slice(0, -2)}AA`;
    expect(() => openWithRatchet(rb, flipped)).toThrow();
  });

  it('rejects bundles with invalid prekey signatures', () => {
    const alice = finalizeIdentity(generateIdentity());
    const bob = finalizeIdentity(generateIdentity());
    const spkB = generateSignedPreKey(bob.ed.priv);
    const badSig = Uint8Array.from(spkB.sig);
    badSig[0] = (badSig[0] as number) ^ 0xff;
    expect(
      verifyBundle({ ikPub: bob.ik.pub, edPub: bob.ed.pub, spkPub: spkB.pub, spkSig: badSig }),
    ).toBe(false);
    void alice;
  });
});

describe('Sender Keys', () => {
  it('round-trips and rejects counter/IV mismatch', () => {
    const seedState = generateSenderKey();
    const msg = senderKeyEncrypt(seedState, new TextEncoder().encode('group-hi'));
    const plain = senderKeyDecrypt(seedState.seed, msg.counter, msg.iv, msg.ciphertext);
    expect(new TextDecoder().decode(plain)).toBe('group-hi');

    expect(() =>
      senderKeyDecrypt(seedState.seed, msg.counter + 1, msg.iv, msg.ciphertext),
    ).toThrow();
  });

  it('supports deterministic multi-counter fan-out', () => {
    const s = generateSenderKey();
    const a = senderKeyEncrypt(s, new TextEncoder().encode('one'));
    const b = senderKeyEncrypt(s, new TextEncoder().encode('two'));
    expect(a.counter).toBe(0);
    expect(b.counter).toBe(1);
    expect(new TextDecoder().decode(senderKeyDecrypt(s.seed, b.counter, b.iv, b.ciphertext))).toBe('two');
  });
});
