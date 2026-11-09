import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Book, Zap, Shield, Sparkles, Code, Terminal, Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ApiReference() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-indigo-600" />
            <span className="text-lg font-bold text-gray-900">API Reference</span>
          </div>
          <div className="w-20" />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        <header className="space-y-4">
          <h1 className="text-4xl font-black tracking-tight text-gray-900">API Reference</h1>
          <p className="text-xl text-gray-500 leading-relaxed">
            Integrate OptiPrompt directly into your workflow with our REST API.
          </p>
        </header>

        <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Terminal className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Endpoints</h2>
          </div>
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold uppercase tracking-widest">POST</span>
                <code className="text-sm font-mono text-gray-900">/api/optimize</code>
              </div>
              <p className="text-gray-600">Requires a Firebase ID token. Limits prompts to 10,000 characters and rate-limits each user. Returns provider-reported usage, latency, and an estimated API cost.</p>
              <div className="bg-gray-900 rounded-2xl p-6 overflow-hidden">
                <pre className="text-indigo-400 text-sm font-mono leading-relaxed">
{`POST /api/optimize
Authorization: Bearer <Firebase ID token>
Content-Type: application/json

{
  "prompt": "Your prompt here...",
  "mode": "quality"
}` }
                </pre>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
