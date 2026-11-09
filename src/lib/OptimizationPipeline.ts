/**
 * OptiPrompt — Full 6-Stage Prompt Optimization Pipeline
 *
 * Stage 1: Rule Cleaner       — removes fillers, replaces verbose phrases
 * Stage 2: Context Reducer    — strips redundant preamble, preserves technical context
 * Stage 3: Template Formatter — detects prompt type, adds structure hint (quality/cheap only)
 * Stage 4: Output Controller  — adds output constraints; skipped if constraint already present
 * Stage 5: Cache Check        — returns cached result if normalized prompt was seen before
 * Stage 6: LLM Compressor     — (caller-supplied async hook) semantic compression via LLM
 *
 * Stage order fix: Context Reducer runs BEFORE Template Formatter so the
 * format hint is never appended to pre-stripped preamble text, and Output
 * Controller runs last so it can see the hint added in Stage 3 and avoid
 * double-constraining in cheap mode.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1 — Rule Cleaner
// ─────────────────────────────────────────────────────────────────────────────

const FILLER_PATTERNS: RegExp[] = [
  /\b(please|kindly|if you don'?t mind|if possible)\b/gi,
  /\b(very|really|quite|extremely|absolutely|totally|completely|deeply|highly)\b/gi,
  /\b(basically|essentially|generally speaking|as a matter of fact)\b/gi,
  /\b(go ahead and|feel free to|don'?t hesitate to|make sure to|be sure to)\b/gi,
  /\b(just|simply|merely|only just)\b/gi,
  /\b(in a (?:detailed|comprehensive|thorough) (?:manner|way|fashion))\b/gi,
];

// Each tuple: [pattern, replacement]
// IMPORTANT: capture groups are non-optional — $1/$2 always resolve.
// Patterns are ordered longest-match first to avoid partial rewrites.
const PHRASE_REPLACEMENTS: [RegExp, string][] = [
  [/\bin order to\b/gi, 'to'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\bat (?:the present time|this point in time)\b/gi, 'now'],
  [/\bin the event that\b/gi, 'if'],
  [/\bwith (?:regard|respect) to\b/gi, 'about'],
  [/\bfor the purpose of\b/gi, 'for'],
  [/\bin spite of the fact that\b/gi, 'although'],
  [/\ba large number of\b/gi, 'many'],
  [/\ba wide variety of\b/gi, 'various'],
  [/\b(?:make?|making) a decision\b/gi, 'decide'],
  [/\bgive consideration to\b/gi, 'consider'],
  [/\btake into consideration\b/gi, 'consider'],
  [/\b(?:provide|give me) information about\b/gi, 'explain'],
  [/\btell me about\b/gi, 'explain'],
  // Imperative rewrites — group 1 is the verb, always present
  [/\b(?:can|could|would) you(?: please)? (explain|tell|describe|write|help)\b/gi, '$1'],
  // "i would like to X" / "i want to X" — group 2 is the verb, always present
  [/\bi (?:would like|want)(?: you)? to (explain|know|understand|get|learn)\b/gi, '$1'],
  // "can you help me understand" — group 1 is the verb, always present
  [/\bcan you help me (?:with |to )?(understand|learn|figure out)\b/gi, '$1'],
];

export function runRuleCleaner(text: string): string {
  let result = text;

  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }

  for (const pattern of FILLER_PATTERNS) {
    result = result.replace(pattern, '');
  }

  // Collapse multiple spaces introduced by deletions
  result = result.replace(/\s{2,}/g, ' ').trim();

  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2 — Context Reducer  (moved before Template Formatter)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strips redundant lead-in preamble while PRESERVING technical context sentences.
 *
 * Old behaviour: dropped any sentence without a question word, which destroyed
 * context like "I'm building a REST API. It uses JWT auth. How do I refresh tokens?"
 *
 * New behaviour: only removes the final sentence if it's a self-contained
 * question that fully re-states what came before, and strips known boilerplate
 * lead-ins at the start.
 */
export function runContextReducer(text: string): string {
  let result = text;

  // Strip known boilerplate lead-ins (only at the very start)
  const PREAMBLE_PATTERNS: RegExp[] = [
    /^I need(?: your)? help(?: with| on| regarding)?(?: the following)?:?\s*/i,
    /^My (?:question|query|request) is:?\s*/i,
    /^The (?:question|task|problem) is:?\s*/i,
    /^Here is my (?:question|prompt|request):?\s*/i,
    /^I have a (?:question|problem|request)(?: for you)?:?\s*/i,
    /^(?:So,?\s+)?I was wondering(?: if you could)?:?\s*/i,
  ];

  for (const pattern of PREAMBLE_PATTERNS) {
    result = result.replace(pattern, '');
  }

  // Capitalize after stripping preamble
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  return result.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 3 — Template Formatter
// ─────────────────────────────────────────────────────────────────────────────

export type PromptType =
  | 'explanation'
  | 'list'
  | 'comparison'
  | 'code'
  | 'summary'
  | 'creative'
  | 'generic';

export type OptimizationMode = 'cheap' | 'quality' | 'extreme';

export function detectPromptType(text: string): PromptType {
  const lower = text.toLowerCase();
  if (
    /\b(write|create|generate|build|make|code|implement|program)\b/.test(lower) &&
    /\b(function|class|api|component|script|code)\b/.test(lower)
  )
    return 'code';
  if (/\b(compare|versus|vs\.?|difference|similarities|pros and cons)\b/.test(lower))
    return 'comparison';
  if (/\b(list|enumerate|what are|give me|name the|top \d+)\b/.test(lower)) return 'list';
  if (/\b(summarize|summary|tl;?dr|brief|overview)\b/.test(lower)) return 'summary';
  if (/\b(write|create|story|poem|essay|blog|article|creative)\b/.test(lower)) return 'creative';
  if (/\b(explain|what is|how does|why|describe|define|understand)\b/.test(lower))
    return 'explanation';
  return 'generic';
}

function templateFormatHint(type: PromptType, mode: OptimizationMode): string {
  if (mode === 'extreme') return ''; // extreme: raw compression only, no hints

  // cheap mode gets tighter hints than quality
  const hints: Record<PromptType, { quality: string; cheap: string }> = {
    explanation: { quality: ' Explain concisely.', cheap: ' Explain in 2-3 sentences.' },
    list: { quality: ' List the key points.', cheap: ' List up to 5 bullet points.' },
    comparison: {
      quality: ' Compare concisely.',
      cheap: ' Compare in 3-4 bullet points.',
    },
    code: {
      quality: ' Return clean code with brief comments.',
      cheap: ' Return minimal code only.',
    },
    summary: { quality: ' Summarize concisely.', cheap: ' Summarize in 2 sentences.' },
    creative: { quality: ' Be creative and concise.', cheap: ' Keep under 100 words.' },
    generic: { quality: '', cheap: ' Be concise.' },
  };

  return hints[type][mode] ?? '';
}

export function runTemplateFormatter(
  text: string,
  mode: OptimizationMode,
): { formatted: string; type: PromptType } {
  const type = detectPromptType(text);
  const hint = templateFormatHint(type, mode);
  const alreadyConstrained =
    /\b\d+\s*(sentences?|words?|bullets?|points?|paragraphs?|lines?)\b/i.test(text) ||
    /\b(concisely|minimal(ly)?|brief(ly)?|short)\b/i.test(text);
  return { formatted: alreadyConstrained ? text : text + hint, type };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 4 — Output Controller
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Appends hard output constraints only when none are already present.
 * Runs AFTER Template Formatter so it can see the hint added in Stage 3
 * and avoid double-constraining in cheap mode.
 */
export function runOutputController(
  text: string,
  mode: OptimizationMode,
  type: PromptType,
): string {
  // Detect existing length constraints (from user or from Stage 3 hint)
  const hasConstraint =
    /\b\d+\s*(sentences?|words?|bullets?|points?|paragraphs?|lines?)\b/i.test(text) ||
    /\b(concisely|minimal(ly)?|brief(ly)?|short)\b/i.test(text);

  if (hasConstraint) return text;

  if (mode === 'extreme') {
    return text + ' Max 50 words.';
  }

  if (mode === 'cheap') {
    const constraints: Record<PromptType, string> = {
      explanation: ' Answer in 2 sentences.',
      list: ' List max 5 items.',
      comparison: ' Max 3 differences.',
      code: ' Minimal code only.',
      summary: ' One paragraph.',
      creative: ' Under 100 words.',
      generic: ' Be concise.',
    };
    return text + (constraints[type] ?? ' Be concise.');
  }

  return text; // quality mode: don't artificially constrain output
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 5 — Cache
// ─────────────────────────────────────────────────────────────────────────────

const pipelineCache = new Map<string, string>();

/**
 * Normalize a prompt for cache keying: lowercase, collapse whitespace, strip
 * leading/trailing punctuation.  Two prompts that differ only in case or
 * extra spaces will now share a cache entry.
 */
function normalizeCacheKey(mode: OptimizationMode, text: string): string {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  return `${mode}::${normalized}`;
}

export function getCached(
  mode: OptimizationMode,
  rawPrompt: string,
): string | undefined {
  return pipelineCache.get(normalizeCacheKey(mode, rawPrompt));
}

export function setCached(
  mode: OptimizationMode,
  rawPrompt: string,
  value: string,
): void {
  pipelineCache.set(normalizeCacheKey(mode, rawPrompt), value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineStageResult {
  stage: string;
  input: string;
  output: string;
  tokensBefore: number;
  tokensAfter: number;
  /** Positive = saved tokens; negative = tokens added (e.g. a format hint). */
  delta: number;
}

export interface PipelineResult {
  finalPrompt: string;
  stages: PipelineStageResult[];
  cacheHit: boolean;
  promptType: PromptType;
  /** Net tokens saved across the full pipeline (may be negative if hints were added). */
  totalDelta: number;
}

/**
 * Optional async hook for Stage 6 (LLM Compressor).
 * Callers supply their own implementation; the pipeline calls it when present.
 * Return the compressed prompt string, or throw to fall back to the pre-LLM result.
 *
 * Example implementation using a Groq/OpenAI-compatible API:
 *
 *   const llmCompressor: LLMCompressor = async (prompt) => {
 *     const res = await fetch('https://api.groq.com/openai/v1/chat/completions', { ... });
 *     const json = await res.json();
 *     return json.choices[0].message.content.trim();
 *   };
 */
export type LLMCompressor = (prompt: string) => Promise<string>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Rough token estimate: ~4 chars per token (GPT-style). */
function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function makeStage(stage: string, input: string, output: string): PipelineStageResult {
  const tokensBefore = countTokens(input);
  const tokensAfter = countTokens(output);
  return {
    stage,
    input,
    output,
    tokensBefore,
    tokensAfter,
    delta: tokensBefore - tokensAfter, // positive = saved, negative = added
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Pipeline Runner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs the full pre-LLM optimization pipeline and (optionally) Stage 6.
 *
 * Stage order: Cache → Rule Cleaner → Context Reducer → Template Formatter
 *              → Output Controller → (LLM Compressor) → Cache Write
 */
export async function runPipeline(
  rawPrompt: string,
  mode: OptimizationMode,
  llmCompressor?: LLMCompressor,
  forceReoptimize = false,
): Promise<PipelineResult> {
  const stages: PipelineStageResult[] = [];

  // Stage 5 — Cache read (before any processing)
  // Skip if caller explicitly wants a fresh optimization pass
  const cached = getCached(mode, rawPrompt);
  if (cached && !forceReoptimize) {
    return {
      finalPrompt: cached,
      stages: [],
      cacheHit: true,
      promptType: 'generic',
      totalDelta: 0,
    };
  }

  // Stage 1 — Rule Cleaner
  const afterRules = runRuleCleaner(rawPrompt);
  stages.push(makeStage('Rule Cleaner', rawPrompt, afterRules));

  // Stage 2 — Context Reducer (now before Template Formatter)
  const afterContext = runContextReducer(afterRules);
  stages.push(makeStage('Context Reducer', afterRules, afterContext));

  // Stage 3 — Template Formatter
  const { formatted: afterTemplate, type: promptType } = runTemplateFormatter(
    afterContext,
    mode,
  );
  stages.push(makeStage('Template Formatter', afterContext, afterTemplate));

  // Stage 4 — Output Controller (sees Stage 3 hint, avoids double-constraining)
  const afterOutput = runOutputController(afterTemplate, mode, promptType);
  stages.push(makeStage('Output Controller', afterTemplate, afterOutput));

  let finalPrompt = afterOutput;

  // Stage 6 — LLM Compressor (optional, caller-supplied)
  if (llmCompressor) {
    try {
      const compressed = await llmCompressor(finalPrompt);
      if (compressed && compressed.length > 0) {
        stages.push(makeStage('LLM Compressor', finalPrompt, compressed));
        finalPrompt = compressed;
      }
    } catch (err) {
      // Graceful degradation: log and continue with pre-LLM result
      console.warn('[OptiPrompt] Stage 6 LLM Compressor failed, using pre-LLM result.', err);
    }
  }

  // Stage 5 — Cache write (after all processing)
  setCached(mode, rawPrompt, finalPrompt);

  const totalDelta = stages.reduce((sum, s) => sum + s.delta, 0);

  return { finalPrompt, stages, cacheHit: false, promptType, totalDelta };
}

/**
 * Synchronous convenience wrapper for callers that don't use Stage 6.
 * Identical to `runPipeline` with no `llmCompressor` argument, but avoids
 * the async overhead / Promise unwrapping for simple use cases.
 */
export function runPreLLMPipeline(
  rawPrompt: string,
  mode: OptimizationMode,
  forceReoptimize = false,
): Omit<PipelineResult, 'totalDelta'> & { totalDelta: number } {
  const stages: PipelineStageResult[] = [];

  const cached = getCached(mode, rawPrompt);
  if (cached && !forceReoptimize) {
    return { finalPrompt: cached, stages: [], cacheHit: true, promptType: 'generic', totalDelta: 0 };
  }

  const afterRules = runRuleCleaner(rawPrompt);
  stages.push(makeStage('Rule Cleaner', rawPrompt, afterRules));

  const afterContext = runContextReducer(afterRules);
  stages.push(makeStage('Context Reducer', afterRules, afterContext));

  const { formatted: afterTemplate, type: promptType } = runTemplateFormatter(afterContext, mode);
  stages.push(makeStage('Template Formatter', afterContext, afterTemplate));

  const afterOutput = runOutputController(afterTemplate, mode, promptType);
  stages.push(makeStage('Output Controller', afterTemplate, afterOutput));

  setCached(mode, rawPrompt, afterOutput);

  const totalDelta = stages.reduce((sum, s) => sum + s.delta, 0);
  return { finalPrompt: afterOutput, stages, cacheHit: false, promptType, totalDelta };
}
