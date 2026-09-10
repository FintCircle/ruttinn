'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Send,
  Sparkles,
  HelpCircle,
  AlertCircle,
  Clock,
  Loader2,
  Volume2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { D1Question } from '@/lib/d1-database';
import { useAuth } from '@/lib/auth-context';

interface RutRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuestion?: D1Question | null;
  onRutPublished: () => void;
}

type RecordingStep = 'idle' | 'recording' | 'review' | 'uploading';

export function RutRecorderModal({
  isOpen,
  onClose,
  initialQuestion,
  onRutPublished,
}: RutRecorderModalProps) {
  const { user, token } = useAuth();

  const [step, setStep] = useState<RecordingStep>('idle');
  const [selectedQuestion, setSelectedQuestion] = useState<D1Question | null>(initialQuestion || null);
  const [questionsList, setQuestionsList] = useState<D1Question[]>([]);
  const [caption, setCaption] = useState<string>('');
  const [recordSeconds, setRecordSeconds] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Audio recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);

  // Web Audio analyzer for live waveform display
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Review audio playback
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState<number>(0);

  // Timer & timing references
  const timerIntervalRef = useRef<any>(null);
  const recordingStartTimeRef = useRef<number>(0);

  const cleanupAllAudio = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
  }, []);

  const resetRecordingState = useCallback(() => {
    setStep('idle');
    setRecordSeconds(0);
    setErrorMsg(null);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setWaveformData([]);
    setIsPreviewPlaying(false);
  }, [audioUrl]);

  const loadQuestions = useCallback(async () => {
    try {
      const res = await fetch('/api/questions');
      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        setQuestionsList(data.questions);
        if (!selectedQuestion && !initialQuestion) {
          setSelectedQuestion(data.questions[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load questions list', e);
    }
  }, [selectedQuestion, initialQuestion]);

  useEffect(() => {
    if (isOpen) {
      if (initialQuestion) {
        setSelectedQuestion(initialQuestion);
      }
      loadQuestions();
      resetRecordingState();
    } else {
      cleanupAllAudio();
    }
  }, [isOpen, initialQuestion, loadQuestions, resetRecordingState, cleanupAllAudio]);

  // Start uninterrupted take (strictly no pause)
  const startRecording = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Initialize Web Audio context and Analyser
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Draw real-time waveform on canvas
      drawLiveWaveform();

      // Collect amplitude data for persistent waveform
      const recordedAmplitudes: number[] = [];

      // MediaRecorder setup
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : undefined,
      });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setStep('review');

        // Normalize collected amplitudes into 48 points
        if (recordedAmplitudes.length > 0) {
          const stepSize = Math.max(1, Math.floor(recordedAmplitudes.length / 48));
          const sampled: number[] = [];
          for (let i = 0; i < 48; i++) {
            const index = Math.min(recordedAmplitudes.length - 1, i * stepSize);
            sampled.push(recordedAmplitudes[index] || 0.2);
          }
          setWaveformData(sampled);
        }

        // Stop media tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(250);
      setStep('recording');
      setRecordSeconds(0);

      // Start 3-minute uninterrupted timer (hard stop at 180s)
      recordingStartTimeRef.current = performance.now();
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((performance.now() - recordingStartTimeRef.current) / 1000);
        setRecordSeconds(elapsed);

        // Record instantaneous volume sample for waveform
        if (analyserRef.current) {
          const bufferLength = analyserRef.current.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const avg = sum / bufferLength / 255;
          recordedAmplitudes.push(Math.round(Math.max(0.1, avg) * 100) / 100);
        }

        // 3-minute hard ceiling (180 seconds)
        if (elapsed >= 180) {
          stopRecording();
        }
      }, 500);
    } catch (err: any) {
      console.error('Microphone access denied', err);
      setErrorMsg('Microphone access was denied or is unavailable. Please grant microphone permission.');
      setStep('idle');
    }
  };

  const drawLiveWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.85;

        // Glowing gradient
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#f59e0b');
        gradient.addColorStop(1, '#ef4444');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

        x += barWidth;
      }
    };

    render();
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  // Playback review controls
  const togglePreviewPlay = () => {
    if (!previewAudioRef.current) return;
    if (isPreviewPlaying) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    } else {
      previewAudioRef.current.play();
      setIsPreviewPlaying(true);
    }
  };

  // Re-record take
  const handleReRecord = () => {
    resetRecordingState();
  };

  // Publish Rut
  const handlePublishRut = async () => {
    if (!selectedQuestion) {
      setErrorMsg('Please select a question to answer.');
      return;
    }
    if (!audioBlob) {
      setErrorMsg('No audio recording found to publish.');
      return;
    }

    setStep('uploading');
    setErrorMsg(null);

    try {
      // 1. Upload audio to Cloudflare R2
      const formData = new FormData();
      formData.append('file', audioBlob, 'rut_recording.webm');
      formData.append('duration', recordSeconds.toString());

      const uploadRes = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'Failed to upload audio to Cloudflare R2');
      }

      const mediaKey = uploadData.media_key;

      // 2. Create Rut in Cloudflare D1
      const rutRes = await fetch('/api/ruts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question_id: selectedQuestion.id,
          caption: caption.trim() || 'A voice from the street.',
          media_key: mediaKey,
          duration_seconds: Math.max(1, recordSeconds),
          waveform_data: waveformData,
        }),
      });

      const rutData = await rutRes.json();
      if (!rutRes.ok) {
        throw new Error(rutData.error || 'Failed to publish Rut to D1');
      }

      // Celebrate successful publication
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {}

      onRutPublished();
      onClose();
    } catch (err: any) {
      console.error('Publish error', err);
      setErrorMsg(err.message || 'Failed to publish voice Rut.');
      setStep('review');
    }
  };

  if (!isOpen) return null;

  const minutes = Math.floor(recordSeconds / 60);
  const seconds = recordSeconds % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  const remainingSeconds = 180 - recordSeconds;
  const remMinutes = Math.floor(remainingSeconds / 60);
  const remSec = remainingSeconds % 60;
  const formattedRemaining = `${remMinutes}:${remSec < 10 ? '0' : ''}${remSec}`;

  return (
    <div
      id="rut-recorder-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        // Prevent accidental dismiss while recording
        if (step === 'recording') return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="rut-recorder-card"
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100">Record a Voice Rut</h2>
              <p className="text-xs text-zinc-400">Uninterrupted take • Max 3:00 • No midway pausing</p>
            </div>
          </div>
          {step !== 'recording' && (
            <button
              id="close-recorder-modal-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center text-sm transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Question Prompt Selection */}
          <div className="p-4 rounded-2xl bg-zinc-850/70 border border-zinc-750 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-amber-400 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                <HelpCircle className="w-3.5 h-3.5" />
                Prompt Being Answered
              </span>
              {step === 'idle' && questionsList.length > 1 && (
                <select
                  id="select-different-question"
                  value={selectedQuestion?.id || ''}
                  onChange={(e) => {
                    const found = questionsList.find((q) => q.id === e.target.value);
                    if (found) setSelectedQuestion(found);
                  }}
                  className="bg-zinc-900 text-zinc-300 border border-zinc-700 rounded-lg px-2 py-1 text-[11px] focus:outline-none"
                >
                  {questionsList.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title.slice(0, 35)}...
                    </option>
                  ))}
                </select>
              )}
            </div>

            <p className="text-sm font-medium text-zinc-100 italic">
              &ldquo;{selectedQuestion?.title || 'What is a decision made in 5 seconds that changed your life?'}&rdquo;
            </p>
            <div className="text-[11px] text-zinc-500">
              Category: {selectedQuestion?.category_name || 'Street Wisdom'}
            </div>
          </div>

          {/* STEP 1: IDLE / READY TO RECORD */}
          {step === 'idle' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center">
              <div className="relative">
                <div className="w-28 h-28 rounded-full bg-rose-500/10 border-2 border-rose-500/30 flex items-center justify-center group hover:scale-105 transition-transform">
                  <button
                    id="start-recording-btn"
                    onClick={startRecording}
                    className="w-20 h-20 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all"
                  >
                    <Mic className="w-10 h-10" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-semibold text-zinc-100">Tap to Start Your Take</h3>
                <p className="text-xs text-zinc-400 max-w-sm">
                  Street interviews are raw and honest. Once you begin, you cannot pause midway. Up to 3 minutes uninterrupted.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" /> Max 3:00
                </span>
                <span>•</span>
                <span>Unedited take</span>
                <span>•</span>
                <span>Auto-upload to R2</span>
              </div>
            </div>
          )}

          {/* STEP 2: ACTIVELY RECORDING (No pause permitted!) */}
          {step === 'recording' && (
            <div className="flex flex-col items-center justify-center py-6 space-y-6">
              {/* Pulsing visualizer and live canvas */}
              <div className="w-full h-24 bg-zinc-950/80 rounded-2xl border border-zinc-800 overflow-hidden relative flex items-center justify-center p-2">
                <canvas ref={canvasRef} width={400} height={96} className="w-full h-full" />
                <div className="absolute top-2 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-mono animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  ON AIR
                </div>
              </div>

              {/* Countdown & Elapsed Display */}
              <div className="text-center space-y-1">
                <div className="text-4xl font-mono font-bold text-zinc-100 tracking-wider">
                  {formattedTime}
                </div>
                <div className="text-xs text-zinc-400 font-mono">
                  {formattedRemaining} remaining (hard limit: 3:00)
                </div>
              </div>

              {/* Stop Recording Button (Strictly No Pause!) */}
              <div className="flex flex-col items-center gap-2">
                <button
                  id="stop-recording-btn"
                  onClick={stopRecording}
                  className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition-transform active:scale-95"
                  title="Finish Recording Take"
                >
                  <Square className="w-6 h-6 fill-white" />
                </button>
                <span className="text-xs text-zinc-400 font-medium">Tap square to complete take</span>
              </div>

              <p className="text-[11px] text-amber-400/80 bg-amber-400/10 px-3 py-1 rounded-full text-center">
                Spontaneous voice rule: No pauses allowed during the 3-minute recording.
              </p>
            </div>
          )}

          {/* STEP 3: REVIEW & PUBLISH */}
          {(step === 'review' || step === 'uploading') && (
            <div className="space-y-5">
              {/* Preview Audio Player */}
              {audioUrl && (
                <div className="p-4 rounded-2xl bg-zinc-850/80 border border-zinc-750 space-y-3">
                  <audio
                    ref={previewAudioRef}
                    src={audioUrl}
                    onEnded={() => setIsPreviewPlaying(false)}
                    onTimeUpdate={() => {
                      if (previewAudioRef.current) {
                        setPreviewCurrentTime(previewAudioRef.current.currentTime);
                      }
                    }}
                  />

                  <div className="flex items-center justify-between text-xs text-zinc-300">
                    <span className="font-semibold flex items-center gap-1.5 text-zinc-200">
                      <Volume2 className="w-4 h-4 text-amber-400" />
                      Listen Back to Your Voice Take
                    </span>
                    <span className="font-mono text-zinc-400">Duration: {formattedTime}</span>
                  </div>

                  {/* Play / Pause button & Waveform preview */}
                  <div className="flex items-center gap-3">
                    <button
                      id="toggle-preview-audio-btn"
                      onClick={togglePreviewPlay}
                      className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center flex-shrink-0 transition-colors"
                    >
                      {isPreviewPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                    </button>

                    {/* Waveform bars representation */}
                    <div className="flex-1 h-10 flex items-center gap-1 bg-zinc-900/90 rounded-xl px-3 border border-zinc-800 overflow-hidden">
                      {waveformData.length > 0 ? (
                        waveformData.slice(0, 36).map((amp, i) => (
                          <div
                            key={i}
                            className={`flex-1 rounded-full transition-all ${
                              isPreviewPlaying ? 'bg-amber-400' : 'bg-zinc-600'
                            }`}
                            style={{
                              height: `${Math.max(15, Math.min(100, amp * 100))}%`,
                            }}
                          />
                        ))
                      ) : (
                        <div className="text-[11px] text-zinc-500">Waveform generated</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Title / Caption Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
                  Title or Caption for this Rut
                </label>
                <input
                  id="rut-caption-input"
                  type="text"
                  placeholder="e.g. Standing outside the station in the rain..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={140}
                  className="w-full px-3.5 py-2.5 bg-zinc-850 border border-zinc-700 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
                />
                <div className="flex justify-between text-[11px] text-zinc-500 px-1">
                  <span>Author: {user?.display_name || 'Anonymous Stranger'}</span>
                  <span>{caption.length}/140</span>
                </div>
              </div>

              {/* Action Buttons: Re-record vs Publish */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  id="re-record-btn"
                  onClick={handleReRecord}
                  disabled={step === 'uploading'}
                  className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs flex items-center justify-center gap-2 border border-zinc-700 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  Discard & Re-record
                </button>

                <button
                  id="publish-rut-btn"
                  onClick={handlePublishRut}
                  disabled={step === 'uploading'}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                >
                  {step === 'uploading' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Storing to R2 & D1...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Publish Rut
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
