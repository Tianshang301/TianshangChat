// TianshangChat sample plugin: AI assistant over an OpenAI-compatible endpoint.
// Works out of the box with Ollama (`OLLAMA_ORIGINS=* ollama serve`) and with
// any /v1/chat/completions provider. Keys/URL live in plugin settings storage
// on this device only — never sent to the chat server.

export const manifest = {
  id: 'ai-assistant',
  name: 'AI 助手',
  version: '1.0.0',
  description:
    '/ai <提问> 与 /translate <文本>：调用本地 Ollama 或任意 OpenAI 兼容端点。默认 http://127.0.0.1:11434/v1（模型 llama3.2），可在设置存储中覆盖。',
  permissions: ['commands:register', 'settings'],
};

let baseUrl = 'http://127.0.0.1:11434/v1';
let model = 'llama3.2';
let apiKey = '';

async function chat(prompt) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`endpoint ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '(空回复)';
}

export async function activate(api) {
  baseUrl = api.settings.get('baseUrl', baseUrl);
  model = api.settings.get('model', model);
  apiKey = api.settings.get('apiKey', '');

  api.registerCommand('ai', async (ctx) => {
    if (!ctx.args.trim()) return '用法：/ai <提问>';
    try {
      return await chat(ctx.args.trim());
    } catch (e) {
      return `AI 调用失败：${e.message}（检查端点 ${baseUrl} 是否可达、浏览器是否允许跨域）`;
    }
  });

  api.registerCommand('translate', async (ctx) => {
    if (!ctx.args.trim()) return '用法：/translate <文本>（自动中英互译）';
    const text = ctx.args.trim();
    const isMostlyChinese = /[\u4e00-\u9fff]/.test(text);
    const target = isMostlyChinese ? 'English' : '简体中文';
    try {
      return await chat(`请将下面的内容翻译成${target}，只输出译文：\n${text}`);
    } catch (e) {
      return `翻译失败：${e.message}`;
    }
  });

  api.log('ready', { baseUrl, model });
}

export async function deactivate() {
  /* nothing to clean up */
}
