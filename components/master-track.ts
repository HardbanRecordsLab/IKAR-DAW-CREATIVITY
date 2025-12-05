
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { AudioEngine } from '../utils/audio-engine';

@customElement('master-track')
export class MasterTrack extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.8rem;
      background: #2a2a2a;
      padding: 1rem 0.5rem;
      border-radius: 8px;
      width: 120px;
      position: relative;
      border: 2px solid #555;
      box-shadow: 0 4px 10px rgba(0,0,0,0.4);
    }
    .visualizer-canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
        opacity: 0.4;
        border-radius: 6px;
        pointer-events: none;
    }
    .vu-meter {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      background-color: transparent; 
      border-radius: 8px;
      z-index: 0;
      overflow: hidden;
      height: 100%;
      pointer-events: none;
    }
    .vu-meter-level {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      background: linear-gradient(to top, #06D6A033, #FFD16633 80%, #FF6B6B33 100%);
      transition: height 0.1s linear;
    }
    .fader-container {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 1;
      margin-top: 1rem;
    }
    .fader {
      -webkit-appearance: none;
      appearance: none;
      width: 140px;
      height: 20px;
      background: transparent;
      outline: none;
      border-radius: 8px;
      cursor: pointer;
      transform: rotate(-90deg);
      margin: 60px 0;
    }
    /* Visible track for the fader */
    .fader::before {
        content: '';
        position: absolute;
        top: 8px;
        left: 0;
        right: 0;
        height: 4px;
        background: #111;
        border-radius: 2px;
        z-index: -1;
        border: 1px solid #000;
    }
    .fader::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 25px;
      height: 35px;
      background: #eee;
      border-radius: 4px;
      cursor: pointer;
      border: 1px solid #888;
      box-shadow: 0 2px 4px rgba(0,0,0,0.5);
    }
    .fader::-moz-range-thumb {
      width: 25px;
      height: 35px;
      background: #eee;
      border-radius: 4px;
      cursor: pointer;
      border: none;
    }
    .label {
      font-size: 1.1rem;
      font-weight: 800;
      z-index: 1;
      color: #FFD166;
      text-shadow: 0 2px 4px #000;
      margin-bottom: 5px;
      background: rgba(0,0,0,0.5);
      padding: 2px 8px;
      border-radius: 4px;
    }
    .value {
      font-size: 0.75rem;
      font-family: monospace;
      margin-top: -50px;
      z-index: 1;
      text-shadow: 0 1px 2px #000;
      color: #fff;
      background: rgba(0,0,0,0.6);
      padding: 2px 5px;
      border-radius: 3px;
    }
    .knob-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.2rem;
        z-index: 1;
        width: 100%;
        background: rgba(0,0,0,0.2);
        padding: 2px 0;
        border-radius: 4px;
        margin-bottom: 4px;
    }
    .knob-group label {
        font-size: 0.7em;
        color: #ddd;
        text-shadow: 0 1px 2px #000;
        font-weight: 600;
    }
    .knob-group input[type="range"] {
        width: 80%;
        height: 15px;
        cursor: pointer;
        accent-color: #FFD166;
    }
    .knob-group .value {
        font-size: 0.7em;
        margin-top: 0;
        background: none;
    }
  `;

  @property({ type: Number }) volume = 0; // in dB
  @property({ type: Number }) compThreshold = -24; // in dB
  @property({ type: Number }) compRatio = 12; // 1 to 20
  @property({ type: Number }) limiterThreshold = -6; // in dB
  @property({ type: Number }) level = -Infinity; // in dB
  @property({ type: Object }) audioEngine: AudioEngine | null = null;

  @query('canvas') canvas!: HTMLCanvasElement;
  private animationFrameId: number | null = null;

  private dispatchChange(eventName: string, value: any) {
    // FIX: Cast to any to access dispatchEvent, as type system fails to see this as a LitElement.
    (this as any).dispatchEvent(new CustomEvent(eventName, {
        detail: { value }
    }));
  }

  updated(changedProperties: Map<string, any>) {
      if (changedProperties.has('audioEngine') && this.audioEngine) {
          this.startVisualizer();
      }
  }

  disconnectedCallback() {
      super.disconnectedCallback();
      if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
      }
  }

  private startVisualizer() {
      if (!this.canvas || !this.audioEngine) return;
      
      const ctx = this.canvas.getContext('2d');
      if (!ctx) return;

      const render = () => {
          if (!this.audioEngine?.masterAnalyser) {
             this.animationFrameId = requestAnimationFrame(render);
             return;
          }

          // Get FFT data (frequency domain)
          const values = this.audioEngine.masterAnalyser.getValue();
          
          // Set Canvas size
          this.canvas.width = this.canvas.offsetWidth;
          this.canvas.height = this.canvas.offsetHeight;
          
          ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
          
          // Draw spectrum
          const barWidth = this.canvas.width / values.length;
          
          // Gradient for bars
          const gradient = ctx.createLinearGradient(0, this.canvas.height, 0, 0);
          gradient.addColorStop(0, '#06D6A0');
          gradient.addColorStop(0.5, '#FFD166');
          gradient.addColorStop(1, '#FF6B6B');
          ctx.fillStyle = gradient;

          if (values instanceof Float32Array) {
             for (let i = 0; i < values.length; i++) {
                 const value = values[i]; // Value is in dB, roughly -100 to 0
                 const heightPercent = Math.max(0, (value + 100) / 100); // Normalize to 0-1
                 const barHeight = heightPercent * this.canvas.height;
                 
                 ctx.fillRect(i * barWidth, this.canvas.height - barHeight, barWidth - 1, barHeight);
             }
          }
          
          this.animationFrameId = requestAnimationFrame(render);
      };
      render();
  }

  render() {
    const minDb = -40;
    const maxDb = 6;
    const meterPercent = (this.level - minDb) / (maxDb - minDb) * 100;
    const clampedPercent = Math.max(0, Math.min(100, meterPercent));
    const meterStyles = styleMap({ height: `${clampedPercent}%` });

    return html`
      <canvas class="visualizer-canvas"></canvas>
      <div class="vu-meter">
        <div class="vu-meter-level" style=${meterStyles}></div>
      </div>

      <div class="label">Master</div>

      <div class="knob-group">
        <label>Comp Thresh</label>
        <input type="range" min="-48" max="0" step="0.5" .value=${this.compThreshold}
            @input=${(e: Event) => this.dispatchChange('comp-threshold-changed', parseFloat((e.target as HTMLInputElement).value))}>
        <div class="value">${this.compThreshold.toFixed(1)} dB</div>
      </div>
      <div class="knob-group">
        <label>Comp Ratio</label>
        <input type="range" min="1" max="20" step="0.5" .value=${this.compRatio}
            @input=${(e: Event) => this.dispatchChange('comp-ratio-changed', parseFloat((e.target as HTMLInputElement).value))}>
        <div class="value">${this.compRatio.toFixed(1)}:1</div>
      </div>
       <div class="knob-group">
        <label>Limiter</label>
        <input type="range" min="-24" max="0" step="0.5" .value=${this.limiterThreshold}
            @input=${(e: Event) => this.dispatchChange('limiter-threshold-changed', parseFloat((e.target as HTMLInputElement).value))}>
        <div class="value">${this.limiterThreshold.toFixed(1)} dB</div>
      </div>
      
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

if (!customElements.get('master-track')) {
  customElements.define('master-track', MasterTrack as any);
}