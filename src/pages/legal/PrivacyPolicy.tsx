import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f3f2ee] selection:bg-red-light selection:text-white relative overflow-hidden">
      <div className="grid-bg-overlay" />
      
      <nav className="sticky top-0 z-50 bg-[#f3f2ee]/80 backdrop-blur-xl border-b border-black/5 px-6">
        <div className="max-w-4xl mx-auto h-20 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="group flex items-center gap-3 text-black/40 hover:text-black transition-all font-black text-[10px] uppercase tracking-[2px] border-none bg-transparent cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all">
              <ArrowLeft className="w-4 h-4" />
            </div>
            Back
          </button>
          
          <div className="flex flex-col items-center">
             <h1 className="text-xs font-black text-black uppercase tracking-[4px] mb-0.5">Privacy Policy</h1>
             <p className="text-[9px] font-bold text-black/40 uppercase tracking-widest">Legal Telemetry</p>
          </div>

          <div className="w-20" />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-20 space-y-20 relative z-10">
        <header className="space-y-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 bg-red text-white rounded-lg text-[9px] font-black uppercase tracking-[3px] mb-4"
          >
            Neural Protocol
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl font-black uppercase tracking-tighter text-black"
          >
            Data <span className="text-red">Integrity</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-black/50 font-bold uppercase tracking-widest max-w-lg mx-auto leading-relaxed"
          >
            Your data security is our absolute priority. We operate with radical transparency in our neural processing cycles.
          </motion.p>
        </header>

        <section className="bg-white p-12 shadow-2xl border-l-[6px] border-black space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-black text-white flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-black">Neural Protection</h2>
          </div>
          <div className="space-y-6 text-black/70 font-medium leading-relaxed">
            <p>At OptiPrompt, we take your privacy seriously. We only collect the data necessary to provide our high-performance optimization services and improve your experience.</p>
            
            <div className="pt-8 border-t border-black/5">
              <h3 className="text-sm font-black text-black uppercase tracking-widest mb-4">What We Synchronize</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-red mt-1.5" />
                  <p><strong className="text-black uppercase text-xs">Prompts:</strong> Prompts are sent to the selected AI provider for optimization. Prompt history is off by default. If you opt in under Settings, original and optimized prompts are stored in your account-scoped Firestore history until you clear it.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-red mt-1.5" />
                  <p><strong className="text-black uppercase text-xs">Usage Telemetry:</strong> Provider-reported input and output tokens, request latency, provider/model, and estimated API cost are saved with history only when you opt in. Cost uses published standard rates and may differ from your provider bill or free-tier usage.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-red mt-1.5" />
                  <p><strong className="text-black uppercase text-xs">Identity:</strong> We utilize secure OAuth protocols for authentication, ensuring your account remains isolated.</p>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-black/5 flex justify-between items-center opacity-40">
        <div className="text-[10px] font-black uppercase tracking-widest">OptiPrompt Legal Unit</div>
        <div className="text-[10px] font-bold uppercase tracking-widest">© 2026</div>
      </footer>
    </div>
  );
}
