'use client';

import React, { useState } from 'react';
import { User, LogIn, Sparkles, Shield, Check, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_PERSONAS = [
  {
    uid: 'usr_maya_r',
    name: 'Maya R.',
    email: 'maya.r@scruttin.fm',
    city: 'Florence',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
    bio: 'Walking and listening to the city pulse',
  },
  {
    uid: 'usr_marcus_ny',
    name: 'Marcus Reed',
    email: 'marcus.sound@scruttin.fm',
    city: 'New York',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    bio: 'Subway commuter & analog tape enthusiast',
  },
  {
    uid: 'usr_elena_berlin',
    name: 'Elena Vance (Berlin)',
    email: 'elena.b@scruttin.fm',
    city: 'Berlin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    bio: 'Walking with a mic through Kreuzberg at 2 AM',
  },
  {
    uid: 'usr_yuki_tokyo',
    name: 'Yuki Takahashi',
    email: 'yuki.k@scruttin.fm',
    city: 'Tokyo',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    bio: 'Shimokitazawa late-night coffee drinker',
  },
  {
    uid: 'usr_tariq_london',
    name: 'Tariq Al-Mansoor',
    email: 'tariq.m@scruttin.fm',
    city: 'London',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    bio: 'Southbank busker and voice documentarian',
  },
];

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { user, signIn, switchDemoUser, signOut } = useAuth();
  const [customName, setCustomName] = useState<string>('');
  const [customEmail, setCustomEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCustomSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    setIsSubmitting(true);
    try {
      const email = customEmail.trim() || `${customName.toLowerCase().replace(/\s+/g, '')}@scruttin.fm`;
      await signIn(email, customName.trim());
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectPersona = async (p: (typeof PRESET_PERSONAS)[0]) => {
    setIsSubmitting(true);
    try {
      await switchDemoUser(p.uid, p.name, p.email, p.avatar);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="auth-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="auth-modal-card"
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">Firebase & Profile Identity</h2>
              <p className="text-xs text-zinc-400">Verified Firebase ID Token & Cloudflare D1</p>
            </div>
          </div>
          <button
            id="close-auth-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Current user card */}
          {user && (
            <div className="p-4 rounded-2xl bg-zinc-850 border border-zinc-750 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.firebase_uid}`}
                  alt={user.display_name}
                  className="w-11 h-11 rounded-full object-cover border border-amber-500/40"
                />
                <div>
                  <div className="text-sm font-semibold text-zinc-100">{user.display_name}</div>
                  <div className="text-xs text-zinc-400 truncate max-w-[180px]">{user.email}</div>
                  <span className="text-[10px] font-mono text-amber-400">UID: {user.firebase_uid}</span>
                </div>
              </div>

              <button
                id="sign-out-btn"
                onClick={signOut}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-colors"
              >
                Switch
              </button>
            </div>
          )}

          {/* Persona Switcher */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 tracking-wide uppercase">
                Street Storyteller Personas
              </span>
              <span className="text-[11px] text-zinc-500">1-click switch</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {PRESET_PERSONAS.map((p) => {
                const isActive = user?.firebase_uid === p.uid;
                return (
                  <button
                    key={p.uid}
                    id={`select-persona-${p.uid}`}
                    onClick={() => handleSelectPersona(p)}
                    disabled={isSubmitting}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isActive
                        ? 'bg-amber-500/15 border-amber-500/40'
                        : 'bg-zinc-850/40 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.avatar}
                        alt={p.name}
                        className="w-9 h-9 rounded-full object-cover border border-zinc-700"
                      />
                      <div>
                        <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                          {p.name}
                          <span className="text-[10px] text-zinc-400 font-normal">({p.city})</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate max-w-[200px]">{p.bio}</p>
                      </div>
                    </div>

                    {isActive ? (
                      <div className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <ArrowRight className="w-4 h-4 text-zinc-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Sign In Form */}
          <form onSubmit={handleCustomSignIn} className="space-y-3 pt-2 border-t border-zinc-800">
            <span className="text-xs font-semibold text-zinc-300 tracking-wide uppercase block">
              Or Sign In with Your Custom Name
            </span>

            <div className="space-y-2">
              <input
                id="custom-name-input"
                type="text"
                placeholder="Display Name (e.g. Maya Lin)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full px-3.5 py-2 bg-zinc-850 border border-zinc-700 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
              />
              <input
                id="custom-email-input"
                type="email"
                placeholder="Email address (optional)"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                className="w-full px-3.5 py-2 bg-zinc-850 border border-zinc-700 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              id="custom-signin-submit-btn"
              type="submit"
              disabled={isSubmitting || !customName.trim()}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
              Sign In & Sync D1 Profile
            </button>
          </form>

          {/* D1 Rule Architecture Callout */}
          <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-1 text-[11px] text-zinc-400">
            <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              Cloudflare D1 Upsert Rule Enforced:
            </div>
            <code className="block font-mono text-[10px] text-amber-300/80 bg-black/40 p-2 rounded overflow-x-auto">
              INSERT INTO users (firebase_uid, email, display_name)
              <br />
              VALUES (?, ?, ?)
              <br />
              ON CONFLICT(firebase_uid) DO UPDATE SET ...
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
