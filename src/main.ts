import {
  ALERT_MSG,
  ATTRIBUTE,
  CLASS,
  ELEMENT,
  HA_EVENT,
  NAMESPACE,
  PATH,
  SELECTOR,
  SHOW_AFTER_BOTTOM,
  STORAGE,
} from '@constants';
import {
  DividerColorSettings,
  HaExtened,
  NewItemConfig,
  PanelInfo,
  Panels,
  PartialPanelResolver,
  SidebarConfig,
  SidebarPanelItem,
} from '@types';
import { _getSupportedModes, applyTheme } from '@utilities/apply-theme';
import { computePanels } from '@utilities/compute-panels';
import { fetchConfig } from '@utilities/configs';
import { getCollapsedItems, isBeforeChange } from '@utilities/configs/misc';
import { getDefaultThemeColors, convertCustomStyles } from '@utilities/custom-styles';
import { fetchDashboards, LovelaceDashboard } from '@utilities/dashboard';
import { addAction, getInitPanelOrder, getSiderbarEditDialog, onPanelLoaded } from '@utilities/dom-utils';
import { fetchFrontendUserData, saveFrontendUserData } from '@utilities/frontend';
import { isIcon } from '@utilities/is-icon';
import * as LOGGER from '@utilities/logger';

import './components/sidebar-dialog';

import * as PanelHelper from '@utilities/panel';
import { getDefaultPanel } from '@utilities/panel';
import { showAlertDialog, showConfirmDialog } from '@utilities/show-dialog-box';
import { showDialogSidebarOrganizer } from '@utilities/show-dialog-sidebar-organizer';
import { isStoragePanelEmpty, setStorage, sidebarUseConfigFile } from '@utilities/storage-utils';
import { ACTION_TYPES, addHandlerActions } from '@utilities/tap-action';
import { hasTemplate, subscribeRenderTemplate } from '@utilities/ws-templates';
import { getPromisableResult } from 'get-promisable-result';
import { HAElement, HAQuerySelector, HAQuerySelectorEvent, OnPanelLoadDetail } from 'home-assistant-query-selector';
import { HomeAssistantStylesManager } from 'home-assistant-styles-manager';

import { DIVIDER_ADDED_STYLE } from './sidebar-css';

class SidebarOrganizer {
  constructor() {
    const instance = new HAQuerySelector();

    instance.addEventListener(HAQuerySelectorEvent.ON_LISTEN, async (event) => {
      const { HOME_ASSISTANT, HOME_ASSISTANT_MAIN, HA_DRAWER, HA_SIDEBAR } = event.detail;
      this.ha = (await HOME_ASSISTANT.element) as HaExtened;
      this.main = (await HOME_ASSISTANT_MAIN.selector.$.element) as ShadowRoot;
      this._haMain = HOME_ASSISTANT_MAIN;
      this._haDrawer = await HA_DRAWER.element;
      this.HaSidebar = await HA_SIDEBAR.element;
      this.sideBarRoot = (await HA_SIDEBAR.selector.$.element) as ShadowRoot;
      this.run();
    });

    instance.addEventListener(HAQuerySelectorEvent.ON_LISTEN, (event: CustomEvent<OnPanelLoadDetail>) => {
      this._panelResolver = event.detail.PARTIAL_PANEL_RESOLVER;
      this._sidebar = event.detail.HA_SIDEBAR;
    });

    instance.addEventListener(HAQuerySelectorEvent.ON_PANEL_LOAD, () => {
      this._panelLoaded();
      // this._processSidebar();
    });

    instance.listen();

    this._styleManager = new HomeAssistantStylesManager({
      prefix: NAMESPACE,
      throwWarnings: false,
    });

    window.addEventListener('storage', this._storageListener.bind(this));
    // Listen for HA Events
    [
      HA_EVENT.SETTHEME,
      HA_EVENT.DEFAULT_PANEL,
      HA_EVENT.DIALOG_CLOSED,
      HA_EVENT.LOCATION_CHANGED,
      HA_EVENT.SHOW_DIALOG,
      HA_EVENT.SIDEBAR_CONFIG_SAVED,
      HA_EVENT.HASS_EDIT_SIDEBAR,
    ].forEach((event) => {
      window.addEventListener(event, this._handleHaEvents.bind(this));
    });

    this._currentPath = window.location.pathname;
    this._watchPathChanges();
    this._sidebarItems = [];
    this._initDashboards = [];
  }

  private _blockEditModeChange: boolean = false;
  private _bottomItems: string[] = [];
  private _config: SidebarConfig = {};
  private _currentPath: string;
  private _delayTimeout: number | null = null;
  private _diffCheck: boolean = false;
  private _haDrawer: any;
  private _haMain!: HAElement;
  private _hassPanelsChanged: boolean = false;
  private _initDashboards: LovelaceDashboard[] = [];
  private _notCompatible: boolean = false;
  private _panelResolver!: HAElement;
  private _prevPath: string | null = null;
  private _sidebar!: HAElement;
  private _sidebarItems: SidebarPanelItem[];
  private _styleManager: HomeAssistantStylesManager;
  private _userHasSidebarSettings: boolean = false;
  private collapsedItems = new Set<string>();
  private firstSetUpDone = false;
  private ha?: HaExtened;
  private HaSidebar: any;
  private main!: ShadowRoot;
  private setupConfigDone = false;
  private sideBarRoot!: ShadowRoot;
  public _baseOrder: string[] = [];
  public _hiddenPanels: string[] = [];
  private _panelHelpers = PanelHelper;
  private _baseColorFromTheme: DividerColorSettings = {};

  get hass(): HaExtened['hass'] {
    return this.ha!.hass;
  }

  get darkMode(): boolean {
    const themeConfig = this._config.color_config?.custom_theme;
    const configTheme = themeConfig?.theme || this.hass.themes.theme;
    const forceTheme = themeConfig?.mode;
    const themeSupportedModes = _getSupportedModes(configTheme, this.hass);
    let isDark = this.hass.themes.darkMode;
    if (themeSupportedModes.length) {
      if (forceTheme === 'dark' && themeSupportedModes.includes('dark')) {
        isDark = true;
      } else if (forceTheme === 'light' && themeSupportedModes.includes('light')) {
        isDark = false;
      } else {
        isDark = themeSupportedModes.includes('dark') ? this.hass.themes.darkMode : false;
      }
    } else {
      isDark = this.hass.themes.darkMode;
    }
    return isDark;
  }
  get _darkMode(): boolean {
    const forceTheme = this._config.color_config?.custom_theme?.mode;
    if (forceTheme === 'dark') {
      return true;
    } else if (forceTheme === 'light') {
      return false;
    } else {
      return this.hass.themes.darkMode;
    }
  }

  get _scrollbar(): HTMLElement {
    return this.sideBarRoot?.querySelector(SELECTOR.SIDEBAR_SCROLLBAR) as HTMLElement;
  }

  get _scrollbarItems(): NodeListOf<HTMLElement> {
    return this._scrollbar.querySelectorAll(ELEMENT.ITEM) as NodeListOf<HTMLElement>;
  }

  get _hasSidebarConfig(): boolean {
    const sidebarConfig = localStorage.getItem(STORAGE.UI_CONFIG);
    const useConfigFile = sidebarUseConfigFile();
    return useConfigFile || (sidebarConfig !== null && sidebarConfig !== undefined);
  }

  get customPanels(): Panels {
    const panels = this.hass.panels;
    const customPanels = Object.entries(panels)
      .filter(([, panel]) => panel.component_name === 'custom')
      .reduce((acc, [key, panel]) => {
        acc[key] = panel;
        return acc;
      }, {});
    return customPanels;
  }

  public async run() {
    if (isBeforeChange()) {
      console.warn(ALERT_MSG.NOT_COMPATIBLE, '\n', ALERT_MSG.VERSION_INFO);
      this._notCompatible = true;
      return;
    }
    await this._checkUserSidebarSettings();
    await this._watchEditLegacySidebar();

    this._setupConfigBtn();
    if (!this.firstSetUpDone) {
      await this._getInitDashboards();
      this.firstSetUpDone = true;
    }

    if (this.firstSetUpDone && !this._userHasSidebarSettings) {
      await this._getConfig();
      this._processConfig();
    }

    // this._removeSidebarEditModeProperty();
  }

  private async _watchEditLegacySidebar() {
    if (!this._hasSidebarConfig) return;

    const HaMain = customElements.get('home-assistant-main');
    if (!HaMain) {
      console.warn('home-assistant-main is not yet defined');
      return;
    }
    Object.defineProperty(HaMain.prototype, '_sidebarEditMode', {
      get() {
        return false; // Always return false to block edit mode
      },
      set() {
        // Ignore all global attempts to set sidebar edit mode, log the attempt
        console.log('Blocked attempt to set sidebar edit mode');
      },
      configurable: true,
    });
    console.log('Successfully blocked sidebar edit mode');
    this._blockEditModeChange = true;
  }

  private async _addLegacyEditWarning() {
    console.log('Adding legacy edit sidebar warning');
    const confirmToContinue = await showConfirmDialog(
      this.ha!,
      ALERT_MSG.LEGACY_EDIT_WARNING,
      'Open Sidebar Organizer Dialog'
    );
    if (!confirmToContinue) return;

    return this._addConfigDialog();
  }

  private async _watchEditSidebar() {
    const dialog = await this._waitForSidebarDialog();
    if (!dialog) return;

    dialog._open = false;

    const shouldShowConfirm = !this._userHasSidebarSettings && this._hasSidebarConfig;

    if (shouldShowConfirm) {
      const confirmed = await showConfirmDialog(
        this._haDrawer,
        ALERT_MSG.HAS_SIDEBAR_CONFIG_WARNING,
        'Edit with Sidebar Organizer',
        'Continue'
      );

      if (confirmed) {
        dialog.remove();
        return this._addConfigDialog();
      }

      console.log('User chose to continue with the default sidebar editor');
    } else {
      console.log('User has sidebar settings, adding switch button');
    }

    dialog._open = true;
    this._injectSwitchButton(dialog);
  }

  private async _waitForSidebarDialog(): Promise<any> {
    let dialog = null;
    for (let i = 0; i < 10 && !dialog; i++) {
      dialog = await getSiderbarEditDialog(this.ha!);
      if (!dialog) {
        console.log('Waiting for dialog-edit-sidebar to be available...');
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    return dialog;
  }

  private _injectSwitchButton(dialog: any) {
    setTimeout(() => {
      const switchBtn = this._createHaButton(dialog);
      const actions = dialog.shadowRoot?.querySelector('div[slot="actions"]');
      if (actions) {
        console.log('Actions Element:', actions);
        actions.prepend(switchBtn);
      }
    }, 100);
  }

  private _createHaButton(dialog: any): HTMLElement {
    const button = document.createElement('ha-button');
    button.slot = 'actions';
    button.innerText = 'Switch to Sidebar Organizer';
    button.addEventListener('click', () => {
      console.log('Switching to Sidebar Organizer');
      dialog.closeDialog();
      if (this._userHasSidebarSettings) {
        // If user has sidebar settings, remove legacy data
        this._addDiaglogRemoveLegacyUserData();
        return;
      }
      this._addConfigDialog();
    });
    return button;
  }

  private _watchPathChanges() {
    const callback = () => {
      // Delay the check to allow path to update fully
      if (this._delayTimeout) {
        clearTimeout(this._delayTimeout);
      }

      this._delayTimeout = window.setTimeout(() => {
        const newPath = window.location.pathname;
        if (newPath !== this._currentPath) {
          this._prevPath = this._currentPath;
          this._currentPath = newPath;
          if (
            this._prevPath !== null &&
            this._prevPath === PATH.LOVELACE_DASHBOARD &&
            this._currentPath !== PATH.LOVELACE_DASHBOARD
          ) {
            console.log('Path changed from Dashboard to:', this._currentPath, 'from:', this._prevPath);

            this._checkDashboardChange();
          }
        }
      }, 200); // Delay in ms
    };

    const pushState = history.pushState;
    const replaceState = history.replaceState;

    history.pushState = function (...args) {
      pushState.apply(this, args);
      callback();
    };

    history.replaceState = function (...args) {
      replaceState.apply(this, args);
      callback();
    };

    window.addEventListener('popstate', callback);
  }

  private async _checkDashboardChange(): Promise<void> {
    const baseOrder = this._baseOrder;

    const updatedDashboards = await fetchDashboards(this.hass).then((dashboards) => {
      const notInSidebar = dashboards.filter((dashboard) => !dashboard.show_in_sidebar);
      const inSidebar = dashboards.filter((dashboard) => dashboard.show_in_sidebar);
      return { inSidebar: inSidebar.map((d) => d.url_path), notInSidebar: notInSidebar.map((d) => d.url_path) };
    });

    const itemsLength = updatedDashboards.inSidebar.length + updatedDashboards.notInSidebar.length;
    const initLength = this._initDashboards.length;

    const notShowItems = updatedDashboards.notInSidebar.filter((panel) => baseOrder.includes(panel));
    const addedNewItems = updatedDashboards.inSidebar.filter((panel) => !baseOrder.includes(panel));

    let changed = false;

    if (notShowItems.length > 0) {
      const config = { ...this._config };
      const hiddenToRemove = new Set(notShowItems);
      // Remove invalid items from custom groups, bottom items, and hidden items
      const cleanItems = (items: string[]) => items.filter((item) => !hiddenToRemove.has(item));
      const updatedGroups = Object.fromEntries(
        Object.entries(config.custom_groups || {}).map(([key, items]) => [key, cleanItems(items)])
      );
      const updatedBottomItems = (config.bottom_items || []).filter((item) => !hiddenToRemove.has(item));
      const updatedHiddenItems = (config.hidden_items || []).filter((item) => !hiddenToRemove.has(item));

      // Update config with cleaned items
      const newConfig: SidebarConfig = {
        ...config,
        custom_groups: updatedGroups,
        bottom_items: updatedBottomItems,
        hidden_items: updatedHiddenItems,
      };

      // Update storage with new config
      setStorage(STORAGE.UI_CONFIG, newConfig);
      setStorage(STORAGE.HIDDEN_PANELS, updatedHiddenItems);

      changed = true;
      console.log('Removed Not Show Items:', notShowItems, 'Updated Config:', newConfig);
    } else if (addedNewItems.length > 0 || (itemsLength !== initLength && itemsLength < initLength)) {
      console.log('Added New Items:', addedNewItems);
      changed = true;
    }

    if (changed) {
      // Reload the window to apply changes
      console.log('Changes detected');
      this._reloadWindow();
    } else {
      this._addBottomItems();
    }
  }

  private async _panelLoaded(): Promise<void> {
    if (this._notCompatible) return;
    const panelResolver = (await this._panelResolver.element) as PartialPanelResolver;
    const pathName = panelResolver.route?.path || '';
    const paperListBox = (await this._sidebar.selector.$.query(SELECTOR.SIDEBAR_SCROLLBAR).element) as HTMLElement;
    // console.log('Panel Loaded:', pathName, paperListBox);
    if (pathName && paperListBox) {
      // console.log('Dashboard Page Loaded');
      setTimeout(() => {
        if (this._diffCheck && this.firstSetUpDone && this.setupConfigDone) {
          // console.log('Diff Check and first setup done');
          onPanelLoaded(pathName, paperListBox);
        }
      }, 100);
    }
  }

  private async _checkUserSidebarSettings() {
    const userData = await fetchFrontendUserData(this.hass.connection, 'sidebar');
    this._userHasSidebarSettings = (userData?.panelOrder && userData.panelOrder.length > 0) || false;
    console.log('User has sidebar settings:', this._userHasSidebarSettings);
  }

  private async _setupConfigBtn() {
    let profileEl = this.sideBarRoot?.querySelector(SELECTOR.ITEM_PROFILE) as HTMLElement;
    if (!profileEl) {
      profileEl = this.sideBarRoot?.querySelector(SELECTOR.USER_ITEM) as HTMLElement;
    }
    if (!profileEl) return;
    if (this._userHasSidebarSettings) {
      // console.log('User has sidebar settings, adding remove legacy data action');
      addAction(profileEl, this._addDiaglogRemoveLegacyUserData.bind(this));
      return;
    } else {
      // console.log('User does not have sidebar settings, adding config dialog action');
      addAction(profileEl, this._addConfigDialog.bind(this));
    }
    // Load translations for dialog later
    await this.hass.loadFragmentTranslation('lovelace');
  }

  private async _getInitDashboards(): Promise<void> {
    this._initDashboards = await fetchDashboards(this.hass);
    // console.log('Initial Dashboards:', this._initDashboards);
  }
  private _processConfig(): void {
    if (!this._config || Object.keys(this._config).length === 0) {
      console.log('No config found, skipping processing');
      return;
    }
    this._getElements().then((elements) => {
      const { bottom_items, custom_groups, notification } = this._config;
      const [sidebarItemsContainer, scrollbarItems, spacer] = elements;
      // this.collapsedItems = getCollapsedItems(custom_groups, default_collapsed);
      this._sidebarItems = Array.from(scrollbarItems) as SidebarPanelItem[];

      for (const item of Array.from(scrollbarItems) as SidebarPanelItem[]) {
        const isNewItem = item.hasAttribute('newitem');
        const isConfigOrDevTools = SHOW_AFTER_BOTTOM.includes(item.href);
        if (isNewItem || isConfigOrDevTools) continue; // Skip processing for these items
        item.setAttribute('data-panel', item.href.replace('/', ''));
      }

      if (this._hiddenPanels && this._hiddenPanels.length > 0) {
        this._sidebarItems.forEach((item) => {
          const itemToHide = Array.from(scrollbarItems).filter((el) => {
            return (
              el.getAttribute(ATTRIBUTE.DATA_PANEL) === item.getAttribute(ATTRIBUTE.DATA_PANEL) &&
              this._hiddenPanels.includes(el.getAttribute(ATTRIBUTE.DATA_PANEL) || '')
            );
          });
          if (itemToHide.length > 0) {
            itemToHide.forEach((el) => {
              el.style.display = 'none';
            });
          }
        });
      }
      const initOrder = Array.from(scrollbarItems)
        .filter((item) => !SHOW_AFTER_BOTTOM.includes(item.href))
        .map((item) => item.getAttribute(ATTRIBUTE.DATA_PANEL) || item.href.replace('/', ''));

      const combinedOrder = this._computePanels(initOrder);
      // console.log('Combined Order:', combinedOrder);
      this._baseOrder = combinedOrder;
      setStorage(STORAGE.PANEL_ORDER, combinedOrder);

      // raarnge items based on the combined order, item not found in the combined order will be placed at the end
      const orderedItems = this._sidebarItems.sort((a, b) => {
        const aIndex = combinedOrder.indexOf(a.getAttribute(ATTRIBUTE.DATA_PANEL) || a.href.replace('/', ''));
        const bIndex = combinedOrder.indexOf(b.getAttribute(ATTRIBUTE.DATA_PANEL) || b.href.replace('/', ''));
        return aIndex - bIndex;
      });
      // console.log('Ordered Items:', orderedItems);
      // find config or developer-tools items and move them to the end
      const configOrDevToolsItems = orderedItems.filter((item) => SHOW_AFTER_BOTTOM.includes(item.href));
      if (configOrDevToolsItems.length > 0) {
        // splice them out of the ordered items and push them to the end
        orderedItems.splice(
          orderedItems.findIndex((item) => SHOW_AFTER_BOTTOM.includes(item.href)),
          configOrDevToolsItems.length
        );
        orderedItems.push(...configOrDevToolsItems);
      }

      this._sidebarItems = orderedItems;

      // rearrange the items in the sidebar by their new order

      this._sidebarItems.forEach((item) => {
        const itemToMove = Array.from(scrollbarItems).find(
          (el) => el.getAttribute(ATTRIBUTE.DATA_PANEL) === item.getAttribute(ATTRIBUTE.DATA_PANEL)
        );
        if (itemToMove && SHOW_AFTER_BOTTOM.indexOf(itemToMove.href) === -1) {
          // Move the item to the new position
          sidebarItemsContainer.insertBefore(itemToMove, spacer);
        }
        if (notification && Object.keys(notification).length > 0) {
          // Add notification if exists
          Object.entries(notification).forEach(([key, value]) => {
            if (item.getAttribute(ATTRIBUTE.DATA_PANEL) === key) {
              this._subscribeNotification(item, value);
            }
          });
        }
      });

      // Handle bottom items
      if (bottom_items && bottom_items.length > 0) {
        this._bottomItems = bottom_items;
        this._addBottomItems();
      }

      // Handle custom groups
      if (custom_groups && Object.keys(custom_groups).length > 0) {
        this._handleItemsGroup(custom_groups);
      }

      // Reorder grouped items
      this._reorderGroupedSidebar();

      this._handleSidebarHeader();
      this.setupConfigDone = true;

      this._panelLoaded();
    });
  }

  private async _getElements(): Promise<[HTMLElement, NodeListOf<SidebarPanelItem>, HTMLElement]> {
    const promisableResultOptions = {
      retries: 100,
      delay: 50,
      shouldReject: false,
    };
    const sidebarItemsContainer = (await this._sidebar.selector.$.query(SELECTOR.SIDEBAR_SCROLLBAR)
      .element) as HTMLElement;

    const spacer = await getPromisableResult<HTMLElement>(
      () => {
        const spacer = sidebarItemsContainer.querySelector<HTMLElement>(`:scope ${SELECTOR.SPACER}`);
        if (!spacer) throw new Error('Spacer element not found');
        return spacer;
      },
      (spacer: HTMLElement): boolean => !!spacer,
      promisableResultOptions
    );

    const scrollbarItems = await getPromisableResult<NodeListOf<SidebarPanelItem>>(
      () => sidebarItemsContainer.querySelectorAll<SidebarPanelItem>(ELEMENT.ITEM),
      (elements: NodeListOf<SidebarPanelItem>): boolean => {
        return Array.from(elements).every((el: SidebarPanelItem): boolean => {
          const itemTextElement = el.querySelector<HTMLElement>(SELECTOR.ITEM_TEXT);
          const text = itemTextElement ? itemTextElement.innerText.trim() : '';
          return text.length > 0;
        });
      },
      promisableResultOptions
    );

    return [sidebarItemsContainer, scrollbarItems, spacer];
  }

  private _storageListener(event: StorageEvent) {
    if (event.key === STORAGE.COLLAPSE) {
      const collapsedItems = JSON.parse(event.newValue!);
      this.collapsedItems = new Set(collapsedItems);
      this._handleCollapsed(this.collapsedItems);
    }
  }

  private async _handleHaEvents(event: any) {
    if (this._notCompatible) return;
    event.stopPropagation();
    const { type, detail } = event;
    if (!type || !detail) return;
    switch (type) {
      case HA_EVENT.HASS_EDIT_SIDEBAR:
        console.log('HASS Edit Sidebar Event:', detail);
        if (detail.editMode === true && (!this._hasSidebarConfig || this._blockEditModeChange)) {
          this._addLegacyEditWarning();
        }
        break;

      case HA_EVENT.SETTHEME:
        const themeSetting = detail as HaExtened['hass']['selectedTheme'];
        console.log('Theme Changed', themeSetting);
        this._styleManager.removeStyle(this.sideBarRoot!);
        setTimeout(() => {
          this._addAdditionalStyles(this._config.color_config);
        }, 100);
        break;
      case HA_EVENT.DEFAULT_PANEL:
        this._handleDefaultPanelChange(detail.defaultPanel);
        break;

      case HA_EVENT.SHOW_DIALOG:
        if (detail.dialogTag === ELEMENT.DIALOG_EDIT_SIDEBAR) {
          console.log('Show Dialog Event:', ELEMENT.DIALOG_EDIT_SIDEBAR, detail);
          this._watchEditSidebar();
        }
        break;
      case HA_EVENT.SIDEBAR_CONFIG_SAVED:
        console.log('Sidebar Config Saved Event:', detail);
        this._handleNewConfig(detail.config, detail.useConfigFile);
        break;
    }
  }

  private _addConfigDialog() {
    this._haDrawer.open!! = false;
    this.HaSidebar.editMode = false;
    this._setInitPanelOrder();

    showDialogSidebarOrganizer(this.ha!, { config: this._config });
  }

  private _handleDefaultPanelChange(defaultPanel: string) {
    const inGroup = this._getItemInConfig(defaultPanel);
    if (!inGroup) {
      this._reloadWindow();
      return;
    }
    console.log('Default Panel Changed:', defaultPanel, 'In Group:', inGroup);
    // remove the default panel from any custom group or bottom items
    const update: Partial<SidebarConfig> = {};
    const config = { ...(this._config || {}) };
    if (inGroup === 'bottom_items') {
      const index = config.bottom_items?.indexOf(defaultPanel);
      config.bottom_items?.splice(index!, 1);
      update.bottom_items = config.bottom_items;
    } else if (inGroup === 'hidden_items') {
      // remove from hidden items
      console.log('Removing from hidden items:', defaultPanel);
      const index = config.hidden_items?.indexOf(defaultPanel);
      if (index !== -1) {
        config.hidden_items?.splice(index!, 1);
        update.hidden_items = config.hidden_items;
      }
    } else {
      // remove from custom groups
      console.log('Removing from custom groups:', defaultPanel);
      const customGroups = { ...(config.custom_groups || {}) };
      Object.entries(customGroups).forEach(([group, items]) => {
        const index = items.indexOf(defaultPanel);
        if (index !== -1) {
          items.splice(index, 1);
          customGroups[group] = items;
        }
      });
      update.custom_groups = customGroups;
    }
    // update the config
    this._config = {
      ...this._config,
      ...update,
    };
    setStorage(STORAGE.UI_CONFIG, this._config);
    setStorage(STORAGE.HIDDEN_PANELS, this._config.hidden_items || []);

    this._reloadWindow();
  }

  private async _getConfig() {
    const config = await fetchConfig(this.hass);
    // console.log('Fetched Config:', config);
    if (!config) {
      console.log('No config found, stopping further setup');
      this._setInitPanelOrder();
      return;
    }
    if (config) {
      this._config = config;
      this._setupInitialConfig();
    }
  }

  private _setInitPanelOrder(): void {
    if (isStoragePanelEmpty()) {
      console.log('No initial panel order found, setting default');
      const beforeSpacer = this._getComputedPanelOrder().beforeSpacer;
      const panelOrder = beforeSpacer.map((panel) => panel.url_path);
      setStorage(STORAGE.PANEL_ORDER, panelOrder);
      console.log('Initial Panel Order Set:', panelOrder);
    }
  }

  private _setupInitialConfig() {
    console.log('Setting up initial config');
    const { new_items, default_collapsed, custom_groups, hidden_items, color_config } = this._config;
    this.collapsedItems = getCollapsedItems(custom_groups, default_collapsed);
    this._handleHidden(hidden_items || []);
    this._addNewItems(new_items || []);
    // Add additional styles
    this._addAdditionalStyles(color_config);
  }

  private async _addDiaglogRemoveLegacyUserData() {
    const confirmed = await showConfirmDialog(this._haDrawer, ALERT_MSG.CLEAN_USER_DATA, 'Clear', 'Cancel');
    if (!confirmed) {
      console.log('User data clearing cancelled');
      return;
    }

    try {
      await saveFrontendUserData(this.hass.connection, 'sidebar', {
        panelOrder: [],
        hiddenPanels: [],
      });

      console.log('User data cleared successfully');
      this._checkUserSidebarSettings();

      const initConfirmed = await showConfirmDialog(this._haDrawer, ALERT_MSG.CLEAN_SUCCESS_RELOAD, 'OK', 'Cancel');
      if (initConfirmed) {
        this._hasSidebarConfig ? window.location.reload() : this._getInitPanelOrder();
      } else {
        await showAlertDialog(this._haDrawer, 'User data cleared, but initial panel order not set.');
      }
    } catch (err: any) {
      console.error('Error clearing user data:', err);
      await showAlertDialog(this._haDrawer, `Error clearing user data: ${err.message}`);
    }
  }

  private async _getInitPanelOrder() {
    if (!this.ha) return;
    const sidebarMenu = this.sideBarRoot?.querySelector(SELECTOR.MENU) as HTMLElement;
    if (sidebarMenu) {
      sidebarMenu.dispatchEvent(new CustomEvent('action', { detail: { action: 'hold' } }));
      setTimeout(async () => {
        const initPanelOrder = await getInitPanelOrder(this.ha!);
        console.log('Initial Panel Order:', initPanelOrder);
        setStorage(STORAGE.PANEL_ORDER, initPanelOrder);
        const dialog = this.ha?.shadowRoot?.querySelector('dialog-edit-sidebar');
        dialog?.remove();
        window.location.reload();
      }, 100);
    }
  }

  private _handleSidebarHeader(): void {
    const menuEl = this.sideBarRoot?.querySelector(SELECTOR.MENU) as HTMLElement;
    const titleEl = menuEl.querySelector(SELECTOR.MENU_TITLE) as HTMLElement;
    if (!titleEl) return;
    const customTitle = this._config.header_title;
    if (customTitle && customTitle !== '') {
      titleEl.innerText = customTitle;
    }

    titleEl.classList.add('toggle');
    const hide_header_toggle = this._config.hide_header_toggle || false;
    if (hide_header_toggle) return;
    const groupKeys = Object.keys(this._config?.custom_groups || {});
    if (groupKeys.length === 0 || Object.values(this._config.custom_groups || {}).flat().length === 0) return;
    const isSomeCollapsed = this.collapsedItems.size > 0;

    const collapseEl = document.createElement('ha-icon') as any;
    collapseEl.icon = isSomeCollapsed ? 'mdi:plus' : 'mdi:minus';
    collapseEl.classList.add('collapse-toggle');
    collapseEl.classList.toggle('active', isSomeCollapsed);

    const handleToggle = (ev: Event) => {
      ev.preventDefault();
      this.collapsedItems.size === 0 ? (this.collapsedItems = new Set([...groupKeys])) : this.collapsedItems.clear();
      this._handleCollapsed(this.collapsedItems);
    };

    ['touchstart', 'mousedown'].forEach((eventType) => {
      collapseEl.addEventListener(eventType, handleToggle);
    });

    titleEl.appendChild(collapseEl);
  }

  private _handleHidden(hiddenItems: string[]): void {
    if (!hiddenItems || hiddenItems.length === 0) return;
    this._hiddenPanels = hiddenItems;
  }

  private _addNewItems(newItems: NewItemConfig[]): void {
    if (!newItems || newItems.length === 0) return;
    const scrollbarContainer = this._scrollbar;

    const spacer = scrollbarContainer.querySelector(SELECTOR.SPACER) as HTMLElement;
    Array.from(newItems).map((item) => {
      const newItem = this._createNewItem(item);
      if (newItem) {
        scrollbarContainer.insertBefore(newItem, spacer);
      }
    });
    console.log('New Items Added to Sidebar');
  }

  private _subscribeTemplate(value: string, callback: (result: string) => void): void {
    if (!this.hass || !hasTemplate(value)) {
      console.log('Not a template:', this.hass, value);
      return;
    }

    subscribeRenderTemplate(
      this.hass.connection,
      (result) => {
        callback(result.result);
      },
      {
        template: value,
        variables: {
          config: value,
          user: this.hass.user!.name,
        },
        strict: true,
      }
    );
  }

  private _createDivider = (): HTMLElement => {
    const divider = document.createElement('div') as HTMLElement;
    divider.classList.add('divider');
    return divider;
  };

  private _createDividerWithGroup = (group: string): HTMLElement => {
    const divider = this._createDivider();
    divider.setAttribute('group', group);
    divider.setAttribute('added', '');
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('added-content');
    contentDiv.setAttribute('group', group);
    contentDiv.innerHTML = `<ha-icon icon="mdi:chevron-down"></ha-icon><span>${group.replace(/_/g, ' ')}</span>`;
    divider.appendChild(contentDiv);
    divider.addEventListener('click', this._toggleGroup.bind(this));
    return divider;
  };

  private _addBottomItems(): void {
    if (!this._bottomItems.length) return;

    const scrollbarItems = Array.from(this._scrollbarItems);
    const spacer = this._scrollbar.querySelector(SELECTOR.SPACER) as HTMLElement;

    this._bottomItems.forEach((item, index) => {
      const panel = scrollbarItems.find((el) => el.getAttribute(ATTRIBUTE.DATA_PANEL) === item);
      if (!panel) return;

      panel.setAttribute(ATTRIBUTE.MOVED, '');

      // Insert spacer before first bottom item
      if (index === 0) {
        this._scrollbar.insertBefore(spacer, panel);
      }

      // Always insert panel (even if already in DOM it repositions)
      this._scrollbar.insertBefore(panel, panel.nextSibling);

      // Insert divider after the last bottom item
      if (index === this._bottomItems.length - 1) {
        const divider = this._createDivider();
        divider.setAttribute(ATTRIBUTE.BOTTOM, '');
        this._scrollbar.insertBefore(divider, panel.nextSibling);
      }

      // console.log('Adding Bottom Item:', item, 'Panel:', panel, 'Index:', index);
    });
  }

  private _handleNewConfig(config: SidebarConfig, useConfigFile: boolean) {
    if (useConfigFile) {
      console.log('Using Config File');
      this._reloadWindow();
      return;
    }

    const isChanged = JSON.stringify(config) !== JSON.stringify(this._config);
    if (!isChanged) {
      console.log('No Changes');
      return;
    } else {
      console.log('Changes Detected');
      // remove empty custom group or alert to abort

      setStorage(STORAGE.UI_CONFIG, config);
      setStorage(STORAGE.HIDDEN_PANELS, config.hidden_items);
      this._config = config;

      this._reloadWindow();
      return;
    }
  }

  private _handleCollapsed(collapsedItems: Set<string>) {
    const toggleIcon = this.sideBarRoot!.querySelector(SELECTOR.HEADER_TOGGLE_ICON) as HTMLElement;
    const isCollapsed = collapsedItems.size > 0;

    // Update toggle icon
    toggleIcon?.classList.toggle('active', isCollapsed);
    toggleIcon?.setAttribute('icon', isCollapsed ? 'mdi:plus' : 'mdi:minus');

    const scrollbarItems = Array.from(this._scrollbarItems).filter((item) =>
      item.hasAttribute('group')
    ) as HTMLElement[];

    // Update visibility of collapsed items
    scrollbarItems.forEach((item) => {
      const group = item.getAttribute('group');
      item.classList.toggle(CLASS.COLLAPSED, collapsedItems.has(group!));
      // console.log('Item:', item, 'Group:', group, 'Collapsed:', collapsedItems.has(group!));
    });

    // Update dividers and their content
    this._scrollbar!.querySelectorAll(SELECTOR.DIVIDER).forEach((divider) => {
      const group = divider.getAttribute('group');
      const isGroupCollapsed = collapsedItems.has(group!);
      divider.classList.toggle(CLASS.COLLAPSED, isGroupCollapsed);
      divider.querySelector(SELECTOR.ADDED_CONTENT)?.classList.toggle(CLASS.COLLAPSED, isGroupCollapsed);
      // console.log('Divider:', divider, 'Group:', group, 'Collapsed:', isGroupCollapsed);
    });
  }

  private _addAdditionalStyles(color_config: SidebarConfig['color_config'], mode?: string) {
    mode = mode ? mode : this.darkMode ? 'dark' : 'light';
    const customTheme = color_config?.custom_theme?.theme || undefined;
    console.log('Adding Additional Styles for mode:', mode);
    if (customTheme) {
      applyTheme(this.HaSidebar, this.hass, customTheme, mode);
      console.log('Custom Theme:', customTheme, 'Mode:', mode);
    }
    const colorConfig = color_config?.[mode] || {};
    const borderRadius = color_config?.border_radius ? `${color_config.border_radius}px` : undefined;
    const marginRadius = borderRadius ? '4px 4px' : '1px 4px 0px';

    // Custom Styles
    const customStyles = colorConfig.custom_styles || [];
    const CUSTOM_STYLES = convertCustomStyles(customStyles) || '';

    const defaultColors = getDefaultThemeColors(customTheme !== undefined ? this.HaSidebar : undefined);

    this._baseColorFromTheme = defaultColors;
    // console.log('Default Colors:', defaultColors);
    // console.log('theme', customTheme, 'colorConfig', colorConfig, 'defaultColors', defaultColors);
    const getColor = (key: string): string => {
      const color = colorConfig?.[key] ? `${colorConfig[key]} !important` : this._baseColorFromTheme[key];
      // console.log('Color:', key, color);
      return color;
    };

    const colorCssConfig = {
      '--divider-color': getColor('divider_color'),
      '--divider-bg-color': getColor('background_color'),
      '--divider-border-top-color': getColor('border_top_color'),
      '--scrollbar-thumb-color': getColor('scrollbar_thumb_color'),
      '--sidebar-background-color': getColor('custom_sidebar_background_color'),
      '--divider-border-radius': borderRadius,
      '--divider-margin-radius': marginRadius,
      '--sidebar-text-color': getColor('divider_text_color'),
    };

    const CUSTOM_COLOR_CONFIG = `:host {${Object.entries(colorCssConfig)
      .map(([key, value]) => `${key}: ${value};`)
      .join('')}}`;

    this._styleManager.addStyle(
      [CUSTOM_COLOR_CONFIG, CUSTOM_STYLES, DIVIDER_ADDED_STYLE.toString()],
      this.sideBarRoot!
    );
  }

  private _handleItemsGroup(customGroups: { [key: string]: string[] }) {
    if (!customGroups || Object.keys(customGroups).length === 0) return;
    const collapsedItems = this.collapsedItems || new Set<string>();
    const scrollbarItems = Array.from(this._scrollbarItems) as HTMLElement[];

    // Loop through each group, create a divider with group name and place it before the first item of the group
    Object.entries(customGroups).forEach(([group, panels]) => {
      const isGroupCollapsed = collapsedItems.has(group!);
      // Create a divider for the group
      const divider = this._createDividerWithGroup(group);
      // Find the first item of the group
      const firstItem = scrollbarItems.find((item) => panels.includes(item.getAttribute('data-panel')!));
      if (firstItem) {
        // Insert the divider before the first item of the group
        divider.classList.toggle(CLASS.COLLAPSED, isGroupCollapsed);
        divider.querySelector(SELECTOR.ADDED_CONTENT)?.classList.toggle(CLASS.COLLAPSED, isGroupCollapsed);
        this._scrollbar.insertBefore(divider, firstItem);

        // Set the group attribute on all items of the group
        scrollbarItems
          .filter((item) => panels.includes(item.getAttribute('data-panel')!))
          .forEach((item) => {
            item.setAttribute('group', group);
            item.classList.toggle(CLASS.COLLAPSED, isGroupCollapsed);
          });
      }
    });

    // debugger;
    console.log('Custom Groups Setup Done');
  }

  private _computePanels(currentPanel: string[]) {
    const defaultPanel = getDefaultPanel(this.hass).url_path;
    const bottomMovedItems = this._config.bottom_items || [];
    const customGroups = this._config.custom_groups || {};

    // Get grouped items
    const groupedItems = Object.values(customGroups)
      .flat()
      .filter((item) => currentPanel.includes(item));

    // Filter default items that are not in grouped or bottom items
    const defaultItems = currentPanel.filter(
      (item) => !groupedItems.includes(item) && !bottomMovedItems.includes(item)
    );

    // Move default panel item to the front
    const defaultPanelItem = defaultItems.find((item) => item === defaultPanel);
    if (defaultPanelItem) {
      defaultItems.splice(defaultItems.indexOf(defaultPanelItem), 1);
      groupedItems.unshift(defaultPanelItem);
    }

    // Combine grouped, default, and bottom items
    return [...groupedItems, ...defaultItems, ...bottomMovedItems];
  }

  private _reorderGroupedSidebar() {
    const scrollbarItems = Array.from(this._scrollbarItems) as HTMLElement[];
    const lastGroupedItem = scrollbarItems.find(
      (item) => item.hasAttribute('group') && !item.nextElementSibling?.hasAttribute('group')
    );
    if (lastGroupedItem) {
      const divider = this._createDivider();
      divider.setAttribute('ungrouped', '');
      this._scrollbar.insertBefore(divider, lastGroupedItem.nextSibling);
    }

    // console.log('adding ungrouped divider after last grouped item:', lastGroupedItem);

    // Check differences after a delay
    setTimeout(() => this._checkDiffs(), 100);
  }

  private _checkDiffs = () => {
    console.log('Checking for differences in sidebar configuration...');
    const baseOrder = this._baseOrder;
    const scrollbarItems = Array.from(this._scrollbarItems).slice(0, baseOrder.length) as HTMLElement[];

    const itemsNamed = scrollbarItems.map((item) => item.getAttribute(ATTRIBUTE.DATA_PANEL));
    // console.log('Items Named:', itemsNamed, 'Base Order:', baseOrder);
    const orderDiff = JSON.stringify(baseOrder) !== JSON.stringify(itemsNamed);

    const hasDiff = orderDiff;

    if (hasDiff) {
      this._diffCheck = false;
      const logs = {
        orderDiff: orderDiff,
        baseOrder: baseOrder,
        itemsNamed: itemsNamed,
      };
      console.log('Diff Check:', logs);
      LOGGER.warn('Changes detected:', logs);

      // window.location.reload();

      // this._refreshSidebar();
    } else {
      // this._handleNotification();
      this._diffCheck = true;
      // this._handleCollapsed(this.collapsedItems);
    }
  };

  private _createNewItem(itemConfig: NewItemConfig): SidebarPanelItem {
    const hasAction = ACTION_TYPES.some((action) => itemConfig[action] !== undefined);
    const hasNotification = itemConfig.notification !== undefined;
    const item = document.createElement(ELEMENT.ITEM) as SidebarPanelItem;
    item.setAttribute(ATTRIBUTE.TYPE, 'link');

    item.href = hasAction ? '#' : (itemConfig.url_path ?? '#');
    item.target = itemConfig.target ?? '_self';
    item.setAttribute('data-panel', itemConfig.title!);
    item.setAttribute('has-action', hasAction.toString());
    item.setAttribute('is-new-item', 'true');
    item.setAttribute('newItem', 'true');
    item.tabIndex = -1;

    const span = document.createElement('span');
    span.classList.add('item-text');
    span.setAttribute('slot', 'headline');
    span.innerText = itemConfig.title!;

    item.appendChild(span);

    const haIcon = document.createElement(ELEMENT.HA_ICON) as any;
    haIcon.setAttribute(ATTRIBUTE.SLOT, 'start');
    haIcon.icon = itemConfig.icon!;

    item.prepend(haIcon);
    if (hasAction) {
      addHandlerActions(item, itemConfig);
    }
    if (hasNotification) {
      this._subscribeNotification(item, itemConfig.notification!);
    }
    return item;
  }

  private _subscribeNotification(panel: HTMLElement, value: string) {
    let badge = panel.querySelector(SELECTOR.BADGE);
    let notifyIcon = panel.querySelector(SELECTOR.NOTIFY_ICON);
    const itemText = panel.querySelector(SELECTOR.ITEM_TEXT) as HTMLElement;
    if (!badge || !notifyIcon) {
      badge = document.createElement('span');
      badge.classList.add(CLASS.BADGE);
      badge.setAttribute(ATTRIBUTE.SLOT, 'end');
      notifyIcon = document.createElement('ha-icon');
      notifyIcon.classList.add(CLASS.BADGE);
      notifyIcon.setAttribute(ATTRIBUTE.SLOT, 'end');
      panel.insertBefore(badge, itemText.nextElementSibling);
      panel.insertBefore(notifyIcon, itemText);
    }

    const callback = (resultContent: any) => {
      if (resultContent) {
        // console.log('Notification:', resultContent);
        if (typeof resultContent === 'string' && isIcon(resultContent)) {
          badge.remove();
          notifyIcon.setAttribute('icon', resultContent);
        } else {
          notifyIcon.remove();
          badge.innerHTML = resultContent;
          badge.classList.toggle(CLASS.NO_VISIBLE, false);
          badge.classList.toggle(CLASS.BADGE_NUMBER, !isNaN(resultContent));
          badge.classList.toggle(CLASS.LARGE_BADGE, resultContent.length >= 3);
        }
        panel.setAttribute(ATTRIBUTE.DATA_NOTIFICATION, 'true');
      } else {
        notifyIcon.removeAttribute('icon');
        badge.innerHTML = '';
        badge.classList.toggle(CLASS.NO_VISIBLE, true);
        // panel.removeAttribute(ATTRIBUTE.DATA_NOTIFICATION);
      }
    };
    this._subscribeTemplate(value, callback);
  }

  private _toggleGroup(event: MouseEvent) {
    event.stopPropagation();
    const noAnimation = this._config?.animation_off || false;
    const animationDelay = this._config?.animation_delay || 50;
    const target = event.target as HTMLElement;
    const group = target.getAttribute('group');

    const items = Array.from(this._scrollbarItems).filter((item) => {
      const itemGroup = item.getAttribute('group');
      return itemGroup === group && !item.hasAttribute('moved');
    }) as HTMLElement[];

    if (!items.length) {
      console.error(`No items found for group: ${group}`);
      return;
    }

    const isCollapsed = items[0].classList.contains(CLASS.COLLAPSED);
    this._setItemToLocalStorage(group!, !isCollapsed);

    // Toggle collapsed state for group and its items
    target.classList.toggle(CLASS.COLLAPSED, !isCollapsed);
    target.parentElement?.classList.toggle(CLASS.COLLAPSED, !isCollapsed);

    // Animate items if noAnimation is false
    if (noAnimation) {
      items.forEach((item) => {
        item.classList.toggle(CLASS.COLLAPSED, !isCollapsed);
      });
      return;
    }
    items.forEach((item, index) => {
      const animationClass = isCollapsed ? 'slideIn' : 'slideOut';
      item.style.animationDelay = `${index * animationDelay}ms`;
      item.classList.add(animationClass);
      item.addEventListener(
        'animationend',
        () => {
          item.classList.toggle('collapsed', !isCollapsed);
          item.classList.remove(animationClass);
        },
        { once: true }
      );
    });
  }

  private _setItemToLocalStorage(group: string, collapsed: boolean) {
    if (collapsed) {
      this.collapsedItems.add(group);
    } else {
      this.collapsedItems.delete(group);
    }
    setStorage(STORAGE.COLLAPSE, [...this.collapsedItems]);
  }

  private _getItemInConfig(id: string): string | undefined {
    const { custom_groups = {}, bottom_items = [], hidden_items = [] } = this._config;
    const groupName = Object.keys(custom_groups).find((group) => custom_groups[group].includes(id));
    if (groupName) {
      return groupName;
    } else if (bottom_items.includes(id)) {
      return 'bottom_items';
    } else if (hidden_items.includes(id)) {
      return 'hidden_items';
    }
    return undefined;
  }

  private _getComputedPanelOrder(): { beforeSpacer: PanelInfo[]; afterSpacer: PanelInfo[] } {
    const haSidebar = this.HaSidebar;
    const hass = this.hass;
    const _computePanels = computePanels(
      hass.panels,
      hass.defaultPanel,
      haSidebar._panelOrder,
      haSidebar._hiddenPanels,
      hass.locale
    );
    console.log('Computed Panel Order:', _computePanels);
    return {
      beforeSpacer: _computePanels[0],
      afterSpacer: _computePanels[1],
    };
  }
  private _reloadWindow() {
    console.log('Reloading window...');
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }
}

declare global {
  interface Window {
    SidebarOrganizer: SidebarOrganizer;
  }
}

// Initial Run

if (!window.SidebarOrganizer) {
  window.SidebarOrganizer = new SidebarOrganizer();
}
