'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Heart,
  Share2,
  Flag,
  Mic,
  Music,
  Palette,
  Bell,
  HelpCircle,
  User,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Sliders,
  Check,
  FastForward,
  Layers,
  Flame,
  Moon,
  Compass,
  BookOpen,
  MessageSquare,
  LayoutTemplate,
  ChevronUp,
} from 'lucide-react';
import type { D1Rut, D1Question, D1Category } from '@/lib/d1-database';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { musicEngine } from '@/lib/audio-music';
import { RutRecorderModal } from './RutRecorderModal';
import { QuestionsSheet } from './QuestionsSheet';
import { AudioSettingsModal } from './AudioSettingsModal';
import { ThemeCustomizerModal } from './ThemeCustomizerModal';
import { NotificationsModal } from './NotificationsModal';
import { ReportModal } from './ReportModal';
import { AuthModal } from './AuthModal';

export function RutFeedPlayer() {
  const { user, token } = useAuth();
  const { palette, fontClass, customImageUrl, autoplay } = useTheme();

  // Feed State
  const [ruts, setRuts] = useState<D1Rut[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isLoadingFeed, setIsLoadingFeed] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<D1Category[]>([]);
  const [listenedCount, setListenedCount] = useState<number>(0);

  // Active Rut Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isDuckingActive, setIsDuckingActive] = useState<boolean>(false);
  const [likeAnimation, setLikeAnimation] = useState<boolean>(false);
  const [shareToast, setShareToast] = useState<boolean>(false);

  // Modals state
  const [isRecorderOpen, setIsRecorderOpen] = useState<boolean>(false);
  const [recorderInitialQuestion, setRecorderInitialQuestion] = useState<D1Question | null>(null);
  const [isQuestionsOpen, setIsQuestionsOpen] = useState<boolean>(false);
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState<boolean>(false);
  const [isThemeOpen, setIsThemeOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);

  // Audio elements & animation refs
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentRut: D1Rut | undefined = ruts[currentIndex];

  // Load Categories & Feed
  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFeed = useCallback(async (cat = selectedCategory) => {
    setIsLoadingFeed(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (user?.firebase_uid) headers['X-Client-Uid'] = user.firebase_uid;

      const queryParam = cat && cat !== 'all' ? `?category=${cat}` : '';
      const res = await fetch(`/api/feed${queryParam}`, { headers });
      const data = await res.json();

      setRuts(data.ruts || []);
      setCurrentIndex(0);
      setListenedCount(data.listenedCount || 0);
    } catch (e) {
      console.error('Failed to fetch feed', e);
    } finally {
      setIsLoadingFeed(false);
    }
  }, [token, user, selectedCategory]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchFeed(selectedCategory);
  }, [selectedCategory, fetchFeed]);

  // Handle current rut audio load and autoplay
  useEffect(() => {
    if (!currentRut) {
      setIsPlaying(false);
      musicEngine.unduck();
      return;
    }

    // Set duration from metadata
    setDuration(currentRut.duration_seconds || 30);
    setCurrentTime(0);

    if (audioElementRef.current) {
      // Audio stream URL from R2 storage endpoint
      audioElementRef.current.src = `/api/media/${encodeURIComponent(currentRut.media_key)}`;
      audioElementRef.current.playbackRate = playbackRate;
      audioElementRef.current.volume = isMuted ? 0 : volume;

      if (autoplay) {
        audioElementRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
            musicEngine.duck();
            setIsDuckingActive(true);
          })
          .catch((e) => {
            console.log('Autoplay blocked by browser policy:', e);
            setIsPlaying(false);
            musicEngine.unduck();
            setIsDuckingActive(false);
          });
      } else {
        setIsPlaying(false);
        musicEngine.unduck();
        setIsDuckingActive(false);
      }
    }
  }, [currentIndex, currentRut, autoplay, isMuted, playbackRate, volume]);

  // Clean ducking state when component unmounts
  useEffect(() => {
    return () => {
      musicEngine.unduck();
    };
  }, []);

  // Sync ducking state
  useEffect(() => {
    if (isPlaying) {
      musicEngine.duck();
      setIsDuckingActive(true);
    } else {
      musicEngine.unduck();
      setIsDuckingActive(false);
    }
  }, [isPlaying]);

  // Draw animated waveform on canvas
  useEffect(() => {
    if (!waveformCanvasRef.current || !currentRut) return;
    const canvas = waveformCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const waveform = currentRut.waveform_data && currentRut.waveform_data.length > 0
      ? currentRut.waveform_data
      : Array.from({ length: 48 }, () => 0.4);

    const progress = duration > 0 ? currentTime / duration : 0;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const barCount = waveform.length;
    const barWidth = width / barCount - 2;

    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + 2);
      const amp = waveform[i];
      const barHeight = Math.max(8, amp * (height - 12));
      const y = (height - barHeight) / 2;

      const isPassed = i / barCount <= progress;

      // Color logic: accent color for played portion
      if (isPassed) {
        ctx.fillStyle = palette.accentColor || '#f59e0b';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      }

      ctx.beginPath();
      // Rounded bar
      const radius = 2;
      ctx.roundRect(x, y, barWidth, barHeight, radius);
      ctx.fill();
    }
  }, [currentTime, duration, currentRut, palette.accentColor]);

  // Ephemeral Rule Execution:
  // "Plus once one listens to a rut they can't access it again once they swipe to next."
  const markCurrentRutListened = useCallback(async (rutId: string) => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (user?.firebase_uid) headers['X-Client-Uid'] = user.firebase_uid;

      await fetch(`/api/ruts/${rutId}/listened`, {
        method: 'POST',
        headers,
      });
      setListenedCount((prev) => prev + 1);
    } catch (e) {
      console.error('Failed to mark rut as listened', e);
    }
  }, [token, user]);

  // Swipe / Next Rut Transition
  const goToNextRut = useCallback(async () => {
    if (!currentRut) return;

    // 1. Mark current rut as listened so it disappears from future feed
    await markCurrentRutListened(currentRut.id);

    if (currentIndex < ruts.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Reached the end of available unlistened ruts
      setCurrentIndex(ruts.length);
    }
  }, [currentRut, currentIndex, ruts.length, markCurrentRutListened]);

  // Reset listened history
  const handleResetListened = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (user?.firebase_uid) headers['X-Client-Uid'] = user.firebase_uid;

      await fetch('/api/feed/reset-listened', {
        method: 'POST',
        headers,
      });
      fetchFeed(selectedCategory);
    } catch (e) {
      console.error('Failed to reset listened history', e);
    }
  };

  // Play / Pause Toggle
  const togglePlayPause = useCallback(() => {
    if (!audioElementRef.current) return;
    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
      musicEngine.unduck();
      setIsDuckingActive(false);
    } else {
      audioElementRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          musicEngine.duck();
          setIsDuckingActive(true);
        })
        .catch(console.error);
    }
  }, [isPlaying]);

  // Seek Progress
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = targetTime;
    }
  };

  // Speed Switcher
  const togglePlaybackSpeed = () => {
    const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = nextSpeed;
    }
  };

  // Like Rut
  const handleToggleLike = async () => {
    if (!currentRut) return;
    const rutId = currentRut.id;

    // Optimistic update
    setRuts((prev) =>
      prev.map((r) => {
        if (r.id === rutId) {
          const wasLiked = r.user_liked;
          return {
            ...r,
            user_liked: !wasLiked,
            likes_count: wasLiked ? Math.max(0, r.likes_count - 1) : r.likes_count + 1,
          };
        }
        return r;
      })
    );

    setLikeAnimation(true);
    setTimeout(() => setLikeAnimation(false), 800);

    try {
      const res = await fetch(`/api/ruts/${rutId}/like`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setRuts((prev) =>
          prev.map((r) => (r.id === rutId ? { ...r, likes_count: data.likesCount, user_liked: data.liked } : r))
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Share Rut
  const handleShare = () => {
    if (!currentRut) return;
    const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://scruttin.fm';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2400);
    }
  };

  // Open Recorder pre-tagged to current question
  const handleAnswerCurrentQuestion = () => {
    if (currentRut) {
      setRecorderInitialQuestion({
        id: currentRut.question_id,
        title: currentRut.question_title || 'Street Inquiry',
        category_id: currentRut.category_id || '',
        category_name: currentRut.category_name || '',
        author_uid: currentRut.author_uid,
        author_name: currentRut.author_name,
        created_at: currentRut.created_at,
        answer_count: 1,
      });
    }
    setIsRecorderOpen(true);
  };

  // Swipe Gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    // Swiped UP more than 50px
    if (deltaY > 50) {
      goToNextRut();
    }
    touchStartY.current = null;
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') {
        goToNextRut();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlayPause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextRut, togglePlayPause]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      ref={containerRef}
      id="scruttin-player-root"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full h-screen h-[100dvh] overflow-hidden flex flex-col justify-between select-none ${fontClass} ${
        customImageUrl ? '' : `bg-gradient-to-b ${palette.bgGradient}`
      }`}
      style={
        customImageUrl
          ? {
              backgroundImage: `linear-gradient(rgba(10, 10, 14, 0.82), rgba(10, 10, 14, 0.92)), url(${customImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : {}
      }
    >
      {/* Hidden Native Audio Element */}
      <audio
        ref={audioElementRef}
        onTimeUpdate={() => {
          if (audioElementRef.current) {
            setCurrentTime(audioElementRef.current.currentTime);
          }
        }}
        onDurationChange={() => {
          if (audioElementRef.current && audioElementRef.current.duration) {
            setDuration(audioElementRef.current.duration);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          musicEngine.unduck();
          setIsDuckingActive(false);
          // Optional: smoothly swipe to next or stay
        }}
      />

      {/* ================= TOP NAVIGATION BAR ================= */}
      <header className="z-30 w-full px-4 pt-4 pb-2 flex items-center justify-between backdrop-blur-sm">
        {/* Brand & Tagline */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center font-bold text-base shadow-lg shadow-amber-500/20">
            S
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              Scruttin
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                VOICE
              </span>
            </span>
          </div>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Questions Explorer */}
          <button
            id="open-questions-sheet-btn"
            onClick={() => setIsQuestionsOpen(true)}
            className="px-3 py-1.5 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
            title="Browse street questions & prompts"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Prompts</span>
          </button>

          {/* Audio & Ducking Settings */}
          <button
            id="open-audio-settings-btn"
            onClick={() => setIsAudioSettingsOpen(true)}
            className="relative p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs transition-all active:scale-95"
            title="Background music & ducking controls"
          >
            <Music className="w-4 h-4 text-amber-400" />
            {isDuckingActive && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>

          {/* Theme & Display Customizer */}
          <button
            id="open-theme-customizer-btn"
            onClick={() => setIsThemeOpen(true)}
            className="p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs transition-all active:scale-95"
            title="Custom background and fonts"
          >
            <Palette className="w-4 h-4 text-sky-400" />
          </button>

          {/* Activity Notifications */}
          <button
            id="open-notifications-btn"
            onClick={() => setIsNotificationsOpen(true)}
            className="p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs transition-all active:scale-95"
            title="Activity alerts"
          >
            <Bell className="w-4 h-4 text-zinc-300" />
          </button>

          {/* Profile / Account */}
          <button
            id="open-auth-modal-btn"
            onClick={() => setIsAuthOpen(true)}
            className="p-1 rounded-full border border-zinc-700 hover:border-amber-400 transition-all active:scale-95"
            title="Profile & Firebase Identity"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.firebase_uid || 'guest'}`}
              alt={user?.display_name || 'User'}
              className="w-7 h-7 rounded-full object-cover"
            />
          </button>
        </div>
      </header>

      {/* Category Filter Chips Bar */}
      <div className="z-20 px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <button
          id="feed-category-all"
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            selectedCategory === 'all'
              ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
              : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
          }`}
        >
          All Corners
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            id={`feed-category-${c.id}`}
            onClick={() => setSelectedCategory(c.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedCategory === c.id
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color || '#f59e0b' }} />
            {c.name}
          </button>
        ))}
      </div>

      {/* ================= MAIN FULL-SCREEN AUDIO PLAYER CANVAS ================= */}
      <main className="relative flex-1 flex flex-col justify-between items-center px-4 sm:px-6 max-w-2xl mx-auto w-full overflow-hidden select-none">
        {isLoadingFeed ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3 text-zinc-400">
            <div className="w-12 h-12 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            <p className="text-xs font-mono">Tuning street frequency...</p>
          </div>
        ) : !currentRut ? (
          /* Empty Feed / All Ruts Heard state */
          <div
            id="empty-feed-card"
            className="my-auto w-full p-8 rounded-3xl bg-zinc-900/90 border border-zinc-800 text-center space-y-5 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-300"
          >
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-zinc-100">All Street Voices Heard</h2>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                As per Scruttin&apos;s authentic ephemeral rule, each street Rut can only be listened to once. You have heard{' '}
                <strong className="text-amber-300">{listenedCount}</strong> voices on this corner!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                id="record-new-rut-empty-btn"
                onClick={() => {
                  setRecorderInitialQuestion(null);
                  setIsRecorderOpen(true);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
              >
                <Mic className="w-4 h-4" />
                Record a New Voice Rut
              </button>

              <button
                id="reset-listened-feed-btn"
                onClick={handleResetListened}
                className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Rediscover Past Voices
              </button>
            </div>
          </div>
        ) : (
          /* Active Single Rut Player */
          <div className="relative w-full h-full flex flex-col justify-between items-center pt-2 pb-5">
            {/* Center Area: Lifted Profile Image with Centered Ring Ripples */}
            <div className="relative flex-1 flex flex-col items-center justify-center w-full -translate-y-3 sm:-translate-y-6">
              {/* Concentric Voice Ring Ripples originating directly from user profile image */}
              <div className="relative flex items-center justify-center">
                {/* Voice ripples radiating outward from user profile image */}
                {isPlaying ? (
                  <>
                    <span className="absolute w-28 h-28 sm:w-36 sm:h-36 rounded-full border border-amber-400/50 animate-ping pointer-events-none" />
                    <span className="absolute w-36 h-36 sm:w-48 sm:h-48 rounded-full border-2 border-amber-500/40 animate-voice-ripple pointer-events-none" />
                    <span
                      className="absolute w-48 h-48 sm:w-64 sm:h-64 rounded-full border border-amber-500/25 animate-voice-ripple pointer-events-none"
                      style={{ animationDelay: '0.6s' }}
                    />
                    <span
                      className="absolute w-60 h-60 sm:w-80 sm:h-80 rounded-full border border-amber-500/10 animate-voice-ripple pointer-events-none"
                      style={{ animationDelay: '1.2s' }}
                    />
                  </>
                ) : (
                  <span className="absolute w-28 h-28 sm:w-36 sm:h-36 rounded-full border border-zinc-700/40 opacity-40 pointer-events-none scale-95" />
                )}

                {/* Centered User Profile Image */}
                <div
                  id="center-avatar-container"
                  className="relative z-10 cursor-pointer group select-none"
                  onClick={togglePlayPause}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      currentRut.author_avatar ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${currentRut.author_uid}`
                    }
                    alt={currentRut.author_name}
                    className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-zinc-900 shadow-2xl transition-transform group-hover:scale-105"
                  />
                  <button
                    id="center-play-toggle-btn"
                    className={`absolute inset-0 m-auto w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
                      isPlaying
                        ? 'bg-black/35 text-white opacity-0 group-hover:opacity-100'
                        : 'bg-amber-500 text-zinc-950 opacity-100 shadow-xl shadow-amber-500/40'
                    }`}
                    aria-label={isPlaying ? 'Pause Rut' : 'Play Rut'}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Dynamic Waveform Visualizer Canvas below avatar */}
              <div className="w-full max-w-xs sm:max-w-md h-9 sm:h-11 mt-4 px-4 flex items-center justify-center z-10">
                <canvas
                  ref={waveformCanvasRef}
                  width={360}
                  height={44}
                  className="w-full h-full cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = (e.clientX - rect.left) / rect.width;
                    const newTime = ratio * duration;
                    setCurrentTime(newTime);
                    if (audioElementRef.current) audioElementRef.current.currentTime = newTime;
                  }}
                />
              </div>

              {/* Speech Ducking Live Indicator */}
              <div className="mt-2.5 flex items-center gap-2 z-10">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider transition-colors ${
                    isDuckingActive
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-zinc-800/40 text-zinc-500 border border-zinc-800'
                  }`}
                >
                  <Music className="w-3 h-3" />
                  {isDuckingActive ? 'MUSIC DUCKED (VOICE ACTIVE)' : 'AMBIENT READY'}
                </span>
              </div>
            </div>

            {/* Right Side Vertical Action Rail (TikTok Style, pinned bottom-right) */}
            <div className="absolute right-2 sm:right-4 bottom-24 sm:bottom-28 flex flex-col items-center gap-3.5 z-30">
              {/* Like Button */}
              <div className="flex flex-col items-center gap-0.5">
                <button
                  id="like-rut-btn"
                  onClick={handleToggleLike}
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all ${
                    currentRut.user_liked
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                      : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 backdrop-blur-md'
                  } ${likeAnimation ? 'scale-125' : 'scale-100'}`}
                  title="Like voice Rut"
                >
                  <Heart
                    className={`w-5 h-5 ${currentRut.user_liked ? 'fill-white' : 'stroke-current'}`}
                  />
                </button>
                <span className="text-[10px] font-mono text-zinc-300 font-semibold">{currentRut.likes_count}</span>
              </div>

              {/* Answer Prompt / Record Rut Shortcut */}
              <div className="flex flex-col items-center gap-0.5">
                <button
                  id="record-rut-shortcut-btn"
                  onClick={handleAnswerCurrentQuestion}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center shadow-lg shadow-amber-500/25 transition-transform active:scale-95"
                  title="Record your own Rut for this question"
                >
                  <Mic className="w-5 h-5" />
                </button>
                <span className="text-[9px] font-medium text-amber-300">Answer</span>
              </div>

              {/* Next Rut (Swipe Up / Tap) */}
              <div className="flex flex-col items-center gap-0.5">
                <button
                  id="swipe-next-rut-btn"
                  onClick={goToNextRut}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 backdrop-blur-md flex items-center justify-center transition-transform active:scale-95"
                  title="Next stranger's voice (or swipe up)"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
                <span className="text-[9px] text-zinc-400">Next</span>
              </div>

              {/* Share Rut */}
              <div className="flex flex-col items-center gap-0.5">
                <button
                  id="share-rut-btn"
                  onClick={handleShare}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 backdrop-blur-md flex items-center justify-center transition-transform active:scale-95"
                  title="Share Rut link"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <span className="text-[9px] text-zinc-400">Share</span>
              </div>

              {/* Report Rut */}
              <div className="flex flex-col items-center gap-0.5">
                <button
                  id="report-rut-btn"
                  onClick={() => setIsReportOpen(true)}
                  className="w-8 h-8 rounded-full bg-zinc-950/60 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-800 flex items-center justify-center transition-colors"
                  title="Report inappropriate Rut"
                >
                  <Flag className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ================= QUESTION DISPLAY AT THE BOTTOM (NO CARD) ================= */}
            <div
              id="rut-question-bottom"
              className="w-full text-left pr-14 sm:pr-16 z-20 space-y-1.5"
            >
              {/* Category & Ephemeral Tag */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {currentRut.category_name || 'Street Inquiry'}
                </span>
                <span className="text-zinc-500 text-xs">•</span>
                <span className="text-[11px] font-mono text-zinc-400">Single listen</span>
              </div>

              {/* The Question Text (No card container, clean high-contrast display typography) */}
              <h1 className="text-lg sm:text-2xl font-extrabold text-zinc-100 tracking-tight leading-snug drop-shadow-md">
                &ldquo;{currentRut.question_title}&rdquo;
              </h1>

              {/* Speaker Attribution & Caption */}
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <span className="font-bold text-amber-200/95">@{currentRut.author_name}</span>
                {currentRut.caption && (
                  <>
                    <span className="text-zinc-500">•</span>
                    <p className="italic text-zinc-400 truncate max-w-xs sm:max-w-md">
                      &ldquo;{currentRut.caption}&rdquo;
                    </p>
                  </>
                )}
              </div>

              {/* Direct Quick Answer Button */}
              <div className="pt-1 flex items-center gap-3">
                <button
                  id="answer-current-prompt-btn"
                  onClick={handleAnswerCurrentQuestion}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-transform active:scale-95 shadow-md shadow-amber-500/20"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Answer this Prompt</span>
                </button>

                <span className="text-[11px] font-mono text-zinc-500">
                  Swipe up for next voice ↑
                </span>
              </div>

              {/* Minimal Scrubber Line at the very bottom */}
              <div className="pt-2 w-full">
                <div
                  id="rut-seek-slider"
                  onClick={(e) => {
                    if (!duration || !audioElementRef.current) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const newTime = ratio * duration;
                    setCurrentTime(newTime);
                    audioElementRef.current.currentTime = newTime;
                  }}
                  className="w-full h-1 bg-white/10 hover:h-2 transition-all cursor-pointer relative rounded-full overflow-hidden"
                  title="Click to seek"
                >
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-400 mt-1 px-0.5">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Share Toast */}
      {shareToast && (
        <div
          id="share-toast-notification"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-amber-500 text-zinc-950 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          Rut link copied to clipboard!
        </div>
      )}

      {/* ================= MODALS & SHEETS ================= */}
      <RutRecorderModal
        isOpen={isRecorderOpen}
        onClose={() => setIsRecorderOpen(false)}
        initialQuestion={recorderInitialQuestion}
        onRutPublished={() => fetchFeed(selectedCategory)}
      />

      <QuestionsSheet
        isOpen={isQuestionsOpen}
        onClose={() => setIsQuestionsOpen(false)}
        onSelectQuestionToAnswer={(q) => {
          setRecorderInitialQuestion(q);
          setIsRecorderOpen(true);
        }}
      />

      <AudioSettingsModal
        isOpen={isAudioSettingsOpen}
        onClose={() => setIsAudioSettingsOpen(false)}
      />

      <ThemeCustomizerModal
        isOpen={isThemeOpen}
        onClose={() => setIsThemeOpen(false)}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        rut={currentRut || null}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
}
