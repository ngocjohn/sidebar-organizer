import { mdiDotsVertical } from '@mdi/js';
import { PanelInfo } from '@types';
import { isMobile } from '@utilities/dom-utils';
import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('so-item-row')
export class SoItemRow extends LitElement {
  @property({ attribute: false }) private _item!: PanelInfo;
  @property({ type: Boolean, attribute: 'no-edit' }) noEdit = false;

  protected createRenderRoot() {
    return this;
  }
  protected render() {
    const { icon, title, url_path, component_name } = this._item;
    return html`
      <div class="item-row">
        <div class="cell icon">
          <ha-icon icon=${icon ?? 'mdi:help-circle-outline'}></ha-icon>
        </div>
        <div class="cell grows">${title}</div>
        ${!isMobile
          ? html`<div class="cell">${url_path}</div>
              <div class="cell">${component_name}</div> `
          : nothing}
        <div class="cell icon">
          ${!this.noEdit
            ? html` <ha-icon-button .path=${mdiDotsVertical} @click=${this._handleMenuClick}></ha-icon-button> `
            : nothing}
        </div>
      </div>
    `;
  }

  private _handleMenuClick() {
    // Placeholder for menu click handling
    console.log('Menu clicked for item:', this._item);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'so-item-row': SoItemRow;
  }
}
