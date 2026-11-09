import React from 'react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Zap, Target, Clock, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCurrency } from '../../lib/CurrencyContext';

interface AnalyticsProps {
  history: {
    id: string;
    uid: string;
    originalPrompt: string;
    optimizedPrompt: string;
    originalTokens: number;
    optimizedTokens: number;
    tokensSaved: number;
    apiInputTokens?: number;
    apiOutputTokens?: number;
    estimatedApiCostUsd?: number;
    latencyMs?: number;
    provider?: string;
    mode: string;
    model: string;
    timestamp: string;
  }[];
  view?: 'charts' | 'ledger';
}

export function Analytics({ history, view = 'charts' }: AnalyticsProps) {
  const { formatCost } = useCurrency();
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 10;
  // Aggregate usage and savings by day
  const dailyPerformance = React.useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        name: days[d.getDay()],
        fullDate: d.toISOString().split('T')[0],
        usage: 0,
        tokensSaved: 0,
        apiTokens: 0
      };
    });

    history.forEach(item => {
      if (!item.timestamp) return;
      const date = item.timestamp.split('T')[0];
      const dayData = last7Days.find(d => d.fullDate === date);
      if (dayData) {
        dayData.usage += (item.apiInputTokens || 0) + (item.apiOutputTokens || 0);
        dayData.apiTokens = dayData.usage;
        dayData.tokensSaved += item.tokensSaved || 0;
      }
    });

    return last7Days.map(d => ({
      ...d,
      savings: d.tokensSaved
    }));
  }, [history]);

  const avgCompression = history.length > 0
    ? (() => {
        const totalOriginal = history.reduce((acc, item) => acc + (item.originalTokens || 0), 0);
        if (totalOriginal === 0) return 0;
        
        const totalSaved = history.reduce((acc, item) => acc + (item.tokensSaved || 0), 0);
        
        return Math.round((totalSaved / totalOriginal) * 100);
      })()
    : 0;

  return view === 'charts' ? (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col gap-8">
        {/* Unified Command Center */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-12 border-l-[10px] border-black shadow-2xl relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-red/5 rounded-full blur-[120px] -mr-32 -mt-32 opacity-50 pointer-events-none group-hover:scale-110 transition-transform duration-1000" />
          
          <div className="relative z-10 space-y-12">
            {/* Top Header & Metrics Bar */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-10">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-red text-white rounded-none text-[9px] font-black uppercase tracking-widest mb-4 border-none">
                  <TrendingUp className="w-3 h-3" />
                  Neural Diagnostics
                </div>
                <h3 className="text-5xl font-medium text-slate-900 font-display tracking-tight leading-none mb-4">Usage & Prompt Size</h3>
                <p className="text-base font-medium text-slate-500 leading-relaxed max-w-xl">Provider token counts and latency come from API responses. Prompt-size change is a rough character-based estimate, not a tokenizer measurement.</p>
              </div>

              <div className="grid grid-cols-3 gap-6 shrink-0">
                {[
                  { label: 'Approx. prompt change', value: `~${avgCompression}%`, icon: Target, color: 'text-red', bg: 'bg-red-light' },
                  { label: 'Avg Latency', value: history.length > 0 ? `${(history.reduce((acc, h) => acc + (h.latencyMs || 0), 0) / history.length / 1000).toFixed(2)}s` : '0s', icon: Clock, color: 'text-red', bg: 'bg-red-light' },
                  { label: 'Best approx. reduction', value: history.length > 0 ? `${Math.max(-100, ...history.map(h => {
                    const original = h.originalTokens || 0;
                    const optimized = h.optimizedTokens || 0;
                    return original > 0 ? Math.round(((original - optimized) / original) * 100) : 0;
                  }))}%` : '0%', icon: Zap, color: 'text-red', bg: 'bg-red-light' },
                ].map((item) => (
                  <div key={item.label} className="min-w-[140px] p-6 bg-[#f3f2ee] border-none transition-all flex flex-col items-center text-center">
                    <div className={cn("w-10 h-10 flex items-center justify-center mb-3 transition-transform group-hover/item:scale-110", item.bg)}>
                      <item.icon className={cn("w-5 h-5", item.color)} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-black/40 uppercase tracking-widest mb-0.5">{item.label}</p>
                      <p className="text-lg font-black text-black font-display">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Main Visual Waveform */}
            <div className="pt-8 border-t border-slate-100">
              <div className="flex items-center justify-between mb-10">
                 <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[3px]">Daily usage and estimated prompt-size change</p>
                 </div>
                  <div className="flex items-center gap-6 p-4 bg-black text-white">
                    <div className="flex items-center gap-2 px-3">
                      <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Provider tokens (actual)</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 border-l border-slate-200">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Prompt tokens changed (approx.)</span>
                    </div>
                  </div>
              </div>

              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyPerformance}>
                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f1f5f9" strokeWidth={0.5} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }}
                      dy={15}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }}
                      dx={-10}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc', radius: 4 }}
                      contentStyle={{ 
                        borderRadius: '24px', 
                        border: 'none', 
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
                        padding: '20px',
                        backgroundColor: 'rgba(255,255,255,0.98)',
                      }} 
                      itemStyle={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}
                    />
                    <Bar dataKey="usage" fill="url(#usageGradient)" radius={[8, 8, 0, 0]} barSize={32} />
                    <Bar dataKey="savings" fill="url(#savingsGradient)" radius={[8, 8, 0, 0]} barSize={32} />
                    <defs>
                      <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#000000" />
                        <stop offset="100%" stopColor="#333333" />
                      </linearGradient>
                      <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e61e2a" />
                        <stop offset="100%" stopColor="#ff4d4d" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  ) : (
    <div className="space-y-12">
      {/* Recent Activity Table */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white border-l-[10px] border-red shadow-2xl overflow-hidden"
      >
        <div className="p-10 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-medium text-slate-800 font-display">Activity ledger</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">Comprehensive historical logs of neural optimizations.</p>
          </div>
          <div className="flex gap-2">
             <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-medium text-slate-500 uppercase tracking-widest">
               {history.length} operations detected
             </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black text-white border-none">
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[2px]">Date & Time</th>
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[2px]">Mode</th>
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[2px]">Provider / model</th>
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[2px]">Prompt tokens (approx.)</th>
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[2px]">Change (approx.)</th>
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[2px]">API tokens / cost est.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {history.length > 0 ? history.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((log, i) => (
                <tr key={i} className="hover:bg-indigo-50/30 transition-all cursor-pointer group">
                  <td className="px-10 py-6 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">{new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="text-[10px] font-medium text-slate-500 mt-0.5">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <span className={cn(
                      "px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border-none",
                      log.mode === 'cheap' ? "bg-black text-white" : log.mode === 'extreme' ? "bg-red text-white" : "bg-black text-white opacity-40"
                    )}>
                      {log.mode}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-xs font-bold text-slate-700">{log.provider || 'legacy'} · {log.model}</td>
                  <td className="px-10 py-6 text-xs font-black text-slate-700 font-mono tracking-tighter">~{log.originalTokens} → ~{log.optimizedTokens}</td>
                  <td className="px-10 py-5">
                    {(() => {
                      const yieldVal = log.originalTokens > 0 ? Math.round((log.tokensSaved / log.originalTokens) * 100) : 0;
                      return (
                        <div className={cn(
                          "flex items-center gap-1.5 font-medium text-sm",
                          yieldVal >= 0 ? "text-emerald-500" : "text-rose-500"
                        )}>
                          {yieldVal >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {yieldVal}%
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                      <span>{(log.apiInputTokens ?? 0) + (log.apiOutputTokens ?? 0)} tokens · {log.estimatedApiCostUsd == null ? 'cost n/a' : formatCost(log.estimatedApiCostUsd)}</span>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-10 py-32 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                        <Target className="w-8 h-8 text-slate-200" />
                      </div>
                      <p className="text-sm font-medium text-slate-400">No neural activity recorded</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {history.length > itemsPerPage && (
          <div className="px-10 py-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
            <p className="text-xs font-medium text-slate-500">
              Showing <span className="text-slate-900">{Math.min(history.length, (currentPage - 1) * itemsPerPage + 1)}</span> to <span className="text-slate-900">{Math.min(history.length, currentPage * itemsPerPage)}</span> of <span className="text-slate-900">{history.length}</span> entries
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.ceil(history.length / itemsPerPage) }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === Math.ceil(history.length / itemsPerPage) || Math.abs(p - currentPage) <= 1)
                  .map((p, i, arr) => (
                    <React.Fragment key={p}>
                      {i > 0 && arr[i-1] !== p - 1 && <span className="px-2 text-slate-400">...</span>}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={cn(
                          "w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all",
                          currentPage === p ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-500 hover:bg-white hover:text-slate-900"
                        )}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
              </div>
              <button
                disabled={currentPage === Math.ceil(history.length / itemsPerPage)}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
