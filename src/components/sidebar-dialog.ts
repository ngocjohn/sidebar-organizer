import { ALERT_MSG, CONFIG_SECTION, DIALOG_TAG, STORAGE, TAB_STATE } from '@constants';
import { SidebarConfig, NewItemConfig, SidebardPanelConfig, PANEL_TYPE } from '@types';
import {
  fetchFileConfig,
  INVALID_ITEM_KEYS,
  InvalidItemKeys,
  InvalidItemLabels,
  isItemsValid,
  normalizePinnedGroups,
  tryCorrectConfig,
  validateConfig,
} from '@utilities/configs';
import { INVALID_CONFIG } from '@utilities/configs';
import { cleanItemsFromConfig } from '@utilities/configs/clean-items';
import { comparePanelItems } from '@utilities/dashboard';
import { TRANSLATED_LABEL } from '@utilities/localize';
import { getDefaultPanelUrlPath } from '@utilities/panel';
import {
  DialogBoxParams,
  DialogType,
  showAlertDialog,
  showConfirmDialog,
  showDialogBox,
} from '@utilities/show-dialog-box';
import {
  getStorage,
  setStorage,
  getStorageConfig,
  getHiddenPanels,
  sidebarUseConfigFile,
  removeStorage,
} from '@utilities/storage-utils';
import { isEmpty, pick } from 'es-toolkit/compat';
import { html, css, TemplateResult, PropertyValues, CSSResultGroup, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import './editor';
import YAML from 'yaml';

import { BaseEditor } from './base-editor';
import * as ELEMENT from './editor';
import { EditorStore } from './editor-store';
import { SidebarOrganizerDialog } from './sidebar-organizer-dialog';
import { SidebarOrganizerDialogWA } from './sidebar-organizer-dialog_wa';

export interface ConfigChangedEvent {
  config: SidebarConfig;
}

@customElement('sidebar-organizer-config-dialog')
export class SidebarConfigDialog extends BaseEditor {
  @property({ type: Boolean, reflect: true, attribute: 'fullscreen' }) fullscreen: boolean = false;
  @property({ attribute: false }) _mainDialog!: SidebarOrganizerDialog | SidebarOrganizerDialogWA;
  @property({ attribute: false }) readonly _initConfig!: SidebarConfig;

  @state() _connected: boolean = false;
  @state() public _sidebarConfig = {} as SidebarConfig;
  @state() public _useConfigFile = false;

  @state() public _tabState: TAB_STATE = TAB_STATE.BASE;

  @state() private _configLoaded = false;
  @state() public _currSection: CONFIG_SECTION = CONFIG_SECTION.GENERAL;

  @state() public _initPanelOrder: string[] = [];
  @state() public _initCombiPanels: string[] = [];
  @state() public _newItemMap = new Map<string, NewItemConfig>();
  @state() public _newItems: string[] = [];
  @state() private _panelConfigMap = new Map<string, string[]>();
  @state() private _pinnedGroupsMap = new Map<string, { icon?: string }>();
  @state() public _settingItemMoved = false;
  @state() private _uncategorizedItemsGroup: string[] = [];
  @state() public _uncategorizedIsActive?: boolean;

  @state() private _uploading = false;
  @state() _invalidConfig?: INVALID_CONFIG;
  @state() public _narrow = false;

  private _resizeObserver?: ResizeObserver;

  @query(DIALOG_TAG.COLORS) _dialogColors!: ELEMENT.SidebarDialogColors;
  @query(DIALOG_TAG.PANELS) _dialogPanels!: ELEMENT.SidebarDialogPanels;
  @query(DIALOG_TAG.PREVIEW) _dialogPreview!: ELEMENT.SidebarDialogPreview;
  @query(DIALOG_TAG.CODE_EDITOR) _dialogCodeEditor!: ELEMENT.SidebarDialogCodeEditor;
  @query(DIALOG_TAG.NEW_ITEMS) _dialogNewItems!: ELEMENT.SidebarDialogNewItems;
  @query(DIALOG_TAG.MENU) _dialogMenu!: ELEMENT.SidebarDialogMenu;

  @query('#sidebar-config') _configSection!: HTMLElement;

  constructor() {
    super(CONFIG_SECTION.GENERAL);
  }

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
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = undefined;
    }
  }

  public get GUImode(): boolean {
    return this._tabState === TAB_STATE.BASE;
  }

  private async _showDialogBox(type: DialogType, params: DialogBoxParams): Promise<any> {
    return await showDialogBox(this, type, params);
  }

  async _alert(message: string, confirmText?: string): Promise<void> {
    return await this._showDialogBox('alert', {
      text: message,
      confirmText,
    });
  }

  protected willUpdate(_changedProperties: PropertyValues): void {
    if (_changedProperties.has('_connected') && this._connected) {
      //info
      console.log(
        '%cSIDEBAR-DIALOG:%c ℹ️ Sidebar dialog connected, setting up initial config...',
        'color: #40c057;',
        'color: #228be6;'
      );

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
      const isValid = this.isValidConfig;
      this._mainDialog._configValid = isValid;
      this.requestUpdate();
    }

    if (_changedProperties.has('_settingItemMoved')) {
      if (this._settingItemMoved && !this._initCombiPanels.includes('config')) {
        this._initCombiPanels.push('config');
      } else if (!this._settingItemMoved) {
        this._initCombiPanels = this._initCombiPanels.filter((item) => item !== 'config');
        const configInPanel = this._getGroupOfPanel('config') as string | null;
        if (configInPanel !== null) {
          // Removing the config item from the panel it is currently in
          const panelToUpdate = [PANEL_TYPE.BOTTOM_ITEMS, PANEL_TYPE.BOTTOM_GRID_ITEMS].includes(
            configInPanel as PANEL_TYPE
          )
            ? configInPanel
            : PANEL_TYPE.CUSTOM_GROUPS;
          const updatedPanelConfig = this._cleanItemsFromGroups(panelToUpdate as PANEL_TYPE, ['config']);

          this._sidebarConfig = { ...this._sidebarConfig, ...updatedPanelConfig };
        }
      }
    }

    if (_changedProperties.has('_uncategorizedIsActive') && this._uncategorizedIsActive !== undefined) {
      if (this._uncategorizedIsActive) {
        const currentConfig = { ...(this._sidebarConfig || {}) } as SidebarConfig;
        const currentCustomGroups = { ...(currentConfig.custom_groups || {}) };
        const currentItemsInConfig = currentCustomGroups?.[PANEL_TYPE.UNCATEGORIZED_ITEMS] || [];
        const allUngroupedItems = this.uncategorizedItems;

        const isDifferent = JSON.stringify(currentItemsInConfig.sort()) !== JSON.stringify(allUngroupedItems.sort());

        if (isDifferent) {
          const updatedGroupConfigUncategorized = [...allUngroupedItems];
          currentCustomGroups[PANEL_TYPE.UNCATEGORIZED_ITEMS] = updatedGroupConfigUncategorized;
          const updatedConfig = { ...currentConfig, custom_groups: currentCustomGroups };
          console.log(
            'Updated uncategorized items from:',
            currentItemsInConfig,
            'to:',
            updatedGroupConfigUncategorized
          );
          this._sidebarConfig = { ...this._sidebarConfig, ...updatedConfig };
        }
      } else {
        console.log('Uncategorized is not active, removing uncategorized items from config');
      }
    }
    if (_changedProperties.has('_configLoaded') && this._configLoaded === true && !this._resizeObserver) {
      setTimeout(() => {
        this._measureConfigSection();
      }, 100);
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
          this._newItemMap = new Map(newConfig.new_items.map((item: NewItemConfig) => [item.title!, item]));
          //info
          console.log(
            '%cSIDEBAR-DIALOG:%c ℹ️ New items updated:',
            'color: #40c057;',
            'color: #228be6;',
            this._newItemMap
          );
        }

        const pinnedGroupsChanged = JSON.stringify(oldConfig.pinned_groups) !== JSON.stringify(newConfig.pinned_groups);
        if (pinnedGroupsChanged && newConfig.pinned_groups) {
          this._pinnedGroupsMap = new Map(Object.entries(normalizePinnedGroups(newConfig.pinned_groups)));
        }

        this._settingItemMoved = newConfig.move_settings_from_fixed === true;
        // Resetting uncategorizedIsActive to ensure it gets recalculated based on the new config
        this._uncategorizedIsActive = undefined;

        this._uncategorizedIsActive =
          newConfig.uncategorized_items === true ||
          (newConfig.custom_groups &&
            Array.isArray(newConfig.custom_groups[PANEL_TYPE.UNCATEGORIZED_ITEMS]) &&
            newConfig.custom_groups[PANEL_TYPE.UNCATEGORIZED_ITEMS].length > 0)
            ? true
            : false;
        console.log('uncategorizedIsActive:', this._uncategorizedIsActive);
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

      // Update panel config map
      const panelConfig = {
        ...(newConfig.custom_groups || {}),
        bottom_items: newConfig.bottom_items || [],
        bottom_grid_items: newConfig.bottom_grid_items || [],
      };
      this._panelConfigMap = new Map(Object.entries(panelConfig));
      // Check for config changes from initial config

      const hasConfigChanged = JSON.stringify(this._initConfig) !== JSON.stringify(newConfig);

      this._mainDialog._saveDisabled = !hasConfigChanged;
      if (this._store !== undefined) {
        this._store.sidebarConfig = this._sidebarConfig;
      } else {
        this._createStore();
      }
    }
  }

  public _setupInitConfig = async () => {
    this._validateStoragePanels();
    this._validateConfigFile();
  };

  private _measureConfigSection() {
    const configSection = this.shadowRoot?.getElementById('sidebar-config');
    if (!configSection) return;
    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { height, width } = entry.contentRect;
        this._narrow = width < 600;
        const minHeight = 800;
        if (height > minHeight && !this.fullscreen) {
          this._dialogPreview.style.setProperty('--config-section-height', `${Math.round(height)}px`);
        } else {
          this._dialogPreview.style.removeProperty('--config-section-height');
        }
      }
    });
    this._resizeObserver.observe(configSection);
  }

  protected render(): TemplateResult {
    if (!this._configLoaded) {
      return html`
        <div class="loading-content">
          <ha-fade-in .delay=${500}><ha-spinner size="large"></ha-spinner></ha-fade-in>
        </div>
      `;
    }

    this._createStore();

    const mainContent = this._renderMainConfig();
    const sidebarPreview = this._renderSidebarPreview();

    return html` <div id="sidebar-dialog-wrapper" class="dialog-content">${mainContent} ${sidebarPreview}</div> `;
  }

  private _createStore(): void {
    if (this._store) return;
    this._store = new EditorStore(this, this._sidebarConfig);
    console.log('Store created ...', this._store);
  }
  private _renderMainConfig(): TemplateResult {
    if (this._tabState !== TAB_STATE.BASE) {
      return this._renderCodeEditor();
    }

    return html`
      <div id="sidebar-config">
        <div class="dialog-menu">
          <sidebar-dialog-menu
            .hass=${this.hass}
            ._store=${this._store}
            .value=${this._currSection}
            @menu-value-changed=${this._handleMenuValueChanged}
          ></sidebar-dialog-menu>
        </div>
        ${this._renderConfigSection()}
      </div>
    `;
  }

  private _handleMenuValueChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const newValue = ev.detail.value || null;
    const configArea = newValue ? (newValue as CONFIG_SECTION) : CONFIG_SECTION.GENERAL;
    const sectionFrom = this._currSection;
    this._currSection = configArea;
    if (sectionFrom === CONFIG_SECTION.NEW_ITEMS && configArea !== CONFIG_SECTION.NEW_ITEMS) {
      this._dialogPreview._hightlightItem(null);
    }
  }

  private _renderConfigSection(): TemplateResult {
    const selectedArea = this._currSection;
    const areaMap = {
      [CONFIG_SECTION.APPEARANCE]: this._renderBaseConfig(),
      [CONFIG_SECTION.PANELS]: this._renderPanelConfig(),
      [CONFIG_SECTION.NEW_ITEMS]: this._renderNewItemsConfig(),
    };

    return areaMap[selectedArea] || html``;
  }

  private _renderSidebarPreview(): TemplateResult {
    const previewStyles = {
      '--so-force-transparent-background':
        this._sidebarConfig.force_transparent_background === true ? 'transparent' : undefined,
    };
    return html`
      <div id="sidebar-preview" style=${styleMap(previewStyles)}>
        <sidebar-dialog-preview
          .hass=${this.hass}
          ._store=${this._store}
          ._sidebarConfig=${this._sidebarConfig}
          .invalidConfig=${!this.isValidConfig}
          @item-clicked=${this._handleItemClicked}
        ></sidebar-dialog-preview>
      </div>
    `;
  }

  private _renderBaseConfig(): TemplateResult {
    return html` <sidebar-dialog-colors
      .hass=${this.hass}
      ._store=${this._store}
      ._sidebarConfig=${this._sidebarConfig}
      @sidebar-changed=${this._handleSidebarChanged}
    ></sidebar-dialog-colors>`;
  }

  private _renderPanelConfig(): TemplateResult {
    return html` <sidebar-dialog-panels
      .hass=${this.hass}
      ._store=${this._store}
      ._sidebarConfig=${this._sidebarConfig}
      @sidebar-changed=${this._handleSidebarChanged}
    ></sidebar-dialog-panels>`;
  }

  private _renderNewItemsConfig(): TemplateResult {
    return html`
      <sidebar-dialog-new-items
        .hass=${this.hass}
        ._store=${this._store}
        ._sidebarConfig=${this._sidebarConfig}
        @sidebar-changed=${this._handleSidebarChanged}
        @item-clicked=${this._handleItemClicked}
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
                  ._store=${this._store}
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
          ${INVALID_ITEM_KEYS.map((key: InvalidItemKeys) => {
            const items = _invalidConfig[key] as string[] | boolean;
            const hasItems = Array.isArray(items) ? items.length > 0 : Boolean(items);
            const title = InvalidItemLabels[key];
            return hasItems
              ? html`
                  <div>
                    <h2>${title}</h2>
                    <ul>
                      ${Array.isArray(items)
                        ? items.map((item: string) => html`<li>${item}</li>`)
                        : html`<li>True</li>`}
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
          const checkedConfig = await isItemsValid(newConfig, this.hass, true);
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
            this._uploading = false;
            const saveConfirm = await showConfirmDialog(this, ALERT_MSG.UPLOAD_SUCCESS_VALID_RELOAD, 'OK');
            if (!saveConfirm) {
              return;
            }

            this._sidebarConfig = newConfig;
            const resetConfigPromise = () =>
              new Promise<void>((resolve) => {
                setStorage(STORAGE.UI_CONFIG, this._sidebarConfig);
                localStorage.removeItem(STORAGE.PANEL_ORDER);
                localStorage.removeItem(STORAGE.HIDDEN_PANELS);
                resolve();
              });
            await resetConfigPromise();

            window.location.reload();
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

    const hiddenItems = getHiddenPanels();

    const allPanels = this._utils.ARRAY.union(currentPanelOrder, hiddenItems);

    const { added, removed } = await comparePanelItems(this.hass, allPanels);
    if (Boolean(added.length || removed.length)) {
      // If there are changes, persist them first, then update the sidebar items
      console.log('Storage panels have changes compared to current panels:', { added, removed });

      // Merge added panels into stored panel order so they are not re-detected as new
      if (added.length > 0) {
        const updatedOrder = [...currentPanelOrder, ...added];
        setStorage(STORAGE.PANEL_ORDER, updatedOrder);
        console.log('Persisted new panels to panel order:', added);
      }
      // Remove panels that are no longer shown in sidebar
      if (removed.length > 0) {
        const removedSet = new Set(removed);
        const filteredOrder = currentPanelOrder.filter((item: string) => !removedSet.has(item));
        setStorage(STORAGE.PANEL_ORDER, filteredOrder);
        const updatedHidden = [...new Set([...hiddenItems, ...removed])];
        setStorage(STORAGE.HIDDEN_PANELS, updatedHidden);
        console.log('Moved removed panels to hidden:', removed);
      }

      const mesg =
        added.length > 0
          ? `New panels added: ${added.map((panel) => this.hass.panels[panel]?.title || panel).join(', ')}. `
          : '';
      const mesg2 =
        removed.length > 0
          ? `Panels not show in sidebar: ${removed.map((panel) => this.hass.panels[panel]?.title || panel).join(', ')}. `
          : '';
      const alertMesg = `Panels have changed since last configuration: ${mesg}${mesg2}
      Reload sidebar configuration to update panels.`;
      await this._alert(alertMesg, 'Reload page').then(() => {
        this._mainDialog.closeDialog();
        // Reload the page to update the panels
        window.location.reload();
      });
    } else {
      //success
      console.log(
        '%cSIDEBAR-DIALOG:%c ✅ Panel order is up to date.. ',
        'color: #40c057;',
        'color: #40c057; font-weight: 600;'
      );
      this._sidebarConfig = getStorageConfig() || {};
      removeStorage(STORAGE.HIDDEN_PANELS);
      this._updateSidebarItems(currentPanelOrder, hiddenItems);
    }
  };

  private _validateConfigFile = async (): Promise<void> => {
    if (!this._useConfigFile) return;
    const config = await fetchFileConfig();
    if (!config) return;

    const result = (await isItemsValid(config, this.hass, true)) as INVALID_CONFIG;
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
        const result = (await isItemsValid(config, this.hass, true)) as INVALID_CONFIG;
        console.log('Re-checking config validity', result.valid);
        if (typeof result === 'object' && result !== null) {
          this._invalidConfig = result;
          this.requestUpdate();
        }
        break;
      case 'auto-correct':
        console.log('Auto-correcting invalid config');
        const correctedConfig = await tryCorrectConfig(this._invalidConfig.config, this.hass);
        this._invalidConfig = { ...this._invalidConfig, config: correctedConfig };
        this._handleInvalidConfig('check');
        this.requestUpdate();
        break;
      case 'save':
        console.log('Saving config to storage');
        // check again if config is valid
        const isConfigurationValid = (await isItemsValid(this._invalidConfig.config, this.hass)) as boolean;
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

  private _updateSidebarItems = (currentPanelOrder: string[], initHiddenItems: string[]): void => {
    const ARRAY_UTILS = this._utils.ARRAY;
    let configToValidate = { ...(this._sidebarConfig || {}) };
    const defaultPanel = getDefaultPanelUrlPath(this.hass);

    const hiddenItemsToRemove = ARRAY_UTILS.uniq([
      ...initHiddenItems,
      ...(configToValidate.hidden_items || []),
      defaultPanel,
    ]);
    // Clean items from config
    configToValidate = validateConfig(configToValidate, hiddenItemsToRemove);

    const hiddenItems = ARRAY_UTILS.without(configToValidate.hidden_items || [], defaultPanel);

    configToValidate.hidden_items = ARRAY_UTILS.uniq(hiddenItems);
    if (isEmpty(configToValidate.hidden_items)) {
      delete configToValidate.hidden_items;
    }

    const hasConfigChanged = JSON.stringify(this._sidebarConfig) !== JSON.stringify(configToValidate);

    if (hasConfigChanged) {
      //info
      console.log(
        '%cSIDEBAR-DIALOG:%c ℹ️ Config has changed:',
        'color: #40c057;',
        'color: #228be6;',
        { old: this._sidebarConfig },
        { new: configToValidate }
      );

      this._sidebarConfig = configToValidate;
      setStorage(STORAGE.UI_CONFIG, this._sidebarConfig);
    }

    // Filter out defaultPanel and 'lovelace' from the current panel order
    const _sidebarItems = ARRAY_UTILS.uniq(currentPanelOrder);
    //info
    console.log('%cSIDEBAR-DIALOG:%c ℹ️ Initial ', 'color: #40c057;', 'color: #228be6;', { _sidebarItems });

    // Initialize new items
    const configNewItems = this._sidebarConfig?.new_items || [];
    this._newItems = configNewItems.map((item: NewItemConfig) => item.title!);
    // Initialize panel combinations
    this._initCombiPanels = ARRAY_UTILS.union(_sidebarItems, hiddenItems);
    // console.log('Init combi panels:', this._initCombiPanels);

    this._initPanelOrder = [..._sidebarItems];
    this._configLoaded = true;
  };

  public get pickedItems(): string[] {
    return Array.from(this._panelConfigMap.values()).flat();
  }

  public get ungroupedItems(): string[] {
    const defaultPanel = getDefaultPanelUrlPath(this.hass);
    const assignedSet = new Set([...this.pickedItems, ...(this._sidebarConfig?.hidden_items || []), defaultPanel]);
    const ungroupedItems = this._initCombiPanels.filter((item) => !assignedSet.has(item));
    return ungroupedItems;
  }

  public get uncategorizedFromCustom(): string[] | undefined {
    if (
      !this._sidebarConfig[PANEL_TYPE.CUSTOM_GROUPS] ||
      this._sidebarConfig[PANEL_TYPE.CUSTOM_GROUPS].hasOwnProperty(PANEL_TYPE.UNCATEGORIZED_ITEMS)
    ) {
      return undefined;
    }

    return this._sidebarConfig[PANEL_TYPE.CUSTOM_GROUPS][PANEL_TYPE.UNCATEGORIZED_ITEMS];
  }

  public get pickedWithoutUncategorizedFromCustom(): string[] {
    const itemsFromCustom = this._sidebarConfig[PANEL_TYPE.CUSTOM_GROUPS]?.[PANEL_TYPE.UNCATEGORIZED_ITEMS] || [];
    const pickedWithoutUncategorizedFromCustom = Array.from(this._panelConfigMap.values())
      .flat()
      .filter((item) => !itemsFromCustom.includes(item));
    return pickedWithoutUncategorizedFromCustom;
  }

  public get uncategorizedItems(): string[] {
    const defaultPanel = getDefaultPanelUrlPath(this.hass);
    const fromCustom = this.uncategorizedFromCustom || [];
    const pickedWithoutUncategorizedFromCustom = this.pickedWithoutUncategorizedFromCustom;
    const remainingUncategorized = this._initCombiPanels.filter(
      (item) =>
        !pickedWithoutUncategorizedFromCustom.includes(item) &&
        !(this._sidebarConfig.hidden_items || []).includes(item) &&
        item !== defaultPanel
    );
    return Array.from(new Set([...fromCustom, ...remainingUncategorized]));
  }

  public _cleanItemsFromGroups = (groupType: PANEL_TYPE, itemToRemove: string[]): SidebardPanelConfig => {
    const configToClean = pick(this._sidebarConfig, [groupType]) as SidebardPanelConfig;
    return cleanItemsFromConfig(configToClean, itemToRemove);
  };

  public _getGroupOfPanel = (panel: string): string | null => {
    const group = [...this._panelConfigMap.entries()].find(([, items]) => items.includes(panel));
    return group ? group[0] : null;
  };

  private _handleItemClicked(event: CustomEvent) {
    event.stopPropagation();
    const panel = event.detail as string;
    const inGroup = this._getGroupOfPanel(panel);
    if (this._dialogPanels) {
      this._dialogPanels.clickedPanelInPreview(panel, inGroup);
    }
  }

  static get styles(): CSSResultGroup {
    return [
      css`
        :host {
          --side-dialog-gutter: 0.5rem;
          --side-dialog-padding: 1rem;
          --scrollbar-thumb-color: rgba(0, 0, 0, 0.2);
          max-width: 1400px;
          display: flex;
          margin: 0 auto;
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
          height: max-content;
          position: relative;
          width: 100%;
        }
        #sidebar-config *::-webkit-scrollbar {
          width: 0.2em;
          height: 0.2em;
        }
        #sidebar-config *::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
        }
        #sidebar-config * {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
        }
        .dialog-menu {
          position: sticky;
          top: 0;
          z-index: 10;
          background-color: var(--mdc-theme-surface);
        }
        sidebar-dialog-panels {
          display: block;
          position: relative;
          max-height: calc(var(--mdc-dialog-min-height) - 50px);
          width: inherit;
          overflow-y: auto;
        }

        :host([fullscreen]) sidebar-dialog-panels {
          --so-content-fullscreen-max-height: calc(var(--mdc-dialog-min-height) - 128px - 50px);
          max-height: var(--so-content-fullscreen-max-height);
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
          flex: 1 1 0%;
        }
        .tab-item[active] {
          background-color: #9b9b9b10;
        }
        :host([fullscreen]) #sidebar-preview {
          height: calc(var(--mdc-dialog-min-height) - 128px - 7px);
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
          background-color: var(--primary-background-color, var(--clear-background-color, rgba(0, 0, 0, 0.2)));
          --theme-border-color: var(--divider-color, rgba(0, 0, 0, 0.12));
          --drawer-background-color: var(--so-force-transparent-background, var(--mdc-theme-surface));
        }

        .config-content {
          display: flex;
          flex-direction: column;
          gap: var(--side-dialog-gutter);
          min-height: 250px;
          justify-content: space-between;
          flex: 1;
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
  interface HASSDomEvents {
    'sidebar-config-changed': ConfigChangedEvent;
    'config-has-changed': boolean;
  }
  interface HTMLElementEventMap {
    'sidebar-config-changed': ConfigChangedEvent;
  }
}
