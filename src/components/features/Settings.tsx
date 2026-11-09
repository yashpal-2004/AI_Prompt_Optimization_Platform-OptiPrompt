import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../lib/AuthContext';
import { useCurrency, CURRENCIES, CurrencyKey } from '../../lib/CurrencyContext';
import { User, Mail, Shield, Globe, ArrowLeft, Trash2, Bell, CheckCircle2, AlertTriangle, LogOut } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';

export function Settings() {
  const { user, logout } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [savePromptHistory, setSavePromptHistory] = useState(false);

  useEffect(() => {
    setSavePromptHistory(user ? localStorage.getItem(`optiprompt_history_${user.uid}`) === 'true' : false);
  }, [user?.uid]);

  const updateHistoryPreference = (enabled: boolean) => {
    setSavePromptHistory(enabled);
    if (user) localStorage.setItem(`optiprompt_history_${user.uid}`, String(enabled));
  };

  const handleDeleteEntity = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const q = query(collection(db, 'usageLogs'), where('uid', '==', user.uid));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      
      // Clear local keys
      localStorage.removeItem('optiprompt_keys_v2');
      
      setShowDeleteConfirm(false);
      toast.success('Neural signature purged. Resetting environment...');
      setTimeout(() => window.location.href = '/', 1500);
    } catch (error) {
       console.error(error);
      toast.error('Purge failed: Access Denied');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg selection:bg-indigo-100 italic-none">
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-sm glass rounded-[3rem] p-10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] border-white/20"
            >
              <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mb-8 mx-auto animate-float">
                <AlertTriangle className="w-10 h-10 text-rose-600" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-3 text-center font-display">System Purge</h3>
              <p className="text-slate-500 mb-10 text-center leading-relaxed font-medium text-sm">This is an atomic action. All historical data and node configurations will be permanently erased. Proceed with caution.</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                >
                  ABORT
                </button>
                <button 
                  onClick={handleDeleteEntity}
                  disabled={loading}
                  className="flex-1 py-4 bg-rose-600 text-white font-black rounded-2xl hover:bg-rose-700 shadow-2xl shadow-rose-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'PURGING...' : 'PURGE'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <nav className="sticky top-0 z-50 glass border-b border-slate-200/50 px-6 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto h-20 flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="group flex items-center gap-3 text-slate-500 hover:text-slate-900 transition-all font-bold text-xs uppercase tracking-widest"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-white border border-slate-100 shadow-sm group-hover:scale-110 transition-all">
              <ArrowLeft className="w-4 h-4" />
            </div>
            Back
          </button>
          
          <div className="flex flex-col items-center">
             <h1 className="text-sm font-black text-slate-900 uppercase tracking-[4px] font-display mb-0.5">Laboratory</h1>
             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Configuration Console</p>
          </div>

          <div className="w-24 flex justify-end" />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-16 space-y-12 pb-32">
        {/* Profile Identity Card */}
        <section className="glass p-10 rounded-[3rem] border-slate-200 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-[100px] -mr-32 -mt-32 opacity-50 group-hover:scale-110 transition-transform duration-1000" />
          
          <div className="relative z-10 flex flex-col items-center md:flex-row md:items-center gap-6 md:gap-10">
            <div className="relative">
              <div className="w-24 h-24 md:w-32 md:h-32 bg-indigo-100 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center overflow-hidden border-4 border-white shadow-2xl">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-10 h-10 md:w-12 md:h-12 text-indigo-600" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 md:w-10 md:h-10 bg-emerald-500 rounded-xl md:rounded-2xl flex items-center justify-center text-white border-4 border-white shadow-lg shadow-emerald-100">
                <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-[2px] mb-3 border border-indigo-100">
                Identity Verified
              </div>
              <h2 className="text-3xl md:text-4xl font-medium text-slate-900 font-display tracking-tight leading-tight">{user?.displayName || 'Neural Architect'}</h2>
              <p className="text-sm text-slate-500 font-medium mt-1">{user?.email}</p>
            </div>

            <div className="flex flex-col gap-3 w-full md:w-auto justify-center">
               <div className="flex gap-3">
                 <div className="flex-1 md:flex-none px-4 md:px-6 py-3 md:py-4 bg-slate-50 border border-slate-100 rounded-2xl md:rounded-3xl text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                    <p className="text-[11px] md:text-sm font-bold text-slate-900">Active Node</p>
                 </div>
                 <div className="flex-1 md:flex-none px-4 md:px-6 py-3 md:py-4 bg-slate-50 border border-slate-100 rounded-2xl md:rounded-3xl text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tier</p>
                    <p className="text-[11px] md:text-sm font-bold text-indigo-600">Enterprise</p>
                 </div>
               </div>
               
               <button 
                 onClick={() => logout()}
                 className="w-full py-4 bg-red text-white font-black text-[10px] uppercase tracking-[2px] rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-3 border-none cursor-pointer"
               >
                 <LogOut size={14} />
                 Terminate Session
               </button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-10">
          {/* Main Config Column */}
          <div className="space-y-10">
            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 glass rounded-xl flex items-center justify-center border-slate-200">
                  <Globe className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 font-display">System Localization</h3>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">Regional telemetry</p>
                </div>
              </div>

              <div className="glass p-6 rounded-[2rem] border-slate-200 shadow-sm">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Currency Unit</p>
                 <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(CURRENCIES) as CurrencyKey[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCurrency(c)}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1 group active:scale-95",
                        currency === c 
                          ? "bg-indigo-50 border-indigo-600 text-indigo-600 shadow-lg shadow-indigo-100" 
                          : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                      )}
                    >
                      <span className={cn("text-xl font-bold", currency === c ? "scale-105" : "")}>{CURRENCIES[c].symbol}</span>
                      <span className="text-[8px] font-black uppercase tracking-widest">{CURRENCIES[c].label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 glass rounded-xl flex items-center justify-center border-slate-200">
                  <Shield className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 font-display">Security Protocol</h3>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">Memory Management</p>
                </div>
              </div>

              <div className="glass p-6 rounded-[2rem] border-slate-200 shadow-sm">
                <label className="flex items-start gap-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={savePromptHistory}
                    onChange={(event) => updateHistoryPreference(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-indigo-600"
                  />
                  <span>
                    <span className="block text-sm font-bold text-slate-900">Save prompt history to my account</span>
                    <span className="block text-xs text-slate-500 mt-1 leading-relaxed">When enabled, original and optimized prompts are saved in your private Firestore history. Turn this off to keep future prompts out of cloud history.</span>
                  </span>
                </label>
              </div>

              <div className="bg-rose-50/20 glass p-8 rounded-[2rem] border-rose-100/50 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-[60px] -mr-16 -mt-16 opacity-40 group-hover:scale-125 transition-transform duration-700" />
                <div className="relative z-10">
                  <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">Danger Zone</p>
                  <h4 className="text-xl font-black text-slate-900 font-display">Neural Wipe</h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed max-w-[200px]">Permanently clear your account signature and all cloud data.</p>
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="mt-6 w-full py-4 bg-white border border-rose-100 text-rose-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-95"
                  >
                    Delete Entity
                  </button>
                </div>
              </div>
            </section>
          </div>

        </div>

      </main>
    </div>
  );
}
