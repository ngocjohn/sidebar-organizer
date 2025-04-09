import { STORAGE, TAB_STATE } from '@constants';
import { SidebarConfig, HaExtened } from '@types';
import { isItemsValid } from '@utilities/configs';
import { fetchDashboards } from '@utilities/dashboard';
import { showAlertDialog } from '@utilities/show-dialog-box';
import {
  getStorage,
  setStorage,
  sidebarUseConfigFile,
  getStorageConfig,
  getHiddenPanels,
} from '@utilities/storage-utils';
import { html, css, LitElement, TemplateResult, PropertyValues, CSSResultGroup } from 'lit';
import { customElement, property, query, state } from 'lit/decorators';

import './sidebar-dialog-colors';
import './sidebar-dialog-groups';
import './sidebar-dialog-code-editor';
import './sidebar-dialog-preview';

import YAML from 'yaml';

import { SidebarDialogColors } from './sidebar-dialog-colors';
import { SidebarDialogGroups } from './sidebar-dialog-groups';
import { SidebarDialogPreview } from './sidebar-dialog-preview';

const tabs = ['appearance', 'panels'] as const;

@customElement('sidebar-config-dialog')
export class SidebarConfigDialog extends LitElement {
  @property({ attribute: false }) hass!: HaExtened['hass'];
  @property({ attribute: false }) _sideBarRoot!: ShadowRoot;
  @state() public _sidebarConfig = {} as SidebarConfig;

  @state() public _tabState: TAB_STATE = TAB_STATE.BASE;

  @state() private _configLoaded = false;
  @state() private _currTab: (typeof tabs)[number] = tabs[0];

  @state() public _useConfigFile = false;

  @state() public _initPanelOrder: string[] = [];
  @state() public _initCombiPanels: string[] = [];

  @query('sidebar-dialog-colors') _dialogColors!: SidebarDialogColors;
  @query('sidebar-dialog-groups') _dialogGroups!: SidebarDialogGroups;
  @query('sidebar-dialog-preview') _dialogPreview!: SidebarDialogPreview;

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

        #sidebar-dialog-wrapper {
          display: flex;
          flex-direction: row;
          gap: var(--side-dialog-padding);
          justify-content: center;
          position: relative;
          width: 100%;
        }
        @media all and (max-width: 800px), all and (max-height: 500px) {
          #sidebar-dialog-wrapper {
            flex-direction: column;
          }
          #sidebar-preview {
            max-width: none !important;
            width: 100%;
          }
        }
        .dialog-content > * {
          flex-basis: 0;
          flex-grow: 1;
          flex-shrink: 1;
          min-width: 0;
        }

        #sidebar-config {
          display: block;
        }

        #tabbar {
          display: flex;
          font-size: 1rem;
          overflow: hidden;
          text-transform: uppercase;
          margin-bottom: var(--side-dialog-padding);
          align-content: stretch;
          justify-content: space-around;
          align-items: stretch;
          font-weight: 500;
        }
        .tab-item {
          width: 100%;
          flex: 1;
        }
        .tab-item[active] {
          background-color: #9b9b9b10;
        }

        #sidebar-preview {
          position: sticky;
          top: 0px;
          padding: 0px;
          justify-items: center;
          max-width: 260px;
          max-height: fit-content;
        }

        .config-content {
          display: flex;
          flex-direction: column;
          gap: var(--side-dialog-gutter);
          margin-top: 1rem;
          min-height: 250px;
          flex: 1;
          justify-content: space-between;
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

  private _setupInitConfig = async () => {
    this._tabState = this._useConfigFile === true ? TAB_STATE.CODE : TAB_STATE.BASE;
    this._validateStoragePanels();
  };

  protected render(): TemplateResult {
    if (!this._configLoaded) {
      return html`<ha-circular-progress .indeterminate=${true} .size=${'medium'}></ha-circular-progress>`;
    }
    const mainContent = this._renderMainConfig();
    const sidebarPreview = this._renderSidebarPreview();

    return html` <div id="sidebar-dialog-wrapper" class="dialog-content">${mainContent} ${sidebarPreview}</div> `;
  }

  private _renderMainConfig(): TemplateResult {
    if (this._tabState !== TAB_STATE.BASE) {
      return this._renderCodeEditor();
    }
    const tabsContent = [
      { key: 'appearance', label: 'Appearance', content: this._renderBaseConfig() },
      { key: 'panels', label: 'Panels', content: this._renderPanelConfig() },
    ];

    const activeTabIndex = tabs.indexOf(this._currTab);

    return html`
      <div id="sidebar-config">
        <div id="tabbar">
          ${tabsContent.map(
            (tab) =>
              html`<ha-tab
                .name=${tab.label}
                .active=${this._currTab === tab.key}
                class="tab-item"
                @click=${() => this._changeTab(tab.key)}
              ></ha-tab>`
          )}
        </div>
        <div>${tabsContent[activeTabIndex]?.content || html`<p>Error: Invalid tab</p>`}</div>
      </div>
    `;
  }

  private _changeTab(tab: string): void {
    if (this._currTab === tab) return;
    this._currTab = tab as (typeof tabs)[number];
  }

  private _renderSidebarPreview(): TemplateResult {
    if (!this._sidebarConfig || !this._configLoaded) {
      return html`<ha-circular-progress .indeterminate=${true} .size=${'medium'}></ha-circular-progress>`;
    }

    return html`
      <div id="sidebar-preview">
        <sidebar-dialog-preview
          .hass=${this.hass}
          ._dialog=${this}
          ._sidebarConfig=${this._sidebarConfig}
        ></sidebar-dialog-preview>
      </div>
    `;
  }

  public _toggleCodeEditor() {
    this._tabState = this._tabState === TAB_STATE.BASE ? TAB_STATE.CODE : TAB_STATE.BASE;
  }
  private _renderBaseConfig(): TemplateResult {
    return html` <sidebar-dialog-colors
      .hass=${this.hass}
      ._dialog=${this}
      ._sidebarConfig=${this._sidebarConfig}
      @sidebar-changed=${this._handleSidebarChanged}
    ></sidebar-dialog-colors>`;
  }

  private _renderPanelConfig(): TemplateResult {
    return html` <sidebar-dialog-groups
      .hass=${this.hass}
      ._dialog=${this}
      ._sidebarConfig=${this._sidebarConfig}
      @sidebar-changed=${this._handleSidebarChanged}
    ></sidebar-dialog-groups>`;
  }

  private _renderCodeEditor(): TemplateResult {
    return html`
      <div class="config-content">
        <sidebar-dialog-code-editor
          .hass=${this.hass}
          ._sidebarConfig=${this._sidebarConfig}
          @sidebar-changed=${this._handleSidebarChanged}
        ></sidebar-dialog-code-editor>

        ${this._renderUseConfigFile()}
      </div>
    `;
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
      reader.onload = async (ev) => {
        try {
          const content = ev.target?.result as string;
          const newConfig = YAML.parse(content);

          if (!isItemsValid(newConfig, this.hass)) {
            await showAlertDialog(
              this,
              'Items in the config file do not match the current panel order, check the file'
            );
            return;
          }
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

  private _validateStoragePanels = async (): Promise<void> => {
    const currentPanelOrder = JSON.parse(getStorage(STORAGE.PANEL_ORDER) || '[]');
    const _dasboards = await fetchDashboards(this.hass).then((dashboards) => {
      const notInSidebar: string[] = [];
      const inSidebar: string[] = [];
      dashboards.forEach((dashboard) => {
        if (dashboard.show_in_sidebar) {
          inSidebar.push(dashboard.url_path);
        } else {
          notInSidebar.push(dashboard.url_path);
        }
      });
      return { inSidebar, notInSidebar };
    });
    // console.log('currentPanelOrder', currentPanelOrder, '_dasboards', _dasboards);
    // Check if the current panel order has extra or missing items
    const extraPanels = _dasboards.notInSidebar.filter((panel: string) => currentPanelOrder.includes(panel));
    const missingPanels = _dasboards.inSidebar.filter((panel: string) => !currentPanelOrder.includes(panel));

    if (extraPanels.length > 0 || missingPanels.length > 0) {
      // If there are extra or missing items, show an alert dialog
      console.log('Sidebar panels are not up to date, reloading...');
      window.location.reload();
      return;
    } else {
      // If there are no changes, update the sidebar items
      console.log('Sidebar panels are up to date');
      this._sidebarConfig = getStorageConfig() || {};
      this._updateSidebarItems(currentPanelOrder);
    }
  };

  private _updateSidebarItems = (currentPanelOrder: string[]) => {
    const initHiddenItems = getHiddenPanels();
    const defaultPanel = this.hass.defaultPanel;

    const customGroup = { ...this._sidebarConfig?.custom_groups };
    const defaultCollapsed = [...(this._sidebarConfig?.default_collapsed || [])];
    let hiddenItems = [...(this._sidebarConfig?.hidden_items || [])];

    const hiddenItemsDiff = JSON.stringify(hiddenItems) !== JSON.stringify(initHiddenItems);

    // Remove the default panel from any custom group
    Object.keys(customGroup).forEach((key) => {
      customGroup[key] = customGroup[key].filter((item: string) => item !== defaultPanel);
    });

    // Remove collapsed groups that no longer exist in customGroup
    const updatedCollapsedGroups = defaultCollapsed.filter((group) => customGroup[group]);

    // If there are any changes (default panel removed from group, hidden items or collapsed groups changed)
    if (hiddenItemsDiff || updatedCollapsedGroups.length !== defaultCollapsed.length) {
      console.log('updateSidebarItems', hiddenItemsDiff, updatedCollapsedGroups.length !== defaultCollapsed.length);
      this._sidebarConfig = {
        ...this._sidebarConfig,
        custom_groups: customGroup,
        default_collapsed: updatedCollapsedGroups,
        hidden_items: initHiddenItems,
      };
      setStorage(STORAGE.UI_CONFIG, this._sidebarConfig);
    }

    // Filter out defaultPanel and 'lovelace' from the current panel order
    const _sidebarItems = currentPanelOrder.filter((item: string) => item !== defaultPanel && item !== 'lovelace');

    // Initialize panel combinations
    this._initCombiPanels = [..._sidebarItems, ...initHiddenItems];
    this._initPanelOrder = [..._sidebarItems];
    this._configLoaded = true;
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
