import { CONFIG_SECTION, PANEL_AREA } from '@constants';
import { HomeAssistant, NewItemConfig, SidebarConfig } from '@types';
import { fireEvent, UTILITIES } from '@utilities/index';
import { HomeAssistantStylesManager } from 'home-assistant-styles-manager';
import { CSSResultGroup, html, LitElement, TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import { dialogStyles } from './dialog-css';
import { EditorStore } from './editor-store';
import { SidebarConfigDialog } from './sidebar-dialog';
import { SelectSelector } from './types';

export class BaseEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) protected _store!: EditorStore;
  @property({ attribute: false }) public _utils = UTILITIES;

  protected _configArea?: CONFIG_SECTION | PANEL_AREA;
  protected _styleManager: HomeAssistantStylesManager;
  constructor(area?: CONFIG_SECTION | PANEL_AREA) {
    super();
    if (area) {
      this._configArea = area;
    }
    this._styleManager = new HomeAssistantStylesManager({
      namespace: 'sidebar-dialog',
      throwWarnings: false,
    });
  }
  public connectedCallback(): void {
    super.connectedCallback();
  }
  public disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  static get styles(): CSSResultGroup {
    return dialogStyles;
  }

  protected get _dialog(): SidebarConfigDialog {
    return this._store.editorDialog;
  }

  protected get _config(): SidebarConfig {
    return this._store.sidebarConfig;
  }

  protected get narrow() {
    return this._dialog._narrow;
  }

  protected get _panelsWithoutNewItems(): string[] {
    const newItems = this._config?.new_items?.map((item) => item.title) || [];
    return this._dialog._initCombiPanels.filter((panel) => !newItems.includes(panel));
  }

  private _getPanelNotification = (panelId: string): string | undefined => {
    const configNotification = this._config?.notification?.[panelId];
    return configNotification;
  };

  public _getPanelInfo = (panelId: string): NewItemConfig => {
    const hass = this.hass;
    const panels = hass.panels || {};
    const notification = this._getPanelNotification(panelId);
    if (this._dialog?._newItemMap?.has(panelId)) {
      return {
        ...this._dialog!._newItemMap!.get(panelId)!,
        component_name: 'new-item',
      };
    } else {
      return {
        ...panels[panelId],
        icon: panels[panelId]?.icon || 'mdi:help-circle-outline',
        title: this._utils.PANEL.getPanelTitleFromUrlPath(hass, panelId) || panels[panelId]?.title || panelId,
        notification,
      };
    }
  };

  public _computePanelInfoList = (panelIds?: string[]): NewItemConfig[] => {
    const panelsToCompute = panelIds || this._dialog._initCombiPanels;
    return panelsToCompute.map((panelId) => ({
      ...this._getPanelInfo(panelId),
      group: this._dialog._getGroupOfPanel(panelId) || undefined,
      show_in_sidebar: this._config?.hidden_items?.includes(panelId) ? false : true,
    }));
  };

  protected _renderSpacerDiv() {
    return html`<div style="flex: 1;"></div>`;
  }

  protected _computeSelectorOptions(
    items: string[],
    mode: 'list' | 'dropdown' | 'box' = 'list',
    reorder: boolean = true,
    includeDefault: boolean = true
  ): SelectSelector {
    const defaultPanel = this._utils.PANEL.getDefaultPanelUrlPath(this.hass);
    const options = items.map((panel) => {
      const isDefault = panel === defaultPanel;
      const isDisabled = isDefault && !includeDefault ? true : false;
      const panelName = this._utils.PANEL.getPanelTitleFromUrlPath(this.hass, panel) || panel;
      return { value: panel, label: panelName + (isDefault ? ' (default)' : ''), disabled: isDisabled };
    });

    // options.sort((a, b) => a.label.localeCompare(b.label));

    const selector = {
      select: {
        multiple: true,
        mode: mode,
        options: options,
        sort: true,
        reorder: reorder,
      },
    };
    return selector;
  }

  protected _createHaSelector(
    selectorConfig: SelectSelector,
    value: string | string[] | undefined,
    key?: string | number,
    subKey?: string | number
  ): TemplateResult {
    return html`<ha-selector
      .hass=${this.hass}
      .value=${value}
      .selector=${selectorConfig}
      .required=${false}
      .key=${key}
      .subKey=${subKey}
      id=${ifDefined(key !== undefined ? `selector-${key}` : undefined)}
      @value-changed=${this._handleSelectorChange}
    ></ha-selector>`;
  }

  protected _handleSelectorChange(e: CustomEvent): void {
    console.debug('selector change from BaseEditor', e);
    e.stopPropagation();
    const { key, subKey } = e.target as any;
    const value = e.detail.value;
    console.debug('value changed:', value, 'key:', key, 'subKey:', subKey);
  }

  protected _configChanged(newConfig: Partial<SidebarConfig>): void {
    console.debug('incoming change from:', this._configArea);
    const updatedConfig = { ...this._config, ...newConfig };
    fireEvent(this, 'sidebar-config-changed', { config: updatedConfig });
  }
}
