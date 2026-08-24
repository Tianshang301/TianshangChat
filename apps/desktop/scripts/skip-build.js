// electron-builder packaging is an explicit release action, not part of the
// default turbo `build` pipeline (it downloads platform binaries from GitHub).
console.log('[desktop] packaging skipped; run: pnpm --filter @tianshangchat/desktop build:win');
