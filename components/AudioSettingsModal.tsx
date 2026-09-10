'use client';

import React, { useState, useEffect } from 'react';
import { Volume2, Music, Sparkles, Play, Pause, Sliders, Check } from 'lucide-react';
import { musicEngine, MUSIC_TRACKS, type MusicPresetId } from '@/lib/audio-music';
import { useTheme } from '@/lib/theme-context';

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AudioSettingsModal({ isOpen, onClose }: AudioSettingsModalProps) {
  const { autoplay, setAutoplay } = useTheme();
  const [currentTrack, setCurrentTrack] = useState<MusicPresetId>(musicEngine.getTrack());
  const [musicVolume, setMusicVolume] = useState<number>(musicEngine.getVolume());
  const [isPlayingMusic, setIsPlayingMusic] = useState<boolean>(true);
  const [isDucked, setIsDucked] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentTrack(musicEngine.getTrack());
      setMusicVolume(musicEngine.getVolume());
    }
  }, [isOpen]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsDucked(musicEngine.getIsDucked());
    }, 200);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen) return null;

  const handleTrackSelect = (trackId: MusicPresetId) => {
    setCurrentTrack(trackId);
    musicEngine.setTrack(trackId);
    if (trackId !== 'off') {
      musicEngine.play();
      setIsPlayingMusic(true);
    } else {
      setIsPlayingMusic(false);
    }
  };

  const handleVolumeChange = (vol: number) => {
    setMusicVolume(vol);
    musicEngine.setVolume(vol);
  };

  const toggleMusicPlayback = () => {
    if (isPlayingMusic) {
      musicEngine.stop();
      setIsPlayingMusic(false);
    } else {
      musicEngine.play();
      setIsPlayingMusic(true);
    }
  };

  return (
    <div
      id="audio-settings-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="audio-settings-card"
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Audio & Background Music</h2>
              <p className="text-xs text-zinc-400">Ambient soundscapes with intelligent speech ducking</p>
            </div>
          </div>
          <button
            id="close-audio-settings-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Autoplay setting */}
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-750 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-200">Autoplay Ruts</div>
              <p className="text-xs text-zinc-400">Automatically play each voice Rut as you swipe into view</p>
            </div>
            <button
              id="toggle-autoplay-btn"
              onClick={() => setAutoplay(!autoplay)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoplay ? 'bg-amber-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoplay ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Speech Ducking Status Callout */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-semibold text-amber-300 block mb-1">
                Dynamic Speech Ducking Active
              </span>
              Background music provides rich street texture, and automatically lowers in volume by 75%
              whenever someone is speaking in a Rut.
              <div className="mt-2 flex items-center gap-2">
                <span className="text-zinc-400">Status:</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    isDucked ? 'bg-amber-500/30 text-amber-300 animate-pulse' : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isDucked ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  {isDucked ? 'Ducking Voice (Lower Volume)' : 'Full Ambient Presence'}
                </span>
              </div>
            </div>
          </div>

          {/* Music Volume Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-zinc-300" />
                Background Music Level
              </span>
              <span className="text-zinc-200">{Math.round(musicVolume * 100)}%</span>
            </div>
            <input
              id="music-volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={musicVolume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              disabled={currentTrack === 'off'}
              className="w-full accent-amber-500 bg-zinc-800 rounded-lg cursor-pointer h-2"
            />
          </div>

          {/* Platform Ambient Music Tracks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 tracking-wide uppercase">
                Select Ambient Atmosphere
              </span>
              {currentTrack !== 'off' && (
                <button
                  id="toggle-music-play-btn"
                  onClick={toggleMusicPlayback}
                  className="text-xs flex items-center gap-1 text-amber-400 hover:text-amber-300"
                >
                  {isPlayingMusic ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  {isPlayingMusic ? 'Mute Atmosphere' : 'Preview Atmosphere'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {MUSIC_TRACKS.map((t) => {
                const isSelected = currentTrack === t.id;
                return (
                  <button
                    key={t.id}
                    id={`track-option-${t.id}`}
                    onClick={() => handleTrackSelect(t.id)}
                    className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/50 shadow-sm'
                        : 'bg-zinc-800/40 border-zinc-800 hover:bg-zinc-800/70 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${isSelected ? 'text-amber-300' : 'text-zinc-200'}`}>
                          {t.name}
                        </span>
                        {isSelected && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/30 text-amber-200 font-mono">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">{t.tagline}</p>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        isSelected ? 'border-amber-400 bg-amber-500 text-zinc-950' : 'border-zinc-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
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
            id="done-audio-settings-btn"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium text-sm transition-colors"
          >
            Apply & Return to Feed
          </button>
        </div>
      </div>
    </div>
  );
}
