import {
  ALERT_MSG,
  ATTRIBUTE,
  CLASS,
  ELEMENT,
  EVENT,
  HA_EVENT,
  MDI,
  NAMESPACE,
  PATH,
  SELECTOR,
  SHOW_AFTER_BOTTOM,
  STORAGE,
} from '@constants';
import {
  CustomGroups,
  DividerColorSettings,
  HaExtened,
  NewItemConfig,
  PANEL_TYPE,
  PanelInfo,
  Panels,
  PartialPanelResolver,
  Sidebar,
  SidebarConfig,
  SidebardPanelConfig,
  SidebarPanelItem,
} from '@types';
import { _getDarkConfigMode, applyTheme } from '@utilities/apply-theme';
import { computeInitialPanelOrder, getBuiltInPanels } from '@utilities/compute-panels';
import { cleanItemsFromConfig, fetchConfig } from '@utilities/configs';
import { clearSidebarOrganizerStorage, getCollapsedItems, isBeforeChange } from '@utilities/configs/misc';
import { getDefaultThemeColors, convertCustomStyles } from '@utilities/custom-styles';
import { compareDashboardItems, fetchDashboards, LovelaceDashboard } from '@utilities/dashboard';
import { addAction, getSiderbarEditDialog, onPanelLoaded } from '@utilities/dom-utils';
import {
  CoreFrontendUserData,
  fetchFrontendUserData,
  saveFrontendUserData,
  SidebarFrontendUserData,
  subscribeFrontendSystemData,
  subscribeFrontendUserData,
} from '@utilities/frontend';
import { isIcon } from '@utilities/is-icon';
import * as LOGGER from '@utilities/logger';
import * as PANEL_UTILS from '@utilities/panel';
import { getDefaultPanel, getDefaultPanelUrlPath, getPanelTitle, getPanelTitleFromUrlPath } from '@utilities/panel';
import { shallowEqual } from '@utilities/shallow-equal';
import { showAlertDialog, showConfirmDialog } from '@utilities/show-dialog-box';
import { showDialogSidebarOrganizer } from '@utilities/show-dialog-sidebar-organizer';
import { isStoragePanelEmpty, setStorage, sidebarUseConfigFile } from '@utilities/storage-utils';
import { ACTION_TYPES, addHandlerActions } from '@utilities/tap-action';
import { showToast } from '@utilities/toast-notify';
import { hasTemplate, subscribeRenderTemplate } from '@utilities/ws-templates';
import { isEmpty, pick } from 'es-toolkit/compat';
import { getPromisableResult } from 'get-promisable-result';
import { UnsubscribeFunc } from 'home-assistant-js-websocket';
import { HAElement, HAQuerySelector, HAQuerySelectorEvent, OnListenDetail } from 'home-assistant-query-selector';
import { HomeAssistantStylesManager } from 'home-assistant-styles-manager';

import { DIVIDER_ADDED_STYLE } from './sidebar-css';

export class SidebarOrganizer {
  public readonly _debugMode: boolean = false;

  constructor(debug: boolean) {
    this._debugMode = debug;
    const instance = new HAQuerySelector();

    instance.addEventListener(HAQuerySelectorEvent.ON_LISTEN, async (event) => {
      const { HOME_ASSISTANT, HA_DRAWER, HA_SIDEBAR } = event.detail;
      this.ha = (await HOME_ASSISTANT.element) as HaExtened;
      this._haDrawer = await HA_DRAWER.element;
      this.HaSidebar = await HA_SIDEBAR.element;
      this.sideBarRoot = (await HA_SIDEBAR.selector.$.element) as ShadowRoot;
      this.run();
    });

    instance.addEventListener(
      HAQuerySelectorEvent.ON_LISTEN,
      (event: CustomEvent<OnListenDetail>) => {
        this._panelResolver = event.detail.PARTIAL_PANEL_RESOLVER;
        this._sidebar = event.detail.HA_SIDEBAR;
        this._haMain = event.detail.HOME_ASSISTANT_MAIN;
        this._homeAssistant = event.detail.HOME_ASSISTANT;
      },
      { once: true }
    );

    instance.addEventListener(HAQuerySelectorEvent.ON_PANEL_LOAD, () => {
      this._panelLoaded();
      // this._processSidebar();
    });

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
    this._mouseEnterBinded = this._mouseEnter.bind(this);
    this._mouseLeaveBinded = this._mouseLeave.bind(this);
    instance.listen();
  }

  private _homeAssistant!: HAElement;
  private _haMain!: HAElement;
  private ha?: HaExtened;
  private _notCompatible: boolean = false;
  private _blockEditModeChange: boolean = false;
  private _bottomItems: string[] = [];
  private _config: SidebarConfig = {};
  private _currentPath: string;
  private _delayTimeout: number | null = null;
  private _diffCheck: boolean = false;
  private _haDrawer: any;
  private _configPanelMap = new Map<string, string[]>();

  private _initDashboards: LovelaceDashboard[] = [];
  private _initDefaultPanel?: PanelInfo;

  private _panelResolver!: HAElement;
  private _prevPath: string | null = null;
  private _sidebar!: HAElement;
  private _sidebarItems: SidebarPanelItem[];
  private _styleManager: HomeAssistantStylesManager;
  private _userHasSidebarSettings: boolean = false;
  private collapsedItems = new Set<string>();
  private firstSetUpDone = false;

  private HaSidebar: any;
  private setupConfigDone = false;
  private sideBarRoot!: ShadowRoot;
  public _baseOrder: string[] = [];
  public _hiddenPanels: string[] = [];
  private _baseColorFromTheme: DividerColorSettings = {};
  private _panelUtils = PANEL_UTILS;
  private _coreUserData?: FrontendSystemData['core'];
  private _userFrontendData: Record<string, any> = {};
  private _unsubCoreData?: Promise<UnsubscribeFunc>;
  private _mouseEnterBinded: (event: MouseEvent) => void;
  private _mouseLeaveBinded: () => void;
  private _debugLog(
    topic: string,
    metadata?: unknown,
    config?: {
      stringify?: boolean;
      table?: boolean;
    }
  ): void {
    const { stringify = true, table = false } = config ?? {};
    if (this._debugMode) {
      const topicMessage = `${NAMESPACE} debug: ${topic}`;
      if (metadata) {
        console.groupCollapsed(topicMessage);
        if (table) {
          console.table(metadata);
        } else {
          console.log(stringify ? JSON.stringify(metadata, null, 4) : metadata);
        }
        console.groupEnd();
      } else {
        console.log(topicMessage);
      }
    }
  }

  get hass(): HaExtened['hass'] {
    return this.ha!.hass;
  }

  get darkMode(): boolean {
    return _getDarkConfigMode(this._config.color_config, this.hass);
  }

  get _scrollbar(): HTMLElement {
    return this.sideBarRoot?.querySelector(SELECTOR.SIDEBAR_SCROLLBAR) as HTMLElement;
  }

  get _scrollbarItems(): NodeListOf<SidebarPanelItem> {
    return this._scrollbar.querySelectorAll(ELEMENT.ITEM) as NodeListOf<SidebarPanelItem>;
  }

  get _hasSidebarConfig(): boolean {
    const sidebarConfig = localStorage.getItem(STORAGE.UI_CONFIG);
    const useConfigFile = sidebarUseConfigFile();
    return useConfigFile || (sidebarConfig !== null && sidebarConfig !== undefined);
  }

  public async run() {
    if (isBeforeChange()) {
      this._notCompatible = true;
      return;
    }
    await this._checkUserSidebarSettings();
    await this._watchEditLegacySidebar();

    this._setupConfigBtn();
    if (!this.firstSetUpDone) {
      // await this._getInitDashboards();
      await this._getDataDashboards();
      this.firstSetUpDone = true;
    }

    if (this.firstSetUpDone && !this._userHasSidebarSettings) {
      await this._getConfig();
      this._processConfig();
    }
  }

  private _subscribeUserDefaultPanel(): void {
    this._unsubCoreData = subscribeFrontendUserData(this.hass.connection, 'core', ({ value }) => {
      if (value !== null) {
        const defaultPanel = value.default_panel;
        if (defaultPanel && defaultPanel !== this._baseOrder[0]) {
          console.log(
            '%cMAIN:',
            'color: #bada55;',
            'Default Panel Changed to:',
            defaultPanel,
            'from:',
            this._baseOrder[0]
          );
          const newDefaultPanel = getPanelTitleFromUrlPath(this.hass, defaultPanel) || defaultPanel;
          const toastParams = {
            id: 'sidebar-organizer-default-panel-changed',
            message: `${NAMESPACE.toUpperCase()}: Default panel changed to ${newDefaultPanel}. Reload page to apply changes.`,
            action: {
              text: 'Reload',
              action: () => this._handleDefaultPanelChange(defaultPanel),
            },
            duration: -1,
            dismissable: false,
          };
          showToast(this.ha!, toastParams);
        }
      }
    });
  }

  private async _watchEditLegacySidebar(): Promise<void> {
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
    // console.log('Successfully blocked sidebar edit mode');
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
      const actions =
        dialog.shadowRoot?.querySelector(SELECTOR.ACTION_SLOT) ??
        dialog.shadowRoot?.querySelector(SELECTOR.HA_DIALOG_FOOTER).shadowRoot?.querySelector(SELECTOR.FOOTER);
      if (actions && !actions.querySelector('ha-button')) {
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
      dialog.remove();
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
    if (this._userHasSidebarSettings || !this._baseOrder.length) {
      console.log('User has sidebar settings or base order is empty, skipping dashboard change check');
      return;
    }
    let changed = false;

    const initDefaultPanel = this._initDefaultPanel;
    const initDashboards = this._initDashboards;
    const baseOrder = this._baseOrder;

    const newDefaultPanel = getDefaultPanel(this.hass);
    const defaultPanelChanged = !shallowEqual(initDefaultPanel, newDefaultPanel);

    const { currentItems, added, removed } = await compareDashboardItems(this.hass, baseOrder);
    const currentItemsLength = Object.values(currentItems).flat().length;
    const addedOrItemChanged = Boolean(
      added.length > 0 || initDashboards.length !== currentItemsLength || initDashboards.length < currentItemsLength
    );

    if (defaultPanelChanged || removed.length > 0) {
      const itemToRemove = [...removed, initDefaultPanel?.url_path || ''];
      const config = { ...this._config };
      const configToUpdate = pick(config, [
        PANEL_TYPE.CUSTOM,
        PANEL_TYPE.BOTTOM,
        PANEL_TYPE.HIDDEN,
      ]) as SidebardPanelConfig;
      const updatedPanels = cleanItemsFromConfig(configToUpdate, itemToRemove);
      const configHasChanged = !shallowEqual(configToUpdate, updatedPanels);
      if (configHasChanged) {
        const newConfig: SidebarConfig = {
          ...config,
          ...updatedPanels,
        };
        setStorage(STORAGE.UI_CONFIG, newConfig);
        changed = true;
        console.log(
          '%cMAIN:',
          'color: #bada55;',
          'Default Panel Changed or Removed Items:',
          itemToRemove,
          'Updated Config:',
          newConfig
        );
      } else {
        console.log('%cMAIN:', 'color: #bada55;', 'No config changes needed for removed items or default panel');
      }
    } else if (addedOrItemChanged) {
      console.log('%cMAIN:', 'color: #bada55;', 'Added New Items or Items Changed:', added, currentItems);
      changed = true;
    }

    if (changed) {
      // Reload the window to apply changes
      console.log('%cMAIN:', 'color: #bada55;', 'Changes detected, reloading window');
      this._reloadWindow();
    } else {
      this._resetPropsAfterNoChange();
      this._addBottomItems();
    }
  }

  private _resetPropsAfterNoChange(): void {
    this._initDashboards = [];
    this._initDefaultPanel = undefined;
    this._unsubCoreData = undefined;
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
          this._getData(pathName);
        }
      }, 100);
    }
  }

  private async _getData(pathName: string): Promise<void> {
    if (pathName === PATH.LOVELACE_DASHBOARD) {
      this._initDashboards = await fetchDashboards(this.hass);
      this._initDefaultPanel = getDefaultPanel(this.hass);
      let initCoreData: CoreFrontendUserData | undefined;
      this._unsubCoreData = subscribeFrontendSystemData(this.hass.connection, 'core', ({ value }) => {
        console.log('%cMAIN:', 'color: #bada55;', 'Core Frontend System Data Changed:', value);
        if (value !== null) {
          this._coreUserData = value;
          if (!initCoreData) {
            initCoreData = this._coreUserData;
            return;
          }
          if (!shallowEqual(initCoreData, this._coreUserData)) {
            console.log('%cMAIN:', 'color: #bada55;', 'Core Data Changed', {
              initCoreData,
              newCoreData: this._coreUserData,
            });
          }
        }
      });
    }
  }
  private async _checkUserSidebarSettings() {
    const userData = await fetchFrontendUserData(this.hass.connection, 'sidebar');
    this._userHasSidebarSettings = (userData?.panelOrder && userData.panelOrder.length > 0) || false;
    this._subscribeUserDefaultPanel();
  }

  private async _setupConfigBtn(): Promise<void> {
    let profileEl = this.sideBarRoot?.querySelector(SELECTOR.ITEM_PROFILE) as HTMLElement;
    if (!profileEl) {
      profileEl = this.sideBarRoot?.querySelector(SELECTOR.USER_ITEM) as HTMLElement;
    }
    if (!profileEl) return;
    if (this._userHasSidebarSettings) {
      console.log('User has sidebar settings, adding remove legacy data action');
      addAction(profileEl, this._addDiaglogRemoveLegacyUserData.bind(this));
      return;
    } else {
      // console.log('User does not have sidebar settings, adding config dialog action');
      addAction(profileEl, this._addConfigDialog.bind(this));
    }
    // Load translations for dialog later
    await this.hass.loadFragmentTranslation('lovelace');
  }

  private async _getDataDashboards(): Promise<void> {
    // this._initDashboards = await fetchDashboards(this.hass);
    // console.log('Initial Dashboards:', this._initDashboards);
    // this._builInPanels = await this._getAutoGeneratedPanels();
    const defaultPanel = getDefaultPanelUrlPath(this.hass);
    await getBuiltInPanels(this.hass.panels, defaultPanel).then((panels) => {
      this._addBuiltInPanelsToSidebar(panels);
    });
  }

  private _processConfig(): void {
    if (!this._config || Object.keys(this._config).length === 0) {
      console.log('No config found, skipping processing');
      return;
    }
    this._getElements().then((elements) => {
      const notificationMap = new Map(Object.entries(this._config.notification || {}));
      const [sidebarItemsContainer, scrollbarItems, spacer] = elements;
      this._sidebarItems = Array.from(scrollbarItems) as SidebarPanelItem[];

      for (const item of Array.from(scrollbarItems) as SidebarPanelItem[]) {
        const isNewItem = item.hasAttribute('newitem');
        const isConfigOrDevTools = SHOW_AFTER_BOTTOM.includes(item.href);
        if (isNewItem || isConfigOrDevTools) continue; // Skip processing for these items
        item.setAttribute('data-panel', item.href.replace('/', ''));
      }

      if (this._hiddenPanels && this._hiddenPanels.length > 0) {
        this._hiddenPanels.forEach((panelId) => {
          const itemToHide = Array.from(scrollbarItems).find((el) => {
            return el.getAttribute(ATTRIBUTE.DATA_PANEL) === panelId;
          });
          if (itemToHide) {
            itemToHide.style.display = 'none';
          }
        });
        console.log('%cMAIN:', 'color: #bada55;', 'Hidden Panels Applied:', this._hiddenPanels);
      }

      const initOrder = Array.from(scrollbarItems)
        .filter((item) => !SHOW_AFTER_BOTTOM.includes(item.href))
        .map((item) => item.getAttribute(ATTRIBUTE.DATA_PANEL) || item.href.replace('/', ''));

      const combinedOrder = this._computePanels(initOrder);
      this._baseOrder = combinedOrder;
      setStorage(STORAGE.PANEL_ORDER, [...this._baseOrder]);
      // console.log('%cMAIN:', 'color: #bada55;', 'Computed Combined Panel Order:', combinedOrder);

      // raarnge items based on the combined order, item not found in the combined order will be placed at the end
      const orderedItems = this._sidebarItems.sort((a, b) => {
        const aIndex = combinedOrder.indexOf(a.getAttribute(ATTRIBUTE.DATA_PANEL) || a.href.replace('/', ''));
        const bIndex = combinedOrder.indexOf(b.getAttribute(ATTRIBUTE.DATA_PANEL) || b.href.replace('/', ''));
        return aIndex - bIndex;
      });

      this._sidebarItems = orderedItems;

      // rearrange the items in the sidebar by their new order
      this._sidebarItems.forEach((item) => {
        const itemPanelId = item.getAttribute(ATTRIBUTE.DATA_PANEL) || '';
        const itemsGroup = this._getGroupOfPanel(itemPanelId);
        const itemsNotificationValue = notificationMap.get(itemPanelId);
        const itemToMove = Array.from(scrollbarItems).find(
          (el) => el.getAttribute(ATTRIBUTE.DATA_PANEL) === item.getAttribute(ATTRIBUTE.DATA_PANEL)
        );

        if (itemToMove && SHOW_AFTER_BOTTOM.indexOf(itemToMove.href) === -1) {
          // Move the item to the new position
          sidebarItemsContainer.insertBefore(itemToMove, spacer);
        }
        if (itemsNotificationValue !== undefined) {
          this._subscribeNotification(item, itemsNotificationValue);
        }
        // Handle custom groups

        if (itemsGroup && itemsGroup !== 'bottom_items') {
          const isCollapsed = this.collapsedItems.has(itemsGroup);
          const isFirstInGroup = this._configPanelMap.get(itemsGroup)?.[0] === itemPanelId;

          item.setAttribute(ATTRIBUTE.GROUP, itemsGroup);
          item.classList.toggle(CLASS.COLLAPSED, isCollapsed);
          if (isFirstInGroup) {
            // Handle collapsed state toggle
            const groupDivider = this._createDividerWithGroup(itemsGroup, isCollapsed);
            sidebarItemsContainer.insertBefore(groupDivider, item);
          }
        }
      });
      // Handle bottom items
      this._addBottomItems();

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
      console.log('Collapsed items updated from storage event:', this.collapsedItems);
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

  private _handleDefaultPanelChange(defaultDashboard: string) {
    const config = { ...(this._config || {}) };
    const configToUpdate = pick(config, [
      PANEL_TYPE.CUSTOM,
      PANEL_TYPE.BOTTOM,
      PANEL_TYPE.HIDDEN,
    ]) as SidebardPanelConfig;
    const cleanedConfig = cleanItemsFromConfig(configToUpdate, [defaultDashboard]);
    this._config = {
      ...this._config,
      ...cleanedConfig,
    };
    setStorage(STORAGE.UI_CONFIG, this._config);
    this._reloadWindow();
  }

  private async _getConfig() {
    const config = await fetchConfig(this.hass);
    // console.log('Fetched Config:', config);
    if (!config) {
      console.log('No config found, stopping further setup');
      // this._setInitPanelOrder();
      return;
    }
    if (config) {
      this._config = config;
      this._setupInitialConfig();
    }
  }

  private _setInitPanelOrder(): void {
    const isEmptyOrder = isStoragePanelEmpty();
    console.log('Is Storage Panel Order Empty:', isEmptyOrder);
    if (!isEmptyOrder) return;
    const baseOrder = this._baseOrder;
    if (baseOrder.length > 0) {
      console.log('Setting initial panel order from base order');
      setStorage(STORAGE.PANEL_ORDER, baseOrder);
      return;
    }

    console.log('No initial panel order found, setting default');
    const { beforeSpacer, builtInhidden } = this._getInitialPanelItems();
    setStorage(STORAGE.PANEL_ORDER, [...beforeSpacer]);
    setStorage(STORAGE.HIDDEN_PANELS, [...builtInhidden]);
    console.log('Initial Panel Order Set:', beforeSpacer, builtInhidden);
  }

  private _setupInitialConfig() {
    console.log('%cMAIN:', 'color: #bada55;', 'Setting up initial config');

    const { new_items, default_collapsed, custom_groups, hidden_items, color_config, bottom_items } = this._config;
    this._configPanelMap = new Map(Object.entries(custom_groups || {}));
    if (!isEmpty(bottom_items)) {
      this._configPanelMap.set('bottom_items', bottom_items!);
    }
    this.collapsedItems = getCollapsedItems(custom_groups, default_collapsed);
    this._handleHidden(hidden_items || []);
    // Add new items
    this._addNewItems(new_items || []);
    // Add additional styles
    this._addAdditionalStyles(color_config);
  }

  private async _addDiaglogRemoveLegacyUserData(): Promise<void> {
    console.log('Adding dialog to remove legacy user data');
    const confirmed = await showConfirmDialog(this._haDrawer, ALERT_MSG.CLEAN_USER_DATA, 'Clear', 'Cancel');
    if (!confirmed) {
      console.log('User data clearing cancelled');
      return;
    }

    try {
      const currentUserData = await fetchFrontendUserData(this.hass.connection, 'sidebar');
      await saveFrontendUserData(this.hass.connection, 'sidebar', {
        panelOrder: [],
        hiddenPanels: [],
      });

      console.log('User data cleared successfully');
      this._checkUserSidebarSettings();
      await this._updateUserDataToStorage(currentUserData!);
      await showAlertDialog(
        this._haDrawer,
        'User data cleared and migrated to storage successfully.',
        'Show Organizer Dialog'
      );
      if (this._hasSidebarConfig) {
        this._addConfigDialog();
      } else {
        this._config = {
          hidden_items: currentUserData?.hiddenPanels || [],
        };
        setStorage(STORAGE.UI_CONFIG, this._config);
        this._addConfigDialog();
      }
    } catch (err: any) {
      console.error('Error clearing user data:', err);
      await showAlertDialog(this._haDrawer, `Error clearing user data: ${err.message}`);
    }
  }

  private async _updateUserDataToStorage(currentUserData: SidebarFrontendUserData) {
    setStorage(STORAGE.PANEL_ORDER, currentUserData.panelOrder || []);
    // setStorage(STORAGE.HIDDEN_PANELS, currentUserData.hiddenPanels || []);
    console.log('User data migrated to storage successfully');
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
    const groupsLength = groupKeys.length;
    const collapsedSize = this.collapsedItems.size;
    const isAllCollapsed = collapsedSize === groupsLength;

    const collapseEl = document.createElement(ELEMENT.HA_ICON) as any;
    collapseEl.icon = isAllCollapsed ? MDI.PLUS : MDI.MINUS;
    collapseEl.classList.add(CLASS.COLLAPSE_TOGGLE);
    collapseEl.classList.toggle(CLASS.ACTIVE, isAllCollapsed!);

    const handleToggle = (ev: Event) => {
      ev.preventDefault();
      this.collapsedItems.size === groupKeys.length
        ? this.collapsedItems.clear()
        : (this.collapsedItems = new Set([...groupKeys]));
      this._handleCollapsed(this.collapsedItems);
    };
    ['touchstart', 'mousedown'].forEach((eventType) => {
      collapseEl.addEventListener(eventType, handleToggle);
    });

    titleEl.appendChild(collapseEl);
  }

  private _handleCollapsedChange(): void {
    const toggleIcon = this.sideBarRoot?.querySelector(SELECTOR.HEADER_TOGGLE_ICON) as HTMLElement;
    if (!toggleIcon) return;
    const collapsedSize = this.collapsedItems.size;
    const groupsLength = Object.keys(this._config?.custom_groups || {}).length;
    const isAllCollapsed = collapsedSize === groupsLength;
    toggleIcon.classList.toggle(CLASS.ACTIVE, isAllCollapsed!);
    toggleIcon.setAttribute('icon', isAllCollapsed ? MDI.PLUS : MDI.MINUS);
    // const isCollapsed = collapsedSize > 0;
    // toggleIcon?.classList.toggle(CLASS.ACTIVE, isCollapsed);
    // toggleIcon?.setAttribute('icon', isCollapsed ? MDI.PLUS : MDI.MINUS);
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
    console.log('%cMAIN:', 'color: #bada55;', 'New Items Added to Sidebar');
  }

  private _addBuiltInPanelsToSidebar(panels: PanelInfo[]): void {
    if (!panels || panels.length === 0) return;
    const spacer = this._scrollbar.querySelector(SELECTOR.SPACER) as HTMLElement;

    panels.map((panel) => {
      const builtInItem = this._createBuiltInPanelItem(panel);
      if (builtInItem) {
        this._scrollbar.insertBefore(builtInItem, spacer);
      }
    });
    console.log('%cMAIN:', 'color: #bada55;', 'Built-in Panels Added to Sidebar:', panels);
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

  private _createDivider = (attribute?: string): HTMLElement => {
    const divider = document.createElement('div') as HTMLElement;
    divider.classList.add('divider');
    if (attribute) {
      divider.setAttribute(attribute, '');
    }
    return divider;
  };

  private _createDividerWithGroup = (group: string, isCollapsed: boolean = false): HTMLElement => {
    const divider = this._createDivider();
    divider.setAttribute(ATTRIBUTE.GROUP, group);
    divider.setAttribute(ATTRIBUTE.ADDED, '');
    divider.classList.toggle(CLASS.COLLAPSED, isCollapsed);
    const contentDiv = document.createElement('div');
    contentDiv.classList.add(CLASS.ADDED_CONTENT);
    contentDiv.setAttribute(ATTRIBUTE.GROUP, group);
    contentDiv.innerHTML = `<ha-icon icon="mdi:chevron-down"></ha-icon><span>${group.replace(/_/g, ' ')}</span>`;
    contentDiv.classList.toggle(CLASS.COLLAPSED, isCollapsed);
    divider.appendChild(contentDiv);
    divider.addEventListener('click', this._toggleGroup.bind(this));
    return divider;
  };

  private _addBottomItems(): void {
    if (!this._configPanelMap.get('bottom_items')) return;

    const value = this._configPanelMap.get('bottom_items')!;
    const scrollbarItems = this._sidebarItems;
    const spacer = this._scrollbar.querySelector(SELECTOR.SPACER) as HTMLElement;
    value.forEach((item, index) => {
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
      if (index === value.length - 1) {
        const divider = this._createDivider(ATTRIBUTE.BOTTOM);
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
      // setStorage(STORAGE.HIDDEN_PANELS, config.hidden_items);
      this._config = config;

      this._reloadWindow();
      return;
    }
  }

  private _handleCollapsed(collapsedItems: Set<string>) {
    setStorage(STORAGE.COLLAPSE, [...collapsedItems]);
    this._handleCollapsedChange();
    // Update sidebar items
    Array.from(this._sidebarItems)
      .filter((item) => item.hasAttribute(ATTRIBUTE.GROUP))
      .forEach((item) => {
        const group = item.getAttribute(ATTRIBUTE.GROUP);
        const isItemCollapsed = collapsedItems.has(group!);
        item.classList.toggle(CLASS.COLLAPSED, isItemCollapsed);
        // console.log('Item:', item, 'Group:', group, 'Collapsed:', isItemCollapsed);
      });

    // Update dividers and their content
    this._scrollbar.querySelectorAll(SELECTOR.DIVIDER_ADDED).forEach((divider) => {
      const group = divider.getAttribute(ATTRIBUTE.GROUP);
      const isGroupCollapsed = collapsedItems.has(group!);
      divider.classList.toggle(CLASS.COLLAPSED, isGroupCollapsed);
      divider.querySelector(SELECTOR.ADDED_CONTENT)?.classList.toggle(CLASS.COLLAPSED, isGroupCollapsed);
      // console.log('Divider:', divider, 'Group:', group, 'Collapsed:', isGroupCollapsed);
    });
  }

  private _addAdditionalStyles(color_config: SidebarConfig['color_config'], mode?: string) {
    mode = mode ? mode : this.darkMode ? 'dark' : 'light';
    const customTheme = color_config?.custom_theme?.theme || undefined;
    // console.log('Adding Additional Styles for mode:', mode);
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

  private _handleItemsGroup(customGroups: CustomGroups) {
    if (!customGroups || Object.keys(customGroups).length === 0) return;
    const collapsedItems = this.collapsedItems || new Set<string>();
    const scrollbarItems = Array.from(this._scrollbarItems) as HTMLElement[];

    // Loop through each group, create a divider with group name and place it before the first item of the group
    Object.entries(customGroups).forEach(([group, panels]) => {
      const isGroupCollapsed = collapsedItems.has(group!);
      // Create a divider for the group
      const divider = this._createDividerWithGroup(group, isGroupCollapsed);
      // Find the first item of the group
      const firstItem = scrollbarItems.find((item) => panels.includes(item.getAttribute('data-panel')!));
      if (firstItem) {
        // Insert the divider before the first item of the group
        // divider.classList.toggle(CLASS.COLLAPSED, isGroupCollapsed);
        // divider.querySelector(SELECTOR.ADDED_CONTENT)?.classList.toggle(CLASS.COLLAPSED, isGroupCollapsed);
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
    const lastGroupedItem = scrollbarItems.findLast((item) => item.hasAttribute('group'));
    // const lastGroupedItem = scrollbarItems.find(
    //   (item) => item.hasAttribute('group') && !item.nextElementSibling?.hasAttribute('group')
    // );
    if (lastGroupedItem) {
      const divider = this._createDivider(ATTRIBUTE.UNGROUPED);
      // divider.setAttribute('ungrouped', '');
      this._scrollbar.insertBefore(divider, lastGroupedItem.nextSibling);
    }

    // console.log('adding ungrouped divider after last grouped item:', lastGroupedItem);

    // Check differences after a delay
    setTimeout(() => this._checkDiffs(), 100);
  }

  private _checkDiffs = () => {
    console.log('%cMAIN:', 'color: #bada55;', 'Checking for sidebar order differences...');

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
    }
  };

  private _createBuiltInPanelItem(panelConfig: PanelInfo): SidebarPanelItem {
    const title = getPanelTitle(this.hass, panelConfig);
    const urlPath = panelConfig.url_path;
    const icon = panelConfig.icon;

    const item = document.createElement(ELEMENT.ITEM) as SidebarPanelItem;
    item.setAttribute(ATTRIBUTE.TYPE, 'link');
    item.href = `/${urlPath}`;
    item.target = '';
    item.setAttribute('newItem', 'true');
    item.setAttribute('data-panel', urlPath!);
    item.tabIndex = -1;

    const span = document.createElement('span');
    span.classList.add('item-text');
    span.setAttribute('slot', 'headline');
    span.innerText = title!;

    item.appendChild(span);

    const haIcon = document.createElement(ELEMENT.HA_ICON) as any;
    haIcon.setAttribute(ATTRIBUTE.SLOT, 'start');
    haIcon.icon = icon!;

    item.prepend(haIcon);
    item.addEventListener(EVENT.MOUSEENTER, this._mouseEnterBinded);
    item.addEventListener(EVENT.MOUSELEAVE, this._mouseLeaveBinded);
    return item;
  }

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
    item.addEventListener(EVENT.MOUSEENTER, this._mouseEnterBinded);
    item.addEventListener(EVENT.MOUSELEAVE, this._mouseLeaveBinded);
    return item;
  }

  private async _mouseEnter(event: MouseEvent) {
    const sidebarElement = (await this._sidebar.element) as Sidebar;
    if (sidebarElement.alwaysExpand) return;
    if (sidebarElement._mouseLeaveTimeout) {
      clearTimeout(sidebarElement._mouseLeaveTimeout);
      sidebarElement._mouseLeaveTimeout = undefined;
    }
    sidebarElement._showTooltip(event.currentTarget as HTMLElement);
  }

  private async _mouseLeave(): Promise<void> {
    const sidebarElement = (await this._sidebar.element) as Sidebar;
    if (sidebarElement._mouseLeaveTimeout) {
      clearTimeout(sidebarElement._mouseLeaveTimeout);
    }
    sidebarElement._mouseLeaveTimeout = window.setTimeout(() => {
      sidebarElement._hideTooltip();
    }, 500);
  }

  private _subscribeNotification(panel: HTMLElement, value: string) {
    let badge = panel.querySelector(SELECTOR.BADGE);
    let notifyIcon = panel.querySelector(SELECTOR.NOTIFY_ICON);
    const itemText = panel.querySelector(SELECTOR.ITEM_TEXT) as HTMLElement;
    if (!badge || !notifyIcon) {
      badge = document.createElement('span');
      badge.classList.add(CLASS.BADGE);
      badge.classList.add(CLASS.NO_VISIBLE); // Start hidden
      badge.setAttribute(ATTRIBUTE.SLOT, 'end');
      notifyIcon = document.createElement('ha-icon');
      notifyIcon.classList.add(CLASS.BADGE);
      notifyIcon.classList.add(CLASS.NO_VISIBLE); // Start hidden
      notifyIcon.setAttribute(ATTRIBUTE.SLOT, 'end');
      panel.insertBefore(badge, itemText.nextElementSibling);
      panel.insertBefore(notifyIcon, itemText);
      panel.setAttribute(ATTRIBUTE.DATA_NOTIFICATION, 'true');
    }

    const callback = (resultContent: any) => {
      // Check for non-empty values (handle null, undefined, empty strings, whitespace-only)
      if (resultContent != null && String(resultContent).trim() !== '') {
        if (typeof resultContent === 'string' && isIcon(resultContent)) {
          // Show icon, hide badge
          // badge.innerHTML = '';
          notifyIcon.classList.toggle(CLASS.NO_VISIBLE, false);
          notifyIcon.setAttribute('icon', resultContent);
          badge.classList.toggle(CLASS.NO_VISIBLE, true);
          badge.remove();
        } else {
          // Show badge, hide icon
          badge.innerHTML = resultContent;
          badge.classList.toggle(CLASS.NO_VISIBLE, false);
          badge.classList.toggle(CLASS.BADGE_NUMBER, !isNaN(resultContent));
          badge.classList.toggle(CLASS.LARGE_BADGE, resultContent.length >= 3);
          notifyIcon.classList.toggle(CLASS.NO_VISIBLE, true);
          notifyIcon.removeAttribute('icon');
          notifyIcon.remove();
        }
      } else {
        // Hide both elements when no value
        notifyIcon.classList.toggle(CLASS.NO_VISIBLE, true);
        notifyIcon.removeAttribute('icon');
        badge.innerHTML = '';
        badge.classList.toggle(CLASS.NO_VISIBLE, true);
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
    // const targetParent = target.parentElement as HTMLElement;
    // console.log('%cMAIN:', 'color: #bada55;', 'Toggling group:', group, target, targetParent);

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
    this._handleCollapsedChange();
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

  private _getInitialPanelItems(): { beforeSpacer: string[]; builtInhidden: string[] } {
    const hass = this.hass;
    const defaultPanel = getDefaultPanelUrlPath(hass);
    const result = computeInitialPanelOrder(hass.panels, defaultPanel, hass.locale);
    console.log('Computed Initial Panel Items:', result);
    const beforeSpacer = result.beforeSpacer.map((panel) => panel.url_path!);
    const builtInhidden = result.builtInDefaultNotVisible.map((panel) => panel.url_path!);
    return { beforeSpacer, builtInhidden };
  }

  private _reloadWindow() {
    console.log('Reloading window...');
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }

  async _getAutoGeneratedPanels(): Promise<Record<string, PanelInfo>> {
    const panels = Object.entries(this.hass.panels);
    const defaultPanel = getDefaultPanel(this.hass).url_path;
    const autoGeneratedPanels = panels
      .filter(([, panel]) => panel.default_visible === false && panel.url_path !== defaultPanel)
      .reduce((acc, [key, panel]) => {
        acc[key] = panel;
        return acc;
      }, {} as Panels);
    return autoGeneratedPanels;
  }

  public _getGroupOfPanel = (panel: string): string | null => {
    const group = [...this._configPanelMap.entries()].find(([, items]) => items.includes(panel));
    return group ? group[0] : null;
  };

  _removeSidebarConfigFromStorage() {
    return clearSidebarOrganizerStorage();
  }
}

declare global {
  interface Window {
    SidebarOrganizer: SidebarOrganizer;
  }
}

// Initial Run

if (!window.SidebarOrganizer) {
  const params = new URLSearchParams(window.location.search);
  const debugMode = params.has('so_debug');
  window.SidebarOrganizer = new SidebarOrganizer(debugMode);
}
