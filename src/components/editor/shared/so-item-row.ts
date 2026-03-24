import { mdiDotsVertical } from '@mdi/js';
import { PanelInfo } from '@types';
import { LitElement, html, css, TemplateResult, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('so-item-row')
export class SoItemRow extends LitElement {
  @property({ attribute: false }) private _item!: PanelInfo;
  @property({ type: Boolean, attribute: 'no-edit' }) noEdit = false;

  protected render(): TemplateResult {
    const { icon, title, url_path } = this._item;
    return html`
      <div class="item-row">
        <div class="cell icon">
          <ha-icon .icon=${icon || 'mdi:help-circle-outline'}></ha-icon>
        </div>
        <div class="cell grows">${title}</div>
        <div class="cell">${url_path}</div>
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

  static styles = css`
    :host {
      display: block;
    }
    .item-row {
      display: flex;
      height: 42px;
      width: 100%;
      align-items: center;
      border-top: 0.5px solid var(--divider-color);
      &:hover {
        background-color: var(--secondary-background-color);
        color: var(--primary-text-color);
      }
    }
    .cell {
      font-family: var(--ha-font-family-body);
      -webkit-font-smoothing: var(--ha-font-smoothing);
      line-height: var(--ha-line-height-condensed);
      font-weight: var(--ha-font-weight-normal);
      letter-spacing: 0.0178571em;
      text-decoration: inherit;
      text-transform: inherit;
      padding-right: 16px;
      padding-left: 16px;
      min-width: 150px;
      align-self: center;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
      box-sizing: border-box;
      flex: 1;
    }
    .cell.icon {
      min-width: 48px;
      flex: 0 0 48px !important;
      display: flex;
      justify-content: center;
      color: var(--secondary-text-color);
      text-align: center;
    }
    .grows {
      flex-grow: 1;
      flex-shrink: 1;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'so-item-row': SoItemRow;
  }
}
