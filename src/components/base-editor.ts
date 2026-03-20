import { CONFIG_SECTION, PANEL_AREA } from '@constants';
import { HomeAssistant, SidebarConfig } from '@types';
import { UTILITIES } from '@utilities/index';
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

  constructor(area?: CONFIG_SECTION | PANEL_AREA) {
    super();
    if (area) {
      this._configArea = area;
    }
  }
  public connectedCallback(): void {
    super.connectedCallback();
    if (this._configArea) {
      console.log(`${this._configArea} editor connected.`);
    }
  }
  public disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._configArea) {
      console.log(`${this._configArea} editor disconnected.`);
    }
  }

  protected get _dialog(): SidebarConfigDialog {
    return this._store.editorDialog;
  }

  protected get _config(): SidebarConfig {
    return this._store.sidebarConfig;
  }

  static get styles(): CSSResultGroup {
    return dialogStyles;
  }
}
