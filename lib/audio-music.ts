// Web Audio API generative ambient music engine with real-time Speech Ducking
// Provides soft background music that automatically ducks when a voice Rut is playing

export type MusicPresetId = 'lofi_rain' | 'late_night' | 'ambient_tape' | 'acoustic_warmth' | 'off';

export interface MusicTrackOption {
  id: MusicPresetId;
  name: string;
  tagline: string;
  vibe: string;
}

export const MUSIC_TRACKS: MusicTrackOption[] = [
  {
    id: 'lofi_rain',
    name: 'Rainy Kreuzberg Cafe',
    tagline: 'Warm electric piano & subtle vinyl texture',
    vibe: 'Reflective, cozy, late afternoon rain',
  },
  {
    id: 'late_night',
    name: 'Late Night Neon',
    tagline: 'Deep ambient pad with velvet warmth',
    vibe: 'Contemplative, midnight street walk',
  },
  {
    id: 'ambient_tape',
    name: 'Tape Drift & Lo-Fi Hiss',
    tagline: 'Vintage cassette tape saturation & slow resonance',
    vibe: 'Raw, honest, street documentarian',
  },
  {
    id: 'acoustic_warmth',
    name: 'Acoustic Ember',
    tagline: 'Soft acoustic reverberations & wooden chime',
    vibe: 'Intimate, heartfelt, acoustic coffeehouse',
  },
  {
    id: 'off',
    name: 'Background Music Off',
    tagline: 'Pure isolated voice with no music',
    vibe: 'Strict silence',
  },
];

class BackgroundMusicEngine {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private isRunning: boolean = false;
  private isDucked: boolean = false;
  private currentTrack: MusicPresetId = 'lofi_rain';
  private targetVolume: number = 0.35; // 0 to 1
  private loopInterval: any = null;
  private activeNodes: (AudioNode | OscillatorNode)[] = [];

  public init() {
    if (typeof window === 'undefined') return;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        this.masterGain = this.audioCtx.createGain();
        this.duckGain = this.audioCtx.createGain();

        // Chain: generators -> duckGain -> masterGain -> destination
        this.duckGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
        this.masterGain.gain.setValueAtTime(this.targetVolume, this.audioCtx.currentTime);

        this.duckGain.connect(this.masterGain);
        this.masterGain.connect(this.audioCtx.destination);
      }
    }
  }

  public async setTrack(trackId: MusicPresetId) {
    this.currentTrack = trackId;
    if (trackId === 'off') {
      this.stop();
      return;
    }
    if (this.isRunning) {
      this.stopGenerators();
      this.startGenerators();
    }
  }

  public getTrack(): MusicPresetId {
    return this.currentTrack;
  }

  public async play() {
    if (this.currentTrack === 'off') return;
    this.init();
    if (!this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    if (!this.isRunning) {
      this.isRunning = true;
      this.startGenerators();
    }
  }

  public stop() {
    this.isRunning = false;
    this.stopGenerators();
  }

  public setVolume(vol: number) {
    this.targetVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(this.targetVolume, this.audioCtx.currentTime, 0.05);
    }
  }

  public getVolume(): number {
    return this.targetVolume;
  }

  /**
   * Ducking: When Voice Rut starts speaking, gracefully lower background music volume
   * so the voice cuts through authentically without music clashing.
   */
  public duck(duckFactor = 0.22) {
    if (!this.duckGain || !this.audioCtx) return;
    this.isDucked = true;
    const now = this.audioCtx.currentTime;
    this.duckGain.gain.cancelScheduledValues(now);
    // Smooth fade down in 250ms
    this.duckGain.gain.linearRampToValueAtTime(duckFactor, now + 0.25);
  }

  /**
   * Unduck: When Voice Rut pauses or completes, swell background music back to full level
   */
  public unduck() {
    if (!this.duckGain || !this.audioCtx) return;
    this.isDucked = false;
    const now = this.audioCtx.currentTime;
    this.duckGain.gain.cancelScheduledValues(now);
    // Smooth swell up in 600ms
    this.duckGain.gain.linearRampToValueAtTime(1.0, now + 0.6);
  }

  public getIsDucked(): boolean {
    return this.isDucked;
  }

  private stopGenerators() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    for (const node of this.activeNodes) {
      try {
        if ('stop' in node && typeof (node as any).stop === 'function') {
          (node as any).stop();
        }
        node.disconnect();
      } catch (e) {}
    }
    this.activeNodes = [];
  }

  private startGenerators() {
    if (!this.audioCtx || !this.duckGain || this.currentTrack === 'off') return;

    // Chords and progressions
    // Scales: E minor / G major warm ambient pentatonics
    const chords: { [key in MusicPresetId]?: number[][] } = {
      lofi_rain: [
        [164.81, 196.00, 246.94, 293.66], // Em7
        [146.83, 174.61, 220.00, 261.63], // Dm7
        [130.81, 164.81, 196.00, 246.94], // Cmaj7
        [146.83, 185.00, 220.00, 293.66], // Bm7
      ],
      late_night: [
        [110.00, 164.81, 220.00, 277.18], // A2 pad
        [123.47, 185.00, 246.94, 293.66], // B2 pad
        [98.00, 146.83, 196.00, 246.94],  // G2 pad
        [110.00, 164.81, 220.00, 329.63], // A2 sus
      ],
      ambient_tape: [
        [130.81, 196.00, 261.63, 329.63], // C warm drone
        [146.83, 220.00, 293.66, 369.99], // D drone
        [164.81, 246.94, 329.63, 392.00], // E drone
      ],
      acoustic_warmth: [
        [196.00, 246.94, 293.66, 392.00], // G pluck
        [164.81, 246.94, 329.63, 392.00], // Em pluck
        [174.61, 220.00, 261.63, 349.23], // F pluck
      ],
    };

    const trackChords = chords[this.currentTrack] || chords.lofi_rain!;
    let chordIndex = 0;

    const playChordStep = () => {
      if (!this.isRunning || !this.audioCtx || !this.duckGain) return;
      const currentNotes = trackChords[chordIndex % trackChords.length];
      chordIndex++;

      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const chordDuration = 4.8;

      currentNotes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        // Warm analog low-pass filter
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(this.currentTrack === 'late_night' ? 650 : 850, now);
        filter.Q.setValueAtTime(1.5, now);

        // Gentle waveform
        osc.type = this.currentTrack === 'ambient_tape' ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(freq, now);

        // Detune slightly for lush warmth
        const detuneAmount = (i - 1.5) * 5 + (Math.random() * 4 - 2);
        osc.detune.setValueAtTime(detuneAmount, now);

        // Gentle swell envelope
        const maxVol = (0.045 / currentNotes.length);
        noteGain.gain.setValueAtTime(0.0001, now);
        noteGain.gain.linearRampToValueAtTime(maxVol, now + 1.2);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + chordDuration);

        osc.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(this.duckGain!);

        osc.start(now);
        osc.stop(now + chordDuration + 0.1);

        this.activeNodes.push(osc, noteGain, filter);
      });

      // Keep activeNodes manageable
      if (this.activeNodes.length > 40) {
        this.activeNodes = this.activeNodes.slice(this.activeNodes.length - 20);
      }
    };

    // First chord immediately
    playChordStep();
    // Subsequent chords every 4.6 seconds
    this.loopInterval = setInterval(playChordStep, 4600);
  }
}

export const musicEngine = new BackgroundMusicEngine();
