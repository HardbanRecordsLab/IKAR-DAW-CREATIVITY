
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Prompt {
  readonly promptId: string;
  text: string;
  weight: number;
  color: string;
  isFiltered: boolean;
  cc?: number;
}

export type Note = 'C3' | 'D#3' | 'F3' | 'G3' | 'A#3' | 'C4' | 'D#4' | 'F4' | null;

export interface TrackState {
  steps: (boolean | Note | string | null)[];
}

export interface SequencerState {
  kick: TrackState;
  snare: TrackState;
  hihat: TrackState;
  bass: TrackState;
  chords: TrackState;
}

export interface TrackSettings {
  kick: { volume: number; pan: number; mute: boolean; solo: boolean; };
  snare: { volume: number; pan: number; mute: boolean; solo: boolean; };
  hihat: { volume: number; pan: number; mute: boolean; solo: boolean; };
  bass: { volume: number; pan: number; mute: boolean; solo: boolean; };
  chords: { volume: number; pan: number; mute: boolean; solo: boolean; };
}

export interface EffectState {
    wet: number; // 0 to 1
    settings: any; // AI-generated settings object
}

export interface EffectsState {
    distortion: EffectState;
    delay: EffectState;
    reverb: EffectState;
}

export interface SynthState {
    oscillator: { type: string };
    envelope: { attack: number; decay: number; sustain: number; release: number };
    filter: { Q: number; type: string; rolloff: number };
    filterEnvelope: { attack: number; decay: number; sustain: number; release: number; baseFrequency: number; octaves: number };
}

export interface Pattern {
  sequencerState: SequencerState;
  prompts: (Prompt | null)[];
  trackSettings: TrackSettings;
  effectsState: EffectsState;
  synthState: SynthState;
}

export interface SampleSettings {
  kick: string;
  snare: string;
  hihat: string;
}

export interface MasterSettings {
    volume: number;
    compressor: {
        threshold: number;
        ratio: number;
        attack: number;
        release: number;
    };
    limiter: {
        threshold: number;
    };
}

export interface DawLayout {
  patterns: Pattern[];
  arrangement: (number | null)[]; // Array index is bar, value is pattern index
  bpm: number;
  sampleSettings: SampleSettings;
  masterSettings: MasterSettings;
  activePatternIndex?: number;
  timelineScrollPosition?: number;
}
