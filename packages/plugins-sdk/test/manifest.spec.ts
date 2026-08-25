import { describe, expect, it } from 'vitest';
import { PluginManifestSchema } from '../src/plugin';

describe('plugin manifest schema', () => {
  it('accepts a valid manifest with defaults applied', () => {
    const parsed = PluginManifestSchema.parse({
      id: 'ai-assistant',
      name: 'AI Assistant',
      version: '1.0.0',
    });
    expect(parsed.permissions).toEqual([]);
  });

  it('rejects malformed ids and versions', () => {
    expect(
      PluginManifestSchema.safeParse({ id: 'Bad_Id', name: 'x', version: '1.0.0' }).success,
    ).toBe(false);
    expect(
      PluginManifestSchema.safeParse({ id: 'ok-id', name: 'x', version: '1' }).success,
    ).toBe(false);
  });

  it('rejects unknown permissions', () => {
    expect(
      PluginManifestSchema.safeParse({
        id: 'ok',
        name: 'x',
        version: '1.0.0',
        permissions: ['filesystem:write'],
      }).success,
    ).toBe(false);
  });
});
