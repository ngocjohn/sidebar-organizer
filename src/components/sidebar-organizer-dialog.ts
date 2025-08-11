import { ALERT_MSG, HA_EVENT, NAMESPACE, NAMESPACE_TITLE, REPO_URL, SLOT, TAB_STATE, VERSION } from '@constants';
import { mdiArrowExpand, mdiClose, mdiInformation } from '@mdi/js';

import './sidebar-dialog';

import { TRANSLATED_LABEL } from '@utilities/localize';
import { showConfirmDialog } from '@utilities/show-dialog-box';
import { SidebarConfigDialogParams } from '@utilities/show-dialog-sidebar-organizer';
import { showToast } from '@utilities/toast-notify';
import { LitElement, TemplateResult, html, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators';
import { DIALOG_STYLE } from 'sidebar-css';

import { HA, SidebarConfig } from '../types';
import { fireEvent } from '../utilities/fire_event';
import { SidebarConfigDialog } from './sidebar-dialog';

@customElement('sidebar-organizer-dialog')
export class SidebarOrganizerDialog extends LitElement {
  @property({ attribute: false }) public hass!: HA;
  @state() private _params?: SidebarConfigDialogParams;
  @state() private _open = false;
  @state() private _large = false;

  @state() _codeUiLabel: string = TRANSLATED_LABEL.BTN_LABEL.SHOW_CODE_EDITOR;
  @state() _configValid = true;
  @state() _saveDisabled = false;

  @query('ha-dialog') private _dialog?: HTMLDialogElement;
  @query('sidebar-organizer-config-dialog') private _configDialog!: SidebarConfigDialog;

  connectedCallback(): void {
    super.connectedCallback();
    window._sidebarOrganizerDialog = this;
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
    window._sidebarOrganizerDialog = undefined;
  }

  public async showDialog(param: SidebarConfigDialogParams): Promise<void> {
    this._open = true;
    this._large = true; // Default to large dialog
    this._params = param;
  }

  public closeDialog(): boolean {
    if (this._isConfigChanged) {
      // If config is changed and not valid, show confirm dialog
      this._handleClose();
      return false;
    }

    this._open = false;
    this._params = undefined;
    this._params = undefined;
    this._open = false;
    fireEvent(this, 'dialog-closed', { dialog: this.localName });
    return true;
  }

  private _dialogClosed(): void {
    this._params = undefined;
    this._open = false;
    fireEvent(this, 'dialog-closed', { dialog: this.localName });
  }

  private get _canSaveConfig(): boolean {
    return (
      this._configDialog._invalidConfig === undefined ||
      (this._configValid && Object.keys(this._configDialog._sidebarConfig).length !== 0)
    );
  }

  private get _isConfigChanged(): boolean {
    if (!this._params || !this._configDialog || this._configDialog._useConfigFile) {
      // If using config file, we don't check for changes
      return false;
    }
    return JSON.stringify(this._params.config) !== JSON.stringify(this._configDialog._sidebarConfig);
  }

  private async _handleSaveToStorage() {
    if (!this._configValid) {
      console.warn('Cannot save config, it is not valid.');
      showToast(this, {
        message: 'Cannot save config, it is not valid.',
        duration: 5000,
      });
      return;
    } else if (this._configValid) {
      // If config is valid, save to storage
      this._configDialog._handleInvalidConfig('save');
      this._handleSaveConfig();
    }
  }

  private async _handleClose() {
    const confirmSaveChange = await showConfirmDialog(this, ALERT_MSG.CONFIG_CHANGED, 'SAVE', 'DISCARD');
    if (confirmSaveChange) {
      this._handleSaveConfig();
    } else {
      this._dialogClosed();
    }
    return;
  }

  private _showSuccessToast(): void {
    showToast(this, {
      message: 'Test config saved successfully.',
    });
  }

  private _handleSaveConfig(): void {
    if (!this._canSaveConfig) {
      console.warn('Cannot save config, it is not valid or has unsaved changes.');
      showToast(this, {
        message: 'Cannot save config, it is not valid or has unsaved changes.',
        duration: 5000,
      });
      return;
    } else if (this._configDialog._useConfigFile && this._configValid) {
      // If using config file, we save the config to the file
      this._configDialog._handleInvalidConfig('save');
      this._showSuccessToast();
      this._handleSaveConfig();
    }
    const config = this._configDialog!._sidebarConfig;
    const useConfigFile = this._configDialog!._useConfigFile;
    const detail = {
      config,
      useConfigFile: useConfigFile,
    };
    fireEvent(this, HA_EVENT.SIDEBAR_CONFIG_SAVED, detail);
    this._dialogClosed();
  }

  private _renderContent(): TemplateResult {
    return html`
      <sidebar-organizer-config-dialog .hass=${this.hass} ._mainDialog=${this}></sidebar-organizer-config-dialog>
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

    const rightHeaderBtns = html`<div slot="actionItems">
      <ha-icon-button .label=${'Toggle large'} .path=${mdiArrowExpand} @click=${toggleLarge}> </ha-icon-button>
      <ha-icon-button
        .label=${'Documentation'}
        .path=${mdiInformation}
        @click=${() => window.open(REPO_URL)}
      ></ha-icon-button>
    </div>`;

    const dialogTitle = html`<span slot="title" .title=${NAMESPACE} @click=${toggleLarge}> ${NAMESPACE_TITLE} </span>
      <span slot="subtitle">(${VERSION})</span> `;
    return html`
      <ha-dialog
        open
        @closed=${this._dialogClosed}
        .hideActions=${false}
        .flexContent=${true}
        ?large=${this._large}
        scrimClickAction
        escapeKeyAction
        .heading=${NAMESPACE_TITLE}
      >
        <ha-dialog-header slot="heading">
          <ha-icon-button
            slot="navigationIcon"
            @click=${this.closeDialog}
            .label=${this.hass.localize('ui.common.close')}
            .path=${mdiClose}
          ></ha-icon-button>
          ${dialogTitle} ${rightHeaderBtns}
        </ha-dialog-header>

        ${this._renderContent()}

        <ha-button appearance="plain" size="small" slot=${SLOT.SECONDARY_ACTION} @click=${this._toggleCodeUi}
          >${this._codeUiLabel}
        </ha-button>
        <div slot=${SLOT.PRIMARY_ACTION}>
          <ha-button appearance="plain" size="small" .label=${BTN_LABEL.CANCEL} @click=${this.closeDialog}>
            ${BTN_LABEL.CANCEL}
          </ha-button>
          <ha-button appearance="plain" size="small" .label=${BTN_LABEL.SAVE} @click=${this._handleSaveConfig}
            >${BTN_LABEL.SAVE}
          </ha-button>
        </div>
      </ha-dialog>
    `;
  }

  private _toggleCodeUi(): void {
    this._configDialog._toggleCodeEditor();
    this._codeUiLabel =
      this._configDialog._tabState === TAB_STATE.CODE
        ? TRANSLATED_LABEL.BTN_LABEL.SHOW_VISUAL_EDITOR
        : TRANSLATED_LABEL.BTN_LABEL.SHOW_CODE_EDITOR;
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
  interface Window {
    _sidebarOrganizerDialog?: SidebarOrganizerDialog;
  }
}
