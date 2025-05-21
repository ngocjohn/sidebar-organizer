const HELPERS = (window as any).loadCardHelpers ? (window as any).loadCardHelpers() : undefined;

import { html, css, LitElement, TemplateResult, CSSResultGroup, nothing, PropertyValues } from 'lit';
import { customElement, property, query } from 'lit/decorators';
import YAML from 'yaml';
/* eslint-disable */
import { ALERT_MSG, NAMESPACE, STORAGE } from '@constants';
import { removeStorage } from '@utilities/storage-utils';
import { SidebarConfig, HaExtened } from '@types';
import { SidebarConfigDialog } from './sidebar-dialog';
import { showConfirmDialog, showPromptDialog } from '@utilities/show-dialog-box';

@customElement('sidebar-dialog-code-editor')
export class SidebarDialogCodeEditor extends LitElement {
  @property({ attribute: false }) hass!: HaExtened['hass'];

  @property({ attribute: false }) _dialog!: SidebarConfigDialog;
  @property({ attribute: false }) _sidebarConfig: SidebarConfig = {};

  @query('ha-yaml-editor') _yamlEditor!: any;

  protected updated(_changedProperties: PropertyValues): void {
    super.updated(_changedProperties);
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        --code-mirror-max-height: 500px;
      }
      :host *[hidden] {
        display: none;
      }
      .header-row {
        display: inline-flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        --mdc-icon-button-size: 42px;
      }
      .header-row.center {
        justify-content: center;
      }
    `;
  }

  protected render(): TemplateResult {
    const initConfig = this._sidebarConfig;
    const isConfigEmpty = Object.keys(initConfig).length === 0;
    const emptyConfig = html`<ha-alert alertType="info">${ALERT_MSG.CONFIG_EMPTY}</ha-alert>`;

    const editor = html` ${isConfigEmpty ? emptyConfig : nothing}
      <ha-yaml-editor
        .hass=${this.hass}
        .defaultValue=${this._sidebarConfig}
        .copyToClipboard=${true}
        .hasExtraActions=${true}
        .required=${true}
        @value-changed=${this._handleConfigChange}
      >
        <div class="header-row" slot="extra-actions" ?hidden=${isConfigEmpty}>
          <div>
            <ha-button @click=${() => this._handleBtnAction('download')}>Download Config</ha-button>
            <ha-button @click=${() => this._handleBtnAction('copy')}>Copy to Clipboard</ha-button>
          </div>
          <ha-button style="--mdc-theme-primary: var(--error-color);" @click=${() => this._handleBtnAction('delete')}
            >Delete Config</ha-button
          >
        </div>
      </ha-yaml-editor>`;

    return editor;
  }

  private _handleConfigChange(ev: CustomEvent) {
    const { isValid, value } = ev.detail;
    if (isValid) {
      console.log('YAML parsed successfully');
      this._sidebarConfig = value;
      this._dispatchConfig(this._sidebarConfig);
    } else {
      console.error('Failed to parse YAML');
    }
  }

  private _showPrompt = async () => {
    const title = 'Import Configuration';
    const text = 'Paste your configuration below:';

    let helpers;
    if ((window as any).loadCardHelpers) {
      helpers = await (window as any).loadCardHelpers();
    } else if (HELPERS) {
      helpers = HELPERS;
    }

    const result = await helpers.showPromptDialog(this, {
      title,
      text,
      inputLabel: 'Configuration',
      confirmText: 'Import',
      inputType: 'string',
      defaultValue: '',
    });

    if (!result) return;
    const yamlStr = result;

    console.log('Importing Config', yamlStr);
  };

  private _handleBtnAction = async (action: string) => {
    switch (action) {
      case 'download':
        let filename = await showPromptDialog(this, 'Enter the filename', 'sidebar-organizer', 'Download', 'Cancel');
        console.log(filename);
        if (filename === null) {
          return;
        }
        if (filename === '') {
          filename = 'sidebar-organizer';
        }

        const data = YAML.stringify(this._sidebarConfig);

        // Create a blob from the data
        const blob = new Blob([data], { type: 'application/x-yaml' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.yaml`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('Downloading Config');
        break;
      case 'copy':
        navigator.clipboard.writeText(YAML.stringify(this._sidebarConfig)).then(() => {
          console.log('Copied to clipboard');
        });
        break;

      case 'delete':
        const confirmText = 'Delete';
        const confirmDelete = await showConfirmDialog(this, ALERT_MSG.CONFIRM_DELETE, confirmText);
        console.log('Delete Config', confirmDelete);
        if (confirmDelete) {
          [STORAGE.UI_CONFIG, STORAGE.PANEL_ORDER, STORAGE.COLLAPSE, STORAGE.HIDDEN_PANELS].forEach((key) => {
            removeStorage(key);
          });
          setTimeout(() => {
            window.location.reload();
          }, 200);
        }
        break;
      default:
        break;
    }
  };

  private _dispatchConfig(config: SidebarConfig) {
    const event = new CustomEvent('sidebar-changed', { detail: config, bubbles: true, composed: true });
    this.dispatchEvent(event);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-dialog-code-editor': SidebarDialogCodeEditor;
  }
}
