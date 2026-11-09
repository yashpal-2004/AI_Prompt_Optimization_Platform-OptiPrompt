export type OptimizationMode = 'cheap' | 'quality' | 'extreme';
export type ProviderName = 'groq' | 'gemini';

export interface ProviderUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
}

export interface OptimizationResponse {
  optimizedPrompt: string;
  provider: ProviderName;
  model: string;
  usage: ProviderUsage;
  latencyMs: number;
}

interface OptimizeOptions {
  prompt: string;
  mode: OptimizationMode;
  groqKeys: string[];
  geminiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const PRICE_PER_MILLION: Record<ProviderName, { input: number; output: number }> = {
  groq: { input: 0.15, output: 0.6 },
  gemini: { input: 0.75, output: 3.75 },
};

export function estimateProviderCostUsd(
  provider: ProviderName,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  if (inputTokens === null || outputTokens === null) return null;
  const price = PRICE_PER_MILLION[provider];
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

export function getSystemInstruction(mode: OptimizationMode): string {
  const instructions: Record<OptimizationMode, string> = {
    extreme: 'Rewrite this prompt in a highly compact form. Remove filler while preserving all requirements and meaning. Return only the rewritten prompt.',
    cheap: 'Rewrite this prompt as concisely as possible while preserving its requirements and meaning. Return only the rewritten prompt.',
    quality: 'Improve this prompt for clarity, structure, and professional tone. Preserve all technical details and intent. Return only the refined prompt.',
  };
  return instructions[mode];
}

async function fetchJson(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ response: Response; payload: any }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
}

function countOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function safeProviderMessage(payload: any, fallback: string): string {
  const message = payload?.error?.message ?? payload?.message;
  if (typeof message !== 'string') return fallback;
  // Keep actionable provider diagnostics while ensuring credentials never reach the UI.
  return message.replace(/(key|authorization|token)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]').slice(0, 180);
}

function toResult(
  provider: ProviderName,
  model: string,
  optimizedPrompt: unknown,
  inputTokensValue: unknown,
  outputTokensValue: unknown,
  startedAt: number,
): OptimizationResponse | null {
  if (typeof optimizedPrompt !== 'string' || !optimizedPrompt.trim()) return null;
  const inputTokens = countOrNull(inputTokensValue);
  const outputTokens = countOrNull(outputTokensValue);
  const totalTokens = inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null;
  return {
    optimizedPrompt: optimizedPrompt.trim(),
    provider,
    model,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCostUsd: estimateProviderCostUsd(provider, inputTokens, outputTokens),
    },
    latencyMs: Date.now() - startedAt,
  };
}

export async function optimizeWithProviders(options: OptimizeOptions): Promise<OptimizationResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const instruction = getSystemInstruction(options.mode);
  const prompt = options.prompt.trim();
  const failures: string[] = [];

  for (const [index, apiKey] of options.groqKeys.entries()) {
    if (!apiKey) continue;
    const startedAt = Date.now();
    try {
      const { response, payload } = await fetchJson(fetchImpl, 'https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: instruction },
            { role: 'user', content: `Prompt: ${prompt}` },
          ],
          max_tokens: 4096,
        }),
      }, timeoutMs);
      if (!response.ok) {
        failures.push(`Groq (${GROQ_MODEL}): ${safeProviderMessage(payload, `HTTP ${response.status}`)}`);
        continue;
      }
      const result = toResult(
        'groq', GROQ_MODEL, payload?.choices?.[0]?.message?.content,
        payload?.usage?.prompt_tokens, payload?.usage?.completion_tokens, startedAt,
      );
      if (result) return result;
      failures.push(`Groq key ${index + 1}: empty response`);
    } catch (error) {
      failures.push(`Groq key ${index + 1}: ${error instanceof Error && error.name === 'AbortError' ? 'request timed out' : 'provider unavailable'}`);
    }
  }

  if (options.geminiKey) {
    const startedAt = Date.now();
    try {
      const { response, payload } = await fetchJson(fetchImpl,
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.geminiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: instruction }] },
            contents: [{ role: 'user', parts: [{ text: `Prompt: ${prompt}` }] }],
            generationConfig: { maxOutputTokens: 4096 },
          }),
        }, timeoutMs);
      if (!response.ok) {
        failures.push(`Gemini (${GEMINI_MODEL}): ${safeProviderMessage(payload, `HTTP ${response.status}`)}`);
      } else {
        const text = payload?.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part.text ?? '').join('');
        const result = toResult(
          'gemini', GEMINI_MODEL, text,
          payload?.usageMetadata?.promptTokenCount,
          payload?.usageMetadata?.candidatesTokenCount,
          startedAt,
        );
        if (result) return result;
        failures.push('Gemini: empty response');
      }
    } catch (error) {
      failures.push(`Gemini: ${error instanceof Error && error.name === 'AbortError' ? 'request timed out' : 'provider unavailable'}`);
    }
  }

  throw new Error(failures.length ? failures.join('; ') : 'No AI provider is configured');
}
