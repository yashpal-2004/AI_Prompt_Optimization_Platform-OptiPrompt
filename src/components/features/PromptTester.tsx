import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Sparkles, Loader2, Info, Copy, Check, RotateCcw, AlertCircle, Activity, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from "sonner";
import { useCurrency } from '../../lib/CurrencyContext';
import { auth } from '../../firebase';
import { runPreLLMPipeline, setCached, PipelineResult } from '../../lib/OptimizationPipeline';

interface OptimizationResult {
  originalPrompt: string;
  optimizedPrompt: string;
  originalTokens: number;
  optimizedTokens: number;
  tokensSaved: number;
  costSaved: number;
  optimizedCost: number | null;
  apiInputTokens: number | null;
  apiOutputTokens: number | null;
  latencyMs: number;
  provider: string;
  mode: 'cheap' | 'quality' | 'extreme';
  model: string;
}

interface OptimizerResponse {
  optimizedPrompt: string;
  provider: 'groq' | 'gemini';
  model: string;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
    estimatedCostUsd: number | null;
  };
  latencyMs: number;
}

function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 px-4 py-2.5 bg-gray-900/95 backdrop-blur-md text-white text-[11px] font-medium rounded-xl shadow-2xl w-56 text-center pointer-events-none border border-white/10"
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-gray-900/95" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function estimatePromptTokens(text: string): number {
  // Approximate only: character-based estimates vary by language and tokenizer.
  return Math.ceil(text.length / 4);
}

function NeuralOptimizerLoader() {
  const steps = [
    { label: 'STAGE 1', text: 'Analyzing semantic structure' },
    { label: 'STAGE 2', text: 'Collapsing redundant context' },
    { label: 'STAGE 3', text: 'Injecting intelligence vectors' },
    { label: 'STAGE 4', text: 'Finalizing neural compression' }
  ];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % steps.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 w-full max-w-sm mx-auto pointer-events-none">
      <div className="w-full space-y-8">
        {/* Progress System */}
        <div className="relative h-[2px] w-full bg-black/5 overflow-hidden">
          <motion.div 
            initial={{ left: '-100%' }}
            animate={{ left: '100%' }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-red to-transparent opacity-50"
          />
          <motion.div 
            animate={{ width: `${(step + 1) * 25}%` }}
            transition={{ duration: 0.5 }}
            className="absolute top-0 bottom-0 left-0 bg-red"
          />
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-4">
             {steps.map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                   <div className={cn(
                     "w-1.5 h-1.5 transition-all duration-500",
                     step >= i ? "bg-red rotate-45" : "bg-black/10"
                   )} />
                   {i < steps.length - 1 && <div className="w-8 h-[1px] bg-black/5" />}
                </div>
             ))}
          </div>

          <div className="text-center">
            <motion.div
              key={`label-${step}`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] font-black text-black uppercase tracking-[0.4em] mb-2"
            >
              {steps[step].label}
            </motion.div>
            <motion.p
              key={`text-${step}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[11px] font-bold text-black/40 uppercase tracking-widest italic"
            >
              {steps[step].text}...
            </motion.p>
          </div>
        </div>

        {/* Binary Stream */}
        <div className="flex justify-center gap-2 h-4 overflow-hidden">
           {[...Array(8)].map((_, i) => (
             <motion.span
               key={i}
               animate={{ 
                 y: [0, -20],
                 opacity: [0, 1, 0]
               }}
               transition={{ 
                 duration: 1 + Math.random(), 
                 repeat: Infinity, 
                 delay: i * 0.1 
               }}
               className="text-[8px] font-mono text-black/10"
             >
               {Math.round(Math.random())}
             </motion.span>
           ))}
        </div>
      </div>
    </div>
  );
}

export function PromptTester({
  onOptimize
}: {
  onOptimize?: (result: OptimizationResult) => void;
}) {
  const { formatCost } = useCurrency();
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'cheap' | 'quality' | 'extreme'>('quality');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<OptimizationResult[] | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [inputCopied, setInputCopied] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [showPipeline, setShowPipeline] = useState(false);
  const [forceReoptimize, setForceReoptimize] = useState(false);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success('Optimized prompt copied!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const reset = () => {
    setPrompt('');
    setResults(null);
    setPipelineResult(null);
    setForceReoptimize(false);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }, 10);
  };

  const llmOptimize = async (text: string): Promise<OptimizerResponse> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in to optimize a prompt.');
    const token = await user.getIdToken();
    const res = await fetch('/api/optimize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt: text, mode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Optimizer request failed (${res.status})`);
    if (typeof data?.optimizedPrompt !== 'string' || !data.optimizedPrompt.trim()) {
      throw new Error('Optimizer returned an empty result.');
    }
    return data as OptimizerResponse;
  };

  const handleOptimize = async (force = false) => {
    if (!prompt.trim()) return;
    setLoading(true);
    setPipelineResult(null);
    setForceReoptimize(false);
    try {
      const pipeline = runPreLLMPipeline(prompt, mode, force);
      setPipelineResult(pipeline);
      const pipelinePrompt = pipeline.finalPrompt;
      const originalTokens = estimatePromptTokens(prompt);

      if (pipeline.cacheHit) {
        const result: OptimizationResult = {
          originalPrompt: prompt,
          optimizedPrompt: pipelinePrompt,
          originalTokens,
          optimizedTokens: estimatePromptTokens(pipelinePrompt),
          tokensSaved: originalTokens - estimatePromptTokens(pipelinePrompt),
          costSaved: 0,
          optimizedCost: null,
          apiInputTokens: null,
          apiOutputTokens: null,
          latencyMs: 0,
          provider: 'local cache',
          mode,
          model: 'Cached result',
        };
        setResults([result]);
        onOptimize?.(result);
        setForceReoptimize(true);
        return;
      }

      const response = await llmOptimize(pipelinePrompt);
      setCached(mode, prompt, response.optimizedPrompt);
      const optimizedTokens = estimatePromptTokens(response.optimizedPrompt);
      const result: OptimizationResult = {
        originalPrompt: prompt,
        optimizedPrompt: response.optimizedPrompt,
        originalTokens,
        optimizedTokens,
        tokensSaved: originalTokens - optimizedTokens,
        costSaved: 0,
        optimizedCost: response.usage.estimatedCostUsd,
        apiInputTokens: response.usage.inputTokens,
        apiOutputTokens: response.usage.outputTokens,
        latencyMs: response.latencyMs,
        provider: response.provider,
        mode,
        model: response.model,
      };
      setResults([result]);
      onOptimize?.(result);
    } catch (error) {
      toast.error('Optimizer stalled', { description: error instanceof Error ? error.message : 'Unable to complete optimization.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-6 lg:gap-8 items-stretch min-h-[500px] lg:min-h-[600px]">
      {/* Input Section */}
      <motion.div className="flex flex-col space-y-8 bg-white p-10 border-l-[6px] border-black shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-[11px] font-black text-black uppercase tracking-[0.2em]">Source Input</h3>
          </div>
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {prompt.trim() && (
                <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} onClick={() => { navigator.clipboard.writeText(prompt); setInputCopied(true); toast.success('Source prompt copied!'); setTimeout(() => setInputCopied(false), 2000); }} className="p-2 text-black/40 hover:text-red transition-all border-none bg-transparent cursor-pointer">
                  {inputCopied ? <Check className="w-4 h-4 text-red" /> : <Copy className="w-4 h-4" />}
                </motion.button>
              )}
            </AnimatePresence>
            <button onClick={reset} className="p-2 text-black/40 hover:text-red transition-all border-none bg-transparent cursor-pointer">
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="relative flex bg-[#f3f2ee] p-1 border border-black">
              {(['quality', 'cheap', 'extreme'] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={cn("relative px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-200 border-none cursor-pointer", mode === m ? "text-white" : "text-black opacity-40 hover:opacity-100")}>
                  {mode === m && <motion.div layoutId="activeMode" className="absolute inset-0 bg-black z-0" />}
                  <span className="relative z-10">{m}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="relative flex-1 group min-h-[400px]">
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="INJECT SOURCE PROMPT..." className="w-full h-full p-8 bg-[#f3f2ee]/50 border-none focus:ring-0 transition-all resize-none font-mono text-base leading-relaxed placeholder:text-black/10 custom-scrollbar outline-none uppercase" />
          <div className="absolute bottom-6 right-6 flex items-center gap-2">
            <div className="px-3 py-1.5 bg-white/80 border border-slate-200 rounded-lg text-[9px] font-bold text-slate-500 backdrop-blur-md"> {prompt.trim().length} chars </div>
            <div className="px-3 py-1.5 bg-white/80 border border-slate-200 rounded-lg text-[9px] font-bold text-slate-500 backdrop-blur-md"> ~{Math.ceil(prompt.trim().length / 4)} tokens </div>
          </div>
        </div>
        <div className="space-y-6">
          {!prompt && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[9px] font-black text-black/40 uppercase tracking-widest mr-2">Quick load:</span>
              {[
                "Marketing SaaS copy",
                "Code optimization",
                "Technical blogging"
              ].map((ex, i) => (
                <button
                  key={ex}
                  onClick={() => {
                    const examples = [
                      "Create a launch campaign for a project management SaaS aimed at small marketing teams. Write a landing-page headline, a short value proposition, three benefit bullets, and a clear free-trial call to action. Keep the tone confident and friendly, avoid unsupported claims, and explain how the product helps teams coordinate work and meet deadlines. Limit the copy to 180 words.",
                      "Review the following TypeScript function that fetches paginated user records from an API. Find correctness, performance, and error-handling issues; then provide a production-ready revision with explicit types, bounded retries for transient failures, and cancellation support. Preserve the existing function signature where practical, explain any behavior changes, and include unit tests for an empty result, a failed request, and multiple pages. Do not add dependencies.\n\n[paste code here]",
                      "Write a technical blog post for junior developers explaining how HTTP caching works in a web application. Cover Cache-Control, ETag, browser versus CDN caching, and one practical request/response example. Use clear section headings, define jargon on first use, distinguish fresh from stale responses, and include a short checklist of common mistakes. Keep it between 700 and 900 words and avoid inventing benchmark results."
                    ];
                    setPrompt(examples[i]);
                  }}
                  className="px-3 py-1.5 bg-[#f3f2ee] border-none text-[9px] font-black uppercase tracking-widest text-black/60 hover:bg-black hover:text-white transition-all cursor-pointer"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button disabled={!prompt.trim() || loading} onClick={() => handleOptimize()} className={cn("relative overflow-hidden flex-1 py-5 font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-4 active:scale-[0.98] border-none cursor-pointer", prompt.trim() && !loading ? "bg-red text-white hover:bg-black" : "bg-black/5 text-black/20 cursor-not-allowed")}>
              {loading ? <div className="flex items-center gap-3"> <Activity className="w-5 h-5 animate-pulse" /> <span className="text-[12px]">Processing Neural Vectors...</span> </div> : <> <Zap className="w-5 h-5 text-white fill-current" /> <span className="text-[12px]">Optimise Now</span> </>}
            </button>
            <AnimatePresence>
              {forceReoptimize && !loading && (
                <motion.button key="reoptimize" initial={{ opacity: 0, scale: 0.9, width: 0 }} animate={{ opacity: 1, scale: 1, width: 'auto' }} exit={{ opacity: 0, scale: 0.9, width: 0 }} transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }} onClick={() => handleOptimize(true)} className="overflow-hidden px-5 py-4 bg-black text-white font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98] whitespace-nowrap cursor-pointer border-none">
                  <RotateCcw className="w-4 h-4" />
                  <span className="text-[11px] uppercase tracking-widest">Force fresh</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Output Section */}
      <motion.div className="flex flex-col bg-white text-black p-10 border-l-[6px] border-red shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h3 className="text-[11px] font-black text-black uppercase tracking-[0.2em]">Optimization Gallery</h3>
          </div>
          {results && results.length > 0 && !loading && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="px-3 py-1 bg-red text-white text-[9px] font-black uppercase tracking-[0.2em]"> Neural Success </motion.div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto pr-2 -mr-2 custom-scrollbar">
          <AnimatePresence mode="wait">
            {loading ? (
              <NeuralOptimizerLoader key="loader" />
            ) : results && results.length > 0 ? (
              <div key="results-list" className="space-y-6 pb-6">
                {results.map((res, idx) => (
                  <motion.div key={`${res.model}-${idx}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative group border border-black/5 bg-[#f3f2ee]/50 overflow-hidden will-change-transform">
                    <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between border-b border-black/5 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red text-white flex items-center justify-center font-black text-[10px]"> {res.model.substring(0, 1)} </div>
                        <div>
                          <span className="text-xs font-black text-black block leading-tight uppercase tracking-widest">{res.provider} · {res.model}</span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                            <span className="text-[9px] font-bold text-black/40 whitespace-nowrap">~{res.originalTokens} → ~{res.optimizedTokens} tokens</span>
                            <div className="w-1 h-1 bg-black/10 rounded-full" />
                            <span className={cn("text-[9px] font-bold whitespace-nowrap", res.tokensSaved >= 0 ? "text-red" : "text-amber-600")}> {res.tokensSaved >= 0 ? `-${res.tokensSaved}` : `+${Math.abs(res.tokensSaved)}`} {res.tokensSaved >= 0 ? 'saved' : 'added'} </span>
                            <div className="w-1 h-1 bg-black/10 rounded-full" />
                            <span className="text-[9px] font-bold text-black/40 whitespace-nowrap">{res.provider === 'local cache' ? 'local cache · no API call' : res.optimizedCost === null ? 'API cost n/a' : `API est. ${formatCost(res.optimizedCost)}`}</span>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => copyToClipboard(res.optimizedPrompt, idx)} className="p-2 hover:bg-black/5 transition-all border-none bg-transparent cursor-pointer">
                        {copiedIndex === idx ? <Check className="w-4 h-4 text-red" /> : <Copy className="w-4 h-4 text-black/40" />}
                      </button>
                    </div>
                    <div className="p-8">
                      <div className="font-mono text-sm font-medium text-black/80 leading-relaxed whitespace-pre-wrap">{res.optimizedPrompt}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center text-center p-12 min-h-[400px]"
              >
                <div className="relative mb-12">
                  {/* Modern Professional Animation */}
                  <div className="w-24 h-24 relative flex items-center justify-center">
                    <motion.div 
                      animate={{ 
                        rotate: 360,
                        borderTopColor: ['#e61e2a', '#000000', '#e61e2a'],
                        borderRightColor: ['#000000', '#e61e2a', '#000000']
                      }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 border-[2px] border-transparent border-t-red border-r-black rounded-full opacity-20"
                    />
                    <motion.div 
                      animate={{ 
                        scale: [1, 1.1, 1],
                        opacity: [0.3, 0.6, 0.3]
                      }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="w-12 h-12 bg-red rounded-full blur-2xl absolute"
                    />
                    <div className="relative z-10 w-2 h-2 bg-black rounded-full" />
                  </div>
                  
                  <motion.div 
                    animate={{ width: ['0%', '100%', '0%'], left: ['0%', '0%', '100%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -bottom-6 left-0 h-[1px] bg-red/30 w-full"
                  />
                </div>
                
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-black font-display tracking-[0.3em] uppercase">Ready for Input</h4>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-1.5 h-[1px] bg-red" />
                    <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest">
                      System Idle // Awaiting Instruction Vectors
                    </p>
                    <div className="w-1.5 h-[1px] bg-red" />
                  </div>
                  <p className="text-[11px] text-black/30 font-medium max-w-[320px] leading-relaxed mx-auto italic">
                    Enter your source prompt in the left panel to begin the neural optimization cycle. Results will be streamed here in realtime with full compression diagnostics.
                  </p>
                </div>
                
                <div className="mt-12 flex gap-1">
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                      className="w-1 h-1 bg-black/10"
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
