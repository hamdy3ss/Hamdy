/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import MeetingTranslator from './components/MeetingTranslator';
import LanguageTutor from './components/LanguageTutor';
import { Languages, GraduationCap, LogOut, LogIn } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function AppContent() {
  const [activeTab, setActiveTab] = useState<'translator' | 'tutor'>('translator');
  const { currentUser, signInWithGoogle, logout } = useAuth();

  return (
    <div dir="rtl" className="min-h-screen bg-[#050b14] text-white font-sans selection:bg-cyan-500/30 bg-grid relative flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/10 via-[#050b14] to-[#050b14] pointer-events-none" />
      
      {/* Top Navigation Tabs */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-center pt-4 md:pt-6 px-4 md:px-8 gap-4">
        <div className="flex-1 flex items-center">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
            حمدي الهواري
          </h1>
        </div>
        <div className="flex bg-[#0a1120]/80 backdrop-blur-md border border-cyan-500/20 rounded-2xl p-1 shadow-[0_0_20px_rgba(0,240,255,0.05)]">
          <button
            onClick={() => setActiveTab('translator')}
            className={`flex items-center gap-2 px-4 py-2 md:px-6 md:py-2.5 rounded-xl text-sm md:text-base font-bold transition-all ${
              activeTab === 'translator'
                ? 'bg-cyan-950/60 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.15)] border border-cyan-500/30'
                : 'text-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-950/30'
            }`}
          >
            <Languages className="w-4 h-4 md:w-5 md:h-5" />
            <span>المترجم الفوري</span>
          </button>
          <button
            onClick={() => setActiveTab('tutor')}
            className={`flex items-center gap-2 px-4 py-2 md:px-6 md:py-2.5 rounded-xl text-sm md:text-base font-bold transition-all ${
              activeTab === 'tutor'
                ? 'bg-fuchsia-950/60 text-fuchsia-300 shadow-[0_0_15px_rgba(192,38,211,0.15)] border border-fuchsia-500/30'
                : 'text-fuchsia-500/50 hover:text-fuchsia-400 hover:bg-fuchsia-950/30'
            }`}
          >
            <GraduationCap className="w-4 h-4 md:w-5 md:h-5" />
            <span>معلم اللغات</span>
          </button>
        </div>
        
        <div className="flex-1 flex justify-end">
          {currentUser ? (
            <div className="flex items-center gap-3 bg-[#0a1120]/80 backdrop-blur-md border border-cyan-500/20 rounded-2xl p-2 px-4">
              <img src={currentUser.photoURL || ''} alt="Profile" className="w-8 h-8 rounded-full border border-cyan-500/50" />
              <span className="text-sm font-bold text-cyan-100 hidden md:block">{currentUser.displayName}</span>
              <button onClick={logout} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors" title="تسجيل الخروج">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button 
              onClick={signInWithGoogle}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>تسجيل الدخول</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 relative z-10">
        {activeTab === 'translator' ? <MeetingTranslator /> : <LanguageTutor />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
