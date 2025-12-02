import { ALERT_MSG, CUSTOM_EVENT, STORAGE, TAB_STATE } from '@constants';
import { SidebarConfig, HaExtened, NewItemConfig } from '@types';
import * as ThemeHelper from '@utilities/apply-theme';
import { fetchFileConfig, isItemsValid, tryCorrectConfig } from '@utilities/configs';
import { INVALID_CONFIG } from '@utilities/configs';

import './sidebar-dialog-colors';
import './sidebar-dialog-groups';
import './sidebar-dialog-code-editor';
import './sidebar-dialog-preview';
import './sidebar-organizer-tab';
import './sidebar-dialog-new-items';

import { fetchDashboards } from '@utilities/dashboard';
import { TRANSLATED_LABEL } from '@utilities/localize';
import { getDefaultPanel } from '@utilities/panel';
import { showAlertDialog } from '@utilities/show-dialog-box';
import {
  getStorage,
  setStorage,
  getStorageConfig,
  getHiddenPanels,
  sidebarUseConfigFile,
} from '@utilities/storage-utils';
import { html, css, LitElement, TemplateResult, PropertyValues, CSSResultGroup, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import YAML from 'yaml';

import { SidebarDialogCodeEditor } from './sidebar-dialog-code-editor';
import { SidebarDialogColors } from './sidebar-dialog-colors';
import { SidebarDialogGroups } from './sidebar-dialog-groups';
import { SidebarDialogNewItems } from './sidebar-dialog-new-items';
import { SidebarDialogPreview } from './sidebar-dialog-preview';
import { SidebarOrganizerDialog } from './sidebar-organizer-dialog';

const tabs = ['appearance', 'panels', 'newItems'] as const;

export interface ConfigChangedEvent {
  config: SidebarConfig;
}

declare global {
  interface HASSDomEvents {
    'sidebar-config-changed': ConfigChangedEvent;
  }
  interface HTMLElementEventMap {
    'sidebar-config-changed': ConfigChangedEvent;
  }
}

@customElement('sidebar-organizer-config-dialog')
export class SidebarConfigDialog extends LitElement {
  @property({ attribute: false }) hass!: HaExtened['hass'];
  @property({ attribute: false }) _mainDialog!: SidebarOrganizerDialog;
  @state() _connected: boolean = false;
  @state() public _sidebarConfig = {} as SidebarConfig;
  @state() public _useConfigFile = false;

  @state() public _tabState: TAB_STATE = TAB_STATE.BASE;

  @state() private _configLoaded = false;
  @state() private _currTab: (typeof tabs)[number] = tabs[0];

  @state() public _initPanelOrder: string[] = [];
  @state() public _initCombiPanels: string[] = [];
  @state() public _newItemMap = new Map<string, NewItemConfig>();
  @state() private _newItems: string[] = [];

  @state() private _uploading = false;
  @state() _invalidConfig?: INVALID_CONFIG;

  @query('sidebar-dialog-colors') _dialogColors!: SidebarDialogColors;
  @query('sidebar-dialog-groups') _dialogGroups!: SidebarDialogGroups;
  @query('sidebar-dialog-preview') _dialogPreview!: SidebarDialogPreview;
  @query('sidebar-dialog-code-editor') _dialogCodeEditor!: SidebarDialogCodeEditor;
  @query('sidebar-dialog-new-items') _dialogNewItems!: SidebarDialogNewItems;

  @state() _themeHelper = ThemeHelper;
  connectedCallback(): void {
    super.connectedCallback();
    this._connected = true;
    this._useConfigFile = sidebarUseConfigFile();
    this._tabState = this._useConfigFile === true ? TAB_STATE.CODE : TAB_STATE.BASE;
    this.addEventListener('sidebar-config-changed', this._sidebarConfigChanged as EventListener);
    window.sidebarDialog = this;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._connected = false;
  }

  protected willUpdate(_changedProperties: PropertyValues): void {
    if (_changedProperties.has('_connected') && this._connected) {
      console.log('SidebarConfigDialog connected, setting up initial config');
      this._setupInitConfig();
    }
    if (_changedProperties.has('_useConfigFile')) {
      if (this._useConfigFile) {
        console.log('Use config file changed, validating config file');
        this._validateConfigFile();
      } else if (!this._useConfigFile && this._invalidConfig !== undefined) {
        console.log('Use config file changed to false, resetting invalid config');
        this._invalidConfig = undefined;
        this._validateStoragePanels();
        this._mainDialog._configValid = this.isValidConfig;
        this.requestUpdate();
      }
    }

    if (_changedProperties.has('_invalidConfig') && this._invalidConfig) {
      console.log('Invalid config changed, updating dialog state');
      const isValid = this.isValidConfig;
      this._mainDialog._configValid = isValid;
      this.requestUpdate();
    }
  }
  protected shouldUpdate(_changedProperties: PropertyValues): boolean {
    if (_changedProperties.has('_sidebarConfig') && this._sidebarConfig) {
      return true;
    }
    return true;
  }

  public get isValidConfig(): boolean {
    let isValid = !this._invalidConfig || Object.keys(this._invalidConfig).length === 0;
    if (this._useConfigFile) {
      isValid = this._invalidConfig?.valid !== false;
    }
    return isValid;
  }

  protected updated(_changedProperties: PropertyValues): void {
    if (!this._configLoaded) return;
    if (_changedProperties.has('_sidebarConfig') && this._sidebarConfig) {
      const oldConfig = _changedProperties.get('_sidebarConfig') as SidebarConfig | undefined;
      const newConfig = this._sidebarConfig;
      if (oldConfig !== undefined && newConfig) {
        const newItemsChanged = JSON.stringify(oldConfig.new_items) !== JSON.stringify(newConfig.new_items);

        if (newItemsChanged && newConfig.new_items) {
          console.log('New items changed, updating new item map');
          this._newItemMap = new Map(newConfig.new_items.map((item: NewItemConfig) => [item.title!, item]));
          // console.log('New item map:', this._newItemMap);
          // compare the new items with initCombiPanels if is new added or removed
        }
      }
      const curentNewItems = [...this._newItems];
      // console.log('Current new items:', curentNewItems);

      const _newConfigChanged =
        JSON.stringify(curentNewItems) !== JSON.stringify(newConfig.new_items?.map((item) => item.title!) || []);
      // console.log('New config changed:', _newConfigChanged);

      if (_newConfigChanged) {
        console.log('New config changed, updating new items and init combi panels', newConfig.new_items);
        this._newItems = newConfig.new_items?.map((item) => item.title!) || [];
        console.log('New items updated:', this._newItems);
        this._initCombiPanels = this._initCombiPanels.filter((item) => !curentNewItems.includes(item));
        console.log('Init combi panels:', this._initCombiPanels);
        this._initCombiPanels = [...this._initCombiPanels, ...Array.from(this._newItems)];
        console.log('Init combi panels updated:', this._initCombiPanels);
      }
    }
  }

  public _setupInitConfig = async () => {
    this._validateStoragePanels();
    this._validateConfigFile();
  };

  protected render(): TemplateResult {
    if (!this._configLoaded) {
      return html`
        <div class="loading-content">
          <ha-fade-in .delay=${500}><ha-spinner size="large"></ha-spinner></ha-fade-in>
        </div>
      `;
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
    return html`
      <div id="sidebar-preview">
        <sidebar-dialog-preview
          .invalidConfig=${!this.isValidConfig}
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
        ${this._invalidConfig && Object.keys(this._invalidConfig).length > 0
          ? html``
          : this._uploading
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
    if (!this._invalidConfig || Object.keys(this._invalidConfig).length === 0) {
      return nothing;
    }
    const BTN_LABEL = TRANSLATED_LABEL.BTN_LABEL;
    const _invalidConfig = this._invalidConfig;
    const isConfigValid = this._invalidConfig.valid === true;
    const sections = [
      { title: 'Duplicated:', key: 'duplikatedItems' },
      { title: 'Not exist:', key: 'invalidItems' },
      { title: 'Hidden from sidebar', key: 'noTitleItems' },
    ];
    const extraActionsStyle = `display: flex;  width: auto; justify-content: space-between;`;
    return html`
      <div class="invalid-config" .hidden=${this._useConfigFile} style="--code-mirror-max-height: 250px;">
        <ha-alert alert-type="info">${ALERT_MSG.INFO_EDIT_UPLOAD_CONFIG}</ha-alert>
        <ha-yaml-editor
          .label=${'EDITOR FOR INVALID CONFIG'}
          .hass=${this.hass}
          .defaultValue=${this._invalidConfig.config}
          .hasExtraActions=${true}
          .readOnly=${isConfigValid}
          @value-changed=${(ev: CustomEvent) => {
            ev.stopPropagation();
            const { isValid, value } = ev.detail;
            if (isValid) {
              this._invalidConfig = { ..._invalidConfig, config: value };
              this.requestUpdate();
            }
          }}
        >
          <div slot="extra-actions" style="${extraActionsStyle}">
            <ha-button
              appearance="plain"
              size="small"
              .disabled=${isConfigValid}
              @click=${() => this._handleInvalidConfig('auto-correct')}
              >${BTN_LABEL.AUTO_CORRECT}</ha-button
            >
            <ha-button
              appearance="plain"
              size="small"
              destructive
              .label=${isConfigValid ? BTN_LABEL.SAVE_MIGRATE : BTN_LABEL.CHECK_VALIDITY}
              @click=${() => this._handleInvalidConfig(isConfigValid ? 'save' : 'check')}
              >${isConfigValid ? BTN_LABEL.SAVE_MIGRATE : BTN_LABEL.CHECK_VALIDITY}</ha-button
            >
          </div>
        </ha-yaml-editor>

        <ha-alert alert-type=${!_invalidConfig.valid ? 'warning' : 'success'}
          >${!isConfigValid ? ALERT_MSG.CONFIG_INVALID : ALERT_MSG.CONFIG_VALID}</ha-alert
        >
        <div class="invalid-config-content" ?hidden=${isConfigValid}>
          ${sections.map(({ title, key }) => {
            const items = (this._invalidConfig as any)[key];
            return items?.length
              ? html`
                  <div>
                    <h2>${title}</h2>
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
    const BTN_LABEL = TRANSLATED_LABEL.BTN_LABEL;
    const useJsonFile = this._useConfigFile;

    return html`
      <div class="overlay">
        <ha-alert alert-type="info" .hidden=${!useJsonFile}> ${ALERT_MSG.USE_CONFIG_FILE} </ha-alert>
        ${this._renderInvalidConfig()}

        <div class="header-row">
          <ha-button
            appearance="filled"
            size="small"
            .label=${BTN_LABEL.UPLOAD}
            @click=${() => this._uploadConfigFile()}
            >${BTN_LABEL.UPLOAD}</ha-button
          >
          <ha-formfield label="Use YAML File" style="min-height: 48px;">
            <ha-switch
              .label=${BTN_LABEL.USE_CONFIG_FILE}
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
          const checkedConfig = isItemsValid(newConfig, this.hass, true);
          if (typeof checkedConfig !== 'object' || checkedConfig === null) {
            return;
          }
          if (!checkedConfig.valid) {
            this._invalidConfig = checkedConfig;
            await showAlertDialog(this, ALERT_MSG.INVALID_UPLOADED_CONFIG);
            this._uploading = false;
            this.requestUpdate();
          } else {
            this._invalidConfig = undefined;
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
    if (this._useConfigFile) return;
    const currentPanelOrder = JSON.parse(getStorage(STORAGE.PANEL_ORDER) || '[]');
    if (!currentPanelOrder || currentPanelOrder.length === 0) {
      console.log('no initial panel order found, fetching from storage');
    }

    const hiddenItems = getHiddenPanels();
    const allPanels = [...currentPanelOrder, ...hiddenItems];
    console.log('Current panel order:', currentPanelOrder);
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
    // console.log('Fetched dashboards:', _dasboards);
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
      this._invalidConfig = result;
    }
    this._configLoaded = true;
  };

  private _sidebarConfigChanged(event: CustomEvent<ConfigChangedEvent>) {
    event.stopPropagation();
    const newConfig = event.detail.config as SidebarConfig;
    // Update the sidebar config
    this._sidebarConfig = newConfig;
  }

  public _handleInvalidConfig = async (action: 'check' | 'auto-correct' | 'save') => {
    if (!this._invalidConfig || Object.keys(this._invalidConfig).length === 0) {
      console.warn('No invalid config to handle');
      return;
    }

    switch (action) {
      case 'check':
        const config = this._invalidConfig.config as SidebarConfig;
        const result = isItemsValid(config, this.hass, true);
        console.log('Config validation result:', result);
        if (typeof result === 'object' && result !== null) {
          this._invalidConfig = result;
          this.requestUpdate();
        }
        break;
      case 'auto-correct':
        console.log('Auto-correcting invalid config');
        const correctedConfig = tryCorrectConfig(this._invalidConfig.config, this.hass);
        console.log('Corrected config:', correctedConfig);
        this._invalidConfig = { ...this._invalidConfig, config: correctedConfig };
        this._handleInvalidConfig('check');
        this.requestUpdate();
        break;
      case 'save':
        console.log('Saving config to storage');
        // check again if config is valid
        const isConfigurationValid = isItemsValid(this._invalidConfig.config, this.hass) as boolean;
        if (!isConfigurationValid) {
          await showAlertDialog(this, ALERT_MSG.CONFIG_INVALID);
          return;
        } else {
          console.log('Config is valid, saving to storage');
          this._sidebarConfig = this._invalidConfig.config;
          this._invalidConfig = undefined;
          this._useConfigFile = false;
          this._mainDialog._configValid = true;
          setStorage(STORAGE.USE_CONFIG_FILE, 'false');
          setStorage(STORAGE.UI_CONFIG, this._sidebarConfig);
          this.requestUpdate();
        }
        break;
    }
  };

  private _updateSidebarItems = (currentPanelOrder: string[]) => {
    // let hasChanged: boolean = false;
    const initHiddenItems = getHiddenPanels();
    const defaultPanel = getDefaultPanel(this.hass).url_path || '';

    const customGroup = { ...this._sidebarConfig?.custom_groups };
    const bottomItems = [...(this._sidebarConfig?.bottom_items || [])];
    const defaultCollapsed = [...(this._sidebarConfig?.default_collapsed || [])];
    let hiddenItems = [...(this._sidebarConfig?.hidden_items || [])];

    const hiddenItemsDiff = JSON.stringify(hiddenItems) !== JSON.stringify(initHiddenItems);
    console.log(
      'Initial hidden items:',
      initHiddenItems,
      'Current hidden items:',
      hiddenItems,
      'having diff:',
      hiddenItemsDiff
    );

    // Remove the default panel from any custom group
    Object.keys(customGroup).forEach((key) => {
      customGroup[key] = customGroup[key].filter((item: string) => item !== defaultPanel);
    });

    // Remove collapsed groups that no longer exist in customGroup
    const updatedCollapsedGroups = defaultCollapsed.filter((group) => customGroup[group]);

    // Remove default panel from bottom items
    if (bottomItems.includes(defaultPanel)) {
      bottomItems.splice(bottomItems.indexOf(defaultPanel), 1);
    }

    // If there are any changes (default panel removed from group, hidden items or collapsed groups changed)
    if (hiddenItemsDiff || updatedCollapsedGroups.length !== defaultCollapsed.length) {
      console.log('updateSidebarItems', hiddenItemsDiff, updatedCollapsedGroups.length !== defaultCollapsed.length);

      this._sidebarConfig = {
        ...this._sidebarConfig,
        custom_groups: customGroup,
        default_collapsed: updatedCollapsedGroups,
        hidden_items: hiddenItems,
        bottom_items: bottomItems,
      };
      setStorage(STORAGE.UI_CONFIG, this._sidebarConfig);
    }

    // Filter out defaultPanel and 'lovelace' from the current panel order
    const _sidebarItems = currentPanelOrder.filter((item: string) => item !== defaultPanel && item !== 'lovelace');

    const configNewItems = this._sidebarConfig?.new_items || [];
    this._newItems = configNewItems.map((item: NewItemConfig) => item.title!);
    // Initialize panel combinations
    this._initCombiPanels = [..._sidebarItems, ...initHiddenItems];
    // console.log('Init combi panels:', this._initCombiPanels);

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
    const currentOrder = [...this._initCombiPanels];
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
        .loading-content {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          width: 100%;
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
            min-height: 600px;
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
          max-width: 300px;
          max-height: fit-content;
          overflow: hidden;
          align-content: center;
          /* background-color: rgba(0, 0, 0, 0.2); */
          background-color: var(--clear-background-color, rgba(0, 0, 0, 0.2));
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
          align-items: stretch;
          justify-content: flex-end;
          flex-direction: column;
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
          display: flex;
          width: inherit;
          /* background: var(--clear-background-color); */
          place-items: center;
          flex-direction: column;
          align-items: stretch;
          gap: 1em;
          padding: 0.5em;
        }
        .invalid-config-content {
          display: flex;
          flex-direction: row;
          gap: var(--side-dialog-gutter);
          width: 100%;
          justify-content: space-around;
          background: var(--disabled-color);
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-organizer-config-dialog': SidebarConfigDialog;
  }

  interface Window {
    sidebarDialog: SidebarConfigDialog;
  }
}
