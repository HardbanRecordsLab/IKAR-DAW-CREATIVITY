
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from '@google/genai';
import type { Note, Prompt } from '../types';

let aiInstance: GoogleGenAI | null = null;

function getApiKey(): string {
    // Safely access process.env.API_KEY without triggering ReferenceError in strict browsers
    try {
        const safeGlobal = (typeof globalThis !== 'undefined' ? globalThis : window) as any;
        const env = safeGlobal.process?.env || (typeof process !== 'undefined' ? process.env : {});
        return env.API_KEY || '';
    } catch (e) {
        return '';
    }
}

function getAi() {
    if (!aiInstance) {
        const apiKey = getApiKey();
        // Even if empty, we initialize. The SDK might throw later if called without a key, 
        // but this prevents crash on load.
        aiInstance = new GoogleGenAI({ apiKey: apiKey });
    }
    return aiInstance;
}

/**
 * Generates a Tone.js MonoSynth configuration from a set of weighted prompts.
 */
export async function generateTimbreFromPrompts(prompts: Prompt[], bpm: number) {
    const promptString = prompts.map(p => `'${p.text}' with weight ${p.weight.toFixed(2)}`).join(', ');
    const fullPrompt = `Design a synthesizer bass patch for a ${bpm} BPM electronic music track. The sound should be a blend of the following characteristics: ${promptString}. Generate a JSON object with parameters for a Tone.js MonoSynth. The JSON should match this schema: {type: 'object', properties: {oscillator: {type: 'object', properties: {type: {type: 'string', enum: ['sine', 'square', 'sawtooth', 'triangle', 'fmsine', 'amsquare']}}}, envelope: {type: 'object', properties: {attack: {type: 'number'}, decay: {type: 'number'}, sustain: {type: 'number'}, release: {type: 'number'}}}, filter: {type: 'object', properties: {type: {type: 'string', enum: ['lowpass', 'highpass', 'bandpass']}, rolloff: {type: 'number', enum: [-12, -24, -48]}, Q: {type: 'number'}}}, filterEnvelope: {type: 'object', properties: {attack: {type: 'number'}, decay: {type: 'number'}, sustain: {type: 'number'}, release: {type: 'number'}, baseFrequency: {type: 'number'}, octaves: {type: 'number'}}}}}. Ensure attack and release values are small for a percussive bass sound.`;
    
    try {
        const ai = getAi();
        if (!ai) return null;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: fullPrompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        oscillator: { type: Type.OBJECT, properties: { type: { type: Type.STRING }}},
                        envelope: { type: Type.OBJECT, properties: { attack: { type: Type.NUMBER }, decay: { type: Type.NUMBER }, sustain: { type: Type.NUMBER }, release: { type: Type.NUMBER }}},
                        filter: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, rolloff: { type: Type.NUMBER }, Q: { type: Type.NUMBER }}},
                        filterEnvelope: { type: Type.OBJECT, properties: { attack: { type: Type.NUMBER }, decay: { type: Type.NUMBER }, sustain: { type: Type.NUMBER }, release: { type: Type.NUMBER }, baseFrequency: { type: Type.NUMBER }, octaves: { type: Type.NUMBER }}}
                    }
                }
            }
        });
        const jsonStr = response.text;
        if (!jsonStr) return null;
        return JSON.parse(jsonStr);

    } catch (e) {
        console.error("AI Timbre generation failed:", e);
        return null;
    }
}

/**
 * Generates parameters for a Tone.js effects chain from a text prompt.
 */
export async function generateEffectsFromPrompt(prompt: string) {
    const fullPrompt = `Design an effects chain for a synthesizer bass patch based on the description: "${prompt}". Generate a JSON object with parameters for Tone.js effects: Distortion, FeedbackDelay, and Reverb. The JSON should match this schema: {type: 'object', properties: {distortion: {type: 'object', properties: {distortion: {type: 'number'}}}, delay: {type: 'object', properties: {delayTime: {type: 'string'}, feedback: {type: 'number'}}}, reverb: {type: 'object', properties: {decay: {type: 'number'}, preDelay: {type: 'number'}}}}}. For delayTime, use musical notation like '8n', '4t', etc. Keep feedback between 0 and 0.7. Keep reverb decay reasonable for a musical context.`;
    
    try {
        const ai = getAi();
        if (!ai) return null;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: fullPrompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        distortion: { type: Type.OBJECT, properties: { distortion: { type: Type.NUMBER }}},
                        delay: { type: Type.OBJECT, properties: { delayTime: { type: Type.STRING }, feedback: { type: Type.NUMBER }}},
                        reverb: { type: Type.OBJECT, properties: { decay: { type: Type.NUMBER }, preDelay: { type: Type.NUMBER }}}
                    }
                }
            }
        });
        const jsonStr = response.text;
        if (!jsonStr) return null;
        return JSON.parse(jsonStr);

    } catch (e) {
        console.error("AI Effects generation failed:", e);
        return null;
    }
}

/**
 * Generates a list of new, creative prompt texts.
 */
export async function generateRandomPrompts(existingPrompts: string[]): Promise<string[]> {
    const existingPromptsString = existingPrompts.join(', ');
    const fullPrompt = `Generate a JSON array of 5 unique and creative synthesizer patch descriptions. They should be short, 2-4 words each. Examples: "Lush Pad", "Acid Squawk", "Wobble Bass". Do not include any of the following in your response: ${existingPromptsString}.`;

    try {
        const ai = getAi();
        if (!ai) return [];

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: fullPrompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING,
                    },
                },
            },
        });
        const jsonStr = response.text;
        if (!jsonStr) return [];
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("AI random prompt generation failed:", e);
        return [];
    }
}

/**
 * Generates a 16-step chord progression from a prompt, considering the bassline.
 */
export async function generateChordsFromPrompt(prompt: string, bassline: (Note | null)[]): Promise<(string | null)[] | null> {
    const basslineString = bassline.map(note => note || 'rest').join(', ');
    const fullPrompt = `You are a music theory expert. Generate a 16-step chord progression for a synthesizer based on the prompt: "${prompt}". The progression should harmonically complement this existing 16-step bassline: [${basslineString}]. 
    A step can contain a chord name (like 'Cm7', 'G#maj7', 'Fsus4') or be an empty string "" for silence. Chord names must be valid for Tone.js (e.g., use 'C#4' for C-sharp major chord in the 4th octave, 'Abm7' for A-flat minor 7th). The progression should have a good sense of harmonic movement and rhythm. Return a JSON array of exactly 16 strings, where some can be empty for rests.`;

    try {
        const ai = getAi();
        if (!ai) return null;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: fullPrompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                },
            },
        });
        const jsonStr = response.text;
        if (!jsonStr) return null;
        const chordsArray: string[] = JSON.parse(jsonStr);
        return chordsArray.map(chord => chord === "" ? null : chord);
    } catch (e) {
        console.error("AI chord generation failed:", e);
        return null;
    }
}

export async function generateDrumParams(drumType: 'kick' | 'snare' | 'hihat', description: string) {
    const extraInstruction = drumType === 'kick' 
        ? "Focus on low pitch, punchy envelopes, and pitch decay."
        : drumType === 'snare'
        ? "Snare sounds often need noise. If using MembraneSynth, pitch it high. If NoiseSynth, focus on envelope."
        : "High frequency content, metallic or noisy character, very short decay.";

    const fullPrompt = `Act as a sound designer. Create a Tone.js synthesizer configuration to generate a "${drumType}" sample with this character: "${description}". 
    ${extraInstruction}
    
    Return a JSON object with two properties:
    1. "synthType": Must be one of "MembraneSynth", "NoiseSynth", or "MetalSynth". choose the best one for the sound.
    2. "settings": A JSON object containing the parameters for that synth.`;

    try {
        const ai = getAi();
        if (!ai) return null;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: fullPrompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        synthType: { type: Type.STRING, enum: ["MembraneSynth", "NoiseSynth", "MetalSynth"] },
                        settings: { type: Type.OBJECT }
                    }
                }
            }
        });
        
        const jsonStr = response.text;
        if (!jsonStr) return null;
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("AI Drum generation failed:", e);
        return null;
    }
}
