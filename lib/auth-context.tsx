'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { D1User } from './d1-database';

interface AuthContextType {
  user: D1User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, displayName: string, avatarUrl?: string) => Promise<void>;
  signOut: () => void;
  switchDemoUser: (uid: string, name: string, email: string, avatar: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PRESET_ACCOUNTS = [
  {
    uid: 'usr_marcus_ny',
    name: 'Marcus Reed',
    email: 'marcus.sound@scruttin.fm',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    uid: 'usr_elena_berlin',
    name: 'Elena Vance (Berlin)',
    email: 'elena.b@scruttin.fm',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    uid: 'usr_yuki_tokyo',
    name: 'Yuki Takahashi',
    email: 'yuki.k@scruttin.fm',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Helper to generate verifiable token
  const createToken = (uid: string, email: string, name: string) => {
    return `demo:${uid}:${email}:${encodeURIComponent(name)}`;
  };

  const [user, setUser] = useState<D1User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedToken = localStorage.getItem('scruttin_auth_token');
        if (savedToken) return savedToken;
        const defaultUser = PRESET_ACCOUNTS[0];
        const initialToken = `demo:${defaultUser.uid}:${defaultUser.email}:${encodeURIComponent(defaultUser.name)}`;
        localStorage.setItem('scruttin_auth_token', initialToken);
        localStorage.setItem('scruttin_user_uid', defaultUser.uid);
        return initialToken;
      } catch (e) {}
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  const syncWithD1 = async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error('Failed to sync D1 user profile', err);
    }
  };

  useEffect(() => {
    if (token) {
      syncWithD1(token).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const signIn = async (email: string, displayName: string, avatarUrl?: string) => {
    setIsLoading(true);
    try {
      const uid = `usr_${displayName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36).slice(-4)}`;
      const newToken = createToken(uid, email, displayName);
      setToken(newToken);
      localStorage.setItem('scruttin_auth_token', newToken);
      localStorage.setItem('scruttin_user_uid', uid);

      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${newToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const switchDemoUser = async (uid: string, name: string, email: string, avatar: string) => {
    setIsLoading(true);
    try {
      const newToken = createToken(uid, email, name);
      setToken(newToken);
      localStorage.setItem('scruttin_auth_token', newToken);
      localStorage.setItem('scruttin_user_uid', uid);

      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${newToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('scruttin_auth_token');
    localStorage.removeItem('scruttin_user_uid');
  };

  const refreshProfile = async () => {
    if (!token) return;
    await syncWithD1(token);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        signIn,
        signOut,
        switchDemoUser,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
