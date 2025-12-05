/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * A singleton class to handle Web MIDI API interactions.
 */
class MidiDispatcher extends EventTarget {
  private static instance: MidiDispatcher;
  // FIX: Use 'any' type as WebMidi types are not available in the environment.
  public midiAccess: any | null = null;
  // FIX: Use 'any' type as WebMidi types are not available in the environment.
  public inputs: any[] = [];
  public selectedInputId: string | null = null;

  private constructor() {
    super();
  }

  public static getInstance(): MidiDispatcher {
    if (!MidiDispatcher.instance) {
      MidiDispatcher.instance = new MidiDispatcher();
    }
    return MidiDispatcher.instance;
  }

  async initialize() {
    if (this.midiAccess) return true; // Already initialized

    if (!navigator.requestMIDIAccess) {
      console.warn('WebMIDI is not supported in this browser.');
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      this.midiAccess.onstatechange = (event: any) => this.handleStateChange(event);
      this.inputs = Array.from(this.midiAccess.inputs.values());
      
      if (this.inputs.length > 0) {
        this.selectInput(this.inputs[0].id);
      }
      this.dispatchEvent(new CustomEvent('midi-state-change', { detail: { inputs: this.inputs } }));
      return true;
    } catch (error) {
      console.error('Could not access MIDI devices.', error);
      return false;
    }
  }

  // FIX: Use 'any' type as WebMidi types are not available in the environment.
  private handleStateChange(event: any) {
    if (!this.midiAccess) return;
    this.inputs = Array.from(this.midiAccess.inputs.values());
    this.dispatchEvent(new CustomEvent('midi-state-change', { detail: { inputs: this.inputs } }));

    if (event.port.state === 'disconnected' && event.port.id === this.selectedInputId) {
        this.selectInput(this.inputs.length > 0 ? this.inputs[0].id : null);
    }
  }

  selectInput(inputId: string | null) {
    if (this.selectedInputId) {
      const oldInput = this.midiAccess?.inputs.get(this.selectedInputId);
      if (oldInput) {
        oldInput.onmidimessage = null;
      }
    }
    
    this.selectedInputId = inputId;

    if (inputId) {
      const newInput = this.midiAccess?.inputs.get(inputId);
      if (newInput) {
        newInput.onmidimessage = this.onMIDIMessage.bind(this);
        console.log(`Listening to MIDI input: ${newInput.name}`);
      }
    }
    this.dispatchEvent(new CustomEvent('midi-input-selected', { detail: { inputId: this.selectedInputId } }));
  }

  // FIX: Use 'any' type as WebMidi types are not available in the environment.
  private onMIDIMessage(event: any) {
    const [command, note, velocity] = event.data;
    
    switch (command & 0xF0) {
        case 0x90: // Note On
            if (velocity > 0) {
                this.dispatchEvent(new CustomEvent('midi-note-on', { detail: { note, velocity } }));
            } else {
                // Some controllers send note on with velocity 0 for note off
                this.dispatchEvent(new CustomEvent('midi-note-off', { detail: { note, velocity } }));
            }
            break;
        case 0x80: // Note Off
            this.dispatchEvent(new CustomEvent('midi-note-off', { detail: { note, velocity } }));
            break;
        case 0xB0: // Control Change (CC)
            const controller = note;
            const value = velocity;
            this.dispatchEvent(new CustomEvent('midi-control-change', { detail: { controller, value } }));
            break;
    }
  }
}

export const midiDispatcher = MidiDispatcher.getInstance();