'use client';

import React from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';
import { RutFeedPlayer } from '@/components/RutFeedPlayer';

export default function HomePage() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <RutFeedPlayer />
      </ThemeProvider>
    </AuthProvider>
  );
}
