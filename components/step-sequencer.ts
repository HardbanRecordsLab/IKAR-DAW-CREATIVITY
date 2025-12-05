
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { Note, SequencerState, TrackState } from '../types';

const BASS_NOTES: Note[] = ['F4', 'D#4', 'C4', 'A#3', 'G3', 'F3', 'D#3', 'C3', null];
const BASS_NOTE_COLORS: { [key: string]: string } = {
    'C3': '#FF6B6B', 'D#3': '#FFD166', 'F3': '#06D6A0', 'G3': '#118AB2',
    'A#3': '#7209B7', 'C4': '#F78C6B', 'D#4': '#FFD972', 'F4': '#37E2B3',
};

@customElement('step-sequencer')
export class StepSequencer extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      background-color: #222;
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid #555;
    }
    .track {
      display: grid;
      grid-template-columns: 80px repeat(16, 1fr);
      gap: 5px;
      align-items: center;
    }
    .track-label {
      font-weight: 700;
      font-size: 0.9rem;
      text-align: right;
      padding-right: 10px;
      color: #fff;
    }
    .step {
      aspect-ratio: 1;
      background-color: #444;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.1s, transform 0.1s;
      position: relative;
      border: 1px solid #555;
    }
    .step:hover {
      background-color: #666;
      border-color: #888;
    }
    .step.active {
      background-color: #06D6A0;
      border-color: #06D6A0;
      box-shadow: 0 0 5px rgba(6, 214, 160, 0.5);
    }
    .step.current::before {
      content: '';
      position: absolute;
      top: -4px;
      left: -4px;
      right: -4px;
      bottom: -4px;
      border: 2px solid #FFD166;
      border-radius: 6px;
      pointer-events: none;
      z-index: 10;
    }
    .bass-step {
      opacity: 0.6;
      background-color: #333;
    }
    .bass-step.active {
        opacity: 1;
    }
    .chord-track {
        align-items: stretch;
    }
    .chord-step {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #333;
        font-size: 0.7em;
        color: #ccc;
        aspect-ratio: auto;
        min-height: 20px;
    }
    .chord-step.active {
        background-color: #7209B7;
        color: white;
        font-weight: bold;
        border-color: #9b4de0;
    }
  `;

  @property({ type: Object }) sequencerState!: SequencerState;
  @property({ type: Number }) activeStep = -1;

  private toggleDrumStep(trackName: 'kick' | 'snare' | 'hihat', stepIndex: number) {
    const track = this.sequencerState[trackName];
    track.steps[stepIndex] = !track.steps[stepIndex];
    this.dispatchChange();
  }

  private cycleBassNote(stepIndex: number) {
    const currentNote = this.sequencerState.bass.steps[stepIndex] as Note;
    const currentIndex = BASS_NOTES.indexOf(currentNote);
    const nextIndex = (currentIndex + 1) % BASS_NOTES.length;
    this.sequencerState.bass.steps[stepIndex] = BASS_NOTES[nextIndex];
    this.dispatchChange();
  }

  private clearChordStep(stepIndex: number) {
    this.sequencerState.chords.steps[stepIndex] = null;
    this.dispatchChange();
  }

  private dispatchChange() {
    // FIX: Cast to any to access dispatchEvent, as type system fails to see this as a LitElement.
    (this as any).dispatchEvent(new CustomEvent('sequence-changed', {
      detail: this.sequencerState,
    }));
    // FIX: Cast to any to access requestUpdate, as type system fails to see this as a LitElement.
    (this as any).requestUpdate();
  }

  render() {
    return html`
      ${this.renderTrack('kick', 'Kick')}
      ${this.renderTrack('snare', 'Snare')}
      ${this.renderTrack('hihat', 'Hi-Hat')}
      ${this.renderBassTrack('bass', 'Bass')}
      ${this.renderChordTrack('chords', 'Chords')}
    `;
  }

  private renderTrack(trackName: 'kick' | 'snare' | 'hihat', label: string) {
    const track = this.sequencerState[trackName];
    return html`
      <div class="track">
        <div class="track-label">${label}</div>
        ${track.steps.map((isActive, i) => html`
          <div
            class=${classMap({ step: true, active: !!isActive, current: this.activeStep === i })}
            @click=${() => this.toggleDrumStep(trackName, i)}>
          </div>
        `)}
      </div>
    `;
  }

  private renderBassTrack(trackName: 'bass', label: string) {
    const track = this.sequencerState[trackName];
    return html`
      <div class="track">
        <div class="track-label">${label}</div>
        ${track.steps.map((note, i) => {
          const color = note ? BASS_NOTE_COLORS[note as string] || '#06D6A0' : '';
          return html`
          <div
            class=${classMap({ step: true, 'bass-step': true, active: note !== null, current: this.activeStep === i })}
            style="${note ? `background-color: ${color}` : ''}"
            @click=${() => this.cycleBassNote(i)}>
          </div>
        `})}
      </div>
    `;
  }

  private renderChordTrack(trackName: 'chords', label: string) {
    const track = this.sequencerState[trackName];
    return html`
      <div class="track chord-track">
        <div class="track-label">${label}</div>
        ${(track.steps as (string | null)[]).map((chord, i) => html`
          <div
            class=${classMap({ step: true, 'chord-step': true, active: chord !== null, current: this.activeStep === i })}
            title=${chord || 'Right-click to clear'}
            @contextmenu=${(e: MouseEvent) => { e.preventDefault(); this.clearChordStep(i); }}>
            ${chord}
          </div>
        `)}
      </div>
    `;
  }
}

if (!customElements.get('step-sequencer')) {
  customElements.define('step-sequencer', StepSequencer as any);
}