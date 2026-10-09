/**
 * AI Provider Abstraction Layer
 * ─────────────────────────────
 * To switch AI providers, change AI_PROVIDER env var in Vercel:
 *   AI_PROVIDER=claude   → uses Anthropic Claude
 *   AI_PROVIDER=deepseek → uses DeepSeek
 *   AI_PROVIDER=openai   → uses OpenAI GPT
 *
 * Then add the corresponding API key:
 *   ANTHROPIC_API_KEY   for Claude
 *   DEEPSEEK_API_KEY    for DeepSeek
 *   OPENAI_API_KEY      for OpenAI
 *
 * Nothing else in the codebase needs to change.
 */

const PROVIDERS = {
  claude: {
    url: "https://api.anthropic.com/v1/messages",
    model: "claude-haiku-4-5-20251001",
    buildHeaders: (key) => ({
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    }),
    buildBody: (prompt, maxTokens, model) => JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
    parseResponse: (data) => {
      if (data.error) throw new Error(data.error.message);
      return (data.content || []).map(b => b.text || "").join("").trim();
    },
  },

  deepseek: {
    url: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
    buildHeaders: (key) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    }),
    buildBody: (prompt, maxTokens, model) => JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
    parseResponse: (data) => {
      if (data.error) throw new Error(data.error.message);
      return data.choices?.[0]?.message?.content?.trim() || "";
    },
  },

  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    buildHeaders: (key) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    }),
    buildBody: (prompt, maxTokens, model) => JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
    parseResponse: (data) => {
      if (data.error) throw new Error(data.error.message);
      return data.choices?.[0]?.message?.content?.trim() || "";
    },
  },
};

/**
 * Call the configured AI provider
 * @param {string} prompt
 * @param {number} maxTokens
 * @returns {Promise<string>} raw text response
 */
export async function callAI(prompt, maxTokens = 1200) {
  const providerName = (process.env.AI_PROVIDER || "claude").toLowerCase();
  const provider = PROVIDERS[providerName];

  if (!provider) throw new Error(`Unknown AI provider: ${providerName}`);

  // Pick the right API key
  const keyMap = {
    claude: process.env.ANTHROPIC_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  };
  const apiKey = keyMap[providerName];
  if (!apiKey) throw new Error(`Missing API key for provider: ${providerName}`);

  // Allow model override via env (e.g. AI_MODEL=claude-sonnet-4-5-20251001)
  const model = process.env.AI_MODEL || provider.model;

  const res = await fetch(provider.url, {
    method: "POST",
    headers: provider.buildHeaders(apiKey),
    body: provider.buildBody(prompt, maxTokens, model),
  });

  const data = await res.json();
  return provider.parseResponse(data);
}
