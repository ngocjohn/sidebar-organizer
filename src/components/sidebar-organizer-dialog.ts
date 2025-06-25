import { NAMESPACE, NAMESPACE_TITLE, REPO_URL, SLOT, TAB_STATE, VERSION } from '@constants';
import { mdiArrowExpand, mdiInformation } from '@mdi/js';
import { createCloseHeading } from '@utilities/dom-utils';

import './sidebar-dialog';

import { TRANSLATED_LABEL } from '@utilities/localize';
import { sidebarUseConfigFile } from '@utilities/storage-utils';
import { LitElement, TemplateResult, html, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators';
import { DIALOG_STYLE } from 'sidebar-css';

import { HA, SidebarConfig } from '../types';
import { fireEvent } from '../utilities/fire_event';
import { SidebarConfigDialog } from './sidebar-dialog';

@customElement('sidebar-organizer-dialog')
export class SidebarOrganizerDialog extends LitElement {
  @property({ attribute: false }) public hass!: HA;

  @state() _useConfigFile = false;
  @state() private _open = false;
  @state() private _large = false;

  @query('ha-dialog') private _dialog?: HTMLDialogElement;
  @query('sidebar-organizer-config-dialog') private _configDialog?: SidebarConfigDialog;

  public async showDialog(): Promise<void> {
    this._open = true;

    this._useConfigFile = sidebarUseConfigFile();
    this._configDialog?._setupInitConfig();
  }

  private _dialogClosed(): void {
    this._open = false;

    fireEvent(this, 'dialog-closed', { dialog: this.localName });
  }

  public closeDialog(): void {
    this._dialog?.close();
  }
  private _handleSaveConfig(): void {
    const config = this._configDialog!._sidebarConfig;
    const useConfigFile = this._configDialog!._useConfigFile;
    const detail = {
      config,
      useConfigFile: useConfigFile,
    };
    fireEvent(this, 'save-sidebar-organizer-config', detail);
    this._dialogClosed();
  }

  private _renderContent(): TemplateResult {
    return html`
      <sidebar-organizer-config-dialog
        .hass=${this.hass}
        ._useConfigFile=${this._useConfigFile}
      ></sidebar-organizer-config-dialog>
    `;
  }

  protected render() {
    if (!this._open) {
      return nothing;
    }
    const BTN_LABEL = TRANSLATED_LABEL.BTN_LABEL;
    const toggleLarge = () => {
      this._large = !this._large;
    };
    const codeEditorLabel =
      this._configDialog?._tabState === TAB_STATE.BASE ? BTN_LABEL.SHOW_CODE_EDITOR : BTN_LABEL.SHOW_CODE_EDITOR;

    const dialogTitle = html`<span slot="heading" style="flex: 1;" .title=${NAMESPACE} @click=${toggleLarge}
      >${NAMESPACE_TITLE} <span style="font-size: small; text-wrap-mode: nowrap;"> (${VERSION})</span></span
    >`;
    const rightHeaderBtns = html`<div>
      <ha-icon-button .label=${'Toggle large'} .path=${mdiArrowExpand} @click=${toggleLarge}> </ha-icon-button>
      <ha-icon-button
        .label=${'Documentation'}
        .path=${mdiInformation}
        @click=${() => window.open(REPO_URL)}
      ></ha-icon-button>
    </div>`;
    return html`
      <ha-dialog
        open=${this._open}
        @closed=${this._dialogClosed}
        .heading=${createCloseHeading(this.hass, dialogTitle, rightHeaderBtns)}
        .hideActions=${false}
        .flexContent=${true}
        ?large=${this._large}
        scrimClickAction
        escapeKeyAction
      >
        ${this._renderContent()}
        <ha-button
          .label=${codeEditorLabel}
          slot=${SLOT.SECONDARY_ACTION}
          @click=${() => this._configDialog?._toggleCodeEditor()}
        >
        </ha-button>
        <div slot=${SLOT.PRIMARY_ACTION}>
          <ha-button .label=${BTN_LABEL.CANCEL} @click=${this.closeDialog}> </ha-button>
          <ha-button .label=${BTN_LABEL.SAVE} @click=${this._handleSaveConfig}> </ha-button>
        </div>
      </ha-dialog>
    `;
  }

  static styles = [DIALOG_STYLE];
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-organizer-dialog': SidebarOrganizerDialog;
  }
  interface HASSDomEvents {
    'save-sidebar-organizer-config': { config: SidebarConfig; useConfigFile: boolean };
  }
}
