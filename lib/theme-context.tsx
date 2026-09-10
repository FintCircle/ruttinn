'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type FontType = 'editorial' | 'grotesque' | 'display' | 'storyteller';

export interface ColorPalette {
  id: string;
  name: string;
  description: string;
  bgGradient: string;
  cardBg: string;
  accentColor: string;
  accentBorder: string;
  textColor: string;
  subtextColor: string;
}

export const COLOR_PALETTES: ColorPalette[] = [
  {
    id: 'tokyo_midnight',
    name: 'Midnight Neon',
    description: 'Deep indigo street with cyber cyan highlights',
    bgGradient: 'from-slate-950 via-indigo-950 to-slate-900',
    cardBg: 'bg-slate-900/80 backdrop-blur-md',
    accentColor: '#38bdf8',
    accentBorder: 'border-sky-500/30',
    textColor: 'text-slate-100',
    subtextColor: 'text-slate-400',
  },
  {
    id: 'street_amber',
    name: 'Street Lamp Amber',
    description: 'Warm asphalt and incandescent street corners',
    bgGradient: 'from-stone-950 via-neutral-900 to-amber-950/40',
    cardBg: 'bg-stone-900/80 backdrop-blur-md',
    accentColor: '#f59e0b',
    accentBorder: 'border-amber-500/30',
    textColor: 'text-amber-50',
    subtextColor: 'text-amber-200/60',
  },
  {
    id: 'berlin_noir',
    name: 'Brutalist Noir',
    description: 'Minimalist charcoal with electric orange flare',
    bgGradient: 'from-zinc-950 via-neutral-950 to-zinc-900',
    cardBg: 'bg-zinc-900/85 backdrop-blur-md',
    accentColor: '#ff5e00',
    accentBorder: 'border-orange-500/30',
    textColor: 'text-zinc-100',
    subtextColor: 'text-zinc-400',
  },
  {
    id: 'velvet_dusk',
    name: 'Velvet Dusk',
    description: 'Rich midnight plum with soft magenta glow',
    bgGradient: 'from-purple-950 via-slate-950 to-pink-950/30',
    cardBg: 'bg-purple-950/70 backdrop-blur-md',
    accentColor: '#ec4899',
    accentBorder: 'border-pink-500/30',
    textColor: 'text-purple-50',
    subtextColor: 'text-purple-200/60',
  },
  {
    id: 'rainy_coffee',
    name: 'Analog Cafe',
    description: 'Warm sepia, vinyl grain, and quiet rain ambience',
    bgGradient: 'from-[#140e0b] via-[#1c1512] to-[#0f0b09]',
    cardBg: 'bg-[#221a16]/80 backdrop-blur-md',
    accentColor: '#d97706',
    accentBorder: 'border-amber-700/40',
    textColor: 'text-amber-100',
    subtextColor: 'text-amber-300/60',
  },
];

interface ThemeContextType {
  palette: ColorPalette;
  fontType: FontType;
  customImageUrl: string | null;
  autoplay: boolean;
  setPalette: (palette: ColorPalette) => void;
  setFontType: (font: FontType) => void;
  setCustomImageUrl: (url: string | null) => void;
  setAutoplay: (autoplay: boolean) => void;
  fontClass: string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState<ColorPalette>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedPaletteId = localStorage.getItem('scruttin_palette_id');
        if (savedPaletteId) {
          const found = COLOR_PALETTES.find(p => p.id === savedPaletteId);
          if (found) return found;
        }
      } catch (e) {}
    }
    return COLOR_PALETTES[0];
  });

  const [fontType, setFontTypeState] = useState<FontType>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedFont = localStorage.getItem('scruttin_font_type') as FontType;
        if (savedFont && ['editorial', 'grotesque', 'display', 'storyteller'].includes(savedFont)) {
          return savedFont;
        }
      } catch (e) {}
    }
    return 'grotesque';
  });

  const [customImageUrl, setCustomImageUrlState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('scruttin_custom_bg');
      } catch (e) {}
    }
    return null;
  });

  const [autoplay, setAutoplayState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedAutoplay = localStorage.getItem('scruttin_autoplay');
        if (savedAutoplay !== null) {
          return savedAutoplay === 'true';
        }
      } catch (e) {}
    }
    return true;
  });

  const setPalette = (p: ColorPalette) => {
    setPaletteState(p);
    localStorage.setItem('scruttin_palette_id', p.id);
  };

  const setFontType = (f: FontType) => {
    setFontTypeState(f);
    localStorage.setItem('scruttin_font_type', f);
  };

  const setCustomImageUrl = (url: string | null) => {
    setCustomImageUrlState(url);
    if (url) {
      localStorage.setItem('scruttin_custom_bg', url);
    } else {
      localStorage.removeItem('scruttin_custom_bg');
    }
  };

  const setAutoplay = (val: boolean) => {
    setAutoplayState(val);
    localStorage.setItem('scruttin_autoplay', String(val));
  };

  const fontClass =
    fontType === 'editorial'
      ? 'font-editorial'
      : fontType === 'display'
      ? 'font-display'
      : fontType === 'storyteller'
      ? 'font-storyteller'
      : 'font-grotesque';

  return (
    <ThemeContext.Provider
      value={{
        palette,
        fontType,
        customImageUrl,
        autoplay,
        setPalette,
        setFontType,
        setCustomImageUrl,
        setAutoplay,
        fontClass,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
