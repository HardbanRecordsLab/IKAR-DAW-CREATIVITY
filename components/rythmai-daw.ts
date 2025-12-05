
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { classMap } from 'lit/directives/class-map.js';
import * as Tone from 'tone';

import type { DawLayout, EffectsState, MasterSettings, Note, Pattern, Prompt, SampleSettings, SequencerState, SynthState, TrackSettings } from '../types';
import { AudioEngine } from '../utils/audio-engine';
import { throttle } from '../utils/throttle';
import { generateRandomPrompts, generateEffectsFromPrompt, generateChordsFromPrompt, generateTimbreFromPrompts } from '../utils/GeminiHelper';
import { midiDispatcher } from '../utils/MidiDispatcher';

// Ensure side-effect imports are handled correctly
import './step-sequencer';
import './mixer-track';
import './master-track';
import './ToastMessage';
import './SampleLibrary';
import type { ToastMessage } from './ToastMessage';

@customElement('rythmai-daw')
export class RytmAI_DAW extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      width: 100vw;
      height: 100vh;
      position: absolute;
      top: 0;
      left: 0;
      overflow: hidden;
      background-color: #181818;
      color: #ffffff;
      padding: 1rem;
      box-sizing: border-box;
      min-height: 100vh;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      padding: 0.5rem 1rem;
      background: #222;
      border: 1px solid #444;
      border-radius: 8px;
      flex-shrink: 0;
      z-index: 10;
    }
    h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: #fff;
      text-shadow: 0 2px 4px rgba(0,0,0,0.5);
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .controls select {
        background: #333;
        color: #fff;
        border: 1px solid #666;
        border-radius: 4px;
        padding: 0.5em;
        cursor: pointer;
    }
    .controls select:hover {
        border-color: #999;
    }
    .controls button {
        background: #444;
        border: 1px solid #666;
        color: #fff;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .controls button:hover {
        background: #555;
        border-color: #999;
    }
    .controls button[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
      background: #333;
      border-color: #444;
    }
    .main-content {
      display: flex;
      gap: 1rem;
      flex: 1;
      overflow: hidden; /* Container for panels that scroll internally */
      min-height: 0;
    }
    .left-panel {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      flex: 1;
      overflow-y: auto;
      padding-right: 5px; /* Space for scrollbar */
    }
    .right-panel {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      width: 400px;
      min-width: 300px;
      overflow-y: auto;
      padding-right: 5px;
    }
    /* Custom Scrollbar */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #222; border-radius: 4px; }
    ::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; border: 1px solid #333; }
    ::-webkit-scrollbar-thumb:hover { background: #777; }

    #prompt-matrix {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      width: 100%;
      aspect-ratio: 1;
      margin-bottom: 1rem;
      background: #222;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid #444;
    }
    .add-prompt-btn {
      width: 100%;
      height: 100%;
      aspect-ratio: 1;
      border-radius: 50%;
      border: 2px dashed #666;
      background: rgba(255,255,255,0.05);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #888;
      font-size: 2rem;
      transition: all 0.2s ease;
    }
    .add-prompt-btn:hover {
      background: rgba(255,255,255,0.1);
      border-color: #aaa;
      color: #fff;
    }
    #mixer {
      display: flex;
      gap: 8px;
      justify-content: center;
      align-items: flex-end;
      background: #222;
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid #555;
      flex-wrap: wrap;
      min-height: 250px;
    }
    #background {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      background: #181818;
      transition: background-image 0.5s linear;
      opacity: 0.3;
    }
    .pattern-arrangement-section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        background: #222;
        padding: 0.5rem;
        border-radius: 8px;
        border: 1px solid #444;
        z-index: 5;
    }
    .pattern-selector {
        display: flex;
        gap: 5px;
        overflow-x: auto;
        padding-bottom: 5px;
    }
    .pattern-selector button {
      background: #333;
      border: 1px solid #555;
      color: #ccc;
      font-weight: bold;
      min-width: 40px;
    }
    .pattern-selector button:hover {
        background: #444;
        color: #fff;
        border-color: #888;
    }
    .arrangement-timeline {
        background: #1a1a1a;
        padding: 10px;
        border-radius: 4px;
        position: relative;
        border: 1px solid #444;
        overflow-x: auto;
        flex-shrink: 0;
        display: flex;
        gap: 2px;
        min-height: 40px;
    }
    .arrangement-timeline .bar {
        background: #333;
        border: 1px solid #555;
        color: #888;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8rem;
        cursor: pointer;
        user-select: none;
        border-radius: 3px;
    }
    .arrangement-timeline .bar:hover {
        background: #444;
        border-color: #777;
        color: #fff;
    }
    .playhead {
        position: absolute;
        top: 0;
        left: 0;
        width: 2px;
        height: 100%;
        background: #FFD166;
        z-index: 10;
        pointer-events: none;
        transition: transform 0.1s linear;
    }
    .ai-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      border-bottom: 1px solid #444;
      padding-bottom: 0.5rem;
      margin-bottom: 0.5rem;
    }
    h3, h4 {
        margin: 0;
        color: #fff;
        font-weight: 600;
    }
    h3.ai-thinking, h4.ai-thinking {
        animation: glow 1.5s infinite alternate;
        color: #06D6A0;
    }
    .randomize-btn {
      background: #333;
      border: 1px solid #666;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      padding: 0;
      font-size: 1.2rem;
      color: #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .randomize-btn:hover:not(:disabled) {
      background: #555;
      border-color: #fff;
      color: #fff;
    }
    @keyframes glow {
        from { opacity: 1; text-shadow: 0 0 5px #06D6A0; }
        to { opacity: 0.5; text-shadow: none; }
    }
    
    .prompt-container {
        position: relative;
        width: 100%;
        aspect-ratio: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        background: #2a2a2a;
        border-radius: 8px;
        border: 1px solid #444;
        transition: border-color 0.2s;
        overflow: hidden;
    }
    .prompt-container:hover {
        border-color: #888;
        background: #333;
    }
    .remove-btn {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 1px solid #fff;
      background: #da2000;
      color: white;
      cursor: pointer;
      font-size: 12px;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 10;
      line-height: 1;
      padding: 0;
    }
    .prompt-container:hover .remove-btn { display: flex; }

    .prompt-text {
      font-size: 0.8rem;
      padding: 4px;
      border-radius: 4px;
      text-align: center;
      background: rgba(0,0,0,0.6);
      color: #fff;
      cursor: text;
      width: 90%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border: 1px solid transparent;
    }
    .prompt-text:hover {
      background: #000;
      white-space: normal;
      position: absolute;
      z-index: 5;
      height: auto;
      border: 1px solid #06D6A0;
    }

    .prompt-edit-input {
      font-size: 0.8rem;
      width: 90%;
      background: #111;
      color: #fff;
      border: 1px solid #06D6A0;
      border-radius: 4px;
      text-align: center;
      padding: 4px;
    }

    .learn-btn {
        font-size: 0.7rem;
        padding: 2px 6px;
        background-color: #333;
        border: 1px solid #555;
        border-radius: 3px;
        color: #ccc;
        width: 90%;
    }
    .learn-btn.learning {
        background-color: #FF6B6B;
        border-color: #FF6B6B;
        color: #fff;
        animation: glow 1.5s infinite alternate;
    }
    
    .effects-panel, .chords-panel, .synth-panel {
      background: #222;
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid #555;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }
    .effects-controls, .ai-prompt {
      display: flex;
      gap: 1rem;
      align-items: center;
      margin-top: 0.5rem;
    }
    .ai-prompt input, .effects-prompt input {
      flex: 1;
      background: #111;
      color: #fff;
      border: 1px solid #666;
      border-radius: 4px;
      padding: 0.6em;
    }
    .ai-prompt input:focus, .effects-prompt input:focus {
        border-color: #06D6A0;
        outline: none;
        background: #000;
    }
    .effect-knob, .synth-knob {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      flex: 1;
    }
    .effect-knob label, .synth-knob label {
      font-size: 0.75em;
      white-space: nowrap;
      color: #ccc;
    }
    .effect-knob input[type="range"], .synth-knob input[type="range"] {
      width: 100%;
      accent-color: #06D6A0;
      cursor: pointer;
    }
    
    .synth-section {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        margin-bottom: 1rem;
    }
    .synth-group {
        flex: 1;
        min-width: 120px;
        background: #1f1f1f;
        padding: 0.75rem;
        border-radius: 6px;
        border: 1px solid #444;
    }
    .synth-group h5 {
        margin: 0 0 0.5rem 0;
        font-size: 0.75rem;
        color: #bbb;
        border-bottom: 1px solid #333;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    .synth-row {
        display: flex;
        gap: 8px;
    }
    select.synth-select {
        width: 100%;
        background: #111;
        color: #fff;
        border: 1px solid #555;
        border-radius: 4px;
        font-size: 0.85rem;
        padding: 4px;
    }
  `;

  @property({ type: Object })
  layout!: DawLayout;

  @state() private isPlaying = false;
  @state() private activeStep = -1;
  @state() private activeBar = -1;
  @state() private activePatternIndex = 0;
  @state() private isAiThinking = false;
  @state() private isLibraryOpen = false;
  @state() private isRendering = false;
  @state() private editingPromptId: string | null = null;
  @state() private trackLevels: { [key: string]: number } = {
    kick: -Infinity,
    snare: -Infinity,
    hihat: -Infinity,
    bass: -Infinity,
    chords: -Infinity,
    master: -Infinity,
  };
  // FIX: Use 'any' type as WebMidi types are not available in the environment.
  @state() private midiInputs: any[] = [];
  @state() private selectedMidiInputId: string | null = null;
  @state() private isMidiLearning: string | null = null; // promptId that is learning
  @state() private fxPromptText = 'Spacious ambient cave';
  @state() private chordPromptText = 'Sad lofi progression';
  @state() private dragOverBarIndex: number | null = null;

  private audioEngine: AudioEngine;
  private toast!: ToastMessage;

  constructor() {
    super();
    this.audioEngine = new AudioEngine();
  }

  connectedCallback() {
    super.connectedCallback();
    console.log("DAW Connected");
    this.audioEngine.onStepChange = (step, bar) => {
        this.activeStep = step;
        this.activeBar = bar;
    };
    this.audioEngine.onMeterUpdate = (levels) => {
        this.trackLevels = levels;
    };
    
    // Safety check in case layout is set after connection
    if (this.layout) {
      this.audioEngine.updateAll(this.layout);
       // Restore active pattern index from layout if present
      if (typeof this.layout.activePatternIndex === 'number') {
          this.activePatternIndex = this.layout.activePatternIndex;
      }
    }

    // MIDI Setup
    midiDispatcher.initialize();
    midiDispatcher.addEventListener('midi-state-change', this.handleMidiStateChange);
    midiDispatcher.addEventListener('midi-input-selected', this.handleMidiInputSelected);
    midiDispatcher.addEventListener('midi-note-on', this.handleMidiNoteOn);
    midiDispatcher.addEventListener('midi-note-off', this.handleMidiNoteOff);
    midiDispatcher.addEventListener('midi-control-change', this.handleMidiControlChange);
  }

  disconnectedCallback() {
      super.disconnectedCallback();
      midiDispatcher.removeEventListener('midi-state-change', this.handleMidiStateChange);
      midiDispatcher.removeEventListener('midi-input-selected', this.handleMidiInputSelected);
      midiDispatcher.removeEventListener('midi-note-on', this.handleMidiNoteOn);
      midiDispatcher.removeEventListener('midi-note-off', this.handleMidiNoteOff);
      midiDispatcher.removeEventListener('midi-control-change', this.handleMidiControlChange);
  }

  firstUpdated() {
    // FIX: Cast to any to access shadowRoot, as type system fails to see this as a LitElement.
    if ((this as any).shadowRoot) {
        const toastEl = (this as any).shadowRoot!.querySelector('toast-message');
        if (toastEl) {
          this.toast = toastEl;
        }

        // Restore timeline scroll position
        if (this.layout && typeof this.layout.timelineScrollPosition === 'number') {
            const timeline = (this as any).shadowRoot!.querySelector('.arrangement-timeline');
            if (timeline) {
                requestAnimationFrame(() => {
                    timeline.scrollLeft = this.layout.timelineScrollPosition!;
                });
            }
        }
    }
  }

  public showNotification(message: string) {
    if (this.toast) {
        this.toast.show(message);
    } else {
        console.log("Notification:", message);
    }
  }

  private async togglePlay() {
    if (this.isPlaying) {
      this.audioEngine.stop();
      this.isPlaying = false;
      this.activeStep = -1;
      this.activeBar = -1;
    } else {
      await this.audioEngine.start();
      this.isPlaying = true;
    }
  }
  
  private get activePattern(): Pattern {
    if (!this.layout || !this.layout.patterns || this.layout.patterns.length === 0) {
        // Return a dummy pattern to prevent crashes if layout is not ready
        return {
            sequencerState: { kick: {steps:[]}, snare: {steps:[]}, hihat: {steps:[]}, bass: {steps:[]}, chords: {steps:[]} },
            prompts: [],
            trackSettings: { kick:{volume:0,pan:0,mute:false,solo:false}, snare:{volume:0,pan:0,mute:false,solo:false}, hihat:{volume:0,pan:0,mute:false,solo:false}, bass:{volume:0,pan:0,mute:false,solo:false}, chords:{volume:0,pan:0,mute:false,solo:false} },
            effectsState: { distortion:{wet:0,settings:{}}, delay:{wet:0,settings:{}}, reverb:{wet:0,settings:{}} },
            synthState: { oscillator:{type:'sine'}, envelope:{attack:0,decay:0,sustain:0,release:0}, filter:{type:'lowpass',rolloff:-12,Q:1}, filterEnvelope:{attack:0,decay:0,sustain:0,release:0,baseFrequency:200,octaves:0} }
        } as unknown as Pattern;
    }
    const pattern = this.layout.patterns[this.activePatternIndex];
    return pattern || this.layout.patterns[0];
  }

  private handleBpmChange(e: Event) {
    const input = e.target as HTMLInputElement;
    this.layout.bpm = Number(input.value);
    this.audioEngine.setBpm(this.layout.bpm);
    // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
    (this as any).requestUpdate();
  }

  private handleSequenceChange(e: CustomEvent<SequencerState>) {
    this.activePattern.sequencerState = e.detail;
    this.audioEngine.updateAll(this.layout);
    // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
    (this as any).requestUpdate();
  }
  
  private handleMixerChange<T extends keyof TrackSettings[keyof TrackSettings]>(
    track: keyof TrackSettings, 
    property: T, 
    value: TrackSettings[keyof TrackSettings][T]
  ) {
      (this.activePattern.trackSettings[track] as any)[property] = value;
      this.audioEngine.updateAll(this.layout);
      // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
      (this as any).requestUpdate();
  }

  private handleMasterChange<T extends keyof MasterSettings>(property: T, value: MasterSettings[T]) {
    (this.layout.masterSettings as any)[property] = value;
    this.audioEngine.updateMasterSettings(this.layout.masterSettings);
    // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
    (this as any).requestUpdate();
  }

  private handleMasterCompressorChange<T extends keyof MasterSettings['compressor']>(property: T, value: MasterSettings['compressor'][T]) {
      this.layout.masterSettings.compressor[property] = value;
      this.audioEngine.updateMasterSettings(this.layout.masterSettings);
      // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
      (this as any).requestUpdate();
  }

  private updateAiTimbre = throttle(async () => {
    this.isAiThinking = true;
    try {
      const activePrompts = this.activePattern.prompts.filter(p => p && p.weight > 0) as Prompt[];
      if (activePrompts.length === 0) {
        this.isAiThinking = false;
        return;
      }

      const newTimbre = await generateTimbreFromPrompts(activePrompts, this.layout.bpm);
      if (newTimbre) {
          // Cast generic response to SynthState - assuming schema match
          this.activePattern.synthState = newTimbre as SynthState;
          this.audioEngine.setBassSynth(this.activePattern.synthState);
          // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
          (this as any).requestUpdate();
      }
    } catch (err) {
      console.error('Failed to update AI timbre:', err);
      this.showNotification('Error: Failed to update AI timbre.');
    } finally {
      this.isAiThinking = false;
    }
  }, 1000);

  private handleSynthChange(path: string, value: any) {
      // Helper to update nested state
      const parts = path.split('.');
      let current: any = this.activePattern.synthState;
      for (let i = 0; i < parts.length - 1; i++) {
          current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
      
      this.audioEngine.setBassSynth(this.activePattern.synthState);
      // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
      (this as any).requestUpdate();
  }

  private handlePromptWeightChange(promptId: string, newWeight: number) {
    const prompt = this.activePattern.prompts.find(p => p?.promptId === promptId);
    if (prompt) {
      prompt.weight = newWeight;
      this.updateAiTimbre();
      // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
      (this as any).requestUpdate();
    }
  }

  private handleRemovePrompt(promptId: string) {
    const index = this.activePattern.prompts.findIndex(p => p?.promptId === promptId);
    if (index !== -1) {
      this.activePattern.prompts[index] = null;
      this.updateAiTimbre();
      // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
      (this as any).requestUpdate();
    }
  }

  private handleAddPrompt(index: number) {
    if (this.activePattern.prompts.filter(p => p).length >= 16) {
      this.showNotification('Maximum of 16 prompts reached.');
      return;
    }
    const newPrompt: Prompt = {
      promptId: `prompt-${Date.now()}`,
      text: 'New Prompt',
      weight: 0,
      color: this.getNewPromptColor(),
      isFiltered: false,
    };
    this.activePattern.prompts[index] = newPrompt;
    this.updateAiTimbre();
    // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
    (this as any).requestUpdate();
  }
  
  private handlePromptTextSave(promptId: string, newText: string) {
    const prompt = this.activePattern.prompts.find(p => p?.promptId === promptId);
    if (prompt && newText.trim()) {
        prompt.text = newText.trim();
        this.updateAiTimbre(); // Recalculate timbre with new text
    }
    this.editingPromptId = null; // Exit editing mode
  }
  
  private async handleRandomizePrompts() {
    const emptySlots = this.activePattern.prompts.filter(p => p === null).length;
    if (emptySlots === 0) {
        this.showNotification('No empty prompt slots available.');
        return;
    }
    this.isAiThinking = true;
    try {
        const existingPrompts = this.activePattern.prompts.filter(p => p).map(p => p!.text);
        const newPromptTexts = await generateRandomPrompts(existingPrompts);
        
        let newPromptsAdded = 0;
        for (let i = 0; i < this.activePattern.prompts.length && newPromptsAdded < newPromptTexts.length; i++) {
            if (this.activePattern.prompts[i] === null) {
                const newPrompt: Prompt = {
                    promptId: `prompt-${Date.now()}-${i}`,
                    text: newPromptTexts[newPromptsAdded],
                    weight: 0,
                    color: this.getNewPromptColor(),
                    isFiltered: false,
                };
                this.activePattern.prompts[i] = newPrompt;
                newPromptsAdded++;
            }
        }
        if (newPromptsAdded > 0) {
          this.showNotification(`${newPromptsAdded} new prompts added!`);
        } else {
          this.showNotification(`Couldn't generate new unique prompts.`);
        }
    } catch (e) {
        console.error('Failed to generate random prompts', e);
        this.showNotification('AI failed to generate prompts.');
    } finally {
        this.isAiThinking = false;
        // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
        (this as any).requestUpdate();
    }
  }

  private getNewPromptColor(): string {
    const colors = ['#9900ff', '#5200ff', '#ff25f6', '#2af6de', '#ffdd28', '#3dffab', '#d8ff3e', '#d9b2ff'];
    const usedColors = this.activePattern.prompts.filter(p => p).map(p => p!.color);
    const colorCounts = colors.map(c => ({ color: c, count: usedColors.filter(uc => uc === c).length }));
    colorCounts.sort((a,b) => a.count - b.count);
    return colorCounts[0].color;
  }
  
  private clearArrangementBar(barIndex: number) {
    this.layout.arrangement[barIndex] = null;
    this.audioEngine.updateAll(this.layout);
    // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
    (this as any).requestUpdate();
  }

  private handleSave() {
    // Capture UI state into layout before saving
    this.layout.activePatternIndex = this.activePatternIndex;
    
    const timeline = (this as any).shadowRoot!.querySelector('.arrangement-timeline');
    if (timeline) {
        this.layout.timelineScrollPosition = timeline.scrollLeft;
    }

    // FIX: Cast to any to access dispatchEvent, as type system fails to see this as a LitElement.
    (this as any).dispatchEvent(new CustomEvent('save-layout', { detail: this.layout }));
  }

  private handleReset() {
    // FIX: Cast to any to access dispatchEvent, as type system fails to see this as a LitElement.
    (this as any).dispatchEvent(new CustomEvent('reset-layout'));
  }

  private async handleExport() {
    this.isRendering = true;
    this.showNotification('Rendering song...');
    try {
        const wavBlob = await this.audioEngine.renderSong(this.layout);
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'rythmai-song.wav';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showNotification('Export complete!');
    } catch (e) {
        console.error('Export failed', e);
        this.showNotification('Export failed. See console for details.');
    } finally {
        this.isRendering = false;
    }
  }

  private async handleSampleSelected(e: CustomEvent<{track: keyof SampleSettings, url: string}>) {
    const { track, url } = e.detail;
    this.isLibraryOpen = false; // Close library immediately for better UX
    this.showNotification(`Loading ${track} sample...`);
    try {
        await this.audioEngine.loadSample(track, url);
        this.layout.sampleSettings[track] = url; // Only update on success
        this.showNotification(`${track.charAt(0).toUpperCase() + track.slice(1)} sample loaded!`);
    } catch (err) {
        console.error(`Failed to load sample for ${track}:`, err);
        this.showNotification(`Error: Could not load ${track} sample.`);
    }
    // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
    (this as any).requestUpdate();
  }

  private async handleSampleDrop(e: DragEvent, track: keyof SampleSettings) {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('audio/')) {
            const objectUrl = URL.createObjectURL(file);
            this.showNotification(`Loading user sample for ${track}...`);
            try {
                await this.audioEngine.loadSample(track, objectUrl);
                this.layout.sampleSettings[track] = objectUrl;
                this.showNotification(`Custom ${track} loaded!`);
                // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
                (this as any).requestUpdate();
            } catch (err) {
                console.error('Error loading dropped file:', err);
                this.showNotification('Failed to load dropped audio.');
            }
        } else {
            this.showNotification('Please drop an audio file.');
        }
    }
  }

  private handleDragOver(e: DragEvent) {
    e.preventDefault(); // Necessary to allow dropping
  }

  // --- MIDI Handlers ---
  private handleMidiStateChange = (e: Event) => {
    const { inputs } = (e as CustomEvent).detail;
    this.midiInputs = inputs;
  };

  private handleMidiInputSelected = (e: Event) => {
      const { inputId } = (e as CustomEvent).detail;
      this.selectedMidiInputId = inputId;
  };

  private handleMidiDeviceChange(e: Event) {
      const select = e.target as HTMLSelectElement;
      midiDispatcher.selectInput(select.value);
  }

  private handleMidiNoteOn = (e: Event) => {
    const { note, velocity } = (e as CustomEvent).detail;
    const noteName = Tone.Midi(note).toNote();
    this.audioEngine.midiNoteOn(noteName, velocity);
  };
  
  private handleMidiNoteOff = (e: Event) => {
    const { note } = (e as CustomEvent).detail;
    const noteName = Tone.Midi(note).toNote();
    this.audioEngine.midiNoteOff(noteName);
  };

  private handleMidiControlChange = (e: Event) => {
    const { controller, value } = (e as CustomEvent).detail;
    
    if (this.isMidiLearning) {
        const prompt = this.activePattern.prompts.find(p => p?.promptId === this.isMidiLearning);
        if (prompt) {
            prompt.cc = controller;
        }
        this.isMidiLearning = null;
        // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
        (this as any).requestUpdate();
        return;
    }

    const targetPrompt = this.activePattern.prompts.find(p => p?.cc === controller);
    if (targetPrompt) {
        const newWeight = value / 127;
        this.handlePromptWeightChange(targetPrompt.promptId, newWeight);
    }
  }

  private toggleMidiLearn(promptId: string) {
    if (this.isMidiLearning === promptId) {
        this.isMidiLearning = null; // Cancel learning
    } else {
        this.isMidiLearning = promptId;
    }
  }

  // --- Effects Handlers ---
  private handleEffectWetChange(effect: keyof EffectsState, value: number) {
    this.activePattern.effectsState[effect].wet = value;
    this.audioEngine.updateBassEffects(this.activePattern.effectsState);
    // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
    (this as any).requestUpdate();
  }

  private async handleApplyAiEffects() {
      if (!this.fxPromptText.trim()) {
          this.showNotification('Please enter an effects prompt.');
          return;
      }
      this.isAiThinking = true;
      try {
          const newSettings = await generateEffectsFromPrompt(this.fxPromptText);
          if (newSettings) {
              this.activePattern.effectsState.distortion.settings = newSettings.distortion || this.activePattern.effectsState.distortion.settings;
              this.activePattern.effectsState.delay.settings = newSettings.delay || this.activePattern.effectsState.delay.settings;
              this.activePattern.effectsState.reverb.settings = newSettings.reverb || this.activePattern.effectsState.reverb.settings;
              
              this.audioEngine.updateBassEffects(this.activePattern.effectsState);
              this.showNotification('AI effects applied!');
              // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
              (this as any).requestUpdate();
          } else {
              this.showNotification('AI failed to generate effects.');
          }
      } catch (e) {
          console.error('Failed to apply AI effects', e);
          this.showNotification('Error applying AI effects.');
      } finally {
          this.isAiThinking = false;
      }
  }

  // --- Chord AI Handler ---
  private async handleGenerateChords() {
      if (!this.chordPromptText.trim()) {
          this.showNotification('Please enter a chord progression prompt.');
          return;
      }
      this.isAiThinking = true;
      try {
          const bassline = this.activePattern.sequencerState.bass.steps as (Note | null)[];
          const newChords = await generateChordsFromPrompt(this.chordPromptText, bassline);
          if (newChords && newChords.length === 16) {
              this.activePattern.sequencerState.chords.steps = newChords;
              this.audioEngine.updateAll(this.layout);
              this.showNotification('AI chord progression generated!');
              // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
              (this as any).requestUpdate();
          } else {
              this.showNotification('AI failed to generate a valid chord progression.');
          }
      } catch (e) {
          console.error('Failed to generate AI chords', e);
          this.showNotification('Error generating AI chords.');
      } finally {
          this.isAiThinking = false;
      }
  }

  // --- Drag & Drop Handlers ---
  private handlePatternDragStart(e: DragEvent, patternIndex: number) {
      e.dataTransfer!.setData('text/plain', patternIndex.toString());
  }

  private handleBarDragOver(e: DragEvent, barIndex: number) {
      e.preventDefault();
      this.dragOverBarIndex = barIndex;
  }

  private handleBarDragLeave() {
      this.dragOverBarIndex = null;
  }

  private handleBarDrop(e: DragEvent, barIndex: number) {
      e.preventDefault();
      const patternIndex = parseInt(e.dataTransfer!.getData('text/plain'), 10);
      if (!isNaN(patternIndex)) {
          this.assignPatternToBar(barIndex, patternIndex);
      }
      this.dragOverBarIndex = null;
  }

  private assignPatternToBar(barIndex: number, patternIndex: number) {
      this.layout.arrangement[barIndex] = patternIndex;
      this.audioEngine.updateAll(this.layout);
      // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
      (this as any).requestUpdate();
  }

  private readonly makeBackground = throttle(() => {
    // Safe guard against early calls where layout might be undefined
    if (!this.layout || !this.layout.patterns) return '';

    const pattern = this.activePattern;
    // Guard against empty pattern
    if (!pattern || !pattern.prompts) return '';

    const activePrompts = pattern.prompts.filter(p => p && p.weight > 0);
    if (activePrompts.length === 0) return '';
    const gradients = activePrompts.map(p => `${p!.color} ${p!.weight * 100}%`);
    if (gradients.length === 1) {
      return `radial-gradient(ellipse at center, ${gradients[0]}, #181818 70%)`;
    }
    return `linear-gradient(45deg, ${gradients.join(', ')})`;
  }, 100);

  render() {
    try {
        // Safety check: If layout is not yet set, render visible loading state
        if (!this.layout) {
            return html`
                <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%; color:#06D6A0; background:#181818;">
                    <h2>Loading Project...</h2>
                    <p style="color:#888;">Initialize Audio Engine</p>
                </div>
            `;
        }
        
        // Safety check 2: Patterns must exist and contain at least one pattern
        if (!this.layout.patterns || this.layout.patterns.length === 0) {
            return html`
                <div style="padding:20px; color:#FF6B6B; background:#181818; height:100%; display:flex; align-items:center; justify-content:center; text-align:center;">
                    <div>
                        <h2>Project Error</h2>
                        <p>Project data is corrupted (No patterns found).</p>
                        <button @click=${this.handleReset} style="margin-top:10px; padding:10px 20px;">Reset Data</button>
                    </div>
                </div>`;
        }
        
        // Ensure activePatternIndex is valid
        if (this.activePatternIndex >= this.layout.patterns.length || this.activePatternIndex < 0) {
            this.activePatternIndex = 0;
        }

        const currentPattern = this.activePattern;
        
        const bg = styleMap({
          backgroundImage: this.makeBackground(),
        });
        
        const playheadPosition = this.activeBar >= 0 && this.activeStep >= 0
            ? `calc(${(this.activeBar + this.activeStep / 16) * (100 / this.layout.arrangement.length)}% + ${2 * (this.activeBar + 1)}px)`
            : '-10px';
        
        // Fallback for synth state if it's missing in the data
        const synthState = currentPattern.synthState || {
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.5 },
            filter: { type: 'lowpass', rolloff: -12, Q: 1 },
            filterEnvelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.5, baseFrequency: 200, octaves: 4 }
        };

        return html`
          <div id="background" style=${bg}></div>
          <header>
            <h1>RytmAI DAW</h1>
            <div class="controls">
              <button @click=${this.togglePlay}>${this.isPlaying ? 'Stop' : 'Play'}</button>
              <input type="number" .value=${this.layout.bpm} @input=${this.handleBpmChange} min="60" max="240">
              <span>BPM</span>
              <select @change=${this.handleMidiDeviceChange} .value=${this.selectedMidiInputId ?? ''}>
                <option value="">No MIDI Input</option>
                ${this.midiInputs.map(input => html`<option value=${input.id}>${input.name}</option>`)}
              </select>
            </div>
            <div class="controls">
                <button @click=${() => this.isLibraryOpen = true}>Library</button>
                <button @click=${this.handleExport} ?disabled=${this.isRendering}>
                    ${this.isRendering ? 'Rendering...' : 'Export WAV'}
                </button>
                <button @click=${this.handleSave}>Save</button>
                <button @click=${this.handleReset}>Reset</button>
            </div>
          </header>
          
          <div class="pattern-arrangement-section">
              <div class="pattern-selector">
                ${this.layout.patterns.map((_, i) => html`
                    <button 
                        class=${classMap({ active: i === this.activePatternIndex })}
                        @click=${() => this.activePatternIndex = i}
                        draggable="true"
                        @dragstart=${(e: DragEvent) => this.handlePatternDragStart(e, i)}>
                        P${i + 1}
                    </button>
                `)}
              </div>
              <div class="arrangement-timeline">
                  <div class="playhead" style="transform: translateX(${playheadPosition});"></div>
                  ${this.layout.arrangement.map((patternIndex, barIndex) => html`
                    <div class="bar ${classMap({
                        'active-pattern': patternIndex === this.activePatternIndex,
                        'drag-over': barIndex === this.dragOverBarIndex,
                     })}" 
                        @click=${() => this.assignPatternToBar(barIndex, this.activePatternIndex)}
                        @contextmenu=${(e: MouseEvent) => { e.preventDefault(); this.clearArrangementBar(barIndex); }}
                        @dragover=${(e: DragEvent) => this.handleBarDragOver(e, barIndex)}
                        @dragleave=${this.handleBarDragLeave}
                        @drop=${(e: DragEvent) => this.handleBarDrop(e, barIndex)}
                        title="Drag a pattern here, or Left-click to assign P${this.activePatternIndex + 1}. Right-click to clear."
                        >
                        ${patternIndex !== null ? `P${patternIndex + 1}` : '-'}
                    </div>
                  `)}
              </div>
          </div>

          <div class="main-content">
            <div class="left-panel">
                <step-sequencer 
                    .sequencerState=${currentPattern.sequencerState}
                    .activeStep=${this.activeStep}
                    @sequence-changed=${this.handleSequenceChange}>
                </step-sequencer>
                <div id="mixer">
                    ${Object.keys(currentPattern.trackSettings).map(trackName => {
                        const trackKey = trackName as keyof TrackSettings;
                        const settings = currentPattern.trackSettings[trackKey];
                        // Check if this track supports samples (Drop zone)
                        const supportsDrop = ['kick', 'snare', 'hihat'].includes(trackKey);
                        
                        return html`
                            <mixer-track 
                                label=${trackKey.charAt(0).toUpperCase() + trackKey.slice(1)}
                                .volume=${settings.volume}
                                .pan=${settings.pan}
                                .mute=${settings.mute}
                                .solo=${settings.solo}
                                .level=${this.trackLevels[trackKey]}
                                .canDrop=${supportsDrop}
                                @volume-changed=${(e: CustomEvent) => this.handleMixerChange(trackKey, 'volume', e.detail.value)}
                                @pan-changed=${(e: CustomEvent) => this.handleMixerChange(trackKey, 'pan', e.detail.value)}
                                @mute-toggled=${(e: CustomEvent) => this.handleMixerChange(trackKey, 'mute', e.detail.value)}
                                @solo-toggled=${(e: CustomEvent) => this.handleMixerChange(trackKey, 'solo', e.detail.value)}
                                @drop=${(e: DragEvent) => supportsDrop ? this.handleSampleDrop(e, trackKey as keyof SampleSettings) : null}
                                @dragover=${(e: DragEvent) => supportsDrop ? this.handleDragOver(e) : null}
                            >
                            </mixer-track>
                        `
                    })}
                    <master-track
                        .volume=${this.layout.masterSettings.volume}
                        .compThreshold=${this.layout.masterSettings.compressor.threshold}
                        .compRatio=${this.layout.masterSettings.compressor.ratio}
                        .limiterThreshold=${this.layout.masterSettings.limiter.threshold}
                        .level=${this.trackLevels['master']}
                        .audioEngine=${this.audioEngine}
                        @volume-changed=${(e: CustomEvent) => this.handleMasterChange('volume', e.detail.value)}
                        @comp-threshold-changed=${(e: CustomEvent) => this.handleMasterCompressorChange('threshold', e.detail.value)}
                        @comp-ratio-changed=${(e: CustomEvent) => this.handleMasterCompressorChange('ratio', e.detail.value)}
                        @limiter-threshold-changed=${(e: CustomEvent) => this.handleMasterChange('limiter', { threshold: e.detail.value })}
                    >
                    </master-track>
                </div>
            </div>
            <div class="right-panel">
                <div class="ai-header">
                    <h3 class=${classMap({'ai-thinking': this.isAiThinking})}>AI Timbre Control</h3>
                    <button 
                        class="randomize-btn"
                        @click=${this.handleRandomizePrompts} 
                        ?disabled=${this.isAiThinking} 
                        title="Generate new prompt ideas">🎲</button>
                </div>
                <div id="prompt-matrix">
                  ${currentPattern.prompts.map((prompt, index) => prompt 
                    ? html`
                        <div class="prompt-container">
                            <button class="remove-btn" @click=${() => this.handleRemovePrompt(prompt.promptId)} ?disabled=${this.isPlaying}>✕</button>
                            <input type="range" min="0" max="1" step="0.01" .value=${prompt.weight}
                                   @input=${(e: Event) => this.handlePromptWeightChange(prompt.promptId, parseFloat((e.target as HTMLInputElement).value))}>
                            ${this.editingPromptId === prompt.promptId
                                ? html`<input type="text"
                                           class="prompt-edit-input"
                                           .value=${prompt.text}
                                           @blur=${(e: FocusEvent) => this.handlePromptTextSave(prompt.promptId, (e.target as HTMLInputElement).value)}
                                           @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                           autofocus>`
                                : html`<div class="prompt-text" @click=${() => { this.editingPromptId = prompt.promptId }}>${prompt.text}</div>`
                            }
                            <button 
                                class="learn-btn ${classMap({learning: this.isMidiLearning === prompt.promptId})}"
                                @click=${() => this.toggleMidiLearn(prompt.promptId)}>
                                ${this.isMidiLearning === prompt.promptId ? 'Listening...' : (prompt.cc ? `CC ${prompt.cc}` : 'Learn MIDI')}
                            </button>
                        </div>`
                    : html`<button class="add-prompt-btn" ?disabled=${this.isPlaying} @click=${() => this.handleAddPrompt(index)}>+</button>`
                  )}
                </div>

                <div class="synth-panel">
                    <h4 class=${classMap({'ai-thinking': this.isAiThinking})}>Bass Synth Parameters</h4>
                    
                    <div class="synth-section">
                        <div class="synth-group">
                            <h5>Oscillator</h5>
                            <div class="synth-row">
                                 <select class="synth-select" .value=${synthState.oscillator.type} @change=${(e: Event) => this.handleSynthChange('oscillator.type', (e.target as HTMLSelectElement).value)}>
                                    <option value="sine">Sine</option>
                                    <option value="square">Square</option>
                                    <option value="sawtooth">Sawtooth</option>
                                    <option value="triangle">Triangle</option>
                                    <option value="fmsine">FM Sine</option>
                                    <option value="amsquare">AM Square</option>
                                 </select>
                            </div>
                        </div>
                         <div class="synth-group">
                            <h5>Filter</h5>
                            <div class="synth-row">
                                <div class="synth-knob">
                                    <label>Q</label>
                                    <input type="range" min="0" max="10" step="0.1" .value=${synthState.filter.Q} @input=${(e: Event) => this.handleSynthChange('filter.Q', parseFloat((e.target as HTMLInputElement).value))}>
                                </div>
                                <div class="synth-knob">
                                    <label>Cutoff</label>
                                    <input type="range" min="20" max="2000" step="10" .value=${synthState.filterEnvelope.baseFrequency} @input=${(e: Event) => this.handleSynthChange('filterEnvelope.baseFrequency', parseFloat((e.target as HTMLInputElement).value))}>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="synth-section">
                        <div class="synth-group">
                            <h5>Amp Envelope</h5>
                            <div class="synth-row">
                                <div class="synth-knob"><label>A</label><input type="range" min="0" max="2" step="0.01" .value=${synthState.envelope.attack} @input=${(e: Event) => this.handleSynthChange('envelope.attack', parseFloat((e.target as HTMLInputElement).value))}></div>
                                <div class="synth-knob"><label>D</label><input type="range" min="0" max="2" step="0.01" .value=${synthState.envelope.decay} @input=${(e: Event) => this.handleSynthChange('envelope.decay', parseFloat((e.target as HTMLInputElement).value))}></div>
                                <div class="synth-knob"><label>S</label><input type="range" min="0" max="1" step="0.01" .value=${synthState.envelope.sustain} @input=${(e: Event) => this.handleSynthChange('envelope.sustain', parseFloat((e.target as HTMLInputElement).value))}></div>
                                <div class="synth-knob"><label>R</label><input type="range" min="0" max="2" step="0.01" .value=${synthState.envelope.release} @input=${(e: Event) => this.handleSynthChange('envelope.release', parseFloat((e.target as HTMLInputElement).value))}></div>
                            </div>
                        </div>
                    </div>

                     <div class="synth-section">
                        <div class="synth-group">
                            <h5>Filter Envelope</h5>
                            <div class="synth-row">
                                <div class="synth-knob"><label>A</label><input type="range" min="0" max="2" step="0.01" .value=${synthState.filterEnvelope.attack} @input=${(e: Event) => this.handleSynthChange('filterEnvelope.attack', parseFloat((e.target as HTMLInputElement).value))}></div>
                                <div class="synth-knob"><label>D</label><input type="range" min="0" max="2" step="0.01" .value=${synthState.filterEnvelope.decay} @input=${(e: Event) => this.handleSynthChange('filterEnvelope.decay', parseFloat((e.target as HTMLInputElement).value))}></div>
                                <div class="synth-knob"><label>S</label><input type="range" min="0" max="1" step="0.01" .value=${synthState.filterEnvelope.sustain} @input=${(e: Event) => this.handleSynthChange('filterEnvelope.sustain', parseFloat((e.target as HTMLInputElement).value))}></div>
                                <div class="synth-knob"><label>R</label><input type="range" min="0" max="2" step="0.01" .value=${synthState.filterEnvelope.release} @input=${(e: Event) => this.handleSynthChange('filterEnvelope.release', parseFloat((e.target as HTMLInputElement).value))}></div>
                                 <div class="synth-knob"><label>Amt</label><input type="range" min="0" max="7" step="0.1" .value=${synthState.filterEnvelope.octaves} @input=${(e: Event) => this.handleSynthChange('filterEnvelope.octaves', parseFloat((e.target as HTMLInputElement).value))}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="effects-panel">
                    <h4 class=${classMap({'ai-thinking': this.isAiThinking})}>AI Bass Effects</h4>
                    <div class="effects-prompt">
                        <input type="text" .value=${this.fxPromptText} @input=${(e: Event) => this.fxPromptText = (e.target as HTMLInputElement).value}>
                        <button @click=${this.handleApplyAiEffects} ?disabled=${this.isAiThinking}>Apply</button>
                    </div>
                    <div class="effects-controls">
                        ${Object.keys(currentPattern.effectsState).map(key => {
                            const effectKey = key as keyof EffectsState;
                            const effectState = currentPattern.effectsState[effectKey];
                            return html`
                                <div class="effect-knob">
                                    <label>${effectKey.charAt(0).toUpperCase() + effectKey.slice(1)}</label>
                                    <input type="range" min="0" max="1" step="0.01" .value=${effectState.wet}
                                           @input=${(e: Event) => this.handleEffectWetChange(effectKey, parseFloat((e.target as HTMLInputElement).value))}>
                                </div>
                            `;
                        })}
                    </div>
                </div>
                <div class="chords-panel">
                    <h4 class=${classMap({'ai-thinking': this.isAiThinking})}>AI Chord Progression</h4>
                    <div class="ai-prompt">
                        <input type="text" .value=${this.chordPromptText} @input=${(e: Event) => this.chordPromptText = (e.target as HTMLInputElement).value}>
                        <button @click=${this.handleGenerateChords} ?disabled=${this.isAiThinking}>Generate</button>
                    </div>
                </div>
            </div>
          </div>
          <toast-message></toast-message>
          ${this.isLibraryOpen ? html`
            <sample-library 
                .currentSamples=${this.layout.sampleSettings}
                .audioEngine=${this.audioEngine}
                @close-library=${() => this.isLibraryOpen = false}
                @sample-selected=${this.handleSampleSelected}
            ></sample-library>
          ` : ''}
        `;
    } catch (e) {
        console.error("Critical Render Error:", e);
        return html`
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #111; color: #FF6B6B; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; box-sizing: border-box;">
                <h1>Rendering Error</h1>
                <p>Something went wrong while drawing the interface.</p>
                <pre style="background: #000; padding: 1rem; border-radius: 4px; overflow: auto; max-width: 800px;">${e}</pre>
                <button @click=${() => location.reload()} style="margin-top: 1rem; padding: 10px 20px; background: #333; color: #fff; border: 1px solid #555; cursor: pointer;">Reload App</button>
            </div>
        `;
    }
  }
}

if (!customElements.get('rythmai-daw')) {
  try {
    customElements.define('rythmai-daw', RytmAI_DAW as any);
  } catch(e) {
    console.warn("Failed to register rythmai-daw component", e);
  }
}
