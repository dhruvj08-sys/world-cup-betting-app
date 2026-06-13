/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, onAuthStateChanged, User, updateProfile } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import Dashboard from './components/Dashboard';
import { ArrowRight, LogIn, User as UserIcon } from 'lucide-react';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const dbFirestore = getFirestore(app);
const provider = new GoogleAuthProvider();

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Auth state
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setAuthError(null);
      setIsSubmitting(true);
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Sign-in failed:', error);
      setIsSubmitting(false);
      if (error?.message?.includes('Pending promise') || error?.code === 'auth/internal-error') {
        setAuthError('Popups blocked. Please open in a new tab.');
      } else {
        setAuthError('Sign in failed. Please try again.');
      }
    }
  };

  const handleGuestSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setAuthError('Please enter a nickname.');
      return;
    }
    
    try {
      setAuthError(null);
      setIsSubmitting(true);
      const userCredential = await signInAnonymously(auth);
      await updateProfile(userCredential.user, {
        displayName: guestName.trim()
      });
      setUser({ ...userCredential.user, displayName: guestName.trim() } as User); // Optimistic update
    } catch (error: any) {
      console.error('Guest sign-in failed:', error);
      setAuthError('Could not join as guest.');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-slate-400 font-sans">
        <div className="animate-pulse font-bold tracking-widest uppercase text-xs">Loading Pool...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-surface-base text-white flex flex-col items-center justify-center p-6 font-sans select-none relative overflow-hidden">
        {/* Subtle premium gradient background */}
        <div className="absolute inset-x-0 top-0 h-[50vh] bg-gradient-to-b from-brand-muted to-transparent pointer-events-none"></div>

        <div className="w-full max-w-sm flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
          <div className="flex flex-col items-center mb-12 text-center">
            <div className="w-16 h-16 bg-brand text-black rounded-2xl mb-6 flex items-center justify-center shadow-[0_0_50px_var(--color-brand-muted)] border border-brand/20 relative">
              <div className="absolute inset-0 rounded-2xl border border-brand animate-ping opacity-20"></div>
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-4xl md:text-5xl font-black font-display tracking-tight text-white mb-3 uppercase">The Pool</h1>
            <p className="text-slate-400 text-sm font-medium px-4 tracking-wide">
              A premium, high-stakes prediction experience. Lock your picks before it's too late.
            </p>
          </div>

          <div className="bg-surface-card border border-surface-border rounded-[2rem] p-8 shadow-2xl relative z-10">
            {authError && (
              <div className="mb-6 border-l-2 border-red-500 bg-red-500/10 px-4 py-3 text-red-500 text-xs font-semibold rounded-r-lg">
                {authError}
              </div>
            )}

            {!isGuestMode ? (
              <div className="flex flex-col gap-4">
                <button 
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting}
                  className="group relative w-full flex items-center justify-center gap-3 bg-white text-black hover:bg-slate-200 shadow-lg hover:shadow-xl font-bold text-sm py-4 px-4 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <title>Google</title>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>
                
                <div className="flex items-center gap-4 my-2 opacity-60">
                  <div className="flex-1 border-t border-surface-border"></div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">OR</span>
                  <div className="flex-1 border-t border-surface-border"></div>
                </div>

                <button 
                  onClick={() => { setAuthError(null); setIsGuestMode(true); }}
                  className="w-full flex items-center justify-center gap-2 text-white bg-transparent hover:bg-surface-hover border border-surface-border font-bold text-sm py-4 px-4 rounded-xl transition-all duration-300"
                >
                  <UserIcon className="w-4 h-4 opacity-70" />
                  Continue as Guest
                </button>
              </div>
            ) : (
              <form onSubmit={handleGuestSignIn} className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-brand">Guest Mode</h3>
                  <button type="button" onClick={() => setIsGuestMode(false)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Back</button>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Choose a Display Name</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-surface-base border border-surface-border rounded-xl px-4 py-4 text-white placeholder-slate-600 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all font-semibold"
                    autoFocus
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting || !guestName.trim()}
                  className="group w-full flex items-center justify-center gap-2 bg-brand text-black hover:bg-brand-hover font-black uppercase tracking-widest text-sm py-4 px-4 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-[0_0_20px_var(--color-brand-muted)]"
                >
                  <span>{isSubmitting ? 'Joining...' : 'Enter the Pool'}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <Dashboard user={user} auth={auth} />;
}

