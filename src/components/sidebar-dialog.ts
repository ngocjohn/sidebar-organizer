import { ALERT_MSG, CUSTOM_EVENT, STORAGE, TAB_STATE } from '@constants';
import { SidebarConfig, HaExtened, NewItemConfig } from '@types';
import { fetchFileConfig, isItemsValid } from '@utilities/configs';
import { fetchDashboards } from '@utilities/dashboard';
import { showAlertDialog } from '@utilities/show-dialog-box';
import {
  getStorage,
  setStorage,
  sidebarUseConfigFile,
  getStorageConfig,
  getHiddenPanels,
} from '@utilities/storage-utils';
import { html, css, LitElement, TemplateResult, PropertyValues, CSSResultGroup, nothing } from 'lit';

import './sidebar-dialog-colors';
import './sidebar-dialog-groups';
import './sidebar-dialog-code-editor';
import './sidebar-dialog-preview';
import './sidebar-organizer-tab';
import './sidebar-dialog-new-items';

import { customElement, property, query, state } from 'lit/decorators';
import YAML from 'yaml';

import { SidebarDialogCodeEditor } from './sidebar-dialog-code-editor';
import { SidebarDialogColors } from './sidebar-dialog-colors';
import { SidebarDialogGroups } from './sidebar-dialog-groups';
import { SidebarDialogNewItems } from './sidebar-dialog-new-items';
import { SidebarDialogPreview } from './sidebar-dialog-preview';

const tabs = ['appearance', 'panels', 'newItems'] as const;

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
  @state() public _newItems: string[] = [];
  @state() public _newItemMap = new Map<string, NewItemConfig>();

  @state() private _uploading = false;
  @state() private _invalidConfig: Record<string, string[] | SidebarConfig> = {};

  @query('sidebar-dialog-colors') _dialogColors!: SidebarDialogColors;
  @query('sidebar-dialog-groups') _dialogGroups!: SidebarDialogGroups;
  @query('sidebar-dialog-preview') _dialogPreview!: SidebarDialogPreview;
  @query('sidebar-dialog-code-editor') _dialogCodeEditor!: SidebarDialogCodeEditor;
  @query('sidebar-dialog-new-items') _dialogNewItems!: SidebarDialogNewItems;

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

  protected updated(_changedProperties: PropertyValues): void {
    if (_changedProperties.has('_sidebarConfig') && this._sidebarConfig) {
      const oldConfig = _changedProperties.get('_sidebarConfig') as SidebarConfig | undefined;
      const newConfig = this._sidebarConfig;
      if (oldConfig && newConfig) {
        const newItemsChanged = JSON.stringify(oldConfig.new_items) !== JSON.stringify(newConfig.new_items);
        if (newItemsChanged && newConfig.new_items) {
          console.log('New items changed:', newConfig.new_items);
          this._newItemMap = new Map(newConfig.new_items!.map((item) => [item.title!, item as NewItemConfig]));
          this._newItems = newConfig.new_items!.map((item) => item.title!);
        }
      }
    }
  }

  private _setupInitConfig = async () => {
    this._tabState = this._useConfigFile === true ? TAB_STATE.CODE : TAB_STATE.BASE;
    this._validateStoragePanels();
    this._validateConfigFile();
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
      { key: 'newItems', label: 'New Items', content: this._renderNewItemsConfig() },
    ];

    const activeTabIndex = tabs.indexOf(this._currTab);

    return html`
      <div id="sidebar-config">
        <div id="tabbar">
          ${tabsContent.map(
            (tab) =>
              html`<sidebar-organizer-tab
                .name=${tab.label}
                .active=${this._currTab === tab.key}
                class="tab-item"
                @click=${() => this._changeTab(tab.key)}
              ></sidebar-organizer-tab>`
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
    // if (!this._sidebarConfig || !this._configLoaded) {
    //   return html`<ha-circular-progress .indeterminate=${true} .size=${'medium'}></ha-circular-progress>`;
    // }

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

  private _renderNewItemsConfig(): TemplateResult {
    return html`
      <sidebar-dialog-new-items
        .hass=${this.hass}
        ._dialog=${this}
        ._sidebarConfig=${this._sidebarConfig}
        @sidebar-changed=${this._handleSidebarChanged}
      ></sidebar-dialog-new-items>
    `;
  }

  public _toggleCodeEditor() {
    this._tabState = this._tabState === TAB_STATE.BASE ? TAB_STATE.CODE : TAB_STATE.BASE;
  }

  private _renderCodeEditor(): TemplateResult {
    return html`
      <div class="config-content">
        ${this._uploading
          ? html`<ha-spinner .size=${'large'}></ha-spinner>`
          : html`
              <sidebar-dialog-code-editor
                .hass=${this.hass}
                ._sidebarConfig=${this._sidebarConfig}
                @sidebar-changed=${this._handleSidebarChanged}
              ></sidebar-dialog-code-editor>
            `}
        ${this._renderUseConfigFile()}
      </div>
    `;
  }

  private _renderInvalidConfig(): TemplateResult | typeof nothing {
    if (!this._invalidConfig || Object.keys(this._invalidConfig).length === 0 || !this._useConfigFile) {
      return nothing;
    }

    const sections = [
      { title: 'Duplicated items:', key: 'duplikatedItems' },
      { title: 'Invalid items:', key: 'invalidItems' },
      { title: 'Items not in sidebar', key: 'noTitleItems' },
    ];

    return html`
      <div class="invalid-config" .hidden=${this._useConfigFile} style="--code-mirror-max-height: 250px;">
        <ha-alert alert-type="error">${ALERT_MSG.ITEMS_DIFFERENT}</ha-alert>
        <ha-yaml-editor
          .hass=${this.hass}
          .defaultValue=${this._invalidConfig.config}
          .readOnly=${true}
        ></ha-yaml-editor>
        <div class="invalid-config-content">
          ${sections.map(({ title, key }) => {
            const items = (this._invalidConfig as any)[key];
            return items?.length
              ? html`
                  <div>
                    <p>${title}</p>
                    <ul>
                      ${items.map((item: string) => html`<li>${item}</li>`)}
                    </ul>
                  </div>
                `
              : nothing;
          })}
        </div>
      </div>
    `;
  }
  private _renderUseConfigFile() {
    const useJsonFile = this._useConfigFile;

    return html`
      <div class="overlay" ?expanded=${useJsonFile}>
        <ha-alert alert-type="info" .hidden=${!useJsonFile}> ${ALERT_MSG.USE_CONFIG_FILE} </ha-alert>
        ${this._renderInvalidConfig()}

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
      this._uploading = true;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const content = ev.target?.result as string;
          const newConfig = YAML.parse(content);

          if (!isItemsValid(newConfig, this.hass)) {
            await showAlertDialog(this, ALERT_MSG.ITEMS_DIFFERENT);
            this._uploading = false;
            return;
          } else {
            const resetConfigPromise = () =>
              new Promise<void>((resolve) => {
                localStorage.removeItem(STORAGE.UI_CONFIG);
                localStorage.removeItem(STORAGE.PANEL_ORDER);
                localStorage.removeItem(STORAGE.HIDDEN_PANELS);
                resolve();
              });

            await resetConfigPromise();
            this._sidebarConfig = newConfig;
            this._uploading = false;
          }
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
    const hiddenItems = getHiddenPanels();
    const allPanels = [...currentPanelOrder, ...hiddenItems];
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
    // Check if the current panel order has extra or missing items
    const extraPanels = _dasboards.notInSidebar.filter((panel: string) => allPanels.includes(panel));
    const missingPanels = _dasboards.inSidebar.filter((panel: string) => !allPanels.includes(panel));
    if (extraPanels.length > 0 || missingPanels.length > 0) {
      // If there are changes, update the sidebar items
      console.log('Sidebar panels have changed');
      console.log('Extra panels:', extraPanels);
      console.log('Missing panels:', missingPanels);
      const newEvent = new CustomEvent(CUSTOM_EVENT.CONFIG_DIFF, {
        detail: {
          extraPanels,
          missingPanels,
        },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(newEvent);
      return;
    } else {
      // If there are no changes, update the sidebar items
      console.log('Sidebar panels are up to date');
      this._sidebarConfig = getStorageConfig() || {};
      this._updateSidebarItems(currentPanelOrder);
    }
  };

  private _validateConfigFile = async (): Promise<void> => {
    if (!this._useConfigFile) return;
    const config = await fetchFileConfig();
    if (!config) return;

    const result = isItemsValid(config, this.hass, true);
    console.log('Config file validation result', result);
    if (typeof result === 'object' && result !== null) {
      const { configValid, config, duplikatedItems, invalidItems, noTitleItems } = result;
      if (!configValid) {
        this._invalidConfig = {
          config,
          duplikatedItems,
          invalidItems,
          noTitleItems,
        };
      }
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

  public get pickedItems(): string[] {
    const bottomItems = this._sidebarConfig?.bottom_items || [];
    const customGroups = this._sidebarConfig?.custom_groups || {};
    const pickedItems = [...bottomItems, ...Object.values(customGroups).flat()];
    return pickedItems;
  }

  public get ungroupedItems(): string[] {
    const hiddenItems = this._sidebarConfig?.hidden_items || [];
    const pickedItems = this.pickedItems;
    const currentOrder = [...this._initCombiPanels, ...this._newItems];
    const ungroupedItems = currentOrder.filter((item) => !pickedItems.includes(item) && !hiddenItems.includes(item));
    return ungroupedItems;
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
          overflow: hidden;
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

        .invalid-config {
          display: block;
          width: inherit;
          padding: 1rem;
          background: var(--clear-background-color);
          place-items: center;
        }
        .invalid-config-content {
          display: flex;
          flex-direction: row;
          gap: var(--side-dialog-gutter);
          width: 100%;
          justify-content: space-around;
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-config-dialog': SidebarConfigDialog;
  }

  interface Window {
    sidebarDialog: SidebarConfigDialog;
  }
}
