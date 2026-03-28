import { CONFIG_SECTION, PANEL_AREA } from '@constants';
import { HomeAssistant, NewItemConfig, SidebarConfig } from '@types';
import { UTILITIES } from '@utilities/index';
import { HomeAssistantStylesManager } from 'home-assistant-styles-manager';
import { CSSResultGroup, LitElement } from 'lit';
import { property } from 'lit/decorators.js';

import { dialogStyles } from './dialog-css';
import { EditorStore } from './editor-store';
import { SidebarConfigDialog } from './sidebar-dialog';

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
}
