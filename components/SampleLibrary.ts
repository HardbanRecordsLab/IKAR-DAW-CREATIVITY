
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import WaveSurfer from 'wavesurfer.js';

import type { SampleSettings } from '../types';
import { AudioEngine, SAMPLE_LIBRARY } from '../utils/audio-engine';

@customElement('sample-library')
export class SampleLibrary extends LitElement {
    static styles = css`
        .modal-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
        }
        .modal-content {
            background: #2a2a2a;
            padding: 2rem;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            width: 80vw;
            max-width: 700px;
            max-height: 85vh;
            overflow-y: auto;
            border: 1px solid #444;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .preview-area {
            background: #111;
            border-radius: 6px;
            padding: 10px;
            height: 120px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            position: relative;
            border: 1px solid #333;
        }
        .preview-placeholder {
            color: #555;
            text-align: center;
            font-size: 0.9rem;
        }
        #waveform {
            width: 100%;
            height: 100%;
        }
        .ai-generator-section {
            background: #333;
            padding: 1rem;
            border-radius: 6px;
            border: 1px solid #555;
        }
        .ai-generator-section h3 {
            margin: 0 0 1rem 0;
            color: #FFD166;
            font-size: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .ai-controls {
            display: flex;
            gap: 0.5rem;
        }
        .ai-controls select, .ai-controls input {
            background: #222;
            color: #fff;
            border: 1px solid #555;
            padding: 0.5rem;
            border-radius: 4px;
        }
        .ai-controls input {
            flex: 1;
        }
        .ai-controls button {
            background: #FFD166;
            color: #111;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            font-weight: bold;
            cursor: pointer;
        }
        .ai-controls button:disabled {
            opacity: 0.5;
            cursor: wait;
        }
        .track-category {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        h2 { margin-top: 0; color: #fff; }
        h4 { margin: 0; color: #06D6A0; border-bottom: 1px solid #444; padding-bottom: 5px; }
        .sample-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 0.5rem;
        }
        .sample-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #333;
            padding: 0.6rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
            border: 1px solid transparent;
        }
        .sample-item:hover {
            background: #444;
        }
        .sample-item.active {
            border-color: #06D6A0;
            background: #3a3a3a;
        }
        .sample-controls button {
            margin-left: 0.5rem;
            font-size: 0.8rem;
            padding: 0.3em 0.6em;
        }
        .close-btn {
            align-self: flex-end;
            background: #444;
            border: none;
            padding: 0.8rem 2rem;
            margin-top: 1rem;
        }
        .close-btn:hover { background: #555; }
        
        .loading-spinner {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid #111;
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
    `;

    @property({ type: Object }) currentSamples!: SampleSettings;
    @property({ type: Object }) audioEngine!: AudioEngine;
    
    @state() private activePreviewUrl: string | null = null;
    @state() private aiDrumType: 'kick' | 'snare' | 'hihat' = 'kick';
    @state() private aiPrompt = '';
    @state() private isGenerating = false;
    @state() private generatedSamples: { [key: string]: { name: string, url: string }[] } = {
        kick: [], snare: [], hihat: []
    };
    
    private wavesurfer: WaveSurfer | null = null;

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.wavesurfer) {
            this.wavesurfer.destroy();
        }
    }

    private close() {
        // FIX: Cast to any to access dispatchEvent, as type system fails to see this as a LitElement.
        (this as any).dispatchEvent(new CustomEvent('close-library'));
    }

    private selectSample(track: keyof SampleSettings, url: string) {
        // FIX: Cast to any to access dispatchEvent, as type system fails to see this as a LitElement.
        (this as any).dispatchEvent(new CustomEvent('sample-selected', { detail: { track, url } }));
    }

    private async playPreview(url: string) {
        this.activePreviewUrl = url;
        
        // Ensure DOM is updated before initializing wavesurfer
        await (this as any).updateComplete;

        const container = (this as any).renderRoot.querySelector('#waveform');
        
        if (this.wavesurfer) {
            this.wavesurfer.destroy();
        }

        const fullUrl = url.startsWith('blob:') ? url : `https://storage.googleapis.com/prompt-dj-app-public/samples/rythmai-daw/${url}`;

        this.wavesurfer = WaveSurfer.create({
            container: container,
            waveColor: '#444',
            progressColor: '#06D6A0',
            cursorColor: '#FFD166',
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            height: 100,
            url: fullUrl,
        });

        this.wavesurfer.on('ready', () => {
            this.wavesurfer?.play();
        });
        
        this.audioEngine.previewSample(url);
    }

    private async generateAiSample() {
        if (!this.aiPrompt.trim()) return;
        
        this.isGenerating = true;
        try {
            const result = await this.audioEngine.generateAndRenderDrum(this.aiDrumType, this.aiPrompt);
            if (result) {
                this.generatedSamples = {
                    ...this.generatedSamples,
                    [this.aiDrumType]: [
                        ...this.generatedSamples[this.aiDrumType],
                        { name: `AI: ${this.aiPrompt}`, url: result.url }
                    ]
                };
                // Automatically preview the new sound
                this.playPreview(result.url);
            }
        } catch (e) {
            console.error("Generation failed", e);
        } finally {
            this.isGenerating = false;
        }
    }

    render() {
        return html`
            <div class="modal-backdrop" @click=${this.close}>
                <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
                    <h2>Sample Library</h2>
                    
                    <div class="ai-generator-section">
                        <h3>✨ AI Drum Designer</h3>
                        <div class="ai-controls">
                            <select @change=${(e: Event) => this.aiDrumType = (e.target as HTMLSelectElement).value as any}>
                                <option value="kick">Kick</option>
                                <option value="snare">Snare</option>
                                <option value="hihat">Hi-Hat</option>
                            </select>
                            <input 
                                type="text" 
                                placeholder="Describe sound (e.g., 'distorted industrial kick')"
                                .value=${this.aiPrompt}
                                @input=${(e: Event) => this.aiPrompt = (e.target as HTMLInputElement).value}
                                @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.generateAiSample()}
                            >
                            <button @click=${this.generateAiSample} ?disabled=${this.isGenerating}>
                                ${this.isGenerating ? html`<span class="loading-spinner"></span>` : 'Generate'}
                            </button>
                        </div>
                    </div>
                    
                    <div class="preview-area">
                        ${this.activePreviewUrl 
                            ? html`<div id="waveform"></div>` 
                            : html`<div class="preview-placeholder">Select a sample to preview waveform</div>`
                        }
                    </div>

                    ${Object.keys(SAMPLE_LIBRARY).map(track => {
                        const trackKey = track as keyof SampleSettings;
                        const staticSamples = SAMPLE_LIBRARY[trackKey];
                        const aiSamples = this.generatedSamples[trackKey] || [];
                        const allSamples = [...aiSamples, ...staticSamples];
                        
                        return html`
                            <div class="track-category">
                                <h4>${track.charAt(0).toUpperCase() + track.slice(1)}</h4>
                                <div class="sample-list">
                                    ${allSamples.map(sample => html`
                                        <div class="sample-item ${classMap({active: this.currentSamples[trackKey] === sample.url})}"
                                             @click=${() => this.playPreview(sample.url)}>
                                            <span style="${sample.name.startsWith('AI:') ? 'color: #FFD166' : ''}">${sample.name}</span>
                                            <div class="sample-controls">
                                                <button @click=${(e: Event) => { e.stopPropagation(); this.selectSample(trackKey, sample.url); }}>Load</button>
                                            </div>
                                        </div>
                                    `)}
                                </div>
                            </div>
                        `
                    })}
                    <button class="close-btn" @click=${this.close}>Close Library</button>
                </div>
            </div>
        `;
    }
}

if (!customElements.get('sample-library')) {
  customElements.define('sample-library', SampleLibrary as any);
}