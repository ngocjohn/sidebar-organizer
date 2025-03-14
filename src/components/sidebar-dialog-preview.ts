import { html, css, LitElement, TemplateResult, PropertyValues, CSSResultGroup, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { PREVIEW_MOCK_PANELS } from '../const';
import { applyTheme, getDefaultThemeColors, getPreviewItems } from '../helpers';
import { DividerColorSettings, HaExtened, PanelInfo, SidebarConfig } from '../types';
import { convertPreviewCustomStyles } from '../utils';
import { SidebarConfigDialog } from './sidebar-dialog';

@customElement('sidebar-dialog-preview')
export class SidebarDialogPreview extends LitElement {
  @property({ attribute: false }) hass!: HaExtened['hass'];
  @property({ attribute: false }) _dialog!: SidebarConfigDialog;
  @property({ attribute: false }) _sidebarConfig: SidebarConfig = {};

  @state() public _paperListbox: Record<string, PanelInfo[]> = {};
  @state() private _colorConfigMode: string = '';
  @state() private _baseColorFromTheme: DividerColorSettings = {};

  @state() private _ready = false;

  protected firstUpdated(): void {
    const colorMode = this.hass.themes.darkMode ? 'dark' : 'light';
    // console.log('colorMode', colorMode);
    this._colorConfigMode = colorMode;
  }

  protected shouldUpdate(_changedProperties: PropertyValues): boolean {
    if (_changedProperties.has('_sidebarConfig') && this._sidebarConfig) {
      this._ready = false;
      this._paperListbox = getPreviewItems(this.hass, this._sidebarConfig);
      if (this._paperListbox) {
        this._ready = true;
      }
      return true;
    }

    if (_changedProperties.has('_dialog') && this._dialog) {
      return true;
    }

    if (_changedProperties.has('_colorConfigMode') && this._colorConfigMode) {
      this._setTheme(this._colorConfigMode);
      return true;
    }

    return true;
  }

  private _setTheme(mode: string): void {
    const theme = this.hass.themes.theme;
    const themeContainer = this.shadowRoot?.getElementById('preview-container');
    applyTheme(themeContainer, this.hass, theme, mode);
    setTimeout(() => {
      this._getDefaultColors();
    }, 0);
  }

  private _getDefaultColors(): void {
    const previewEl = this.shadowRoot?.getElementById('preview-container');
    if (!previewEl) return;
    const defaultColors = getDefaultThemeColors(previewEl);
    this._baseColorFromTheme = defaultColors;
  }

  protected render(): TemplateResult {
    if (!this._ready) {
      return html`<ha-circular-progress .indeterminate=${true} .size=${'medium'}></ha-circular-progress>`;
    }

    const { mockCustomGroups, mockDefaultPage } = PREVIEW_MOCK_PANELS;
    const _paperListbox = this._paperListbox;

    const groups =
      Object.keys(this._sidebarConfig?.custom_groups || {}).length >= 2
        ? Object.keys(this._sidebarConfig.custom_groups!)
        : Object.keys(mockCustomGroups);

    const _toggleClick = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
      const target = ev.target as HTMLElement;
      const isActive = target.classList.contains('collapsed');
      const targetParent = target.parentElement;
      const itemsEl = targetParent?.nextElementSibling as HTMLElement;
      if (itemsEl && targetParent?.getAttribute('group') === itemsEl.getAttribute('group')) {
        itemsEl.classList.toggle('collapsed', !isActive);
      }
      target.classList.toggle('collapsed', !isActive);
    };

    const _renderPanelItem = (item: PanelInfo) => {
      const { icon, title } = item;
      return html`<a href="#">
        <div class="icon-item"><ha-icon icon=${icon}></ha-icon><span class="item-text">${title}</span></div>
      </a>`;
    };

    // const lovelacePanel = _paperListbox['defaultPage'][0] || { title: 'Home', icon: 'mdi:home' };

    const lovelacePanel = _paperListbox['defaultPage'][0] || mockDefaultPage[0];

    const bottomSys = _paperListbox['bottomSystem'].map((item: PanelInfo) => {
      return _renderPanelItem(item);
    });
    const bottomPanel = _paperListbox['bottomItems'].map((item: PanelInfo) => {
      return _renderPanelItem(item);
    });

    return html` <div class="divider-preview" style=${this._computePreviewStyle()} id="divider-preview">
      <div class="groups-container">
        ${_renderPanelItem(lovelacePanel)}
        ${Array.from({ length: groups.length }, (_, i) => {
          const collapsed = i === 0 ? true : false;
          const title = groups[i].replace('_', ' ');
          const someGroupItems = _paperListbox[groups[i]] ?? mockCustomGroups[groups[i]] ?? [];

          return html`<div class="divider-container" @click=${(ev: Event) => _toggleClick(ev)} group=${groups[i]}>
              <div class=${collapsed ? 'added-content' : 'added-content collapsed'}>
                <ha-icon icon="mdi:chevron-down"></ha-icon>
                <span>${title}</span>
              </div>
            </div>
            ${someGroupItems.length !== 0
              ? html`<div group=${groups[i]} class=${collapsed ? 'group-items' : 'group-items collapsed'}>
                  ${someGroupItems.map((item: PanelInfo) => {
                    return _renderPanelItem(item);
                  })}
                </div>`
              : nothing} `;
        })}
        <div class="spacer"></div>
        ${bottomPanel}
        <div class="divider"></div>
        ${bottomSys}
      </div>
    </div>`;
  }

  private _computePreviewStyle() {
    if (!this._sidebarConfig) return;
    const colorMode = this._colorConfigMode;
    const color_config = this._sidebarConfig?.color_config || {};
    const borderRadius = color_config?.border_radius || 0;
    const colorConfig = color_config?.[colorMode] || {};
    const customStyles = colorConfig.custom_styles || [];
    const styleAddedCustom = convertPreviewCustomStyles(customStyles);
    // console.log('Converted Custom Styles:', styleAddedCustom);

    const getColor = (key: string): string => {
      return colorConfig?.[key] ?? this._baseColorFromTheme[key];
    };

    const styleAdded = {
      '--divider-color': getColor('divider_color'),
      '--divider-bg-color': getColor('background_color'),
      '--divider-border-top-color': getColor('border_top_color'),
      '--scrollbar-thumb-color': getColor('scrollbar_thumb_color'),
      '--sidebar-background-color': getColor('custom_sidebar_background_color'),
      '--divider-border-radius': `${borderRadius}px`,
      '--sidebar-text-color': getColor('divider_text_color'),
      '--sidebar-icon-color': getColor('sidebar_icon_color'),
      ...styleAddedCustom,
    };

    // console.log('styleAdded', styleAdded);
    return styleMap(styleAdded);
  }

  static get styles(): CSSResultGroup {
    return [
      css`
        :host *[hidden] {
          display: none !important;
        }

        .preview-container {
          min-width: 260px;
          flex: 0;
          display: flex;
          flex-direction: column;
          width: 100%;
          background-color: var(--primary-background-color);
          border: 1px solid var(--divider-color);
          /* display: block; */
        }

        .header-row {
          display: inline-flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          --mdc-icon-button-size: 42px;
          /* padding-block: 0.5rem; */
        }
        .header-row.center {
          justify-content: center;
        }

        .header-row.config-item {
          place-items: anchor-center;
          color: var(--secondary-text-color);
        }
        .header-row.config-item ha-icon:hover {
          cursor: pointer;
          color: var(--primary-color);
        }
        .primary {
          font-size: 1.2rem;
          font-weight: 500;
          background: var(--app-header-background-color);
          padding-block: 0.5rem;
          text-transform: uppercase;
        }
        .title {
          font-size: 1.05rem;
          margin-block: 0.5rem;
          line-height: 100%;
        }

        .config-colors {
          display: flex;
          flex-direction: column;
          gap: var(--side-dialog-gutter);
          padding-block: var(--side-dialog-gutter);
        }

        .config-colors.header {
          flex-direction: row;
        }

        .config-colors .color-item {
          display: flex;
        }

        .change-format {
          display: inline-block;
          flex: 0;
          width: fit-content;
        }

        a.color-picker-box {
          width: fit-content;
          position: relative;
          display: inline-block;
          box-sizing: border-box;
          padding: 0.5rem 0.5rem;
          min-height: 2em;
          border: 1px solid;
          outline: none;
          overflow: visible;
          color: var(--sidebar-text-color);
          background-color: var(--divider-bg-color);
          text-align: center;
          cursor: pointer;
          text-decoration: none;
          margin-inline: 0.5rem;
          border-radius: inherit;
          transition: all 0.3s ease;
        }

        .divider-preview {
          display: block;
          /* margin: 1rem auto; */
          align-items: center;
          max-height: 580px;
          max-width: 260px;
          height: 580px;
          width: 100%;
          background-color: var(--sidebar-background-color);
        }
        @media all and (max-width: 800px), all and (max-height: 500px) {
          .divider-preview {
            margin: 0 auto;
          }
        }
        .groups-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          overflow-y: auto;
          scrollbar-color: var(--scrollbar-thumb-color) transparent;
          scrollbar-width: thin;
        }

        .divider-container {
          padding: 0;
          margin-top: 1px;
          box-sizing: border-box;
          box-sizing: border-box;
          margin: 1px 4px 0px;
          /* width: 248px; */
        }

        .added-content {
          display: flex;
          justify-content: flex-start;
          align-items: center;
          color: var(--sidebar-text-color);
          background-color: var(--divider-bg-color);
          letter-spacing: 1px;
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.3s ease;
          border-top: 1px solid var(--divider-border-top-color);
          border-radius: var(--divider-border-radius, none);
          box-sizing: border-box;
          padding-left: 12px;
          padding-inline-end: initial;
          min-height: 40px;
          text-transform: capitalize;
          &:hover {
            color: var(--primary-color);
            background-color: rgb(from var(--primary-color) r g b / 0.1);
          }
        }

        .added-content > span,
        .added-content > ha-icon {
          pointer-events: none;
          transition: all 150ms ease;
        }

        .divider-container:hover .added-content > span {
          transform: translateX(30px);
          transition: all 150ms ease;
        }

        .added-content > span {
          transform: translateX(30px);
        }
        .added-content.collapsed > span {
          transform: translateX(10px);
        }

        .added-content.collapsed > ha-icon {
          transform: rotate(-90deg);
        }

        .group-items {
          max-height: 1000px;
          display: block;
          transition: all 0.3s ease;
        }

        .group-items.collapsed {
          max-height: 0px;
          overflow: hidden;
        }

        .divider {
          /* padding: 10px 0; */
          display: block;
        }

        .divider::before {
          content: '';
          display: block;
          height: 1px;
          background-color: var(--divider-color);
        }
        .spacer {
          flex: 1;
        }
        a {
          text-decoration: none;
          color: var(--sidebar-text-color);
          font-weight: 500;
          font-size: 14px;
          position: relative;
          display: block;
          outline: 0;
          &:hover {
            color: var(--primary-color);
            background-color: rgb(from var(--primary-color) r g b / 0.1);
          }
          /* width: 248px; */
        }

        .icon-item {
          box-sizing: border-box;
          margin: 4px;
          padding-left: 12px;
          padding-inline-start: 12px;
          padding-inline-end: initial;
          border-radius: 4px;
          display: flex;
          min-height: 40px;
          align-items: center;
          padding: 0 16px;
        }
        .icon-item > ha-icon {
          width: 56px;
          color: var(--sidebar-icon-color);
        }
        .icon-item span.item-text {
          display: block;
          max-width: calc(100% - 56px);
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-dialog-preview': SidebarDialogPreview;
  }
}
