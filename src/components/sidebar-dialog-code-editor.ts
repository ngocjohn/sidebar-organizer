import { html, css, LitElement, TemplateResult, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators';
import YAML from 'yaml';

import { NAMESPACE, STORAGE } from '../const';
import { SidebarConfig, HaExtened } from '../types';
import { removeStorage } from '../utils';
import { SidebarConfigDialog } from './sidebar-dialog';

@customElement('sidebar-dialog-code-editor')
export class SidebarDialogCodeEditor extends LitElement {
  @property({ attribute: false }) hass!: HaExtened['hass'];

  @property({ attribute: false }) _dialog!: SidebarConfigDialog;
  @property({ attribute: false }) _sidebarConfig!: SidebarConfig;

  @state() private _codeErorr = false;

  static get styles(): CSSResultGroup {
    return css`
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

      .json-viewer {
        position: relative;
        border: 0.5px solid var(--divider-color);
        --code-mirror-max-height: 500px;
      }
    `;
  }

  protected render(): TemplateResult {
    const configEmpty = Object.keys(this._sidebarConfig).length === 0;
    const info = `You dont have any configuration yet.`;
    const yamlStr = YAML.stringify(this._sidebarConfig);

    const haCodeEditor = html`<ha-code-editor
      .value=${yamlStr}
      .error=${this._codeErorr}
      @value-changed=${(ev: CustomEvent) => {
        this._handleYamlChange(ev);
      }}
    ></ha-code-editor>`;
    return html`
      <div class="json-viewer">
        ${configEmpty
          ? html`<ha-alert alertType="info">${info}</ha-alert>`
          : html`
              <div class="header-row">
                <ha-button @click=${() => this._handleBtnAction('download')}>Download Config</ha-button>
                <ha-button @click=${() => this._handleBtnAction('copy')}>Copy to Clipboard</ha-button>
              </div>
            `}
        ${haCodeEditor}
        <ha-button
          ?hidden=${configEmpty}
          style="--mdc-theme-primary: var(--error-color); float: inline-end;"
          @click=${() => this._handleBtnAction('delete')}
          >Delete Config</ha-button
        >
      </div>
    `;
  }

  private _handleYamlChange(ev: CustomEvent) {
    ev.stopPropagation();
    const yamlStr = ev.detail.value;

    try {
      // Directly parse YAML into JavaScript object
      const newConfig = YAML.parse(yamlStr);

      // Assign the parsed object to _sidebarConfig
      this._sidebarConfig = newConfig;
      this._codeErorr = false;
      console.log('YAML parsed successfully');
      this._dispatchConfig(this._sidebarConfig);
    } catch (e) {
      this._codeErorr = true;
      console.error('Failed to parse YAML:', e);
    }
  }

  private _handleBtnAction = (action: string) => {
    switch (action) {
      case 'download':
        const data = YAML.stringify(this._sidebarConfig);

        // Create a blob from the data
        const blob = new Blob([data], { type: 'application/x-yaml' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${NAMESPACE}.yaml`;
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
        const confirmDelete = confirm('Are you sure you want to delete the current configuration?');
        if (!confirmDelete) return;
        removeStorage(STORAGE.UI_CONFIG);
        window.location.reload();
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
