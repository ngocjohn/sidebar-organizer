import { CONFIG_SECTION, PANEL_AREA } from '@constants';
import { HomeAssistant, PanelInfo, SidebarConfig } from '@types';
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

  protected get _dialog(): SidebarConfigDialog {
    return this._store.editorDialog;
  }

  protected get _config(): SidebarConfig {
    return this._store.sidebarConfig;
  }

  protected get _panelsWithoutNewItems(): string[] {
    const newItems = this._config?.new_items?.map((item) => item.title) || [];
    return this._dialog._initCombiPanels.filter((panel) => !newItems.includes(panel));
  }

  static get styles(): CSSResultGroup {
    return dialogStyles;
  }

  public _getPanelInfo = (panelId: string): PanelInfo => {
    const hass = this.hass;
    const panels = hass.panels || {};
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
      };
    }
  };
}
