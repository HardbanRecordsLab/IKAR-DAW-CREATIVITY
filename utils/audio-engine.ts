
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as Tone from 'tone';
import type { DawLayout, EffectsState, MasterSettings, Note, Pattern, Prompt, SampleSettings, SynthState, TrackSettings } from '../types';
import { generateDrumParams } from './GeminiHelper';

const SAMPLES_URL = 'https://storage.googleapis.com/prompt-dj-app-public/samples/rythmai-daw/';

export const SAMPLE_LIBRARY: { [key in keyof SampleSettings]: { name: string, url: string }[] } = {
    kick: [
        { name: 'Default Kick', url: 'kick.wav' },
        { name: 'Acoustic Kick', url: 'kick_acoustic.wav' },
        { name: '808 Kick', url: 'kick_808.wav' },
        { name: 'Vinyl Kick', url: 'kick_vinyl.wav' },
    ],
    snare: [
        { name: 'Default Snare', url: 'snare.wav' },
        { name: 'Acoustic Snare', url: 'snare_acoustic.wav' },
        { name: '808 Snare', url: 'snare_808.wav' },
        { name: 'Brush Snare', url: 'snare_brush.wav' },
    ],
    hihat: [
        { name: 'Default Hi-Hat', url: 'hihat.wav' },
        { name: 'Acoustic Hi-Hat', url: 'hihat_acoustic.wav' },
        { name: '808 Hi-Hat', url: 'hihat_808.wav' },
        { name: 'Open Hi-Hat', url: 'hihat_open.wav' },
    ]
};

export class AudioEngine {
    private instruments: {
        kick: Tone.Sampler;
        snare: Tone.Sampler;
        hihat: Tone.Sampler;
        bass: Tone.MonoSynth;
        chords: Tone.PolySynth;
    };
    private channels: {
        kick: Tone.Channel;
        snare: Tone.Channel;
        hihat: Tone.Channel;
        bass: Tone.Channel;
        chords: Tone.Channel;
    };
    private bassEffects: {
        distortion: Tone.Distortion;
        delay: Tone.FeedbackDelay;
        reverb: Tone.Reverb;
    };
    private master: {
        channel: Tone.Channel;
        compressor: Tone.Compressor;
        limiter: Tone.Limiter;
    };
    private meters: {
        kick: Tone.Meter;
        snare: Tone.Meter;
        hihat: Tone.Meter;
        bass: Tone.Meter;
        chords: Tone.Meter;
        master: Tone.Meter;
    };
    // Added Analyzer for visualization
    public masterAnalyser: Tone.Analyser;

    private mainLoop: Tone.Loop;
    private uiLoop: Tone.Loop;
    private isInitialized = false;
    private currentLayout: DawLayout | null = null;
    private currentPatternIndex: number | null = null;
    private previewPlayer: Tone.Player;

    public onStepChange: (step: number, bar: number) => void = () => {};
    public onMeterUpdate: (levels: { [key: string]: number }) => void = () => {};

    constructor() {
        this.previewPlayer = new Tone.Player().toDestination();

        // Master Channel Setup
        this.master = {
            channel: new Tone.Channel(0),
            compressor: new Tone.Compressor(-18, 4),
            limiter: new Tone.Limiter(-6),
        };
        
        // FFT Size 64 gives us 32 frequency bins, good for a retro visualizer
        this.masterAnalyser = new Tone.Analyser("fft", 64);
        
        this.master.channel.chain(this.master.compressor, this.master.limiter, this.masterAnalyser, Tone.Destination);

        this.channels = {
            kick: new Tone.Channel({volume: -3, pan: 0}).connect(this.master.channel),
            snare: new Tone.Channel({volume: -3, pan: 0}).connect(this.master.channel),
            hihat: new Tone.Channel({volume: -10, pan: 0}).connect(this.master.channel),
            bass: new Tone.Channel({volume: -3, pan: 0}), // Will be chained with effects
            chords: new Tone.Channel({volume: -9, pan: 0}).connect(this.master.channel),
        };

        this.bassEffects = {
            distortion: new Tone.Distortion(0),
            delay: new Tone.FeedbackDelay("8n", 0.5),
            reverb: new Tone.Reverb(1.5),
        };
        // Chain effects on bass channel before routing to master
        this.channels.bass.chain(this.bassEffects.distortion, this.bassEffects.delay, this.bassEffects.reverb, this.master.channel);

        this.meters = {
            kick: new Tone.Meter(),
            snare: new Tone.Meter(),
            hihat: new Tone.Meter(),
            bass: new Tone.Meter(),
            chords: new Tone.Meter(),
            master: new Tone.Meter(),
        };

        this.channels.kick.connect(this.meters.kick);
        this.channels.snare.connect(this.meters.snare);
        this.channels.hihat.connect(this.meters.hihat);
        this.channels.bass.connect(this.meters.bass);
        this.channels.chords.connect(this.meters.chords);
        this.master.limiter.connect(this.meters.master);

        // Initialize with default samples
        this.instruments = {
            kick: this.createSampler(SAMPLE_LIBRARY.kick[0].url, this.channels.kick),
            snare: this.createSampler(SAMPLE_LIBRARY.snare[0].url, this.channels.snare),
            hihat: this.createSampler(SAMPLE_LIBRARY.hihat[0].url, this.channels.hihat),
            bass: new Tone.MonoSynth({
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.1 },
                filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.2, baseFrequency: 200, octaves: 4 }
            }).connect(this.channels.bass),
            chords: new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'fatsawtooth', count: 3, spread: 30 },
                envelope: { attack: 0.01, decay: 0.5, sustain: 0.2, release: 0.8 },
            }).connect(this.channels.chords),
        };
        
        this.mainLoop = new Tone.Loop(this.tick.bind(this), '1m'); // Loop every measure (bar)
        this.uiLoop = new Tone.Loop(this.updateUi.bind(this), '16n');

        Tone.Transport.on('stop', () => {
            this.onStepChange(-1, -1);
            this.currentPatternIndex = null;
            this.onMeterUpdate({ kick: -Infinity, snare: -Infinity, hihat: -Infinity, bass: -Infinity, chords: -Infinity, master: -Infinity });
        });
    }

    private createSampler(url: string, destination: Tone.ToneAudioNode): Tone.Sampler {
        const isBlob = url.startsWith('blob:');
        const sampler = new Tone.Sampler({
            urls: { C1: url },
            baseUrl: isBlob ? '' : SAMPLES_URL
        }).connect(destination);
        return sampler;
    }

    private updateUi() {
        this.onMeterUpdate({
            kick: this.meters.kick.getValue() as number,
            snare: this.meters.snare.getValue() as number,
            hihat: this.meters.hihat.getValue() as number,
            bass: this.meters.bass.getValue() as number,
            chords: this.meters.chords.getValue() as number,
            master: this.meters.master.getValue() as number,
        });
    }

    private tick(time: number) {
        if (!this.currentLayout) return;

        const currentBar = this.mainLoop.progress * this.currentLayout.arrangement.length;
        const barIndex = Math.floor(currentBar);
        const patternIndex = this.currentLayout.arrangement[barIndex];

        if (patternIndex === null) {
            // Mute bass if bar is empty to prevent hanging notes
            this.instruments.bass.triggerRelease(time);
            return;
        }
        
        if (patternIndex !== this.currentPatternIndex) {
            this.loadPattern(this.currentLayout.patterns[patternIndex]);
            this.currentPatternIndex = patternIndex;
        }
        
        const pattern = this.currentLayout.patterns[patternIndex];
        this.schedulePattern(pattern, time, barIndex);
    }

    private schedulePattern(pattern: Pattern, time: number, barIndex: number) {
        const seq = pattern.sequencerState;
        for (let i = 0; i < 16; i++) {
            const stepTime = time + (i * Tone.Time('16n').toSeconds());
            
            if (seq.kick.steps[i]) this.instruments.kick.triggerAttack('C1', stepTime);
            if (seq.snare.steps[i]) this.instruments.snare.triggerAttack('C1', stepTime);
            if (seq.hihat.steps[i]) this.instruments.hihat.triggerAttack('C1', stepTime);
            
            const bassNote = seq.bass.steps[i] as Note;
            if (bassNote) this.instruments.bass.triggerAttackRelease(bassNote, '16n', stepTime);

            const chord = seq.chords.steps[i] as (string | null);
            if (chord) this.instruments.chords.triggerAttackRelease(chord, '4n', stepTime);
            
            Tone.Draw.schedule(() => {
                this.onStepChange(i, barIndex);
            }, stepTime);
        }
    }
    
    private loadPattern(pattern: Pattern) {
        this.updateMixerSettings(pattern.trackSettings);
        this.updateBassEffects(pattern.effectsState);
        if (pattern.synthState) {
            this.setBassSynth(pattern.synthState);
        }
    }
    
    private updateMixerSettings(settings: TrackSettings) {
        const soloedTracks = Object.keys(settings).filter(key => settings[key as keyof TrackSettings].solo);
        
        for (const trackName in settings) {
            const key = trackName as keyof TrackSettings;
            const channel = this.channels[key];
            const trackSettings = settings[key];

            channel.pan.value = trackSettings.pan;
            channel.volume.value = trackSettings.volume;
            
            if (soloedTracks.length > 0) {
                channel.mute = !trackSettings.solo;
            } else {
                channel.mute = trackSettings.mute;
            }
        }
    }

    public updateMasterSettings(settings: MasterSettings) {
        this.master.channel.volume.value = settings.volume;
        this.master.compressor.set(settings.compressor);
        this.master.limiter.threshold.value = settings.limiter.threshold;
    }

    private async initialize() {
        if (!this.isInitialized) {
            await Tone.start();
            await Tone.loaded();
            this.isInitialized = true;
            console.log('Audio engine initialized.');
        }
    }

    async start() {
        await this.initialize();
        if (!this.currentLayout) return;
        this.mainLoop.iterations = this.currentLayout.arrangement.length;
        Tone.Transport.start();
        this.mainLoop.start(0);
        this.uiLoop.start(0);
    }

    stop() {
        Tone.Transport.stop();
        this.mainLoop.stop();
        this.uiLoop.stop();
    }

    updateAll(layout: DawLayout) {
        const oldLayout = this.currentLayout;
        this.currentLayout = layout;
        this.setBpm(layout.bpm);
        this.updateMasterSettings(layout.masterSettings);

        const loadSampleIfChanged = (track: keyof SampleSettings) => {
            if (!oldLayout || oldLayout.sampleSettings[track] !== layout.sampleSettings[track]) {
                this.loadSample(track, layout.sampleSettings[track]).catch(err => {
                    // This can happen on startup, so just log the error to avoid spamming user.
                    console.error(`Failed to automatically load sample for ${track}:`, err);
                });
            }
        };

        loadSampleIfChanged('kick');
        loadSampleIfChanged('snare');
        loadSampleIfChanged('hihat');
    }
    
    setBpm(bpm: number) {
        Tone.Transport.bpm.value = bpm;
    }

    async loadSample(track: keyof SampleSettings, url: string) {
        const drumTrack = track as 'kick' | 'snare' | 'hihat';
        await this.initialize();
        
        // Dispose old sampler to free resources
        if (this.instruments[drumTrack]) {
            this.instruments[drumTrack].dispose();
        }
        
        // Create new sampler
        this.instruments[drumTrack] = this.createSampler(url, this.channels[drumTrack]);
        
        await Tone.loaded();
    }

    async previewSample(url: string) {
        await this.initialize();
        const isBlob = url.startsWith('blob:');
        const fullUrl = isBlob ? url : SAMPLES_URL + url;
        
        // Simple stop/load/play mechanism for preview
        this.previewPlayer.stop();
        await this.previewPlayer.load(fullUrl);
        this.previewPlayer.start();
    }

    public async midiNoteOn(note: string, velocity: number) {
        await this.initialize(); // Ensure context is started
        const gain = velocity / 127;
        this.instruments.bass.triggerAttack(note, undefined, gain);
    }

    public midiNoteOff(note: string) {
        this.instruments.bass.triggerRelease();
    }

    public updateBassEffects(effectsState: EffectsState) {
        this.bassEffects.distortion.wet.value = effectsState.distortion.wet;
        this.bassEffects.distortion.set(effectsState.distortion.settings);
    
        this.bassEffects.delay.wet.value = effectsState.delay.wet;
        this.bassEffects.delay.set(effectsState.delay.settings);
    
        this.bassEffects.reverb.wet.value = effectsState.reverb.wet;
        this.bassEffects.reverb.set(effectsState.reverb.settings);
    }

    public setBassSynth(settings: SynthState) {
        this.instruments.bass.set(settings);
    }

    async generateAndRenderDrum(drumType: 'kick' | 'snare' | 'hihat', description: string): Promise<{blob: Blob, url: string} | null> {
        const params = await generateDrumParams(drumType, description);
        
        if (!params || !params.synthType) return null;

        const duration = 1.0; // 1 second render is plenty for a drum shot

        const buffer = await Tone.Offline(() => {
            let synth: any;
            if (params.synthType === 'MembraneSynth') {
                synth = new Tone.MembraneSynth().toDestination();
            } else if (params.synthType === 'NoiseSynth') {
                synth = new Tone.NoiseSynth().toDestination();
            } else if (params.synthType === 'MetalSynth') {
                synth = new Tone.MetalSynth().toDestination();
            }
            
            if (synth) {
                synth.set(params.settings);
                
                // Trigger slightly after 0 to avoid click artifacts
                if (params.synthType === 'MembraneSynth') {
                    // Membrane synth needs a note
                    const note = drumType === 'kick' ? 'C1' : 'C4';
                    synth.triggerAttackRelease(note, '8n', 0.05);
                } else {
                    // Noise and Metal just trigger
                    synth.triggerAttackRelease('16n', 0.05);
                }
            }
        }, duration);

        const blob = this.audioBufferToWav(buffer);
        const url = URL.createObjectURL(blob);
        return { blob, url };
    }
    
    async renderSong(layout: DawLayout): Promise<Blob> {
        const barDuration = Tone.Time('1m').toSeconds();
        const totalDuration = barDuration * layout.arrangement.length;
        
        const buffer = await Tone.Offline(async (offlineContext) => {
            offlineContext.transport.bpm.value = layout.bpm;
            
            // Create a minimal, sandboxed audio graph for offline rendering.
            const offlineMaster = {
                channel: new Tone.Channel(layout.masterSettings.volume),
                compressor: new Tone.Compressor(layout.masterSettings.compressor),
                limiter: new Tone.Limiter(layout.masterSettings.limiter.threshold),
            };
            offlineMaster.channel.chain(offlineMaster.compressor, offlineMaster.limiter, offlineContext.destination);

            const offlineChannels = {
                kick: new Tone.Channel().connect(offlineMaster.channel),
                snare: new Tone.Channel().connect(offlineMaster.channel),
                hihat: new Tone.Channel().connect(offlineMaster.channel),
                bass: new Tone.Channel(),
                chords: new Tone.Channel().connect(offlineMaster.channel),
            };
            const offlineBassEffects = {
                distortion: new Tone.Distortion(),
                delay: new Tone.FeedbackDelay(),
                reverb: new Tone.Reverb(),
            };
            offlineChannels.bass.chain(offlineBassEffects.distortion, offlineBassEffects.delay, offlineBassEffects.reverb, offlineMaster.channel);

            // Helper for creating offline samplers (handles Blob URLs vs Remote URLs)
            const createOfflineSampler = (url: string, dest: Tone.ToneAudioNode) => {
                const isBlob = url.startsWith('blob:');
                return new Tone.Sampler({ 
                    urls: { C1: url }, 
                    baseUrl: isBlob ? '' : SAMPLES_URL 
                }).connect(dest);
            };

            const offlineInstruments = {
                kick: createOfflineSampler(layout.sampleSettings.kick, offlineChannels.kick),
                snare: createOfflineSampler(layout.sampleSettings.snare, offlineChannels.snare),
                hihat: createOfflineSampler(layout.sampleSettings.hihat, offlineChannels.hihat),
                bass: new Tone.MonoSynth().connect(offlineChannels.bass),
                chords: new Tone.PolySynth(Tone.Synth).connect(offlineChannels.chords),
            };

            await Tone.loaded(); // Wait for samples to load in offline context
            
            for(let barIndex = 0; barIndex < layout.arrangement.length; barIndex++) {
                const patternIndex = layout.arrangement[barIndex];
                if (patternIndex === null) continue;

                const pattern = layout.patterns[patternIndex];
                const time = barIndex * barDuration;
                
                // Apply mixer settings
                const soloedTracks = Object.keys(pattern.trackSettings).filter(k => pattern.trackSettings[k as keyof TrackSettings].solo);
                Object.keys(pattern.trackSettings).forEach(trackKey => {
                    const key = trackKey as keyof TrackSettings;
                    offlineChannels[key].volume.value = pattern.trackSettings[key].volume;
                    offlineChannels[key].pan.value = pattern.trackSettings[key].pan;
                    if (soloedTracks.length > 0) {
                        offlineChannels[key].mute = !pattern.trackSettings[key].solo;
                    } else {
                        offlineChannels[key].mute = pattern.trackSettings[key].mute;
                    }
                });

                // Apply effects
                offlineBassEffects.distortion.wet.value = pattern.effectsState.distortion.wet;
                offlineBassEffects.distortion.set(pattern.effectsState.distortion.settings);
                offlineBassEffects.delay.wet.value = pattern.effectsState.delay.wet;
                offlineBassEffects.delay.set(pattern.effectsState.delay.settings);
                offlineBassEffects.reverb.wet.value = pattern.effectsState.reverb.wet;
                offlineBassEffects.reverb.set(pattern.effectsState.reverb.settings);
                
                // Apply Synth Settings
                if (pattern.synthState) {
                    offlineInstruments.bass.set(pattern.synthState);
                }

                // Schedule notes
                const seq = pattern.sequencerState;
                for (let i = 0; i < 16; i++) {
                    const stepTime = time + (i * Tone.Time('16n').toSeconds());
                    if (seq.kick.steps[i]) offlineInstruments.kick.triggerAttack('C1', stepTime);
                    if (seq.snare.steps[i]) offlineInstruments.snare.triggerAttack('C1', stepTime);
                    if (seq.hihat.steps[i]) offlineInstruments.hihat.triggerAttack('C1', stepTime);
                    const bassNote = seq.bass.steps[i] as Note;
                    if (bassNote) offlineInstruments.bass.triggerAttackRelease(bassNote, '16n', stepTime);
                    const chord = seq.chords.steps[i] as (string | null);
                    if (chord) offlineInstruments.chords.triggerAttackRelease(chord, '4n', stepTime);
                }
            }
            offlineContext.transport.start();
        }, totalDuration);

        return this.audioBufferToWav(buffer);
    }
    
    private audioBufferToWav(buffer: AudioBuffer): Blob {
        const numOfChan = buffer.numberOfChannels;
        const length = buffer.length * numOfChan * 2 + 44;
        const bufferIn = new ArrayBuffer(length);
        const view = new DataView(bufferIn);
        const channels = [];
        let i = 0;
        let sample = 0;
        let offset = 0;
        let pos = 0;

        // write WAV header
        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // file length - 8
        setUint32(0x45564157); // "WAVE"

        setUint32(0x20746d66); // "fmt " chunk
        setUint32(16); // length = 16
        setUint16(1); // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2); // block-align
        setUint16(16); // 16-bit

        setUint32(0x61746164); // "data" - chunk
        setUint32(length - pos - 4); // chunk length

        // write interleaved data
        for (i = 0; i < numOfChan; i++) {
            channels.push(buffer.getChannelData(i));
        }

        while (pos < length) {
            for (i = 0; i < numOfChan; i++) {
                sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
                view.setInt16(pos, sample, true); // write 16-bit sample
                pos += 2;
            }
            offset++;
        }

        return new Blob([view], { type: 'audio/wav' });

        function setUint16(data: number) {
            view.setUint16(pos, data, true);
            pos += 2;
        }

        function setUint32(data: number) {
            view.setUint32(pos, data, true);
            pos += 4;
        }
    }
}
