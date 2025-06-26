import { PREVIEW_MOCK_PANELS } from '@constants';
import { DividerColorSettings, HaExtened, PanelInfo, SidebarConfig } from '@types';
import { applyTheme } from '@utilities/apply-theme';
import { getDefaultThemeColors, convertPreviewCustomStyles } from '@utilities/custom-styles';
import { isIcon } from '@utilities/is-icon';
import { hasTemplate, subscribeRenderTemplate } from '@utilities/ws-templates';
import { html, css, LitElement, TemplateResult, PropertyValues, CSSResultGroup, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { _createPanelItems, getPreviewItems } from '../utilities/preview-items';
import { SidebarConfigDialog } from './sidebar-dialog';
@customElement('sidebar-dialog-preview')
export class SidebarDialogPreview extends LitElement {
  @property({ attribute: false }) hass!: HaExtened['hass'];
  @property({ attribute: false }) _dialog!: SidebarConfigDialog;
  @property({ attribute: false }) _sidebarConfig: SidebarConfig = {};

  @property({ type: Boolean, reflect: true, attribute: 'invalid-config' }) public invalidConfig = false;

  @state() public _paperListbox: Record<string, PanelInfo[]> = {};
  @state() public _colorConfigMode: string = '';
  @state() private _baseColorFromTheme: DividerColorSettings = {};

  @state() private _ready = false;

  protected firstUpdated(): void {
    // console.log('colorMode', colorMode);
    if (this._sidebarConfig) {
      this._paperListbox = getPreviewItems(this._dialog, this._sidebarConfig);
      const colorMode = this._sidebarConfig.color_config?.custom_theme?.mode;
      let darkMode: boolean;
      if (colorMode === 'dark') {
        darkMode = true;
      } else if (colorMode === 'light') {
        darkMode = false;
      } else if (colorMode === 'auto') {
        darkMode = this.hass.themes.darkMode;
      } else {
        darkMode = this.hass.themes.darkMode;
      }
      this._colorConfigMode = darkMode ? 'dark' : 'light';
      setTimeout(() => {
        this._setTheme(this._colorConfigMode);
      }, 0);
    }
    this._addNotification();
  }

  protected shouldUpdate(_changedProperties: PropertyValues): boolean {
    if (_changedProperties.has('_dialog') && this._dialog) {
      return true;
    }
    if (_changedProperties.has('_sidebarConfig') && this._sidebarConfig) {
      return true;
    }
    return true;
  }

  protected updated(_changedProperties: PropertyValues): void {
    super.updated(_changedProperties);
    if (_changedProperties.has('_paperListbox') && this._paperListbox) {
      this._ready = true;
    }

    if (_changedProperties.has('_sidebarConfig') && this._sidebarConfig) {
      const oldConfig = _changedProperties.get('_sidebarConfig') as SidebarConfig | undefined;
      const newConfig = this._sidebarConfig;

      if (oldConfig && newConfig) {
        const bottomChanged = JSON.stringify(oldConfig.bottom_items) !== JSON.stringify(newConfig.bottom_items);
        const customGroupsChanged = JSON.stringify(oldConfig.custom_groups) !== JSON.stringify(newConfig.custom_groups);
        const hiddenItemsChanged = JSON.stringify(oldConfig.hidden_items) !== JSON.stringify(newConfig.hidden_items);
        const newItemsChanged = JSON.stringify(oldConfig.new_items) !== JSON.stringify(newConfig.new_items);
        if (bottomChanged || customGroupsChanged || hiddenItemsChanged || newItemsChanged) {
          console.log('Items changed');
          this._updateListbox(newConfig);
        }

        const themeChanged =
          JSON.stringify(oldConfig.color_config?.custom_theme?.theme) !==
          JSON.stringify(newConfig.color_config?.custom_theme?.theme);

        if (themeChanged) {
          if (newConfig.color_config?.custom_theme?.theme === undefined) {
            const themeCon = this.shadowRoot?.getElementById('theme-container');
            themeCon?.removeAttribute('style');
            setTimeout(() => {
              this._setTheme(this._colorConfigMode);
            }, 200);
          } else {
            this._setTheme(this._colorConfigMode);
          }
        }
        const notificationChanged =
          JSON.stringify(oldConfig.notification) !== JSON.stringify(newConfig.notification) ||
          JSON.stringify(
            oldConfig.new_items?.every((item) => item.notification) !==
              newConfig.new_items?.every((item) => item.notification)
          );
        if (notificationChanged) {
          console.log('Notification changed');
          this._handleNotifyChange();
        }
      }
    }

    if (_changedProperties.has('_colorConfigMode') && this._colorConfigMode) {
      const oldMode = _changedProperties.get('_colorConfigMode') as string | undefined;
      const newMode = this._colorConfigMode;
      if (oldMode && newMode && oldMode !== newMode) {
        // console.log('Color mode changed:', oldMode, '->', newMode);
        this._setTheme(newMode);
      }
    }
    if (_changedProperties.has('_ready') && this._ready) {
      this._handleNotifyChange();
    }
  }

  private _addNotification(): void {
    if (!this._ready) {
      // console.log('Not ready to add notification');
      return;
    }
    console.log('Adding notification');
    const groups = this.shadowRoot?.querySelector('div.groups-container');
    const items = groups!.querySelectorAll('a') as NodeListOf<HTMLElement>;
    const newItems = this._sidebarConfig?.new_items || [];
    if (newItems && newItems.length > 0) {
      const newItemsWithNotification = newItems.filter((item) => item.notification !== undefined);
      newItemsWithNotification.forEach((notify) => {
        const panel = Array.from(items).find((item) => item.getAttribute('data-panel') === notify.title!);
        const notification = notify.notification;
        if (panel && notification) {
          this._subscribeNotification(panel, notification);
        }
      });
    }

    const notification = this._sidebarConfig?.notification || {};
    if (notification && Object.keys(notification).length > 0) {
      Object.entries(notification).forEach(([key, value]) => {
        const panel = Array.from(items).find((item) => item.getAttribute('data-panel') === key);
        if (panel) {
          this._subscribeNotification(panel, value);
        }
      });
    }
  }

  private _subscribeNotification(panel: HTMLElement, configValue: string) {
    let badge = panel.querySelector('span.notification-badge') as HTMLElement;
    let icon = panel.querySelector('ha-icon.notification-badge') as HTMLElement;
    if (!badge && !icon) {
      badge = document.createElement('span');
      badge.classList.add('notification-badge');
      panel.querySelector('div.icon-item')?.appendChild(badge);
      icon = document.createElement('ha-icon');
      icon.classList.add('notification-badge');
      panel.querySelector('div.icon-item')?.appendChild(icon);
    }

    const callback = (result: any) => {
      if (result) {
        if (typeof result === 'string' && isIcon(result)) {
          badge.remove();
          icon.setAttribute('icon', result);
        } else {
          icon.remove();
          badge.innerHTML = result;
        }
      } else {
        badge.remove();
        icon.remove();
      }
    };

    this._subscribeTemplate(configValue, callback);
  }

  private _subscribeTemplate(configValue: string, callback: (result: string) => void): void {
    if (!this.hass || !hasTemplate(configValue)) {
      console.log('Not a template:', this.hass, !hasTemplate(configValue));
      return;
    }

    subscribeRenderTemplate(
      this.hass.connection,
      (result) => {
        callback(result.result);
      },
      {
        template: configValue ?? '',
        variables: {
          config: configValue,
          user: this.hass.user!.name,
        },
        strict: true,
      }
    );
  }

  private _handleNotifyChange(): void {
    const groups = this.shadowRoot?.querySelector('div.groups-container');
    const notifyItems = groups?.querySelectorAll('.notification-badge') as NodeListOf<HTMLElement>;
    if (!notifyItems) {
      console.log('No notify items found');
      return;
    }
    notifyItems.forEach((item) => item.remove());
    setTimeout(() => {
      this._addNotification();
    }, 0);
  }

  public _updateListbox(newConfig?: SidebarConfig): void {
    if (!newConfig) {
      newConfig = this._sidebarConfig;
    }
    this._ready = false;
    this._paperListbox = getPreviewItems(this._dialog, newConfig);
    if (this._paperListbox) {
      this._ready = true;
    }
  }

  private _setTheme(mode: string): void {
    let theme = this.hass.themes.theme;
    const customTheme = this._sidebarConfig?.color_config?.custom_theme?.theme || undefined;
    if (customTheme) {
      theme = customTheme;
    }
    const themeContainer = this.shadowRoot?.getElementById('theme-container');
    applyTheme(themeContainer, this.hass, theme, mode);
    setTimeout(() => {
      this._getDefaultColors();
    }, 200);
    // console.log('Preview Theme applied', theme, mode);
  }

  private _getDefaultColors(): void {
    const previewEl = this.shadowRoot?.getElementById('theme-container');
    const defaultColors = getDefaultThemeColors(previewEl!);
    this._baseColorFromTheme = defaultColors;
  }

  protected render(): TemplateResult {
    if (!this._ready) {
      return html`<ha-spinner style="place-self: center;" .size=${'medium'}></ha-spinner>`;
    }

    const { mockCustomGroups, mockDefaultPage } = PREVIEW_MOCK_PANELS;
    const ungroupedItems = this._dialog.ungroupedItems || [];
    const _paperListbox = this._paperListbox;

    const groups =
      Object.keys(this._sidebarConfig?.custom_groups || {}).length >= 1
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
      const { icon, title, component_name } = item;
      return html`<a href="#" data-panel=${component_name} style="pointer-events: none;">
        <div class="icon-item"><ha-icon .icon=${icon}></ha-icon><span class="item-text">${title}</span></div>
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

    const ungroupedPanel = () => {
      if (!ungroupedItems?.length) return nothing;

      const ungroupedItemsEl = _createPanelItems(this.hass, ungroupedItems, this._dialog);
      return [...ungroupedItemsEl].map(_renderPanelItem);
    };

    return html` <div id="theme-container"></div>
      <div class="divider-preview" style=${this._computePreviewStyle()}>
        <div class="menu-title">
          ${this._sidebarConfig?.header_title || 'Home Assistant'}
          ${this._sidebarConfig?.hide_header_toggle
            ? nothing
            : html`<ha-icon icon="mdi:plus" class="collapse-toggle" @click=${() => this._toggleGroup(null)}></ha-icon>`}
        </div>
        <div class="groups-container">
          ${_renderPanelItem(lovelacePanel)}
          ${Array.from({ length: groups.length }, (_, i) => {
            const collapsed = groups.length >= 2 ? false : true;
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
          ${ungroupedPanel()}
          <div class="spacer"></div>
          <div class="bottom-panel" ?hidden=${_paperListbox['bottomItems'].length === 0}>${bottomPanel}</div>
          <div class="divider"></div>
          <div class="system-panel">${bottomSys}</div>
        </div>
      </div>`;
  }

  public _toggleGroup = (group: string | null, preview?: string) => {
    const container = this.shadowRoot?.querySelector('div.groups-container') as HTMLElement;
    const children = container.children;
    const groups = this.shadowRoot?.querySelectorAll('div.divider-container') as NodeListOf<HTMLElement>;
    const itemsEl = this.shadowRoot?.querySelectorAll('div.group-items') as NodeListOf<HTMLElement>;
    groups.forEach((item) => {
      const groupName = item.getAttribute('group');
      item.classList.toggle('collapsed', groupName !== group);
      const addedContent = item.querySelector('div.added-content') as HTMLElement;
      addedContent.classList.toggle('collapsed', groupName !== group);
    });

    if (!itemsEl) return;
    itemsEl.forEach((item) => {
      const groupName = item.getAttribute('group');
      item.classList.toggle('collapsed', groupName !== group);
      if (groupName === group && !preview) {
        item.classList.add('hight-light');
        item.addEventListener('animationend', () => {
          item.classList.remove('hight-light');
        });
      }
    });

    if (preview) {
      const hightLightItem = () => {
        const filteredItems = Array.from(children).filter((item) => item.getAttribute('group') !== group);
        const itemGroup = container.querySelector(`div.group-items[group="${group}"]`) as HTMLElement;
        const isSelected = itemGroup.hasAttribute('selected');
        itemGroup.toggleAttribute('selected', !isSelected);
        filteredItems.forEach((item) => ((item as HTMLElement).style.opacity = !isSelected ? '0.1' : ''));
      };
      hightLightItem();
    }

    if (group === null) {
      container.querySelectorAll('div.group-items').forEach((item) => item.removeAttribute('selected'));
      Array.from(children).forEach((item) => ((item as HTMLElement).style.opacity = ''));
    }
  };

  public _toggleBottomPanel(bottomPanel: boolean, anime: boolean = true) {
    const bottomPanelEl = this.shadowRoot?.querySelector('div.bottom-panel') as HTMLElement;
    bottomPanelEl.toggleAttribute('selected', bottomPanel && !anime);
    if (bottomPanel && anime) {
      bottomPanelEl.classList.add('hight-light');
      bottomPanelEl.addEventListener('animationend', () => {
        bottomPanelEl.classList.remove('hight-light');
      });
    }
  }

  private _computePreviewStyle() {
    const colorMode = this._colorConfigMode;
    const color_config = this._sidebarConfig?.color_config || {};
    const borderRadius = color_config?.border_radius || 0;
    const colorConfig = color_config?.[colorMode] || {};
    const customStyles = colorConfig.custom_styles || [];
    const styleAddedCustom = convertPreviewCustomStyles(customStyles);
    // console.log('Converted Custom Styles:', styleAddedCustom);

    const getColor = (key: string): string => {
      const color = colorConfig?.[key] ?? this._baseColorFromTheme[key];
      // console.log('getColor', key, color);
      return color;
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
        :host([invalid-config]) {
          filter: blur(5px) grayscale(1);
          pointer-events: none;
        }

        :host *[hidden] {
          display: none !important;
        }
        :host {
          --selected-container-color: rgb(from var(--primary-color) r g b / 0.4);
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
        .bottom-panel {
          display: block;
        }
        .bottom-panel[selected],
        .group-items[selected] {
          border: 1px solid var(--selected-container-color);
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

        .hight-light {
          animation: highLight 1s ease-in-out infinite;
          animation-iteration-count: 3;
          animation-fill-mode: forwards;
        }

        @keyframes highLight {
          0% {
            box-shadow: 0 0 10px 0 var(--selected-container-color);
          }

          50% {
            box-shadow: 0 0 20px 0 var(--selected-container-color);
          }

          100% {
            box-shadow: 0 0 10px 0 var(--selected-container-color);
          }
        }
        .collapse-toggle {
          color: var(--primary-color);
          transition: transform 0.3s ease;
          cursor: pointer;
          opacity: 0.5;
          margin-right: 4px;
        }
        .collapse-toggle.active {
          color: var(--sidebar-icon-color);
          transform: rotate(90deg);
          transition: transform 0.3s ease;
        }
        .collapse-toggle:hover {
          color: var(--primary-color);
          opacity: 1;
        }
        .menu-title {
          border-bottom: 1px solid var(--divider-color);
          display: flex;
          justify-content: space-between;
          padding-inline: 0.5rem;
          font-size: 20px;
          min-height: 40px;
          align-items: center;
          color: var(--sidebar-text-color);
        }
        .system-panel {
          display: block;
          margin-bottom: 40px;
        }

        .notification-badge {
          position: absolute;
          left: calc(var(--app-drawer-width, 248px) - 42px);
          inset-inline-start: calc(var(--app-drawer-width, 248px) - 42px);
          inset-inline-end: initial;
          min-width: 20px;
          box-sizing: border-box;
          border-radius: 20px;
          font-weight: 400;
          background-color: var(--accent-color);
          line-height: 20px;
          text-align: center;
          padding: 0px 5px;
          color: var(--text-accent-color, var(--text-primary-color));
        }
        ha-icon.notification-badge {
          padding: 0 !important;
          color: var(--accent-color);
          background-color: transparent;
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
