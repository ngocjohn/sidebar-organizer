import { ALERT_MSG, HA_EVENT, NAMESPACE_TITLE, REPO_URL, SLOT, VERSION } from '@constants';
import { mdiClose, mdiFullscreen, mdiFullscreenExit, mdiInformation } from '@mdi/js';

import './sidebar-dialog';

import { clearSidebarOrganizerStorage } from '@utilities/configs/misc';
import { TRANSLATED_LABEL } from '@utilities/localize';
import { showConfirmDialog } from '@utilities/show-dialog-box';
import { SidebarConfigDialogParams } from '@utilities/show-dialog-sidebar-organizer';
import { getStorageConfig } from '@utilities/storage-utils';
import { showToast } from '@utilities/toast-notify';
import { cloneDeep, isEmpty } from 'es-toolkit/compat';
import { CSSResultGroup, LitElement, TemplateResult, css, html, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

import { HA, SidebarConfig } from '../types';
import { HassDialog } from '../types/dialog-manager';
import { fireEvent } from '../utilities/fire_event';
import { SidebarConfigDialog } from './sidebar-dialog';

@customElement('sidebar-organizer-dialog-wa')
export class SidebarOrganizerDialogWA extends LitElement implements HassDialog<SidebarConfigDialogParams> {
  @property({ attribute: false }) public hass!: HA;
  @property({ type: Boolean, reflect: true }) public large = false;
  @state() private _params?: SidebarConfigDialogParams;
  @state() private _initConfig?: SidebarConfig;
  @state() private _open = false;

  @state() _configValid = true;
  @state() _saveDisabled = true;
  @state() _GUImode = true;

  @query('sidebar-organizer-config-dialog') private _configDialog!: SidebarConfigDialog;

  connectedCallback(): void {
    super.connectedCallback();
    window._sidebarOrganizerDialogWA = this;
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
    window._sidebarOrganizerDialogWA = undefined;
  }

  public async showDialog(param: SidebarConfigDialogParams): Promise<void> {
    this._open = true;
    this._params = param;
    this.large = false;
    this._initConfig = cloneDeep(param.config);
  }

  public closeDialog(): boolean {
    if (this._isConfigChanged) {
      // If config is changed and not valid, show confirm dialog
      this._handleClose();
      return false;
    }

    this._open = false;
    this._params = undefined;
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
    return JSON.stringify(this._initConfig) !== JSON.stringify(this._configDialog._sidebarConfig);
  }

  private async _handleClose() {
    const confirmSaveChange = await showConfirmDialog(this, ALERT_MSG.CONFIG_CHANGED, 'SAVE', 'DISCARD');
    if (confirmSaveChange) {
      this._handleSaveConfig();
    } else {
      if (isEmpty(this._initConfig) && getStorageConfig()) {
        // If initial config is empty and there is no config in storage, we clear the config file
        //info
        console.log(
          '%cSIDEBAR-ORGANIZER-DIALOG:%c ℹ️ Init config empty, first setup, but not saving.',
          'color: #40c057;',
          'color: #228be6;'
        );

        clearSidebarOrganizerStorage();
      }
      this._dialogClosed();
    }
    return;
  }

  private _showSuccessToast(): void {
    showToast(this, {
      message: 'Test config saved successfully.',
    });
  }

  private async _handleSaveConfig(): Promise<void> {
    if (!this._canSaveConfig) {
      console.warn('Cannot save config, it is not valid or has unsaved changes.');
      showToast(this, {
        message: 'Cannot save config, it is not valid or has unsaved changes.',
        duration: 5000,
      });
      return;
    } else if (this._configDialog._useConfigFile && this._configValid) {
      // If using config file, we save the config to the file
      await this._configDialog._handleInvalidConfig('save');
      this._showSuccessToast();
      // After saving to storage, _useConfigFile will be set to false by _handleInvalidConfig
      // Continue with the rest of the save logic below
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
      <sidebar-organizer-config-dialog
        ?fullscreen=${this.large}
        .hass=${this.hass}
        ._mainDialog=${this}
        ._initConfig=${this._initConfig}
      ></sidebar-organizer-config-dialog>
    `;
  }

  protected render() {
    if (!this._open) {
      return nothing;
    }
    const isMobile = window.matchMedia('all and (max-width: 450px), all and (max-height: 500px)').matches;
    const BTN_LABEL = TRANSLATED_LABEL.BTN_LABEL;

    const headerContent = html`<span slot="headerTitle" @click=${this._enlarge}>${NAMESPACE_TITLE}</span>
      <ha-icon-button
        slot="headerNavigationIcon"
        @click=${this.closeDialog}
        .label=${this.hass.localize('ui.common.close')}
        .path=${mdiClose}
      ></ha-icon-button>
      ${!isMobile &&
      html`
        <ha-icon-button
          slot="headerActionItems"
          .label=${'Toggle large'}
          .path=${this.large ? mdiFullscreenExit : mdiFullscreen}
          @click=${this._enlarge}
        ></ha-icon-button>
      `}
      <ha-icon-button
        slot="headerActionItems"
        .label=${'Documentation'}
        .path=${mdiInformation}
        @click=${() => window.open(REPO_URL)}
      ></ha-icon-button>`;

    return html`
      <ha-dialog
        .hass=${this.hass}
        .open=${this._open}
        .width=${this.large ? 'full' : 'large'}
        prevent-scrim-close
        @keydown=${this._ignoreKeydown}
        @closed=${this._dialogClosed}
        .headerSubtitle=${VERSION}
        .headerSubtitlePosition=${'below'}
      >
        ${headerContent}
        <div class="content">${this._renderContent()}</div>
        <ha-dialog-footer slot="footer">
          <ha-button
            appearance="plain"
            size="small"
            class="gui-mode-button"
            slot=${SLOT.SECONDARY_ACTION}
            @click=${this._toggleCodeUi}
          >
            ${this._GUImode ? BTN_LABEL.SHOW_CODE_EDITOR : BTN_LABEL.SHOW_VISUAL_EDITOR}
          </ha-button>
          <ha-button appearance="plain" size="small" slot=${SLOT.SECONDARY_ACTION} @click=${this.closeDialog}>
            ${BTN_LABEL.CANCEL}
          </ha-button>

          <ha-button
            appearance="plain"
            size="small"
            slot=${SLOT.PRIMARY_ACTION}
            .label=${BTN_LABEL.SAVE}
            @click=${this._handleSaveConfig}
            .disabled=${this._saveDisabled}
          >
            ${BTN_LABEL.SAVE}
          </ha-button>
        </ha-dialog-footer>
      </ha-dialog>
    `;
  }

  private _toggleCodeUi(): void {
    this._configDialog._toggleCodeEditor();
    this._GUImode = this._configDialog.GUImode;
  }

  private _enlarge() {
    this.large = !this.large;
  }

  private _ignoreKeydown(ev: KeyboardEvent) {
    ev.stopPropagation();
  }

  static get styles(): CSSResultGroup {
    return [
      css`
        ha-dialog {
          --ha-dialog-width-full: 100vw;
          --ha-dialog-scrim-backdrop-filter: blur(4px) brightness(30%);
          --mdc-dialog-max-width: 90vw;
          --mdc-dialog-min-height: 700px;
          --ha-dialog-min-height: 700px;
          /* --mdc-dialog-min-height: calc(90vh - 72px); */
          --ha-dialog-surface-backdrop-filter: blur(2px);
          --dialog-backdrop-filter: blur(2px);
          --dialog-content-padding: 0 1rem;
        }
        ha-dialog[width='full'] {
          --width: var(--full-width);
          --mdc-dialog-min-height: 100vh;
          --mdc-dialog-max-height: 100vh;
          --ha-dialog-min-height: 100vh;
          --ha-dialog-max-height: 100vh;
          --ha-dialog-border-radius: 0;
        }

        @media all and (max-width: 450px), all and (max-height: 500px) {
          ha-dialog {
            height: 100vh;
            --mdc-dialog-max-height: 100vh;
            --dialog-surface-top: 0px;
            --mdc-dialog-max-width: 100vw;
          }
          sidebar-organizer-config-dialog {
            width: 100%;
            max-width: 100%;
          }
        }

        @media all and (max-width: 600px), all and (max-height: 500px) {
          :host([large]) .content {
            max-width: none;
          }
          ha-dialog,
          ha-dialog[large] {
            --mdc-dialog-min-width: 100vw;
            --mdc-dialog-max-width: 100vw;
            --mdc-dialog-min-height: 100vh;
            --mdc-dialog-max-height: 100vh;
            --vertical-align-dialog: flex-end;
            --ha-dialog-border-radius: 0;
          }
          sidebar-organizer-config-dialog {
            width: 100%;
            max-width: none;
          }
        }
        .content {
          width: 100%;
          max-width: 100%;
        }

        @media all and (max-width: 450px), all and (max-height: 500px) {
          /* overrule the ha-style-dialog max-height on small screens */
          .content {
            width: 100%;
            max-width: 100%;
          }
        }

        @media all and (min-width: 451px) and (min-height: 501px) {
          :host([large]) .content {
            max-width: none;
          }
        }
        .gui-mode-button {
          margin-right: auto;
          margin-inline-end: auto;
          margin-inline-start: initial;
        }
        ha-dialog ha-icon-button[slot='headerActionItems'] {
          color: var(--secondary-text-color);
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-organizer-dialog-wa': SidebarOrganizerDialogWA;
  }
  interface HASSDomEvents {
    'save-sidebar-organizer-config': { config: SidebarConfig; useConfigFile: boolean };
  }
  interface Window {
    _sidebarOrganizerDialogWA?: SidebarOrganizerDialogWA;
  }
}
