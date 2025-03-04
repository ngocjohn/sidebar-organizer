import { html, css, LitElement, TemplateResult, nothing, PropertyValues, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators';
import YAML from 'yaml';

import { STORAGE } from '../const';
import { sidebarUseConfigFile, getStorageConfig, getPreviewItems } from '../helpers';
import { SidebarConfig, HaExtened, PanelInfo } from '../types';
import { getStorage, setStorage } from '../utils';
import './sidebar-dialog-colors';
import './sidebar-dialog-groups';
import './sidebar-dialog-code-editor';

type TAB_STATE = 'base' | 'panelConfig' | 'codeEditor';

@customElement('sidebar-config-dialog')
export class SidebarConfigDialog extends LitElement {
  @property({ attribute: false }) hass!: HaExtened['hass'];
  @property({ attribute: false }) _sideBarRoot!: ShadowRoot;
  @state() public _sidebarConfig = {} as SidebarConfig;

  @state() private _tabState: TAB_STATE = 'base';
  @state() private _configLoaded = false;

  @state() public _useConfigFile = false;

  public _initPanelOrder: string[] = [];
  @state() public _paperListbox: Record<string, PanelInfo[]> = {};

  connectedCallback(): void {
    super.connectedCallback();
    this._useConfigFile = sidebarUseConfigFile();
    this._setupInitConfig();
    window.sidebarDialog = this;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  protected shouldUpdate(_changedProperties: PropertyValues): boolean {
    if (_changedProperties.has('_sidebarConfig') && this._sidebarConfig) {
      return true;
    }
    return true;
  }

  static get styles(): CSSResultGroup {
    return [
      css`
        :host {
          --side-dialog-gutter: 0.5rem;
          --side-dialog-padding: 1rem;
        }

        .config-content {
          display: flex;
          flex-direction: column;
          gap: var(--side-dialog-gutter);
          margin-top: 1rem;
          min-height: 250px;
        }

        .header-row {
          display: inline-flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          --mdc-icon-button-size: 42px;
          gap: var(--side-dialog-gutter);
        }
        .header-row.center {
          justify-content: center;
        }
        .flex {
          flex: 1;
        }

        .overlay {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          /* padding-inline: 0.5rem; */
        }

        .overlay[expanded] {
          display: flex;
          position: absolute;
          width: -webkit-fill-available;
          height: -webkit-fill-available;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 2rem;
          background: var(--card-background-color);
          z-index: 100;
          padding: 1rem;
          top: 0;
          left: 0;
        }
      `,
    ];
  }

  private _setupInitConfig() {
    this._tabState = this._useConfigFile === true ? 'codeEditor' : 'base';
    this._sidebarConfig = getStorageConfig() || {};
    this._paperListbox = getPreviewItems(this.hass, this._sidebarConfig);
    this._updateSidebarItems();
    this._configLoaded = true;
  }

  protected render() {
    const notReady = html`<ha-circular-progress .indeterminate=${true} .size=${'medium'}></ha-circular-progress>`;

    const mainContent = this._renderMainContent();

    return html` <div id="sidebar-config">${!this._configLoaded ? notReady : mainContent}</div>`;
  }

  private _renderMainContent(): TemplateResult {
    const tabsOpts = [
      { value: 'base', label: 'Appearance' },
      { value: 'panelConfig', label: 'Panels' },
      { value: 'codeEditor', label: 'Code' },
    ];

    const baseConfig = this._renderBaseConfig();
    const panelConfig = this._renderPanelConfig();
    const codeEditor = this._renderCodeEditor();

    const tabSelector = html` <ha-control-select
      .value=${this._tabState}
      .options=${tabsOpts}
      .disabled=${this._useConfigFile}
      @value-changed=${(ev: CustomEvent) => {
        this._tabState = ev.detail.value;
      }}
    ></ha-control-select>`;

    const tabContentMap = {
      base: baseConfig,
      panelConfig: panelConfig,
      codeEditor: codeEditor,
    };

    return html` <div class="header-row">${tabSelector}</div>
      <div class="config-content">${tabContentMap[this._tabState]}</div>`;
  }

  private _renderBaseConfig() {
    if (this._tabState !== 'base') return nothing;
    const headerTitle = this._sidebarConfig?.header_title ?? '';
    const headerToggle = this._sidebarConfig?.hide_header_toggle ?? false;
    const headerMenu = html` <div class="header-row">
      <ha-textfield
        class="flex"
        .placeholder=${'Home Assistant'}
        .label=${'Header Title'}
        .value=${headerTitle}
        .configValue=${'header_title'}
        .required=${false}
        @change=${this._handleValueChange}
      ></ha-textfield>
      <ha-formfield label="Hide Header Toggle">
        <ha-switch
          class="flex"
          .label=${'Hide Header Toggle'}
          .checked=${headerToggle}
          .configValue=${'hide_header_toggle'}
          @change=${this._handleValueChange}
        ></ha-switch>
      </ha-formfield>
    </div>`;

    return html` ${headerMenu}
      <sidebar-dialog-colors
        .hass=${this.hass}
        ._dialog=${this}
        ._sidebarConfig=${this._sidebarConfig}
        @sidebar-changed=${this._handleSidebarChanged}
      ></sidebar-dialog-colors>`;
  }

  private _renderPanelConfig() {
    if (this._tabState !== 'panelConfig') return nothing;
    return html` <sidebar-dialog-groups
      .hass=${this.hass}
      ._dialog=${this}
      ._sidebarConfig=${this._sidebarConfig}
      @sidebar-changed=${this._handleSidebarChanged}
    ></sidebar-dialog-groups>`;
  }

  private _renderCodeEditor(): TemplateResult | typeof nothing {
    if (this._tabState !== 'codeEditor') return nothing;
    return html`
      <sidebar-dialog-code-editor
        .hass=${this.hass}
        ._sidebarConfig=${this._sidebarConfig}
        @sidebar-changed=${this._handleSidebarChanged}
      ></sidebar-dialog-code-editor>

      ${this._renderUseConfigFile()}
    `;
  }

  private _handleValueChange(ev: any) {
    ev.stopPropagation();
    const target = ev.target;
    const configValue = target.configValue;
    const value = target.checked !== undefined ? target.checked : target.value;

    console.log('configValue', configValue, 'value', value);
    if (configValue) {
      this._sidebarConfig = {
        ...this._sidebarConfig,
        [configValue]: value,
      };
    }
  }

  private _renderUseConfigFile() {
    const useJsonFile = this._useConfigFile;
    return html`
      <div class="overlay" ?expanded=${useJsonFile}>
        <ha-alert alert-type="info" .hidden=${!useJsonFile}>
          If enabled, the sidebar configuration will be loaded from a Config file and UI configuration will be disabled.
        </ha-alert>
        <div class="header-row">
          <ha-button @click=${() => this._uploadConfigFile()}>Upload Config File</ha-button>
          <ha-formfield label="Use YAML File" style="min-height: 48px;">
            <ha-switch
              .label=${'Use YAML File'}
              .checked=${useJsonFile}
              @change=${(ev: Event) => {
                const checked = (ev.target as HTMLInputElement).checked;
                this._useConfigFile = checked;
                setStorage(STORAGE.USE_CONFIG_FILE, checked.toString());
              }}
            ></ha-switch>
          </ha-formfield>
        </div>
      </div>
    `;
  }

  private _uploadConfigFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml';
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const content = ev.target?.result as string;
          const newConfig = YAML.parse(content);
          this._sidebarConfig = newConfig;
        } catch (e) {
          console.error('Error parsing YAML file', e);
        }
      };
      reader.readAsText(file);
    };
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }

  private _handleSidebarChanged(event: CustomEvent) {
    event.stopPropagation();

    const newConfig = event.detail;
    this._sidebarConfig = newConfig;
  }
  private _updateSidebarItems = () => {
    const currentPanelOrder = getStorage(STORAGE.PANEL_ORDER) || '[]';
    const defaultPanel = this.hass.defaultPanel;

    let defaultInGroup: boolean = false;
    let collapsedGroupNotExists: boolean = false;

    const customGroup = this._sidebarConfig?.custom_groups || {};
    const defaultCollapsed = this._sidebarConfig?.default_collapsed || [];

    Object.keys(customGroup).forEach((key) => {
      const defaultPanelInGroup = customGroup[key].findIndex((item: string) => item === defaultPanel);
      if (defaultPanelInGroup !== -1) {
        defaultInGroup = true;
        customGroup[key].splice(defaultPanelInGroup, 1);
        console.log(customGroup[key]);
      }
    });

    defaultCollapsed.forEach((group) => {
      if (!customGroup[group]) {
        collapsedGroupNotExists = true;
        defaultCollapsed.splice(defaultCollapsed.indexOf(group), 1);
        console.log('collapsed group not exists', group, 'new defaultCollapsed', defaultCollapsed);
      }
    });

    if (defaultInGroup || collapsedGroupNotExists) {
      this._sidebarConfig = {
        ...this._sidebarConfig,
        custom_groups: customGroup,
        default_collapsed: defaultCollapsed,
      };
      console.log('new config', this._sidebarConfig);
      setStorage(STORAGE.UI_CONFIG, this._sidebarConfig);
      this._updateSidebarItems();
    }
    const _sidebarItems = JSON.parse(currentPanelOrder).filter(
      (item: string) => item !== defaultPanel && item !== 'lovelace'
    );

    this._initPanelOrder = _sidebarItems;

    // console.log(this._initPanelOrder);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-config-dialog': SidebarConfigDialog;
  }

  interface Window {
    sidebarDialog: SidebarConfigDialog;
  }
}
