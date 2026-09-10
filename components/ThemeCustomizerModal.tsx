'use client';

import React, { useRef } from 'react';
import { Palette, Type, Image as ImageIcon, Check, Upload, Trash2 } from 'lucide-react';
import { useTheme, COLOR_PALETTES, type FontType, type ColorPalette } from '@/lib/theme-context';

interface ThemeCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ThemeCustomizerModal({ isOpen, onClose }: ThemeCustomizerModalProps) {
  const {
    palette,
    fontType,
    customImageUrl,
    setPalette,
    setFontType,
    setCustomImageUrl,
  } = useTheme();

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Please choose an image under 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCustomImageUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const fonts: { id: FontType; name: string; description: string; sample: string }[] = [
    {
      id: 'grotesque',
      name: 'Neo-Grotesque Sans',
      description: 'Clean modern street aesthetic, ultra legible',
      sample: 'Authentic street interviews from strangers',
    },
    {
      id: 'editorial',
      name: 'Editorial Serif',
      description: 'Warm literary style with timeless prose',
      sample: 'What is a decision made in five seconds?',
    },
    {
      id: 'display',
      name: 'Punchy Display',
      description: 'Impactful urban poster aesthetic',
      sample: 'NO FILTER. UNINTERRUPTED VOICE.',
    },
    {
      id: 'storyteller',
      name: 'Storyteller Mono',
      description: 'Raw typewriter and field-recording notebook',
      sample: 'Audio reel logged: 02:45 AM, Kreuzberg',
    },
  ];

  return (
    <div
      id="theme-customizer-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="theme-customizer-card"
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Display & Appearance</h2>
              <p className="text-xs text-zinc-400">Personalize background colors, custom images, and typography</p>
            </div>
          </div>
          <button
            id="close-theme-customizer-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Custom Background Image Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 tracking-wide uppercase flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-zinc-400" />
                Custom Background Wallpaper
              </span>
              {customImageUrl && (
                <button
                  id="remove-custom-bg-btn"
                  onClick={() => setCustomImageUrl(null)}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Remove Image
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />

            {customImageUrl ? (
              <div className="relative h-28 rounded-xl overflow-hidden border border-zinc-700 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={customImageUrl}
                  alt="Custom background wallpaper"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    id="change-custom-bg-btn"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800/90 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
                  >
                    Change Image
                  </button>
                  <button
                    id="delete-custom-bg-btn"
                    onClick={() => setCustomImageUrl(null)}
                    className="px-3 py-1.5 rounded-lg bg-rose-900/80 text-xs font-medium text-rose-200 hover:bg-rose-800"
                  >
                    Reset
                  </button>
                </div>
              </div>
            ) : (
              <button
                id="upload-custom-bg-btn"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 rounded-xl border border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-850/50 hover:bg-zinc-800/50 flex flex-col items-center justify-center gap-2 text-zinc-400 transition-colors"
              >
                <Upload className="w-5 h-5 text-zinc-300" />
                <span className="text-xs font-medium text-zinc-300">Upload your own background photo</span>
                <span className="text-[11px] text-zinc-500">Supports JPG, PNG, WebP (Max 5MB)</span>
              </button>
            )}
          </div>

          {/* Color Palettes */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-zinc-300 tracking-wide uppercase">
              Atmospheric Color Palettes
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {COLOR_PALETTES.map((p) => {
                const isSelected = palette.id === p.id && !customImageUrl;
                return (
                  <button
                    key={p.id}
                    id={`palette-${p.id}`}
                    onClick={() => {
                      setPalette(p);
                      if (customImageUrl) setCustomImageUrl(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'bg-zinc-800 border-zinc-500 ring-1 ring-zinc-400'
                        : 'bg-zinc-850/50 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-zinc-200">{p.name}</span>
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-white/20"
                        style={{ backgroundColor: p.accentColor }}
                      />
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">{p.description}</p>
                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-white text-black flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Selection */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-zinc-300 tracking-wide uppercase flex items-center gap-1.5">
              <Type className="w-4 h-4 text-zinc-400" />
              Typography & Font Family
            </span>
            <div className="grid grid-cols-1 gap-2.5">
              {fonts.map((f) => {
                const isSelected = fontType === f.id;
                const fontClass =
                  f.id === 'editorial'
                    ? 'font-editorial'
                    : f.id === 'display'
                    ? 'font-display'
                    : f.id === 'storyteller'
                    ? 'font-storyteller'
                    : 'font-grotesque';

                return (
                  <button
                    key={f.id}
                    id={`font-${f.id}`}
                    onClick={() => setFontType(f.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-zinc-800 border-zinc-500 shadow-sm'
                        : 'bg-zinc-850/50 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-200">{f.name}</span>
                          {isSelected && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-700 text-zinc-300 font-mono">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">{f.description}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                          isSelected ? 'border-white bg-white text-black' : 'border-zinc-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    <div className={`mt-2.5 p-2 rounded-lg bg-zinc-950/60 text-xs text-zinc-300 ${fontClass}`}>
                      &ldquo;{f.sample}&rdquo;
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex justify-end">
          <button
            id="done-theme-customizer-btn"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-sm transition-colors"
          >
            Save Appearance
          </button>
        </div>
      </div>
    </div>
  );
}
