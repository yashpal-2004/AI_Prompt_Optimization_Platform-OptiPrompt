/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { CurrencyProvider } from './lib/CurrencyContext';
import { Toaster } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

const Dashboard = lazy(() => import('./components/layout/Dashboard').then(module => ({ default: module.Dashboard })));
const Landing = lazy(() => import('./components/layout/Landing').then(module => ({ default: module.Landing })));
const Settings = lazy(() => import('./components/features/Settings').then(module => ({ default: module.Settings })));
const Documentation = lazy(() => import('./pages/docs/Documentation').then(module => ({ default: module.Documentation })));
const ApiReference = lazy(() => import('./pages/docs/ApiReference').then(module => ({ default: module.ApiReference })));
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy').then(module => ({ default: module.PrivacyPolicy })));
const SafetyGuides = lazy(() => import('./pages/docs/SafetyGuides').then(module => ({ default: module.SafetyGuides })));
const TermsOfUse = lazy(() => import('./pages/legal/TermsOfUse').then(module => ({ default: module.TermsOfUse })));
const Status = lazy(() => import('./components/features/Status').then(module => ({ default: module.Status })));


function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f2ee] flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
        <div className="grid-bg-overlay" />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative z-10"
        >
          <div className="logo" style={{ fontSize: '48px' }}>OPTIPROMPT<span className="text-red">.</span></div>
          <div className="flex items-center gap-2 mt-4 justify-center">
             <div className="w-2 h-2 bg-[#e61e2a] rounded-full animate-pulse" />
             <span className="text-[10px] font-bold text-black uppercase tracking-[4px]">Initializing Studio</span>
          </div>
        </motion.div>

        {/* Progress loader */}
        <div className="w-48 h-[2px] bg-black/10 rounded-full overflow-hidden mx-auto mt-12 relative z-10">
          <motion.div 
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-1/2 h-full bg-[#e61e2a] rounded-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f2ee] selection:bg-red-light overflow-x-hidden">
      <div className="grid-bg-overlay" />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs font-bold uppercase tracking-[3px] text-black/50">Loading OptiPrompt…</div>}>
      <AnimatePresence mode="wait">
        <Routes>
          <Route 
            path="/" 
            element={!user ? <Landing /> : <Dashboard />} 
          />
          <Route 
            path="/settings" 
            element={user ? <Settings /> : <Navigate to="/" />} 
          />
          <Route 
            path="/docs" 
            element={<Documentation />} 
          />
          <Route 
            path="/api-ref" 
            element={<ApiReference />} 
          />
          <Route 
            path="/privacy" 
            element={<PrivacyPolicy />} 
          />
          <Route 
            path="/safety" 
            element={<SafetyGuides />} 
          />
          <Route 
            path="/terms" 
            element={<TermsOfUse />} 
          />
          <Route 
            path="/status" 
            element={<Status />} 
          />
          <Route 
            path="*" 
            element={<Navigate to="/" />} 
          />
        </Routes>
      </AnimatePresence>
      </Suspense>
      <Toaster position="top-right" richColors />
    </div>

  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <CurrencyProvider>
          <AppContent />
        </CurrencyProvider>
      </AuthProvider>
    </Router>

  );
}
