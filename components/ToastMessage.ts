
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

@customElement('toast-message')
export class ToastMessage extends LitElement {
  static styles = css`
    .toast {
      line-height: 1.6;
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #000;
      color: white;
      padding: 15px;
      border-radius: 5px;
      z-index: 1000;
      width: min(450px, 80vw);
      transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1);
      border: 2px solid #fff;
      box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.5);
    }
    .toast:not(.showing) {
      transform: translate(-50%, -200%);
    }
  `;

  @property({ type: Boolean }) showing = false;
  @property({ type: String }) message = '';
  
  render() {
    return html`<div class=${classMap({ showing: this.showing, toast: true })}>
      ${this.message}
    </div>`;
  }

  show(message: string, duration = 3000) {
    this.message = message;
    this.showing = true;
    setTimeout(() => { this.showing = false; }, duration);
  }
}

if (!customElements.get('toast-message')) {
  customElements.define('toast-message', ToastMessage as any);
}

declare global {
  interface HTMLElementTagNameMap {
    'toast-message': ToastMessage;
  }
}