import { DividerColorSettings, ItemShallowKeys, PANEL_TYPE, PanelInfo, SidebarConfig } from '@types';
import { _getDarkConfigMode, applyTheme } from '@utilities/apply-theme';
import { getDefaultThemeColors, convertPreviewCustomStyles } from '@utilities/custom-styles';
import { isIcon } from '@utilities/is-icon';
import { getDefaultPanelUrlPath } from '@utilities/panel';
import { shallowEqual } from '@utilities/shallow-equal';
import { hasTemplate, subscribeRenderTemplate } from '@utilities/ws-templates';
import { BaseEditor } from 'components/base-editor';
import { BOTTOM_SECTION, CONFIG_SECTION } from 'constants/config-area';
import { isEmpty } from 'es-toolkit/compat';
import { html, css, TemplateResult, PropertyValues, CSSResultGroup, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

export interface PreviewPanels {
  custom_groups?: Record<string, PanelInfo[]>;
  bottom_items?: PanelInfo[];
  bottom_grid_items?: PanelInfo[];
}

@customElement('sidebar-dialog-preview')
export class SidebarDialogPreview extends BaseEditor {
  constructor() {
    super(CONFIG_SECTION.PREVIEW);
  }
  @property({ attribute: false }) _sidebarConfig: SidebarConfig = {};

  @property({ type: Boolean, reflect: true, attribute: 'invalid-config' }) public invalidConfig = false;

  @state() public _colorConfigMode: string = '';
  @state() private _baseColorFromTheme: DividerColorSettings = {};

  @state() private _previewPanels: PreviewPanels = {};
  @state() private _collapsedGroups = new Set<string>();
  @state() private _ready = false;

  @query('.divider-preview') private _previewContainer!: HTMLElement;
  @query('.panels-list') private _panelsList!: HTMLElement;
  @query('.groups-container') private _groupsContainer!: HTMLElement;

  protected willUpdate(_changedProperties: PropertyValues): void {
    if (_changedProperties.has('_sidebarConfig') && this._sidebarConfig && isEmpty(this._previewPanels)) {
      this._previewPanels = this._computePreviewPanels();
      !isEmpty(this._previewPanels) &&
        console.log('%cSIDEBAR-DIALOG-PREVIEW:', 'color: #40c057;', 'Computed preview panels:', this._previewPanels);
    }
  }

  protected firstUpdated(): void {
    // console.log('colorMode', colorMode);

    if (this._sidebarConfig) {
      this._collapsedGroups = new Set(this._sidebarConfig.default_collapsed || []);

      const darkMode = _getDarkConfigMode(this._sidebarConfig.color_config, this.hass);
      this._colorConfigMode = darkMode ? 'dark' : 'light';
      setTimeout(() => {
        this._setTheme(this._colorConfigMode);
      }, 0);
    }
    this._addNotification();
  }

  protected shouldUpdate(_changedProperties: PropertyValues): boolean {
    if (_changedProperties.has('invalidConfig') && this.invalidConfig === true) {
      this.invalidConfig = true;
      console.log('Sidebar config is empty, set blur');
    }
    if (_changedProperties.has('_sidebarConfig') && this._sidebarConfig) {
      return true;
    }
    return true;
  }

  protected updated(_changedProperties: PropertyValues): void {
    super.updated(_changedProperties);
    if (_changedProperties.has('_previewPanels') && this._previewPanels) {
      this._ready = true;
    }

    if (_changedProperties.has('_sidebarConfig') && this._sidebarConfig) {
      const oldConfig = _changedProperties.get('_sidebarConfig') as SidebarConfig | undefined;
      const newConfig = this._sidebarConfig;
      if (oldConfig && newConfig) {
        this._updatePanelConfig(oldConfig, newConfig);
        this._updateThemeChange(oldConfig, newConfig);
        this._updateNotificationChange(oldConfig, newConfig);
      }
    }

    if (_changedProperties.has('_colorConfigMode') && this._colorConfigMode) {
      const oldMode = _changedProperties.get('_colorConfigMode') as string | undefined;
      const newMode = this._colorConfigMode;
      if (oldMode && newMode && oldMode !== newMode) {
        console.log('set theme on mode change:', oldMode, '->', newMode);
        this._setTheme(newMode);
      }
    }
    if (_changedProperties.has('_ready') && this._ready) {
      this._handleNotifyChange();
    }
  }

  private _updatePanelConfig(oldConfig: SidebarConfig, newConfig: SidebarConfig): void {
    const panelConfigKeys = [
      'custom_groups',
      'bottom_items',
      'bottom_grid_items',
      'hidden_items',
      'new_items',
    ] as ItemShallowKeys[];
    const changedFlags = panelConfigKeys.reduce<Record<string, boolean>>(
      (acc, key) => {
        acc[key] = !shallowEqual(oldConfig[key], newConfig[key]);
        return acc;
      },
      {} as Record<ItemShallowKeys, boolean>
    );
    const customGroupsOrderChanged = !shallowEqual(
      Object.keys(oldConfig.custom_groups || {}),
      Object.keys(newConfig.custom_groups || {})
    );
    const settingsItemMovedChanged = oldConfig.move_settings_from_fixed !== newConfig.move_settings_from_fixed;

    if (Object.values(changedFlags).some((changed) => changed) || customGroupsOrderChanged) {
      // update the listbox if any of the panel groups config changed
      this._updateListbox(newConfig);
    } else if (settingsItemMovedChanged) {
      this.requestUpdate();
    }
  }

  private _updateThemeChange(oldConfig: SidebarConfig, newConfig: SidebarConfig): void {
    const oldTheme = oldConfig.color_config?.custom_theme?.theme;
    const newTheme = newConfig.color_config?.custom_theme?.theme;
    if (shallowEqual(oldTheme, newTheme)) return;

    //info
    console.log(
      '%cSIDEBAR-DIALOG-PREVIEW:%c ℹ️ Custom Theme changed:',
      'color: #40c057;',
      'color: #228be6;',
      oldTheme,
      '->',
      newTheme
    );

    if (newTheme === undefined) {
      this.style = '';
      setTimeout(() => this._setTheme('default'), 200);
      return;
    } else {
      this._setTheme(this._colorConfigMode);
    }
  }

  private _updateNotificationChange(oldConfig: SidebarConfig, newConfig: SidebarConfig): void {
    const notificationChanged = !shallowEqual(oldConfig.notification, newConfig.notification);
    const newItemsNotificationChanged = JSON.parse(
      JSON.stringify(
        oldConfig.new_items?.every((item) => item.notification) !==
          newConfig.new_items?.every((item) => item.notification)
      )
    );

    if (!notificationChanged && !newItemsNotificationChanged) {
      return;
    } else {
      console.log(
        '%cSIDEBAR-DIALOG-PREVIEW:',
        'color: #40c057;',
        'Notification config changed, updating notifications'
      );

      this._handleNotifyChange();
    }
  }

  private _addNotification(): void {
    if (!this._ready) {
      // console.log('Not ready to add notification');
      return;
    }

    const items = this._panelsList!.querySelectorAll('a') as NodeListOf<HTMLElement>;
    const { new_items, notification } = this._sidebarConfig || {};
    const newItemsNotify = Array.from(new_items || [])
      .filter((item) => item.notification !== undefined)
      .reduce(
        (acc, item) => {
          acc[item.title!] = item.notification!;
          return acc;
        },
        {} as Record<string, string>
      );

    const allNotifications = { ...(notification || {}), ...newItemsNotify };
    // console.log('%cSIDEBAR-DIALOG-PREVIEW:', 'color: #ff6f61;', allNotifications);
    if (allNotifications && Object.keys(allNotifications).length > 0) {
      Object.entries(allNotifications).forEach(([key, value]) => {
        const panel = Array.from(items).find((item) => item.getAttribute('data-panel') === key);
        if (panel) {
          this._subscribeNotification(panel, value);
          // console.log('%cSIDEBAR-DIALOG-PREVIEW:', 'color: #ff6f61;', 'added notification for panel:', key);
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
    const notifyItems = this._panelsList?.querySelectorAll('.notification-badge') as NodeListOf<HTMLElement>;
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
    this._previewPanels = this._computePreviewPanels();
  }

  private _computePreviewPanels(): PreviewPanels {
    const previewPanels: PreviewPanels = {};

    const { custom_groups, bottom_items, bottom_grid_items } = this._sidebarConfig || {};
    if (custom_groups) {
      previewPanels.custom_groups = {};
      Object.entries(custom_groups).forEach(([groupName, items]) => {
        previewPanels.custom_groups![groupName] = items.map((item) => this._getPanelInfo(item));
      });
    }
    if (bottom_items) {
      previewPanels.bottom_items = bottom_items.map((item) => this._getPanelInfo(item));
    }
    if (bottom_grid_items) {
      previewPanels.bottom_grid_items = bottom_grid_items.map((item) => this._getPanelInfo(item));
    }
    return previewPanels;
  }

  private _setTheme(mode: string): void {
    let theme = this.hass.themes.theme;
    const customTheme = this._sidebarConfig?.color_config?.custom_theme?.theme || undefined;
    if (customTheme) {
      theme = customTheme;
    }
    applyTheme(this, this.hass, theme, mode);
    setTimeout(() => {
      this._getDefaultColors();
    }, 200);

    // console.log('Preview Theme applied', theme, mode);
  }

  private _getDefaultColors(): void {
    const defaultColors = getDefaultThemeColors(this);
    this._baseColorFromTheme = defaultColors;
  }

  protected render(): TemplateResult {
    const defaultPanel = getDefaultPanelUrlPath(this.hass);
    const lovelacePanel = () => {
      const defaultDash = this._getPanelInfo(defaultPanel);
      return this._renderPanel(defaultDash);
    };

    return html` <div class="divider-preview" style=${this._computePreviewStyle()}>
      ${this._renderHeader()}
      <div class="panels-list">
        <div class="wrapper">
          <div class="groups-container before-spacer">
            ${lovelacePanel()} ${this._renderCustomGroups()} ${this._renderUngroupedPanels()}
          </div>
        </div>
        <div class="spacer"></div>
        <div class="after-spacer">
          ${isEmpty(this._previewPanels?.bottom_items)
            ? nothing
            : html`
                <div class="divider"></div>
                <div class="bottom-panel">${this._renderBottomPanels()}</div>
              `}
          ${isEmpty(this._previewPanels?.bottom_grid_items)
            ? nothing
            : html`
                <div class="divider"></div>
                <div class="bottom-grid-panel">${this._renderBottomGridPanels()}</div>
              `}
          ${this._dialog._settingItemMoved
            ? nothing
            : html`<div class="divider"></div>
                ${this._renderPanel(this._getPanelInfo('config'))}`}
        </div>
      </div>
    </div>`;
  }

  private _renderCustomGroups(): TemplateResult[] {
    const groups = this._previewPanels?.custom_groups;
    if (!groups) {
      return [];
    }

    return Object.entries(groups).map(([groupName, items]) => {
      const isUncategorized = groupName === PANEL_TYPE.UNCATEGORIZED_ITEMS;
      const isCollapsed = this._collapsedGroups.has(groupName);
      return html`${isUncategorized
          ? nothing
          : html`<div class="divider-container" group=${groupName} @click=${() => this._toggleColapsed(groupName)}>
              <div class="added-content" group=${groupName} ?collapsed=${isCollapsed}>
                <ha-icon icon="mdi:chevron-down"></ha-icon>
                <span>${groupName.trim()}</span>
              </div>
            </div>`}
        <div class="group-items" ?collapsed=${isUncategorized ? false : isCollapsed} group=${groupName}>
          ${items.map((item: PanelInfo) => this._renderPanel(item))}
        </div>`;
    });
  }

  private _renderBottomPanels(): TemplateResult[] {
    const bottomItems = this._previewPanels?.bottom_items;
    if (!bottomItems) {
      return [];
    }
    return bottomItems.map((item: PanelInfo) => this._renderPanel(item));
  }

  private _renderUngroupedPanels(): TemplateResult[] {
    const ungroupedItems = this._dialog.ungroupedItems || [];
    if (ungroupedItems.length === 0) {
      return [];
    }
    const ungroupedPanels = ungroupedItems.map((itemId: string) => this._getPanelInfo(itemId));
    return ungroupedPanels.map((item: PanelInfo) => this._renderPanel(item));
  }

  private _renderBottomGridPanels(): TemplateResult[] {
    const bottomGridItems = this._previewPanels?.bottom_grid_items;
    if (!bottomGridItems) {
      return [];
    }
    return bottomGridItems.map((item: PanelInfo) => this._renderPanel(item, true));
  }
  private _renderPanel(panel: PanelInfo, gridItem: boolean = false): TemplateResult {
    const itemClicked = () => {
      this._dispatchEvent('item-clicked', panel.url_path ?? panel.title);
    };

    const { icon, title, url_path } = panel;
    return html`<a data-panel=${url_path ?? title} @click=${itemClicked}>
      <div class="icon-item" ?grid-item=${gridItem}>
        <ha-icon .icon=${icon}> </ha-icon><span class="item-text">${title}</span>
      </div>
    </a>`;
  }

  private _renderHeader(): TemplateResult {
    const { header_title, hide_header_toggle, custom_groups } = this._sidebarConfig || {};
    const groupKeys = custom_groups ? Object.keys(custom_groups) : [];
    const collapsedSize = this._collapsedGroups.size;
    const allCollapsed = collapsedSize === groupKeys.length;
    return html`<div class="menu-title">
      ${header_title || 'Home Assistant'}
      ${hide_header_toggle || groupKeys.length === 0
        ? nothing
        : html`<ha-icon
            .icon=${allCollapsed ? 'mdi:plus' : 'mdi:minus'}
            class="collapse-toggle"
            @click=${() => this._handleCollapsedToggle()}
          ></ha-icon>`}
    </div>`;
  }
  private _handleCollapsedToggle(): void {
    const custom_groups = this._sidebarConfig?.custom_groups;
    if (!custom_groups) {
      return;
    }
    const groupKeys = Object.keys(custom_groups);
    const collapsedSize = this._collapsedGroups.size;

    if (collapsedSize === groupKeys.length) {
      this._collapsedGroups = new Set();
    } else {
      this._collapsedGroups = new Set(groupKeys);
    }
    this.requestUpdate();
  }

  private _toggleColapsed = (group: string) => {
    if (this._collapsedGroups.has(group)) {
      this._collapsedGroups.delete(group);
    } else {
      this._collapsedGroups.add(group);
    }
    this.requestUpdate();
  };

  public _toggleGroup = (group: string | null, preview?: string) => {
    const groupKeys = this._previewPanels?.custom_groups ? Object.keys(this._previewPanels.custom_groups) : [];
    this._collapsedGroups = new Set(
      groupKeys.filter((groupName) => {
        return groupName !== group;
      })
    );
    this.requestUpdate();
    this.updateComplete.then(() => {
      const children = this._groupsContainer.children;
      const groupsContent = this._groupsContainer.querySelectorAll('div.divider-container') as NodeListOf<HTMLElement>;
      const groupPanelSelected = Array.from(groupsContent).find((item) => item.getAttribute('group') === group);
      if (groupPanelSelected) {
        const addedContent = groupPanelSelected.querySelector('div.added-content') as HTMLElement;
        addedContent.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
          inline: 'nearest',
        });
      }
      const itemsEl = this._groupsContainer.querySelectorAll('div.group-items') as NodeListOf<HTMLElement>;
      const groupItemsSelected = Array.from(itemsEl).find((item) => item.getAttribute('group') === group);
      if (groupItemsSelected && !preview) {
        groupItemsSelected.classList.add('hight-light');
        groupItemsSelected.addEventListener('animationend', () => {
          groupItemsSelected.classList.remove('hight-light');
        });
      }
      if (preview) {
        const hightLightItem = () => {
          const filteredItems = Array.from(children).filter((item) => item.getAttribute('group') !== group);
          const itemGroup = this._groupsContainer.querySelector(`div.group-items[group="${group}"]`) as HTMLElement;
          const isSelected = itemGroup.hasAttribute('selected');
          itemGroup.toggleAttribute('selected', !isSelected);
          filteredItems.forEach((item) => (item as HTMLElement).toggleAttribute('dimmed', !isSelected));
        };
        hightLightItem();
      }
      if (group === null) {
        this._groupsContainer.querySelectorAll('div.group-items').forEach((item) => item.removeAttribute('selected'));
        Array.from(children).forEach((item) => (item as HTMLElement).removeAttribute('dimmed'));
      }
    });
  };

  public _toggleBottomPanel(bottomPanel: BOTTOM_SECTION, anime: boolean = true) {
    this._collapsedGroups = new Set(Object.keys(this._previewPanels?.custom_groups || {}));
    this.requestUpdate();
    this.updateComplete.then(() => {
      let bottomPanelEl: HTMLElement;
      bottomPanelEl =
        bottomPanel === BOTTOM_SECTION.BOTTOM_ITEMS
          ? (this.shadowRoot?.querySelector('div.bottom-panel') as HTMLElement)
          : (this.shadowRoot?.querySelector('div.bottom-grid-panel') as HTMLElement);
      if (!bottomPanelEl) {
        return;
      }
      this._groupsContainer.scrollTo(0, this._groupsContainer.scrollHeight - bottomPanelEl.scrollHeight);
      // const bottomPanelEl = this.shadowRoot?.querySelector('div.bottom-panel') as HTMLElement;
      bottomPanelEl.toggleAttribute('selected', bottomPanel && !anime);
      if (bottomPanel && anime) {
        bottomPanelEl.classList.add('hight-light');
        bottomPanelEl.addEventListener('animationend', () => {
          bottomPanelEl.classList.remove('hight-light');
        });
      }
    });
  }

  private _dispatchEvent(eventName: string, detail?: any) {
    this.dispatchEvent(
      new CustomEvent(eventName, {
        detail: detail,
        bubbles: true,
        composed: true,
      })
    );
  }
  private _computePreviewStyle() {
    const textTransform = this._sidebarConfig?.text_transformation || 'capitalize';
    const colorMode = this._colorConfigMode;
    const color_config = this._sidebarConfig?.color_config || {};
    const borderRadius = color_config?.border_radius || 0;
    const colorConfig = color_config?.[colorMode] || {};
    const customStyles = colorConfig?.custom_styles || {};
    const convertedStyles = convertPreviewCustomStyles(customStyles);

    const getColor = (key: string): string => {
      const color = colorConfig?.[key] ? `${colorConfig[key]} !important` : this._baseColorFromTheme[key];
      // console.log('getColor', key, color);
      return color;
    };
    const forceTransparent = this._sidebarConfig?.force_transparent_background === true;

    const styleAdded = {
      '--divider-color': getColor('divider_color'),
      '--divider-bg-color': getColor('background_color'),
      '--divider-border-top-color': getColor('border_top_color'),
      '--scrollbar-thumb-color': getColor('scrollbar_thumb_color'),
      '--sidebar-background-color': forceTransparent ? 'transparent' : getColor('custom_sidebar_background_color'),
      '--divider-border-radius': `${borderRadius}px`,
      '--sidebar-text-color': getColor('divider_text_color'),
      '--sidebar-icon-color': getColor('sidebar_icon_color'),
      '--sidebar-text-transform': textTransform,
      ...convertedStyles,
    };

    // console.log('styleAdded', styleAdded);
    return styleMap(styleAdded);
  }

  public _setCustomTheme(theme: string, mode?: string): void {
    this.style = '';
    applyTheme(this, this.hass, theme, mode);
    setTimeout(() => {
      this._getDefaultColors();
    }, 200);
    console.log('Preview Custom Theme applied', theme, mode);
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
        :host *[dimmed] {
          opacity: 0.1;
          pointer-events: none;
        }

        :host {
          --preview-header-height: 56px;
          --selected-container-color: rgb(from var(--primary-color) r g b / 0.4);
          /* background-color: var(--clear-background-color, rgba(0, 0, 0, 0.2)); */
          min-height: 100%;
          display: flex;
          width: 100%;
          height: 100%;
          justify-content: center;
          box-sizing: border-box;
          /* max-height: calc(var(--mdc-dialog-min-height, 700px) - 40px); */
        }

        :host ha-spinner {
          display: flex;
          place-self: center;
        }
        .menu-title {
          display: flex;
          height: var(--preview-header-height);
          width: 100%;
          color: var(--sidebar-text-color);
          border-bottom: 1px solid var(--divider-color);
          font-size: 20px;
          align-items: center;
          padding-inline-start: 0.5em;
          justify-content: space-between;
          box-sizing: border-box;
        }

        .panels-list {
          display: flex;
          flex-direction: column;
          height: calc(
            var(--config-section-height, var(--mdc-dialog-min-height, 700px)) - var(--preview-header-height)
          );
          max-height: calc(100% - var(--preview-header-height));
        }
        .wrapper {
          position: relative;
          display: flex;
          flex-direction: column;
          min-height: 0;
          flex: 1;
        }
        .groups-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-color: var(--scrollbar-thumb-color) transparent;
          scrollbar-width: thin;
        }
        .groups-container.before-spacer {
          padding-bottom: 0;
        }
        .after-spacer {
          padding-top: 0;
          min-height: fit-content;
        }

        .divider-preview {
          display: block;
          position: relative;
          align-items: center;
          max-width: 260px;
          height: auto;
          width: 100%;
          background-color: var(--sidebar-background-color);
          overflow: hidden;
          margin: 0.5rem auto;
          /* border: 1px solid var(--theme-border-color); */
        }
        .divider-preview::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border: 1px solid var(--theme-border-color);
          pointer-events: none;
          background-color: var(--drawer-background-color);
          z-index: -1;
        }

        @media all and (max-width: 800px), all and (max-height: 500px) {
          .divider-preview {
            margin: 10px auto 0;
            max-height: 580px;
          }
        }

        .divider-container {
          padding: 0;
          margin-top: 1px;
          box-sizing: border-box;
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
          text-transform: var(--sidebar-text-transform, capitalize);
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
        .added-content[collapsed] > span,
        .added-content.collapsed > span {
          transform: translateX(10px);
        }
        .added-content[collapsed] > ha-icon,
        .added-content.collapsed > ha-icon {
          transform: rotate(-90deg);
        }

        .group-items {
          max-height: 1000px;
          display: block;
          /* transition: all 0.3s ease; */
        }
        .bottom-panel {
          display: block;
        }
        .bottom-panel[selected],
        .group-items[selected] {
          border: 1px solid var(--selected-container-color);
        }
        .group-items[collapsed],
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
          margin-top: auto;
          pointer-events: none;
          /* flex: 1; */
        }
        a {
          text-decoration: none;
          color: var(--sidebar-text-color);
          font-weight: 500;
          font-size: 14px;
          position: relative;
          display: block;
          outline: 0;
          border-radius: 4px;
          /* width: 248px; */
          cursor: pointer;
        }
        a:hover > .icon-item {
          background-color: var(--secondary-background-color);
        }
        .icon-item {
          box-sizing: border-box;
          margin: 4px;
          padding-inline-start: 12px;
          border-radius: 4px;
          display: flex;
          min-height: 40px;
          align-items: center;
          flex: 1 1 0%;
          overflow: var(--md-item-overflow, hidden);
          /* align-items: var(--md-item-align-items,center); */
          gap: var(--ha-md-list-item-gap, 16px);
          padding-inline-end: 12px;
        }
        .icon-item > ha-icon {
          width: 24px;
          color: var(--sidebar-icon-color);
        }
        .icon-item span.item-text {
          /* display: block;
          max-width: 100%; */
          text-transform: capitalize;
          max-width: 100%;
          opacity: 1;
          transition-delay: 0s, 80ms;
          display: flex;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          height: 100%;
          align-items: center;
          width: 100%;
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

        .bottom-grid-panel {
          display: grid;
          grid-template-columns: repeat(auto-fit, calc(25% - 0px));
          padding: 0;
          max-height: fit-content;
        }
        .bottom-grid-panel a {
          width: calc(249px / 4 - 0px);
          display: flex;
        }
        .icon-item[grid-item] {
          padding: 0;
          padding-inline-start: 0;
          /* margin: auto auto; */
          width: 100%;
          display: flex;
          height: 48px;
        }
        .icon-item[grid-item] > ha-icon {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .icon-item[grid-item] > span.item-text {
          display: none !important;
        }

        .icon-item[grid-item] > .notification-badge {
          left: 32px;
          top: 8px;
          width: fit-content;
          min-width: 8px;
          max-width: 28px;
        }

        .notification-badge {
          position: absolute;
          left: calc(var(--app-drawer-width, 248px) - 26px);
          inset-inline-start: calc(var(--app-drawer-width, 248px) - 26px);
          inset-inline-end: initial;
          min-width: 20px;
          box-sizing: border-box;
          border-radius: 20px;
          font-weight: 400;
          background-color: var(--accent-color);
          line-height: 20px;
          text-align: center;
          padding: 0px 4px;
          color: var(--text-accent-color, var(--text-primary-color));
        }
        ha-icon.notification-badge {
          padding: 0 !important;
          color: var(--accent-color);
          background-color: transparent;
          width: auto;
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
