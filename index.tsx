
/**
 * @fileoverview A hybrid digital audio workstation (DAW) with AI Timbre Control.
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Side-effect imports first to register components
import './components/rythmai-daw';

// Type imports
import type { DawLayout, EffectsState, Pattern, Prompt, SynthState } from './types';

const LAYOUT_STORAGE_KEY = 'rythmai-daw-blueprint-layout';

async function main() {
  console.log("Index.tsx: Main function executed");
  try {
      // 1. Load Layout
      const initialLayout = loadOrDefaultLayout();
      console.log("Index.tsx: Layout loaded");

      if (!initialLayout) {
          throw new Error("Failed to initialize default layout");
      }

      // 2. Component Check & Creation
      // We give the browser a moment to register the custom element if it hasn't yet.
      if (!customElements.get('rythmai-daw')) {
          console.warn("RytmAI_DAW not registered yet, waiting...");
          // In a real module system, imports should have handled this.
          // We can proceed, assuming the tag will upgrade when the definition lands.
      }

      // Safe creation
      const daw = document.createElement('rythmai-daw') as any;
      daw.layout = initialLayout;

      daw.addEventListener('save-layout', (e: Event) => {
        const customEvent = e as CustomEvent<DawLayout>;
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(customEvent.detail));
        if (daw.showNotification) daw.showNotification('Project Saved!');
      });

      daw.addEventListener('reset-layout', () => {
        if (confirm('Are you sure you want to reset the project? Your saved layout will be deleted.')) {
            localStorage.removeItem(LAYOUT_STORAGE_KEY);
            location.reload();
        }
      });

      // 4. Append to Body
      document.body.appendChild(daw);
      console.log("Index.tsx: DAW component appended to body");

      // 5. Remove Loading Screen
      const loadingEl = document.getElementById('app-loading');
      if (loadingEl) {
          loadingEl.style.opacity = '0';
          loadingEl.style.transition = 'opacity 0.5s ease';
          setTimeout(() => loadingEl.remove(), 500);
      }

  } catch (e) {
      console.error("Critical Application Error in main():", e);
      const loadingEl = document.getElementById('app-loading');
      if (loadingEl) {
          loadingEl.innerHTML = `
            <div style="color: #FF6B6B; padding: 2rem; text-align: center; height:100%; display:flex; flex-direction:column; justify-content:center; font-family: sans-serif; background: #121212;">
                <h2>Startup Error</h2>
                <pre style="background:#222; padding:10px; text-align:left; max-width:800px; margin: 0 auto; white-space:pre-wrap; color: #ff8888; overflow: auto; max-height: 50vh;">${e}</pre>
                <button onclick="localStorage.removeItem('${LAYOUT_STORAGE_KEY}'); location.reload();" 
                        style="margin-top:1rem; padding:10px 20px; cursor:pointer; background:#444; color:#fff; border:1px solid #666;">
                    Clear Data & Reload
                </button>
            </div>
          `;
      }
  }
}

function createDefaultSynthState(): SynthState {
    return {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.1 },
        filter: { type: 'lowpass', rolloff: -12, Q: 1 },
        filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.2, baseFrequency: 200, octaves: 4 }
    };
}

function loadOrDefaultLayout(): DawLayout {
  const savedLayoutJson = localStorage.getItem(LAYOUT_STORAGE_KEY);
  if (savedLayoutJson) {
    try {
      const savedLayout = JSON.parse(savedLayoutJson);
      if (savedLayout && savedLayout.patterns && Array.isArray(savedLayout.patterns)) {
        // Ensure defaults for potentially missing fields
        savedLayout.patterns.forEach((pattern: Pattern) => {
            if (!pattern.effectsState) pattern.effectsState = createDefaultEffectsState();
            if (!pattern.sequencerState) pattern.sequencerState = buildDefaultLayout().patterns[0].sequencerState; 
            else if (!pattern.sequencerState.chords) pattern.sequencerState.chords = { steps: new Array(16).fill(null) };
            
            if (!pattern.trackSettings) pattern.trackSettings = buildDefaultLayout().patterns[0].trackSettings;
            else if (!pattern.trackSettings.chords) pattern.trackSettings.chords = { volume: -9, pan: 0, mute: false, solo: false };
            
            if (!pattern.synthState) pattern.synthState = createDefaultSynthState();
        });
        
        if (!savedLayout.sampleSettings) savedLayout.sampleSettings = { kick: 'kick.wav', snare: 'snare.wav', hihat: 'hihat.wav' };
        if (!savedLayout.masterSettings) savedLayout.masterSettings = buildDefaultLayout().masterSettings;
        if (savedLayout.activePatternIndex === undefined) savedLayout.activePatternIndex = 0;
        if (savedLayout.timelineScrollPosition === undefined) savedLayout.timelineScrollPosition = 0;
        return savedLayout;
      }
    } catch (e) {
      console.error("Failed to parse saved layout, resetting.", e);
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    }
  }
  return buildDefaultLayout();
}

function createDefaultPrompts(): (Prompt | null)[] {
    const promptsArray: (Prompt | null)[] = new Array(16).fill(null);
    const defaultPrompts = [
        { color: '#9900ff', text: 'Deep Sub Bass' },
        { color: '#5200ff', text: 'Wailing Filter' },
        { color: '#ff25f6', text: 'Acid Squawk' },
        { color: '#2af6de', text: 'Ambient Reverb' },
        { color: '#ffdd28', text: 'Crunchy Distortion' },
        { color: '#3dffab', text: 'Lush Pad' },
    ];
    for (let i = 0; i < defaultPrompts.length; i++) {
        if (i >= 16) break;
        promptsArray[i] = {
            promptId: `prompt-${i}`,
            text: defaultPrompts[i].text,
            weight: 0,
            color: defaultPrompts[i].color,
            isFiltered: false,
        };
    }
    return promptsArray;
}

function createDefaultEffectsState(): EffectsState {
    return {
        distortion: { wet: 0, settings: { distortion: 0.4 } },
        delay: { wet: 0, settings: { delayTime: '8n', feedback: 0.5 } },
        reverb: { wet: 0, settings: { decay: 1.5, preDelay: 0.01 } },
    };
}

function buildDefaultLayout(): DawLayout {
  const patterns: Pattern[] = [];
  // Pattern 1
  const prompts1 = createDefaultPrompts();
  prompts1[0]!.weight = 1; 
  patterns.push({
    sequencerState: {
      kick: { steps: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false] },
      snare: { steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false] },
      hihat: { steps: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true] },
      bass: { steps: ['C3', null, 'D#3', 'F3', null, 'D#3', null, null, 'G3', null, 'A#3', 'C4', null, 'A#3', 'G3', null] },
      chords: { steps: ['Cm7', null, null, null, 'Fm7', null, null, null, 'G#maj7', null, null, null, 'G7', null, null, null] },
    },
    prompts: prompts1,
    trackSettings: {
      kick: { volume: -3, pan: 0, mute: false, solo: false },
      snare: { volume: -3, pan: 0, mute: false, solo: false },
      hihat: { volume: -10, pan: 0, mute: false, solo: false },
      bass: { volume: -3, pan: 0, mute: false, solo: false },
      chords: { volume: -9, pan: 0, mute: false, solo: false },
    },
    effectsState: createDefaultEffectsState(),
    synthState: createDefaultSynthState(),
  });

  // Pattern 2
  const prompts2 = createDefaultPrompts();
  prompts2[0]!.weight = 1; 
  prompts2[2]!.weight = 0.5; 
  const effects2 = createDefaultEffectsState();
  effects2.distortion = { wet: 0.3, settings: { distortion: 0.8 } };
  patterns.push({
    sequencerState: {
      kick: { steps: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false] },
      snare: { steps: [false, false, false, false, true, false, false, true, false, false, false, false, true, false, false, true] },
      hihat: { steps: [false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true] },
      bass: { steps: ['C3', 'C3', 'D#3', null, 'F3', 'F3', null, null, 'G3', null, 'C4', null, 'A#3', null, 'G3', null] },
      chords: { steps: ['Cm7', null, 'Cm7', null, 'Fm7', null, 'Fm7', null, 'G#maj7', null, 'G#maj7', null, 'G7', null, 'G7', null] },
    },
    prompts: prompts2,
    trackSettings: {
      kick: { volume: 0, pan: 0, mute: false, solo: false },
      snare: { volume: 0, pan: 0.1, mute: false, solo: false },
      hihat: { volume: -8, pan: -0.2, mute: false, solo: false },
      bass: { volume: -2, pan: 0, mute: false, solo: false },
      chords: { volume: -8, pan: 0, mute: false, solo: false },
    },
    effectsState: effects2,
    synthState: createDefaultSynthState(),
  });

  for (let i = 2; i < 8; i++) {
    patterns.push(JSON.parse(JSON.stringify(patterns[0])));
  }

  return {
    patterns,
    arrangement: [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1],
    bpm: 120,
    sampleSettings: { kick: 'kick.wav', snare: 'snare.wav', hihat: 'hihat.wav' },
    masterSettings: {
        volume: 0,
        compressor: { threshold: -18, ratio: 4, attack: 0.01, release: 0.1 },
        limiter: { threshold: -3 }
    },
    activePatternIndex: 0,
    timelineScrollPosition: 0
  };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
