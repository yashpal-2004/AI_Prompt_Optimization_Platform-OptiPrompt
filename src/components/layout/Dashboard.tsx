import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  DollarSign, 
  Activity, 
  Zap, 
  Sparkles, 
  TestTube2, 
  User, 
  LogOut, 
  Settings as SettingsIcon, 
  ChevronDown,
  History,
  AlertCircle,
  ArrowRight,
  Trash2
} from 'lucide-react';
import { PromptTester } from '../features/PromptTester';
import { Analytics } from '../features/Analytics';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/AuthContext';
import { useCurrency } from '../../lib/CurrencyContext';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'sonner';
import { useNavigate, Link } from 'react-router-dom';

interface UsageLog {
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
}

export function Dashboard() {
  const { user, logout } = useAuth();
  const { formatCost } = useCurrency();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState<'playground' | 'analytics' | 'history'>('playground');
  const [history, setHistory] = React.useState<UsageLog[]>([]);
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  React.useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'usageLogs'),
      where('uid', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: (doc.data().timestamp as any)?.toDate?.()?.toISOString() || new Date().toISOString()
      })) as UsageLog[];
      setHistory(logs);
    }, () => {
      toast.error("Failed to sync data with cloud");
    });
    return () => unsubscribe();
  }, [user]);

  const sessionStats = React.useMemo(() => history.reduce((acc, log) => ({
    totalSpent: acc.totalSpent + (log.estimatedApiCostUsd ?? 0),
    tokensUsed: acc.tokensUsed + (log.apiInputTokens ?? 0) + (log.apiOutputTokens ?? 0),
    requests: acc.requests + 1,
    estimatedPromptTokensSaved: acc.estimatedPromptTokensSaved + (log.tokensSaved || 0),
    estimatedPromptTokensBefore: acc.estimatedPromptTokensBefore + (log.originalTokens || 0),
  }), { totalSpent: 0, tokensUsed: 0, requests: 0, estimatedPromptTokensSaved: 0, estimatedPromptTokensBefore: 0 }), [history]);

  const resetStats = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'usageLogs'), where('uid', '==', user.uid));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      setShowResetConfirm(false);
      toast.success("History cleared successfully");
    } catch {
      toast.error("Failed to clear history");
    }
  };

  const handleOptimize = async (data: any) => {
    if (!user || localStorage.getItem(`optiprompt_history_${user.uid}`) !== 'true') return;
    try {
      const log: Record<string, unknown> = {
        uid: user.uid,
        originalPrompt: data.originalPrompt,
        optimizedPrompt: data.optimizedPrompt,
        originalTokens: data.originalTokens,
        optimizedTokens: data.optimizedTokens,
        tokensSaved: data.tokensSaved,
        mode: data.mode,
        provider: data.provider,
        model: data.model,
        latencyMs: data.latencyMs,
        timestamp: serverTimestamp(),
      };
      if (data.apiInputTokens !== null) log.apiInputTokens = data.apiInputTokens;
      if (data.apiOutputTokens !== null) log.apiOutputTokens = data.apiOutputTokens;
      if (data.optimizedCost !== null) log.estimatedApiCostUsd = data.optimizedCost;
      await addDoc(collection(db, 'usageLogs'), log);
    } catch {
      toast.error('Failed to save optimization to cloud');
    }
  };

  const stats = [
    { label: 'Approx. prompt tokens saved', value: sessionStats.estimatedPromptTokensSaved.toLocaleString(), icon: Sparkles },
    { label: 'Est. provider cost', value: formatCost(sessionStats.totalSpent), icon: DollarSign },
    { label: 'Requests', value: sessionStats.requests.toLocaleString(), icon: Zap },
    { label: 'Provider tokens', value: sessionStats.tokensUsed.toLocaleString(), icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-[#f3f2ee] selection:bg-red-light flex flex-col">
      <div className="grid-bg-overlay" />
      
      {/* Navbar */}
      <header className="container sticky top-0 z-50 bg-[#f3f2ee]/80 backdrop-blur-md">
        <nav className="navbar">
          <div className="logo cursor-pointer" onClick={() => setActiveTab('playground')}>
            OPTIPROMPT<span className="text-red">.</span>
          </div>
          
          <div className="nav-links">
            {[
              { id: 'playground', label: 'Laboratory', icon: TestTube2 },
              { id: 'analytics', label: 'Performance', icon: Activity },
              { id: 'history', label: 'History', icon: History },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "nav-link flex items-center gap-2 border-none bg-transparent cursor-pointer relative py-2",
                  activeTab === tab.id ? "opacity-100" : "opacity-40"
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="nav-underline"
                    className="absolute bottom-0 left-0 w-full h-[2px] bg-red"
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate('/settings')}
              className="p-2 text-black hover:text-red transition-colors bg-transparent border-none cursor-pointer"
            >
               <SettingsIcon size={20} />
            </button>

            <div className="flex items-center gap-3 py-2 px-4 bg-black text-white font-bold text-[11px] uppercase tracking-widest border-none cursor-default">
              <span>{user?.displayName?.split(' ')[0] || 'User'}</span>
            </div>
          </div>
        </nav>
      </header>

      <main className="container flex-1 py-12">
        {/* Real-time Stats for all tabs */}
        <div className="stats mb-20">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="stat-item"
            >
              <span className="stat-number">{stat.value}</span>
              <span className="stat-label">{stat.label}</span>
            </motion.div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'playground' && (
            <motion.div
              key="playground"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="works-header">
                <h2>Optimization <span className="text-red">Laboratory</span></h2>
                <div className="hero-explore" onClick={() => setShowResetConfirm(true)}>
                  <span className="text-[11px]">Reset History</span>
                  <div className="explore-circle bg-black">
                    <Trash2 size={16} />
                  </div>
                </div>
              </div>
              <PromptTester onOptimize={handleOptimize} />
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="works-header">
                <h2>System <span className="text-red">Performance</span></h2>
              </div>
              <Analytics history={history} view="charts" />
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="works-header">
                <h2>Activity <span className="text-red">Ledger</span></h2>
              </div>
              <Analytics history={history} view="ledger" />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-12 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-3xl font-black uppercase mb-4 tracking-tighter">Purge Records?</h3>
              <p className="text-black/70 mb-10 leading-relaxed font-bold text-sm uppercase tracking-wider">
                This will <span className="text-red">permanently delete</span> all optimization history from the global cloud storage. This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-4 bg-slate-100 text-black font-black uppercase border-none cursor-pointer hover:bg-slate-200 transition-colors"
                >
                  Abort
                </button>
                <button 
                  onClick={resetStats}
                  className="flex-1 py-4 bg-red text-white font-black uppercase border-none cursor-pointer hover:bg-black transition-colors"
                >
                  Purge
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="container" style={{ padding: '60px 0', borderTop: '1.5px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="logo" style={{ fontSize: '18px' }}>OPTIPROMPT<span className="text-red">.</span></div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          © 2026 OptiPrompt Studio. All Rights Reserved.
        </div>
        <div className="nav-links" style={{ gap: '20px' }}>
          <Link to="/privacy" className="nav-link" style={{ fontSize: '11px' }}>Privacy</Link>
          <Link to="/terms" className="nav-link" style={{ fontSize: '11px' }}>Terms</Link>
        </div>
      </footer>
    </div>
  );
}
