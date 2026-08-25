import { z } from 'zod';

/**
 * Plugin permission model. Every capability the host exposes must be declared
 * here; the host gates its API surface accordingly (deny-by-default).
 */
export const PluginPermissionSchema = z.enum([
  /** Observe incoming/outgoing message content (read-only view). */
  'messages:observe',
  /** Rewrite outgoing text before it leaves the composer. */
  'messages:transform',
  /** Register /slash commands shown in the composer. */
  'commands:register',
  /** Namespaced key/value settings storage. */
  'settings',
]);

export type PluginPermission = z.infer<typeof PluginPermissionSchema>;

export const PluginManifestSchema = z.object({
  /** Stable identifier, lowercase kebab-case. */
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().min(1).max(60),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[\w.]+)?$/),
  description: z.string().max(300).optional(),
  permissions: z.array(PluginPermissionSchema).default([]),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

/** Runtime view handed to a plugin for each observed message. */
export interface MessageView {
  scope: 'public' | 'private' | 'group';
  senderName: string;
  senderId: number;
  /** Decrypted text when available; omitted for voice/undecryptable rows. */
  body?: string;
}

export interface CommandContext {
  args: string;
  /** Reply rendered locally as an ephemeral notice. */
  reply(text: string): void;
}

export interface SettingsStore {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
}

/** API surface injected into `activate()` — gated by manifest permissions. */
export interface PluginApi {
  log(...parts: unknown[]): void;
  settings: SettingsStore;

  registerCommand(
    name: string,
    handler: (ctx: CommandContext) => void | string | Promise<void | string>,
  ): void;

  onMessageObserved(handler: (view: MessageView) => void): void;

  /**
   * Register an outgoing-text transformer. May return a rewritten string.
   * Only callable with the `messages:transform` permission.
   */
  registerOutgoingTransformer(
    handler: (text: string) => string | Promise<string>,
  ): void;
}

export interface TianshangPlugin {
  manifest: PluginManifest;
  activate(api: PluginApi): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}
