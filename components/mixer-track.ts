
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

@customElement('mixer-track')
export class MixerTrack extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.8rem;
      background: #222;
      padding: 1rem 0.5rem;
      border-radius: 8px;
      width: 80px;
      min-height: 200px;
      position: relative;
      transition: box-shadow 0.2s, border-color 0.2s;
      border: 1px solid #555;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }
    :host(.drag-over) {
        border-color: #06D6A0;
        box-shadow: 0 0 10px rgba(6, 214, 160, 0.5);
    }
    .vu-meter {
      position: absolute;
      bottom: 10px;
      left: 10px;
      width: calc(100% - 20px);
      background-color: rgba(0,0,0,0.3);
      border-radius: 4px;
      z-index: 0;
      overflow: hidden;
      height: calc(100% - 20px);
      pointer-events: none;
    }
    .vu-meter-level {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      background: linear-gradient(to top, #06D6A0, #FFD166 80%, #FF6B6B 100%);
      transition: height 0.1s linear;
      opacity: 0.2;
    }
    .fader-container {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 1;
      min-height: 150px;
      justify-content: center;
      width: 40px;
    }
    .fader {
      -webkit-appearance: none;
      appearance: none;
      width: 140px;
      height: 20px;
      background: #333; 
      outline: none;
      border-radius: 10px;
      cursor: pointer;
      transform: rotate(-90deg);
      border: 2px solid #666;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
    }
    .fader::before {
        content: '';
        position: absolute;
        top: 8px;
        left: 0;
        right: 0;
        height: 4px;
        background: #000;
        border-radius: 2px;
        z-index: -1;
        border: 1px solid #222;
    }
    .fader::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 24px;
      height: 34px;
      background: #eee; /* High contrast thumb */
      border-radius: 4px;
      cursor: pointer;
      border: 1px solid #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.9);
    }
    .fader::-webkit-slider-thumb:hover {
       background: #fff;
       border-color: #fff;
       box-shadow: 0 0 8px rgba(255, 255, 255, 0.4);
    }
    .fader::-moz-range-thumb {
      width: 24px;
      height: 34px;
      background: #eee;
      border-radius: 4px;
      cursor: pointer;
      border: 1px solid #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.9);
    }
    .label {
      font-size: 0.9rem;
      font-weight: bold;
      z-index: 1;
      cursor: default;
      color: #fff;
      text-shadow: 0 1px 3px #000;
      background: rgba(0,0,0,0.6);
      padding: 2px 6px;
      border-radius: 4px;
      margin-bottom: 5px;
      white-space: nowrap;
    }
    .label.can-drop {
        cursor: pointer;
        border-bottom: 1px dashed #999;
    }
    .label.can-drop:hover {
        color: #06D6A0;
        border-color: #06D6A0;
    }
    .value {
      font-size: 0.75rem;
      font-family: monospace;
      margin-top: -50px;
      z-index: 1;
      color: #eee;
      text-shadow: 0 1px 2px #000;
      background: rgba(0,0,0,0.6);
      padding: 2px 4px;
      border-radius: 3px;
    }
    .pan-knob {
      -webkit-appearance: none;
      appearance: none;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #333;
      border: 2px solid #888;
      cursor: pointer;
      outline: none;
      z-index: 1;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
    }
    .pan-knob:hover {
        border-color: #fff;
    }
    .pan-knob::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 4px;
      height: 16px;
      background: #06D6A0;
      cursor: pointer;
      border-radius: 2px;
    }
    .buttons {
        display: flex;
        gap: 5px;
        z-index: 1;
    }
    .buttons button {
        border-radius: 4px;
        border: 1px solid #555;
        background: #333;
        color: #ccc;
        width: 28px;
        height: 28px;
        cursor: pointer;
        font-weight: bold;
        font-size: 0.75rem;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    }
    .buttons button:hover {
        background: #444;
        color: #fff;
    }
    .buttons button.active {
        background: #FFD166;
        color: #111;
        border-color: #FFD166;
        font-weight: 800;
    }
    .buttons button.solo.active {
        background: #FF6B6B;
        border-color: #FF6B6B;
    }
  `;

  @property({ type: String }) label = '';
  @property({ type: Number }) volume = 0; // in dB
  @property({ type: Number }) pan = 0; // -1 to 1
  @property({ type: Boolean }) mute = false;
  @property({ type: Boolean }) solo = false;
  @property({ type: Number }) level = -Infinity; // in dB
  @property({ type: Boolean }) canDrop = false;
  
  @state() private isDragOver = false;

  private dispatchChange(eventName: string, value: any) {
    // FIX: Cast to any to access dispatchEvent, as type system fails to see this as a LitElement.
    (this as any).dispatchEvent(new CustomEvent(eventName, {
        detail: { value }
    }));
  }
  
  private handleDragEnter(e: DragEvent) {
    if(!this.canDrop) return;
    e.preventDefault();
    this.isDragOver = true;
  }

  private handleDragLeave(e: DragEvent) {
    if(!this.canDrop) return;
    e.preventDefault();
    this.isDragOver = false;
  }

  private handleDrop(e: DragEvent) {
    if(!this.canDrop) return;
    this.isDragOver = false;
  }

  render() {
    const panDisplay = this.pan === 0 ? 'C' : (this.pan < 0 ? `L${Math.abs(this.pan * 100).toFixed(0)}` : `R${(this.pan * 100).toFixed(0)}`);
    
    const minDb = -40;
    const maxDb = 6;
    const meterPercent = (this.level - minDb) / (maxDb - minDb) * 100;
    const clampedPercent = Math.max(0, Math.min(100, meterPercent));
    const meterStyles = styleMap({ height: `${clampedPercent}%` });

    return html`
      <div 
        class="host-container ${classMap({'drag-over': this.isDragOver})}"
        @dragenter=${this.handleDragEnter}
        @dragleave=${this.handleDragLeave}
        @drop=${this.handleDrop}
        @dragover=${(e: DragEvent) => { if(this.canDrop) e.preventDefault(); }}
      >
      </div>
      
      <div class="vu-meter">
        <div class="vu-meter-level" style=${meterStyles}></div>
      </div>

      <div class="label ${classMap({'can-drop': this.canDrop})}" title=${this.canDrop ? 'Drag & Drop audio file here' : ''}>
        ${this.label}
      </div>
      
      <div class="buttons">
        <button 
            class=${classMap({ active: this.mute })}
            @click=${() => this.dispatchChange('mute-toggled', !this.mute)}>M</button>
        <button 
            class=${classMap({ solo: true, active: this.solo })}
            @click=${() => this.dispatchChange('solo-toggled', !this.solo)}>S</button>
      </div>
      <input 
        type="range" 
        class="pan-knob"
        min="-1" 
        max="1" 
        step="0.01"
        .value=${this.pan}
        @input=${(e: Event) => this.dispatchChange('pan-changed', parseFloat((e.target as HTMLInputElement).value))}>
      <div class="value">${panDisplay}</div>
      
      <div class="fader-container">
        <input 
          type="range" 
          class="fader"
          min="-40" 
          max="6" 
          step="0.1"
          .value=${this.volume}
          @input=${(e: Event) => this.dispatchChange('volume-changed', parseFloat((e.target as HTMLInputElement).value))}>
        <div class="value">${this.volume.toFixed(1)} dB</div>
      </div>
    `;
  }
}

if (!customElements.get('mixer-track')) {
  customElements.define('mixer-track', MixerTrack as any);
}
