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
  Radio,
  Search,
  Users,
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
      : Array.from({ length: 40 }, () => 0.35);

    const progress = duration > 0 ? currentTime / duration : 0;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const barCount = waveform.length;
    const barWidth = 4;
    const gap = 3.5;
    const totalContentWidth = barCount * (barWidth + gap) - gap;
    const startX = Math.max(0, (width - totalContentWidth) / 2);

    for (let i = 0; i < barCount; i++) {
      const x = startX + i * (barWidth + gap);
      const amp = waveform[i];
      const barHeight = Math.max(6, amp * (height - 8));
      const y = (height - barHeight) / 2;

      const isPassed = i / barCount <= progress;

      if (isPassed) {
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
      }

      ctx.beginPath();
      const radius = 2;
      ctx.roundRect(x, y, barWidth, barHeight, radius);
      ctx.fill();
    }
  }, [currentTime, duration, currentRut]);

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

  const formatCount = (count: number) => {
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return count.toString();
  };

  return (
    <div
      ref={containerRef}
      id="scruttin-player-root"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full h-screen h-[100dvh] overflow-hidden flex flex-col justify-between select-none bg-black text-white ${fontClass}`}
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
        }}
      />

      {/* ================= TOP HEADER (MATCHING SCREENSHOT) ================= */}
      <header className="z-30 w-full max-w-md mx-auto px-5 pt-3 pb-1 flex items-center justify-between">
        {/* Brand: scruttin in bold orange */}
        <span className="font-extrabold text-xl tracking-tight text-amber-500 lowercase select-none">
          scruttin
        </span>

        {/* Right Controls: ll muted + count */}
        <div className="flex items-center gap-3">
          <button
            id="toggle-voice-mute-btn"
            onClick={() => {
              const nextMuted = !isMuted;
              setIsMuted(nextMuted);
              if (audioElementRef.current) {
                audioElementRef.current.volume = nextMuted ? 0 : volume;
              }
            }}
            className="px-2.5 py-1 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 flex items-center gap-1.5 text-zinc-400 text-xs font-mono transition-colors cursor-pointer"
            title={isMuted ? 'Unmute voice' : 'Mute voice'}
          >
            <span className="flex items-end gap-0.5 h-3">
              <span
                className={`w-0.5 bg-zinc-400 rounded-full transition-all ${
                  !isMuted && isPlaying ? 'h-2 animate-pulse' : 'h-1.5'
                }`}
              />
              <span
                className={`w-0.5 bg-zinc-400 rounded-full transition-all ${
                  !isMuted && isPlaying ? 'h-3 animate-pulse delay-75' : 'h-3'
                }`}
              />
              <span
                className={`w-0.5 bg-zinc-400 rounded-full transition-all ${
                  !isMuted && isPlaying ? 'h-2 animate-pulse delay-150' : 'h-2'
                }`}
              />
            </span>
            <span>{isMuted ? 'muted' : 'sound'}</span>
          </button>

          <span className="text-xs font-mono text-zinc-500">
            {ruts.length > 0 ? `${currentIndex + 1} / ${ruts.length}` : '1 / 1'}
          </span>
        </div>
      </header>

      {/* ================= MAIN PLAYER CANVAS ================= */}
      <main className="relative flex-1 flex flex-col justify-between px-5 py-2 max-w-md mx-auto w-full overflow-hidden select-none">
        {isLoadingFeed ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3 text-zinc-400">
            <div className="w-10 h-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            <p className="text-xs font-mono">Tuning street frequency...</p>
          </div>
        ) : !currentRut ? (
          /* Empty Feed / All Heard State */
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
                className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                Record a New Voice Rut
              </button>

              <button
                id="reset-listened-feed-btn"
                onClick={handleResetListened}
                className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Rediscover Past Voices
              </button>
            </div>
          </div>
        ) : (
          /* Active Single Rut Player (Exact Layout from Attached Screenshot) */
          <>
            {/* Top Question Section */}
            <div className="w-full text-left space-y-1 mt-1 pr-14">
              {/* Category Tag */}
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-rose-400">
                <span>{currentRut.category_id === 'cat_love' ? '❤️' : '🎙️'}</span>
                <span>{currentRut.category_name || 'Love & Relationships'}</span>
              </div>

              {/* QUESTION label */}
              <p className="text-[11px] font-bold tracking-widest text-zinc-500 uppercase mt-2">
                QUESTION
              </p>

              {/* Question Heading */}
              <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-snug mt-1">
                &ldquo;{currentRut.question_title}&rdquo;
              </h1>
            </div>

            {/* Center Speaker Avatar with Play Button & Info */}
            <div className="relative flex-1 flex flex-col items-center justify-center my-auto">
              {/* Avatar Container with Ripple rings */}
              <div
                id="center-avatar-container"
                className="relative cursor-pointer group"
                onClick={togglePlayPause}
              >
                {/* Concentric voice ripples radiating when audio is playing */}
                {isPlaying && (
                  <>
                    <span className="absolute -inset-2 rounded-full border border-amber-400/40 animate-ping pointer-events-none" />
                    <span className="absolute -inset-4 rounded-full border border-amber-500/25 animate-voice-ripple pointer-events-none" />
                    <span
                      className="absolute -inset-7 rounded-full border border-amber-500/15 animate-voice-ripple pointer-events-none"
                      style={{ animationDelay: '0.7s' }}
                    />
                  </>
                )}

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    currentRut.author_avatar ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${currentRut.author_uid}`
                  }
                  alt={currentRut.author_name}
                  className="w-32 h-32 sm:w-36 sm:h-36 rounded-full object-cover border border-zinc-800 shadow-2xl transition-transform group-hover:scale-102"
                />

                {/* Center play triangle overlay button */}
                <button
                  id="center-play-toggle-btn"
                  className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/40 backdrop-blur-xs flex items-center justify-center text-white transition-all group-hover:bg-black/55 shadow-lg cursor-pointer"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>
              </div>

              {/* Speaker Name */}
              <h2 className="text-base sm:text-lg font-bold text-white mt-3.5 tracking-tight text-center">
                {currentRut.author_name}
              </h2>

              {/* Rut Duration */}
              <p className="text-xs text-zinc-400 font-mono mt-0.5 text-center">
                {formatTime(duration || currentRut.duration_seconds)} rut
              </p>

              {/* Pill: 2 more answered */}
              <button
                id="more-answered-pill"
                onClick={() => setIsQuestionsOpen(true)}
                className="mt-3 px-3.5 py-1.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <div className="flex -space-x-1.5 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80"
                    alt="User"
                    className="inline-block w-4 h-4 rounded-full ring-1 ring-zinc-900 object-cover"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&auto=format&fit=crop&q=80"
                    alt="User"
                    className="inline-block w-4 h-4 rounded-full ring-1 ring-zinc-900 object-cover"
                  />
                </div>
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[11px] font-medium">2 more answered</span>
              </button>
            </div>

            {/* Right Side Vertical Action Rail */}
            <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/10 flex flex-col items-center gap-4 z-30">
              {/* Like Button */}
              <div className="flex flex-col items-center gap-1">
                <button
                  id="like-rut-btn"
                  onClick={handleToggleLike}
                  className="relative w-12 h-12 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-white transition-all active:scale-95 cursor-pointer overflow-hidden"
                  title="Like Rut"
                >
                  <Heart
                    className={`w-5 h-5 ${
                      currentRut.user_liked ? 'fill-rose-500 text-rose-500' : 'text-zinc-200'
                    }`}
                  />
                  {/* Orange accent bar on the right edge */}
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-amber-500 rounded-l" />
                </button>
                <span className="text-xs font-mono text-zinc-400">
                  {formatCount(currentRut.likes_count)}
                </span>
              </div>

              {/* Answers / Comments Button with Badge 3 */}
              <div className="flex flex-col items-center gap-1">
                <button
                  id="comments-rut-btn"
                  onClick={() => setIsQuestionsOpen(true)}
                  className="relative w-12 h-12 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-white transition-all active:scale-95 cursor-pointer"
                  title="View responses"
                >
                  <MessageSquare className="w-5 h-5 text-zinc-200" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-bold flex items-center justify-center">
                    3
                  </span>
                </button>
                <span className="text-xs font-mono text-zinc-400">134</span>
              </div>

              {/* Share Button */}
              <div className="flex flex-col items-center gap-1">
                <button
                  id="share-rut-btn"
                  onClick={handleShare}
                  className="w-12 h-12 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-white transition-all active:scale-95 cursor-pointer"
                  title="Share Rut"
                >
                  <Share2 className="w-5 h-5 text-zinc-200" />
                </button>
                <span className="text-xs font-mono text-zinc-400">89</span>
              </div>
            </div>

            {/* Waveform & Scrubber Section */}
            <div className="w-full pb-3 space-y-1.5">
              <div className="w-full h-11 flex items-center justify-center px-1">
                <canvas
                  ref={waveformCanvasRef}
                  width={340}
                  height={44}
                  className="w-full h-full cursor-pointer"
                  onClick={(e) => {
                    if (!duration || !audioElementRef.current) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const newTime = ratio * duration;
                    setCurrentTime(newTime);
                    audioElementRef.current.currentTime = newTime;
                  }}
                />
              </div>

              {/* Time & NEXT RUT Hint */}
              <div className="flex items-center justify-between text-xs font-mono text-zinc-500 px-1">
                <span>{formatTime(currentTime)}</span>
                <button
                  id="next-rut-hint-btn"
                  onClick={goToNextRut}
                  className="flex flex-col items-center text-zinc-500 hover:text-zinc-300 transition-colors group cursor-pointer"
                >
                  <ChevronUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
                  <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
                    NEXT RUT
                  </span>
                </button>
                <span>{formatTime(duration || currentRut.duration_seconds)}</span>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ================= FIXED BOTTOM NAVIGATION BAR ================= */}
      <footer className="z-40 w-full bg-black border-t border-zinc-900 px-6 py-2 select-none">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {/* Stream Tab (Active) */}
          <button
            id="nav-stream-tab"
            onClick={() => fetchFeed(selectedCategory)}
            className="flex flex-col items-center cursor-pointer"
          >
            <div className="w-13 h-8.5 rounded-2xl bg-amber-500 flex items-center justify-center text-zinc-950 shadow-md shadow-amber-500/20">
              <Radio className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-bold text-amber-500 mt-1">Stream</span>
          </button>

          {/* Questions Tab */}
          <button
            id="nav-questions-tab"
            onClick={() => setIsQuestionsOpen(true)}
            className="flex flex-col items-center text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <Search className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">Questions</span>
          </button>

          {/* Center Floating Mic Record Button */}
          <button
            id="nav-record-btn"
            onClick={handleAnswerCurrentQuestion}
            className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center shadow-lg shadow-amber-500/30 active:scale-95 transition-all -translate-y-1 cursor-pointer"
            title="Record your voice Rut"
          >
            <Mic className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Profile Tab */}
          <button
            id="nav-profile-tab"
            onClick={() => setIsAuthOpen(true)}
            className="flex flex-col items-center text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">Profile</span>
          </button>
        </div>
      </footer>

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
