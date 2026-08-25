import 'fake-indexeddb/auto';

// jsdom-free environment: tests only rely on IndexedDB + WebCrypto (Node 20+
// provides globalThis.crypto.subtle) and btoa/atob (Node >= 16).
