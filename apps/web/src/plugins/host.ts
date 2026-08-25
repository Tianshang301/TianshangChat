import {
  PluginManifestSchema,
  type CommandContext,
  type MessageView,
  type PluginApi,
  type PluginManifest,
  type TianshangPlugin,
} from '@tianshangchat/plugins-sdk';

/**
 * In-page plugin host. Plugins are ES modules loaded from `/plugins/<entry>`;
 * they receive a permission-gated API surface (see packages/plugins-sdk).
 *
 * Sandbox honesty: same-origin page plugins execute with full page privileges —
 * the permission system guards the OFFICIAL host API, not the raw platform.
 * Untrusted third-party code must run in an iframe/worker sandbox (future work).
 */

export interface LoadedPlugin {
  manifest: PluginManifest;
  enabled: boolean;
  error?: string;
}

interface RegisteredCommand {
  pluginId: string;
  handler: (ctx: CommandContext) => void | string | Promise<void | string>;
}

const ENABLED_KEY = 'plugins:enabled';
const registryUrl = '/plugins/registry.json';

const commands = new Map<string, RegisteredCommand>();
const observers: Array<{ pluginId: string; fn: (v: MessageView) => void }> = [];
const transformers: Array<{ pluginId: string; fn: (t: string) => string | Promise<string> }> = [];
interface LoadedEntry {
  manifest: PluginManifest;
  instance?: TianshangPlugin;
  enabled?: boolean;
  error?: string;
}
const loaded = new Map<string, LoadedEntry>();

function readEnabled(): Set<string> {
  try {
    const raw = localStorage.getItem(ENABLED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeEnabled(set: Set<string>): void {
  localStorage.setItem(ENABLED_KEY, JSON.stringify([...set]));
}

export function isPluginEnabled(id: string): boolean {
  return readEnabled().has(id);
}

export function setPluginEnabled(id: string, enabled: boolean): void {
  const set = readEnabled();
  if (enabled) set.add(id);
  else set.delete(id);
  writeEnabled(set);
}

export function listCommands(): Array<{ name: string; pluginId: string }> {
  return [...commands.entries()].map(([name, c]) => ({ name, pluginId: c.pluginId }));
}

export function listLoadedPlugins(): LoadedPlugin[] {
  return [...loaded.values()].map((p) => ({
    manifest: p.manifest,
    enabled: isPluginEnabled(p.manifest.id),
  }));
}

export async function runCommand(raw: string, replyText: (t: string) => void): Promise<boolean> {
  if (!raw.startsWith('/')) return false;
  const [name, ...rest] = raw.slice(1).split(' ');
  const cmd = commands.get(name ?? '');
  if (!cmd) return false;
  const ctx: CommandContext = { args: rest.join(' '), reply: replyText };
  const result = await cmd.handler(ctx);
  if (typeof result === 'string') replyText(result);
  return true;
}

export function observeOutgoing(text: string): Promise<string> {
  let out = text;
  return (async () => {
    for (const t of transformers) {
      out = await t.fn(out);
    }
    return out;
  })();
}

export function emitObserved(view: MessageView): void {
  for (const o of observers) {
    try {
      o.fn(view);
    } catch (err) {
      console.warn(`[plugin:${o.pluginId}] observer threw`, err);
    }
  }
}

/** Loads the registry and activates enabled plugins. Safe to call once per app boot. */
export async function initPlugins(): Promise<LoadedPlugin[]> {
  commands.clear();
  observers.length = 0;
  transformers.length = 0;
  loaded.clear();

  let registry: Array<{ id: string; entry: string; enabled?: boolean }> = [];
  try {
    const res = await fetch(registryUrl);
    registry = (await res.json()) as typeof registry;
  } catch (err) {
    console.warn('[plugins] registry unavailable:', err);
    return [];
  }

  for (const item of registry) {
    try {
      const mod = (await import(/* @vite-ignore */ item.entry)) as Record<string, unknown>;
      const candidate = {
        manifest: mod['manifest'],
        activate: mod['activate'],
        deactivate: mod['deactivate'],
      } as unknown as TianshangPlugin;

      const manifest = PluginManifestSchema.parse(candidate.manifest);
      const enabled = item.enabled === true || isPluginEnabled(manifest.id);

      const perms = new Set(manifest.permissions);
      const api: PluginApi = {
        log: (...parts: unknown[]) => console.log(`[plugin:${manifest.id}]`, ...parts),
        settings: {
          get<T>(key: string, fallback: T): T {
            if (!perms.has('settings')) throw new Error('permission denied: settings');
            const raw = localStorage.getItem(`plugin:${manifest.id}:${key}`);
            return raw === null ? fallback : (JSON.parse(raw) as T);
          },
          set<T>(key: string, value: T): void {
            if (!perms.has('settings')) throw new Error('permission denied: settings');
            localStorage.setItem(`plugin:${manifest.id}:${key}`, JSON.stringify(value));
          },
        },
        registerCommand(name: string, handler: Parameters<PluginApi['registerCommand']>[1]) {
          if (!perms.has('commands:register')) throw new Error('permission denied: commands');
          commands.set(name.replace(/^\//, ''), { pluginId: manifest.id, handler });
        },
        onMessageObserved(fn) {
          if (!perms.has('messages:observe')) throw new Error('permission denied: messages:observe');
          observers.push({ pluginId: manifest.id, fn });
        },
        registerOutgoingTransformer(fn) {
          if (!perms.has('messages:transform')) {
            throw new Error('permission denied: messages:transform');
          }
          transformers.push({ pluginId: manifest.id, fn });
        },
      };

      await candidate.activate(api);
      loaded.set(manifest.id, { manifest, instance: candidate, enabled });
    } catch (err) {
      console.warn(`[plugins] failed to load "${item.id}":`, err);
      const partial = PluginManifestSchema.safeParse({});
      void partial;
      // Surface a stub so Settings can show the failure.
      loaded.set(item.id, {
        manifest: {
          id: item.id,
          name: item.id,
          version: '0.0.0',
          permissions: [],
        },
        enabled: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return listLoadedPlugins();
}
