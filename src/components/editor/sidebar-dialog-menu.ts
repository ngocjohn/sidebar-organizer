import { CONFIG_SECTIONS_MENU, CONFIG_SECTION, VERSION } from '@constants';
import { mdiClose, mdiHome, mdiMenu } from '@mdi/js';
import { fireEvent } from '@utilities/fire_event';
import { omit } from 'es-toolkit/compat';
import { CSSResultGroup, TemplateResult, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { BaseEditor } from '../base-editor';

declare global {
  interface HASSDomEvents {
    'menu-value-changed': { value?: string };
  }
}
@customElement('sidebar-dialog-menu')
export class SidebarDialogMenu extends BaseEditor {
  @property() public value?: string;
  @state() private _open = false;

  protected render(): TemplateResult {
    const value = this.value;
    const options = omit(CONFIG_SECTIONS_MENU, [CONFIG_SECTION.GENERAL]);
    const isDefault = value === CONFIG_SECTION.GENERAL || !value;
    const selectedMenu = CONFIG_SECTIONS_MENU[value as CONFIG_SECTION];

    return html`
      <div class="config-menu-wrapper">
        <div class="menu-info-icon-wrapper">
          <div class="move-sec">
            ${!isDefault
              ? html`
                  <ha-icon-button .path=${mdiHome} @click=${() => this._handleItemClick(CONFIG_SECTION.GENERAL)}>
                  </ha-icon-button>
                `
              : nothing}

            <ha-dropdown
              size="large"
              placement="bottom-start"
              @wa-hide=${(ev: Event) => {
                ev.stopPropagation();
                this._open = false;
              }}
              @wa-show=${(ev: Event) => {
                ev.stopPropagation();
                this._open = true;
              }}
              @wa-select=${this._handleItemClick}
              @click=${(ev: Event) => ev.stopPropagation()}
            >
              <ha-icon-button slot="trigger" .path=${this._open ? mdiClose : mdiMenu}> </ha-icon-button>

              ${Object.entries(options).map(
                ([key, o]) => html`
                  <ha-dropdown-item .value=${key} .selected=${key === value}> ${o.label} </ha-dropdown-item>
                `
              )}
            </ha-dropdown>
          </div>
        </div>
        <div class="menu-label">
          <span class="primary">${selectedMenu.label}</span>
          ${isDefault ? html`<span class="secondary">${selectedMenu.description}</span>` : nothing}
        </div>
      </div>
      ${isDefault ? this._renderMenuContent() : nothing}
    `;
  }

  private _renderMenuContent(): TemplateResult {
    const options = omit(CONFIG_SECTIONS_MENU, [CONFIG_SECTION.GENERAL]);
    return html`<div class="tip-content">
        ${Object.entries(options).map(
          ([key, { label, description }]) =>
            html`<div class="tip-item" @click="${() => this._handleItemClick(key)}" role="button" tabindex="0">
              <div class="tip-title">${label}</div>
              <span class="secondary">${description}</span>
            </div>`
        )}
      </div>
      <div class="version-footer">Version: ${VERSION}</div> `;
  }

  private _handleItemClick(ev: CustomEvent | string): void {
    if (ev instanceof CustomEvent) {
      ev.stopPropagation();
    }
    const selectedValue = typeof ev === 'string' ? ev : (ev.detail as any).item.value;

    const value = selectedValue !== CONFIG_SECTION.GENERAL ? selectedValue : '';
    fireEvent(this, 'menu-value-changed', { value });
  }

  static get styles(): CSSResultGroup {
    return [
      super.styles,
      css`
        :host {
          display: block;
          width: 100%;
          box-sizing: border-box;
          margin-bottom: var(--vic-gutter-gap);
          --ha-button-height: 40px !important;
          --wa-form-control-height: var(--ha-button-height);
          --vic-gutter-gap: 8px;
          --vsc-gutter-gap: 12px;
          --vic-card-padding: 12px;
          --vic-icon-size: 36px;
          --vic-icon-border-radius: 50%;
          --vic-icon-shape-color: rgba(var(--rgb-primary-text-color), 0.05);
        }
        .config-menu-wrapper {
          display: inline-flex;
          box-sizing: border-box;
          align-items: center;
          margin-inline: 4px 8px;
          width: 100%;
        }

        .config-menu-wrapper .menu-info-icon-wrapper {
          display: inline-flex;
          /* gap: var(--vic-card-padding); */
          height: inherit;
          flex: 0;
        }
        .menu-info-icon-wrapper > .move-sec {
          display: inline-flex;
          align-items: center;
        }
        ha-icon-button {
          color: var(--secondary-text-color);
          display: inline-flex;
          height: 100%;
          align-items: center;
          justify-content: center;
          outline: none;
        }

        ha-icon-button[disabled] {
          color: var(--disabled-text-color);
        }
        .menu-content-wrapper .menu-info-icon,
        .config-menu-wrapper .menu-icon {
          width: 36px;
          height: 36px;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          border-radius: 50%;
          cursor: pointer;
          color: var(--secondary-text-color);
          padding-inline-end: var(--vic-card-padding, 8px);
          /* transition: color 400ms cubic-bezier(0.075, 0.82, 0.165, 1); */
          pointer-events: auto;
        }
        .config-menu-wrapper .menu-icon.active,
        .config-menu-wrapper .menu-icon:hover {
          color: var(--primary-color);
        }

        .config-menu-wrapper .menu-icon-inner {
          position: relative;
          width: var(--vic-icon-size);
          height: var(--vic-icon-size);
          font-size: var(--vic-icon-size);
          border-radius: var(--vic-icon-border-radius);
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--vic-icon-shape-color);
          transition-property: background-color, box-shadow;
          transition-duration: 280ms;
          transition-timing-function: ease-out;
        }

        .config-menu-wrapper .menu-content-wrapper {
          display: flex;
          justify-content: space-between;
          width: 100%;
          align-items: center;
          height: auto;
        }

        .menu-content-wrapper .menu-info-icon {
          padding-inline-end: 0;
        }

        .menu-content-wrapper .menu-info-icon:hover {
          color: var(--primary-color);
          background-color: rgba(var(--rgb-secondary-text-color), 0.1);
          transition: all 200ms ease-in-out;
        }

        ha-icon-button.add-btn {
          background-color: var(--app-header-edit-background-color, #455a64);
          border-radius: 50%;
          height: 24px;
          width: 24px;
        }
        .position-badge {
          display: block;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          line-height: var(--ha-line-height-normal);
          box-sizing: border-box;
          font-weight: var(--ha-font-weight-medium);
          text-align: center;
          font-size: var(--ha-font-size-m);
          background-color: var(--app-header-edit-background-color, #455a64);
          color: var(--app-header-edit-text-color, white);
          &:hover {
            background-color: var(--primary-color);
            color: white;
          }
        }

        .menu-content-wrapper.hidden {
          max-width: 0px;
          overflow: hidden;
          opacity: 0;
          transition: all 400ms cubic-bezier(0.075, 0.82, 0.165, 1);
          max-height: 0px;
        }

        .menu-label {
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: space-evenly;
          flex: 1;
        }

        .menu-label .primary {
          font-weight: 500;
          font-size: 1rem;
          white-space: nowrap;
          position: relative;
          text-overflow: ellipsis;
          overflow: hidden;
          text-transform: uppercase;
          line-height: 1;
        }

        .menu-label .secondary {
          color: var(--secondary-text-color);
          /* text-transform: capitalize; */
          letter-spacing: 0.5px;
          font-size: smaller;
          line-height: 150%;
        }

        .menu-selector.hidden {
          max-width: 0;
          overflow: hidden;
          opacity: 0;
        }

        .menu-selector {
          max-width: 100%;
          width: 100%;
          opacity: 1;
          display: flex;
          transition: all 400ms cubic-bezier(0.075, 0.82, 0.165, 1);
        }

        .tip-content {
          display: flex;
          flex-direction: column;
          margin-top: var(--vic-gutter-gap);
          gap: var(--vic-gutter-gap);
        }

        [role='button'] {
          cursor: pointer;
          pointer-events: auto;
        }
        [role='button']:focus {
          outline: none;
        }
        [role='button']:hover {
          background-color: var(--secondary-background-color);
        }

        .tip-item {
          /* background-color: #ffffff; */
          padding: var(--ha-space-2, 8px) var(--ha-space-3, 12px);
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          transition: background-color 0.3s ease;
          /* pointer-events: all; */
        }

        /* .tip-item:hover {
        background-color: var(--secondary-background-color);
      } */

        .tip-title {
          text-transform: capitalize;
          color: var(--primary-text-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          font-size: var(--ha-font-size-l);
          line-height: 2;
        }

        .tip-item span.secondary {
          color: var(--secondary-text-color);
          font-size: var(--ha-font-size-m);
        }

        .click-shrink {
          transition: transform 0.1s;
        }

        .click-shrink:active {
          transform: scale(0.9);
        }

        .version-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          padding: 0.5rem;
          margin-top: var(--vic-card-padding);
          color: var(--secondary-text-color);
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-dialog-menu': SidebarDialogMenu;
  }
}
