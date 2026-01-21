import { DividerColorSettings, HaExtened, PanelInfo, SidebarConfig } from '@types';
import { _getDarkConfigMode, applyTheme } from '@utilities/apply-theme';
import { getDefaultThemeColors, convertPreviewCustomStyles } from '@utilities/custom-styles';
import { isIcon } from '@utilities/is-icon';
import { getDefaultPanelUrlPath, getPanelTitleFromUrlPath } from '@utilities/panel';
import { shallowEqual } from '@utilities/shallow-equal';
import { hasTemplate, subscribeRenderTemplate } from '@utilities/ws-templates';
import { isEmpty } from 'es-toolkit/compat';
import { html, css, LitElement, TemplateResult, PropertyValues, CSSResultGroup, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { SidebarConfigDialog } from './sidebar-dialog';
import { BottomTabPanel } from './sidebar-dialog-groups';

export interface PreviewPanels {
  custom_groups?: Record<string, PanelInfo[]>;
  bottom_items?: PanelInfo[];
  bottom_grid_items?: PanelInfo[];
}

@customElement('sidebar-dialog-preview')
export class SidebarDialogPreview extends LitElement {
  @property({ attribute: false }) hass!: HaExtened['hass'];
  @property({ attribute: false }) _dialog!: SidebarConfigDialog;
  @property({ attribute: false }) _sidebarConfig: SidebarConfig = {};

  @property({ type: Boolean, reflect: true, attribute: 'invalid-config' }) public invalidConfig = false;

  @state() public _colorConfigMode: string = '';
  @state() private _baseColorFromTheme: DividerColorSettings = {};

  @state() private _previewPanels: PreviewPanels = {};
  @state() private _collapsedGroups = new Set<string>();
  @state() private _ready = false;

  @query('.divider-preview') private _previewContainer!: HTMLElement;
  @query('.groups-container') private _groupsContainer!: HTMLElement;

  protected willUpdate(_changedProperties: PropertyValues): void {
    if (_changedProperties.has('_sidebarConfig') && this._sidebarConfig && isEmpty(this._previewPanels)) {
      this._previewPanels = this._computePreviewPanels();
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
    if (_changedProperties.has('invalidConfig') && Object.keys(this._sidebarConfig).length === 0) {
      this.invalidConfig = true;
      console.log('Sidebar config is empty, set blur');
    }
    return true;
  }

  protected updated(_changedProperties: PropertyValues): void {
    super.updated(_changedProperties);
    if (_changedProperties.has('_previewPanels') && this._previewPanels) {
      this._ready = true;
      console.log('%cSIDEBAR-DIALOG-PREVIEW:', 'color: #40c057;', 'Preview panels updated:');
    }

    if (_changedProperties.has('_sidebarConfig') && this._sidebarConfig) {
      const oldConfig = _changedProperties.get('_sidebarConfig') as SidebarConfig | undefined;
      const newConfig = this._sidebarConfig;

      if (oldConfig && newConfig) {
        const bottomHasChanged = !shallowEqual(oldConfig.bottom_items, newConfig.bottom_items);
        const bottomGridHasChanged = !shallowEqual(oldConfig.bottom_grid_items, newConfig.bottom_grid_items);
        const customGroupsHasChanged = !shallowEqual(oldConfig.custom_groups, newConfig.custom_groups);
        const hiddenItemsHasChanged = !shallowEqual(oldConfig.hidden_items, newConfig.hidden_items);
        const newItemsHasChanged = !shallowEqual(oldConfig.new_items, newConfig.new_items);

        if (
          Boolean(
            bottomHasChanged ||
            bottomGridHasChanged ||
            customGroupsHasChanged ||
            hiddenItemsHasChanged ||
            newItemsHasChanged
          )
        ) {
          console.log('%cSIDEBAR-DIALOG-PREVIEW:', 'color: #40c057;', {
            bottomHasChanged,
            bottomGridHasChanged,
            customGroupsHasChanged,
            hiddenItemsHasChanged,
            newItemsHasChanged,
          });
          this._updateListbox(newConfig);
        }

        const themeChanged = !shallowEqual(
          oldConfig.color_config?.custom_theme?.theme,
          newConfig.color_config?.custom_theme?.theme
        );

        if (themeChanged) {
          console.log(
            '%cSIDEBAR-DIALOG-PREVIEW:',
            'color: #40c057;',
            'Custom theme changed, old -> new:',
            oldConfig.color_config?.custom_theme?.theme,
            '->',
            newConfig.color_config?.custom_theme?.theme
          );

          if (newConfig.color_config?.custom_theme?.theme === undefined) {
            this.style = '';
            setTimeout(() => {
              this._setTheme('default');
            }, 200);
          } else {
            this._setTheme(this._colorConfigMode);
          }
        }

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

  private _addNotification(): void {
    if (!this._ready) {
      // console.log('Not ready to add notification');
      return;
    }

    const items = this._groupsContainer!.querySelectorAll('a') as NodeListOf<HTMLElement>;
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

  private _getPanelInfo(panelId: string): PanelInfo {
    const hass = this.hass as HaExtened['hass'];
    const panels = hass.panels;
    if (this._dialog?._newItemMap?.has(panelId)) {
      return {
        ...this._dialog!._newItemMap!.get(panelId)!,
        component_name: panelId,
      };
    } else {
      return {
        ...panels[panelId],
        component_name: panelId,
        title: getPanelTitleFromUrlPath(hass, panelId) || panels[panelId]?.title || panelId,
      };
    }
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

    return html` <div id="theme-container"></div>
      <div class="divider-preview" style=${this._computePreviewStyle()}>
        ${this._renderHeader()}
        <div class="groups-container">
          ${lovelacePanel()} ${this._renderCustomGroups()} ${this._renderUngroupedPanels()}
          <div class="spacer"></div>
          ${isEmpty(this._previewPanels?.bottom_items)
            ? nothing
            : html` <div class="bottom-panel">${this._renderBottomPanels()}</div> `}
          ${isEmpty(this._previewPanels?.bottom_grid_items)
            ? nothing
            : html`
                <div class="divider"></div>
                <div class="bottom-grid-panel">${this._renderBottomGridPanels()}</div>
              `}
        </div>
      </div>`;
  }

  private _renderCustomGroups(): TemplateResult[] {
    const groups = this._previewPanels?.custom_groups;
    if (!groups) {
      return [];
    }

    return Object.entries(groups).map(([groupName, items]) => {
      const isCollapsed = this._collapsedGroups.has(groupName);
      return html`<div class="divider-container" group=${groupName} @click=${() => this._toggleColapsed(groupName)}>
          <div class="added-content" group=${groupName} ?collapsed=${isCollapsed}>
            <ha-icon icon="mdi:chevron-down"></ha-icon>
            <span>${groupName.replace('_', ' ')}</span>
          </div>
        </div>
        <div class="group-items" ?collapsed=${isCollapsed} group=${groupName}>
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
      this._dispatchEvent('item-clicked', panel.component_name);
    };

    const { icon, title, component_name } = panel;
    return html`<a data-panel=${component_name!} @click=${itemClicked}>
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

  public _toggleBottomPanel(bottomPanel: BottomTabPanel, anime: boolean = true) {
    this._collapsedGroups = new Set(Object.keys(this._previewPanels?.custom_groups || {}));
    this.requestUpdate();
    this.updateComplete.then(() => {
      let bottomPanelEl: HTMLElement;
      bottomPanelEl =
        bottomPanel === 'bottom_items'
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

    const styleAdded = {
      '--divider-color': getColor('divider_color'),
      '--divider-bg-color': getColor('background_color'),
      '--divider-border-top-color': getColor('border_top_color'),
      '--scrollbar-thumb-color': getColor('scrollbar_thumb_color'),
      '--sidebar-background-color': getColor('custom_sidebar_background_color'),
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
          --selected-container-color: rgb(from var(--primary-color) r g b / 0.4);
          background-color: var(--clear-background-color, rgba(0, 0, 0, 0.2));
          min-height: 100%;
          display: flex;
          width: 100%;
          justify-content: center;
          max-height: calc(var(--mdc-dialog-min-height, 700px) - 40px);
        }

        :host ha-spinner {
          display: flex;
          place-self: center;
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

        .divider-preview {
          display: block;
          /* margin: 1rem auto; */
          align-items: center;
          max-height: calc(var(--mdc-dialog-min-height, 700px) - 50px);
          /* max-height: max-content; */
          max-width: 260px;
          height: auto;
          width: 100%;
          background-color: var(--sidebar-background-color);
          overflow: hidden;
          margin: 0.5rem auto;
        }

        @media all and (max-width: 800px), all and (max-height: 500px) {
          .divider-preview {
            margin: 10px auto 0;
            max-height: 580px;
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
          max-height: calc(100% - 0px);
          /* scroll-margin-block-end: -40px; */
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
          padding-left: 12px;
          padding-inline-start: 12px;
          padding-inline-end: initial;
          border-radius: 4px;
          display: flex;
          min-height: 40px;
          align-items: center;
          /* padding: 0 16px; */
        }
        .icon-item > ha-icon {
          width: 56px;
          color: var(--sidebar-icon-color);
        }
        .icon-item span.item-text {
          display: block;
          max-width: calc(100% - 56px);
          text-transform: capitalize;
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
          display: flex;
          width: calc(250px + var(--safe-area-inset-left, 0px));
          min-height: 40px;
          color: var(--sidebar-text-color);
          border-bottom: 1px solid var(--divider-color);
          position: sticky;
          font-size: 20px;
          align-items: center;
          padding-inline-start: 0.5em;
          justify-content: space-between;
        }
        .system-panel {
          display: block;
          margin-bottom: 40px;
        }
        .bottom-grid-panel {
          display: grid;
          grid-template-columns: repeat(auto-fill, 25%);
          padding: 0;
          margin-bottom: 40px;
          max-height: fit-content;
          scroll-margin-block-end: -40px;
        }
        .bottom-grid-panel a {
          width: calc(249px / 4 - 0px);
          display: flex;
        }
        .icon-item[grid-item] {
          /* padding: 0; */
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

        .icon-item[grid-item] > ha-icon.notification-badge {
          left: 32px;
          width: 22px;
          top: 8px;
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
