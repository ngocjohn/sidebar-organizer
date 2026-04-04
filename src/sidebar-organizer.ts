import {
  ALERT_MSG,
  ATTRIBUTE,
  CLASS,
  ELEMENT,
  EVENT,
  HA_EVENT,
  HA_STATE,
  MDI,
  NAMESPACE,
  PATH,
  PROFILE_GENERAL_PATH_REGEXP,
  SELECTOR,
  STORAGE,
} from '@constants';
import {
  DividerColorSettings,
  HaDrawer,
  HaExtened,
  NewItemConfig,
  PANEL_TYPE,
  PanelInfo,
  PartialPanelResolver,
  Sidebar,
  SidebarConfig,
  SidebarPanelItem,
  ElementsStore,
} from '@types';
import { _getDarkConfigMode, applyTheme } from '@utilities/apply-theme';
import { compareHacsTagDiff } from '@utilities/compare-urls';

import './components/so-group-divider';
import { getBuiltInPanels } from '@utilities/compute-panels';
import { fetchConfig } from '@utilities/configs';
import {
  atLeastVersion,
  clearSidebarOrganizerStorage,
  getCollapsedItems,
  normalizePinnedGroups,
} from '@utilities/configs/misc';
import { getDefaultThemeColors, convertCustomStyles } from '@utilities/custom-styles';
import { addAction, mapItemsForDebug, nextRender, onPanelLoaded, parseItemValues } from '@utilities/dom-utils';
import { clearSidebarUserData, fetchFrontendUserData } from '@utilities/frontend';
import { isIcon } from '@utilities/is-icon';
import * as LOGGER from '@utilities/logger';
import DialogHandler from '@utilities/model/dialog-handler';
import Store from '@utilities/model/store';
import { computeBadge, computeNewItem, computeNotifyIcon, getDefaultPanelUrlPath } from '@utilities/panel';
import { setStorage, sidebarUseConfigFile } from '@utilities/storage-utils';
import { hasTemplate, subscribeRenderTemplate } from '@utilities/ws-templates';
import { getPromisableResult, PromisableOptions } from 'get-promisable-result';
import { HAElement, HAQuerySelector, HAQuerySelectorEvent, OnListenDetail } from 'home-assistant-query-selector';
import { HomeAssistantStylesManager } from 'home-assistant-styles-manager';

import { SoGroupDivider } from './components/so-group-divider';
import { DIVIDER_ADDED_STYLE, DRAWER_STYLE } from './sidebar-css';

export class SidebarOrganizer {
  constructor() {
    const instance = new HAQuerySelector();
    instance.addEventListener(HAQuerySelectorEvent.ON_LISTEN, async (event) => {
      const { HOME_ASSISTANT, HA_DRAWER, HA_SIDEBAR } = event.detail;
      this._ha = (await HOME_ASSISTANT.element) as HaExtened;
      this._haDrawer = (await HA_DRAWER.element) as HaDrawer;
      this.HaSidebar = await HA_SIDEBAR.element;
      this.sideBarRoot = (await HA_SIDEBAR.selector.$.element) as ShadowRoot;
      this._store = new Store(this._ha, this);
      this._dialogManager = new DialogHandler(this._ha, this);
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
    });

    this._styleManager = new HomeAssistantStylesManager({
      prefix: NAMESPACE,
      throwWarnings: false,
    });

    // Listen for storage changes to handle collapse state updates across tabs
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

    this._sidebarItems = [];
    this._currentPath = window.location.pathname;
    this._watchPathChanges();
    this._mouseEnterBinded = this._mouseEnter.bind(this);
    this._mouseLeaveBinded = this._mouseLeave.bind(this);
    instance.listen();
  }

  private _homeAssistant!: HAElement;
  private _haMain!: HAElement;
  private _drawer!: HAElement;
  private _ha!: HaExtened;
  public _haDrawer!: HaDrawer;
  private _notCompatible: boolean = false;
  private _blockEditModeChange: boolean = false;
  public _config: SidebarConfig = {};
  private _currentPath: string;
  private _delayTimeout: number | null = null;
  private _configPanelMap = new Map<string, string[]>();
  private _pinnedGroups: Record<string, { icon?: string }> = {};

  public _panelResolver!: HAElement;
  private _prevPath: string | null = null;
  private _sidebar!: HAElement;
  private _sidebarItems: SidebarPanelItem[];
  private _styleManager: HomeAssistantStylesManager;
  public _store!: Store;
  public _dialogManager!: DialogHandler;
  public _userHasSidebarSettings: boolean = false;

  private collapsedItems = new Set<string>();
  private firstSetUpDone = false;
  public _diffCheck: boolean = false;

  public HaSidebar: any;
  private setupConfigDone = false;
  private sideBarRoot!: ShadowRoot;
  public _baseOrder: string[] = [];
  public _hiddenPanels: string[] = [];

  private _mouseEnterBinded: (event: MouseEvent) => void;
  private _mouseLeaveBinded: () => void;

  get hass(): HaExtened['hass'] {
    return this._ha!.hass;
  }

  get darkMode(): boolean {
    return _getDarkConfigMode(this._config.color_config, this.hass);
  }

  get _panelsList(): HTMLElement {
    return this.sideBarRoot?.querySelector(SELECTOR.PANELS_LIST) as HTMLElement;
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

  get _pluginConfigured(): boolean {
    return Boolean(this._hasSidebarConfig && !this._userHasSidebarSettings);
  }

  public async run(): Promise<void> {
    if (!this.hass || this.hass.config?.state !== HA_STATE.RUNNING) {
      this._store._haNotRunningToast();
      return;
    }

    if (!atLeastVersion(this.hass.config.version, 2026, 2)) {
      this._notCompatible = true;
      const msg = `${ALERT_MSG.NOT_COMPATIBLE}: ${this.hass.config.version}.\nPlease upgrade Home Assistant to 2026.2 or later.`;
      this._store._showToast(msg, 10 * 1000);

      LOGGER.warn(msg);
      return;
    }

    compareHacsTagDiff(this._ha.hass);
    await this._checkUserSidebarSettings();
    await this._watchEditLegacySidebar();

    this._setupConfigBtn();
    if (!this.firstSetUpDone && this._hasSidebarConfig) {
      // Load built-in panels for versions before 2026.3 to ensure they are included in the sidebar configuration process
      if (!atLeastVersion(this.hass.config.version, 2026, 3)) {
        await this._getDataDashboards();
      }
      this.firstSetUpDone = true;
    }

    if (this.firstSetUpDone && !this._userHasSidebarSettings) {
      await this._getConfig().then(() => {
        this._setupInitialConfig();
      });
      this._processSections();
    }
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
  }

  private _watchPathChanges() {
    const callback = () => {
      // Delay the check to allow path to update fully
      if (this._delayTimeout) {
        clearTimeout(this._delayTimeout);
      }

      this._delayTimeout = window.setTimeout(() => {
        const newPath = window.location.pathname;
        this._checkProfileSection();
        if (newPath !== this._currentPath) {
          this._prevPath = this._currentPath;
          this._currentPath = newPath;
          if (
            this._prevPath !== null &&
            this._prevPath === PATH.LOVELACE_DASHBOARD &&
            this._currentPath !== PATH.LOVELACE_DASHBOARD
          ) {
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
    const changed = await this._store._shouldUpdateConfig();

    if (changed) {
      // Reload the window to apply changes
      console.log('%cSIDEBAR-ORGANIZER:', 'color: #bada55;', 'Changes detected, reloading window');
      this._reloadWindow();
    } else {
      this._checkDiffs();
      this._store.resetDashboardState();
    }
  }

  private async _panelLoaded(): Promise<void> {
    if (this._notCompatible) return;

    const panelResolver = (await this._panelResolver.element) as PartialPanelResolver;
    if (!panelResolver.route) return;
    const pathName = panelResolver.route?.path ?? window.location.pathname;
    if (!pathName) return;
    // const paperListBox = (await this._sidebar.selector.$.query(SELECTOR.SIDEBAR_SCROLLBAR).element) as HTMLElement;
    const paperListBox = this._panelsList as HTMLElement;
    // console.log('Panel Loaded:', pathName, paperListBox);
    if (pathName && paperListBox) {
      setTimeout(() => {
        if (this._diffCheck && this.firstSetUpDone && this.setupConfigDone) {
          onPanelLoaded(pathName, paperListBox);
          if (pathName === PATH.LOVELACE_DASHBOARD) {
            this._store._subscribePanels();
          }
        }
      }, 100);
    }
  }

  private _checkProfileSection = async (): Promise<void> => {
    const panelResolver = (await this._panelResolver.element) as PartialPanelResolver;
    const pathName = panelResolver?.route?.path ?? window.location.pathname;
    if (pathName && PROFILE_GENERAL_PATH_REGEXP.test(pathName) && this._dialogManager) {
      await this._dialogManager._injectSidebarOrganizerElement(panelResolver);
    } else {
      return;
    }
  };

  private async _checkUserSidebarSettings(): Promise<void> {
    const userData = await fetchFrontendUserData(this.hass.connection, 'sidebar');
    this._userHasSidebarSettings = (userData?.panelOrder && userData.panelOrder.length > 0) || false;
  }

  private async _setupConfigBtn(): Promise<void> {
    const siderbarRoot = (await this._sidebar.selector.$.element) as ShadowRoot;
    const profileEl =
      (siderbarRoot?.querySelector(SELECTOR.ITEM_PROFILE) as HTMLElement) ||
      (siderbarRoot?.querySelector(SELECTOR.USER_ITEM) as HTMLElement);
    if (!profileEl) {
      console.log('Profile element not found in sidebar, cannot setup config button');
      return;
    }
    if (this._userHasSidebarSettings) {
      //info
      console.log(
        '%cSIDEBAR-ORGANIZER:%c ℹ️ User has sidebar settings, inject dialog prompt to clear data',
        'color: #999999;',
        'color: #228be6; font-weight: 600;'
      );

      addAction(profileEl, this._dialogManager._addDialogUserDataClear.bind(this._dialogManager));
      return;
    } else {
      addAction(profileEl, this._dialogManager._showConfigDialogEditor.bind(this._dialogManager));
    }
  }

  private async _getDataDashboards() {
    const defaultPanel = getDefaultPanelUrlPath(this.hass);
    await getBuiltInPanels(this.hass.panels, defaultPanel).then((panels) => {
      this._addBuiltInPanelsToSidebar(panels);
    });
  }

  private async _getContainerItems(
    container: HTMLElement,
    promisableResultOptions?: PromisableOptions
  ): Promise<NodeListOf<SidebarPanelItem>> {
    if (!promisableResultOptions) {
      promisableResultOptions = {
        retries: 100,
        delay: 50,
        shouldReject: false,
      };
    }

    const items = await getPromisableResult<NodeListOf<SidebarPanelItem>>(
      () => container.querySelectorAll<SidebarPanelItem>(`${ELEMENT.ITEM}`),
      (elements: NodeListOf<SidebarPanelItem>): boolean => {
        return Array.from(elements).every((element: SidebarPanelItem): boolean => {
          const text = element.querySelector<HTMLElement>(SELECTOR.ITEM_TEXT)!.innerText.trim();
          return text.length > 0;
        });
      },
      promisableResultOptions
    );
    return items;
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
        if (detail.editMode === true && !this._hasSidebarConfig) {
          this._dialogManager._addLegacyEditWarning();
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
        console.log('Default Panel Changed Event:', detail);
        // this._store._handleDefaultPanelChange(detail.defaultPanel);
        break;

      case HA_EVENT.SHOW_DIALOG:
        if (detail.dialogTag === ELEMENT.DIALOG_EDIT_SIDEBAR) {
          console.log('Show Dialog Event:', ELEMENT.DIALOG_EDIT_SIDEBAR, detail);
          this._dialogManager._handleEditModeAttempt();
        }
        break;
      case HA_EVENT.SIDEBAR_CONFIG_SAVED:
        console.log('Sidebar Config Saved Event:', detail);
        this._handleNewConfig(detail.config, detail.useConfigFile);
        break;
    }
  }

  private async _getConfig() {
    const config = await fetchConfig(this.hass);
    // console.log('Fetched Config:', config);
    if (!config) {
      console.log('No config found, stopping further setup');
      return;
    }
    this._config = config;
  }

  private _setupInitialConfig() {
    // info
    console.groupCollapsed('%cSIDEBAR-ORGANIZER:%c ℹ️ Setting from config...', 'color: #bada55;', 'color: #228be6; ');

    const { default_collapsed, custom_groups, color_config, bottom_items, bottom_grid_items, pinned_groups } =
      this._config;

    this._configPanelMap = new Map<string, string[]>(
      Object.entries({
        ...(custom_groups || {}),
        ...(bottom_items ? { [PANEL_TYPE.BOTTOM_ITEMS]: bottom_items } : {}),
        ...(bottom_grid_items ? { [PANEL_TYPE.BOTTOM_GRID_ITEMS]: bottom_grid_items } : {}),
      })
    );
    // Normalize pinned groups config to ensure consistent structure
    this._pinnedGroups = normalizePinnedGroups(pinned_groups || {});
    // Initialize collapsed groups based on config, this will be used to set initial state of groups and manage collapse/expand functionality
    this.collapsedItems = getCollapsedItems(custom_groups, default_collapsed);
    // Setup additional styles based on color config
    this._addAdditionalStyles(color_config);

    // Prepare base order of panels based on current sidebar state and config
    this._setupPanelOrder();
  }

  private _setupPanelOrder(): void {
    Promise.all([
      this._sidebar.selector.$.element,
      this._sidebar.selector.$.query(SELECTOR.SIDEBAR_BEFORE_SPACER_CONTAINER).element,
    ]).then((elements) => {
      const [sidebarShadowRoot, beforeSpacerContainer] = elements;
      if (!sidebarShadowRoot || !(beforeSpacerContainer instanceof HTMLElement)) {
        return;
      }

      const { new_items, move_settings_from_fixed, notification, hidden_items, visibility_templates } = this._config;
      const notificationMap = new Map(Object.entries(notification || {}));
      const groupVisibilityMap = new Map<string, string>(Object.entries(visibility_templates?.groups || {}));
      const itemVisibilityMap = new Map<string, string>(Object.entries(visibility_templates?.items || {}));

      if (new_items && new_items.length > 0) {
        // Add new items to sidebar before spacer
        Array.from(new_items).map((item) => {
          const newItemEl = this._createNewItem(item);

          if (newItemEl) {
            beforeSpacerContainer.appendChild(newItemEl);
          }
        });
        console.log('New items added to sidebar:', new_items);
      }

      if (move_settings_from_fixed === true) {
        const settingsItem = sidebarShadowRoot.querySelector(SELECTOR.SETTINGS_ITEM) as SidebarPanelItem;
        if (settingsItem) {
          beforeSpacerContainer.appendChild(settingsItem);
          console.log('Settings item moved from fixed:', move_settings_from_fixed);
        } else {
          console.log(
            '%cSIDEBAR-ORGANIZER:%c ❌ Settings item not found',
            'color: #999999;',
            'color: #fa5252; font-weight: 600;'
          );
        }
      }

      this._getContainerItems(beforeSpacerContainer).then((items) => {
        Array.from(items).forEach((item: SidebarPanelItem) => {
          if (item.hasAttribute(ATTRIBUTE.NEW_ITEM)) return; // Skip new items

          const panelId = item.href.replace('/', '');
          item.setAttribute(ATTRIBUTE.DATA_PANEL, panelId);

          if (hidden_items?.includes(panelId)) {
            item.style.display = 'none';
          }

          const notificationValue = notificationMap.get(panelId);
          if (notificationValue !== undefined) {
            this._subscribeNotification(item, notificationValue);
          }
        });

        const initOrder = Array.from(items).map(
          (item) => item.getAttribute(ATTRIBUTE.DATA_PANEL) || item.href.replace('/', '')
        );

        this._baseOrder = this._reorderPanelItemsByConfig(initOrder);
        if (this._configPanelMap.size === 0) {
          // Skip reordering if there are no groups defined in config to avoid unnecessary DOM manipulation
          console.log(
            '%cSIDEBAR-ORGANIZER:%c No groups defined in config, skipping initial reordering',
            'color: #999999;',
            'color: #228be6;'
          );
          return;
        }

        const topItems = document.createDocumentFragment();
        const uncategorizedItems = document.createDocumentFragment();
        const bottomItems = document.createDocumentFragment();
        const bottomGridItems = document.createDocumentFragment();

        const inGroup = (panel: string): string | null => this._getGroupOfPanel(panel);
        const groupHasVisibilityTemplate = (group: string): boolean => groupVisibilityMap.has(group);
        const itemHasVisibilityTemplate = (item: string): boolean => itemVisibilityMap.has(item);

        const defaultPanelUrlPath = getDefaultPanelUrlPath(this.hass);

        const orderedPanels: Omit<NewItemConfig, 'icon'>[] = [];
        const visibilityTemplateUsageLog: { panelId: string; source: 'group' | 'item'; template: string }[] = [];

        this._baseOrder.forEach((panelId) => {
          const foundItem = Array.from(items).find((el) => el.getAttribute(ATTRIBUTE.DATA_PANEL) === panelId);
          if (!foundItem) {
            console.log(
              '%cSIDEBAR-ORGANIZER:%c ❌ Panel item not found for panel ID:',
              'color: #999999;',
              'color: #fa5252; font-weight: 600;',
              panelId
            );
          } else {
            const group = inGroup(panelId);
            const groupVisibilityTemplate =
              group && groupHasVisibilityTemplate(group) ? groupVisibilityMap.get(group)! : null;
            const itemVisibilityTemplate = itemHasVisibilityTemplate(panelId) ? itemVisibilityMap.get(panelId)! : null;
            const visibilityTemplate = groupVisibilityTemplate || itemVisibilityTemplate;

            if (visibilityTemplate) {
              visibilityTemplateUsageLog.push({
                panelId,
                source: groupVisibilityTemplate ? 'group' : 'item',
                template: visibilityTemplate,
              });

              this._subscribeVisibility(foundItem, visibilityTemplate);
            }
            if (group === PANEL_TYPE.BOTTOM_ITEMS || group === PANEL_TYPE.BOTTOM_GRID_ITEMS) {
              if (group === PANEL_TYPE.BOTTOM_ITEMS) {
                foundItem.setAttribute(ATTRIBUTE.BOTTOM, '');
                bottomItems.appendChild(foundItem);
              } else if (group === PANEL_TYPE.BOTTOM_GRID_ITEMS) {
                foundItem.setAttribute(ATTRIBUTE.GRID_ITEM, '');
                foundItem.addEventListener(EVENT.MOUSEENTER, this._mouseEnterBinded);
                foundItem.addEventListener(EVENT.MOUSELEAVE, this._mouseLeaveBinded);
                bottomGridItems.appendChild(foundItem);
              }
            } else if (group) {
              if (group !== PANEL_TYPE.UNCATEGORIZED_ITEMS) {
                foundItem.setAttribute(ATTRIBUTE.GROUP, group);
              }
              topItems.appendChild(foundItem);
            } else {
              if (panelId === defaultPanelUrlPath) {
                foundItem.setAttribute(ATTRIBUTE.DEFAULT_PANEL, '');
                topItems.prepend(foundItem);
              } else {
                uncategorizedItems.appendChild(foundItem);
              }
            }
            orderedPanels.push({ ...parseItemValues(foundItem), group: group || 'uncategorized' });
          }
        });
        visibilityTemplateUsageLog.length > 0 &&
          console.groupCollapsed('Panels with visibility templates:', visibilityTemplateUsageLog.length);
        console.table(visibilityTemplateUsageLog);
        console.groupEnd();

        console.groupCollapsed('Ordering panels based on config:', this._baseOrder.length, 'panels');
        console.table(orderedPanels);
        console.groupEnd();

        if (uncategorizedItems.children.length > 0 || topItems.children.length > 0) {
          beforeSpacerContainer.appendChild(topItems);
          beforeSpacerContainer.appendChild(uncategorizedItems);
        }
        if (bottomItems.children.length > 0 || bottomGridItems.children.length > 0) {
          // this._processBottomList(bottomItems, bottomGridItems);
          const createContainer = (
            type: PANEL_TYPE.BOTTOM_GRID_ITEMS | PANEL_TYPE.BOTTOM_ITEMS,
            content: DocumentFragment
          ): HTMLElement | null => {
            if (content.children.length === 0) {
              return null;
            }
            const className = type === PANEL_TYPE.BOTTOM_ITEMS ? CLASS.BOTTOM_CONTAINER : CLASS.BOTTOM_GRID_CONTAINER;

            const container = document.createElement('div') as HTMLElement;
            container.classList.add(className);
            container.appendChild(content);
            return container;
          };

          const bottomContainer = createContainer(PANEL_TYPE.BOTTOM_ITEMS, bottomItems);
          const bottomGridContainer = createContainer(PANEL_TYPE.BOTTOM_GRID_ITEMS, bottomGridItems);

          if (bottomContainer || bottomGridContainer) {
            const haMdList = document.createElement(ELEMENT.HA_MD_LIST) as any;
            haMdList.classList.add(CLASS.BOTTOM_LIST);
            if (bottomContainer) {
              haMdList.appendChild(bottomContainer);
            }
            if (bottomGridContainer) {
              haMdList.appendChild(bottomGridContainer);
            }
            const spacer = this._panelsList.querySelector(SELECTOR.SPACER) as HTMLElement;
            this._panelsList.insertBefore(haMdList, spacer.nextElementSibling);
          }
          //success
          console.log('%cSIDEBAR-ORGANIZER:%c ✅ Bottom items added to sidebar', 'color: #bada55;', 'color: #40c057;');
        }
        console.groupEnd();
      });
    });
  }

  private _processSections() {
    this._getElements().then(async (elements: ElementsStore) => {
      const { custom_groups, visibility_templates } = this._config;
      const { topItemsContainer, topItems, bottomItemsContainer, bottomItems } = elements;

      const groupVisibilityMap = new Map<string, string>(Object.entries(visibility_templates?.groups || {}));

      this._sidebarItems = [
        ...Array.from(topItems),
        ...(bottomItems ? Array.from(bottomItems) : []),
      ] as SidebarPanelItem[];

      Object.entries(custom_groups || {}).forEach(([groupName, panels]) => {
        if (groupName === PANEL_TYPE.UNCATEGORIZED_ITEMS) return; // Skip uncategorized group as it's not an actual group but a placeholder for ungrouped items
        const groupVisibilityTemplate = groupVisibilityMap.has(groupName) ? groupVisibilityMap.get(groupName)! : null;
        const isCollapsed = this.collapsedItems.has(groupName);
        let lastGroupItem: Element | null = null;
        panels.forEach((panelId, index) => {
          const item = Array.from(topItems).find((el) => el.getAttribute(ATTRIBUTE.DATA_PANEL) === panelId);
          if (item) {
            if (index === 0) {
              const groupDivider = this._createDividerWithGroup(groupName, isCollapsed);
              if (groupVisibilityTemplate) {
                this._subscribeVisibility(groupDivider, groupVisibilityTemplate);
              }
              item.insertAdjacentElement('beforebegin', groupDivider);
            }
            item.classList.toggle(CLASS.COLLAPSED, isCollapsed);
            lastGroupItem = item;
          }
        });
        // Insert a closing divider after the last item in this group
        // to visually separate grouped items from ungrouped items below
        if (lastGroupItem) {
          const closingDivider = this._createDivider(ATTRIBUTE.UNGROUPED);
          (lastGroupItem as Element).insertAdjacentElement('afterend', closingDivider);
        }
      });

      const firstUngroupedItem = topItemsContainer.querySelector(
        `${ELEMENT.ITEM}:not([${ATTRIBUTE.GROUP}]):not([${ATTRIBUTE.DEFAULT_PANEL}])`
      ) as SidebarPanelItem | null;
      if (firstUngroupedItem) {
        const ungroupedDivider = this._createDivider(ATTRIBUTE.UNGROUPED);
        firstUngroupedItem.insertAdjacentElement('beforebegin', ungroupedDivider);
      }

      if (bottomItemsContainer && bottomItemsContainer.children.length > 0) {
        Array.from(bottomItemsContainer.children).forEach((item) => {
          const bottomDivider = this._createDivider(ATTRIBUTE.BOTTOM);
          item.insertAdjacentElement('afterend', bottomDivider);
        });
      }
      // Wait for DOM updates to complete before checking diffs and handling header to ensure we are working with the latest rendered state
      await nextRender();
      this._checkDiffs();
      // Handle sidebar header after processing sections to ensure toggle button is added based on the presence of groups in the config and their collapsed state
      this._handleSidebarHeader();

      // Mark setup config as done to allow panel loaded logic to run when panels are loaded
      this.setupConfigDone = true;
      this._watchHaSidebarShouldUpdate();
      this._panelLoaded();
    });
  }

  private async _getElements(): Promise<ElementsStore> {
    const promisableResultOptions = {
      retries: 100,
      delay: 50,
      shouldReject: false,
    };
    const sidebarShadowRoot = await this._sidebar.selector.$.element;

    if (sidebarShadowRoot) {
      await getPromisableResult(
        () => sidebarShadowRoot.querySelector(SELECTOR.SIDEBAR_LOADER),
        (sidebarLoader: Element | null) => sidebarLoader === null,
        promisableResultOptions
      );
    }
    const topItemsContainer = (await this._sidebar.selector.$.query(SELECTOR.SIDEBAR_BEFORE_SPACER_CONTAINER)
      .element) as HTMLElement;

    // bottom list container is optional, may not exist if no bottom items configured
    const bottomItemsContainer = (await this._sidebar.selector.$.query(SELECTOR.SIDEBAR_BOTTOM_LIST_CONTAINER)
      .element) as HTMLElement | null;

    const topItems = await this._getContainerItems(topItemsContainer, promisableResultOptions);
    const bottomItems = bottomItemsContainer
      ? await this._getContainerItems(bottomItemsContainer, promisableResultOptions)
      : null;

    // if (__DEBUG__) {
    //   const topItemsDebug = mapItemsForDebug(topItems);
    //   const bottomItemsDebug = bottomItems ? mapItemsForDebug(bottomItems) : null;
    //   console.groupCollapsed('%cDebug Info: Sections Elements', 'color: #bada55; font-weight: 600;');
    //   console.log('Top Items Container:', topItemsContainer);
    //   console.log('Top Items:', topItemsDebug);
    //   if (bottomItemsContainer) {
    //     console.log('Bottom Items Container:', bottomItemsContainer);
    //     console.log('Bottom Items:', bottomItemsDebug);
    //   }
    //   console.groupEnd();
    // }

    return {
      topItemsContainer,
      topItems,
      bottomItemsContainer,
      bottomItems,
    };
  }

  private _handleSidebarHeader(): void {
    const menuEl = this.sideBarRoot?.querySelector(SELECTOR.MENU) as HTMLElement | null;
    const titleEl = menuEl?.querySelector(SELECTOR.MENU_TITLE) as HTMLElement | null;
    if (!titleEl) return;

    const customTitle = this._config.header_title;
    if (customTitle) titleEl.innerText = customTitle;

    titleEl.classList.add('toggle');

    if (this._config.hide_header_toggle) return;

    const groupKeys = Object.keys(this._config?.custom_groups || {});
    const hasAnyItems = Object.values(this._config.custom_groups || {}).flat().length > 0;
    if (groupKeys.length === 0 || !hasAnyItems) return;

    const isAllCollapsed = this.collapsedItems.size === groupKeys.length;

    const expandCollapseIcon = document.createElement(ELEMENT.HA_ICON) as any;
    expandCollapseIcon.icon = isAllCollapsed ? MDI.PLUS : MDI.MINUS;
    expandCollapseIcon.classList.add(CLASS.COLLAPSE_TOGGLE);
    expandCollapseIcon.classList.toggle(CLASS.ACTIVE, isAllCollapsed);

    // Helps avoid weird touch gestures and delays
    (expandCollapseIcon as HTMLElement).style.touchAction = 'manipulation';

    const toggle = (ev: Event) => {
      ev.stopPropagation();
      // optional: prevents synthetic click paths in some browsers
      if (ev.cancelable) ev.preventDefault();

      this.collapsedItems.size === groupKeys.length
        ? this.collapsedItems.clear()
        : (this.collapsedItems = new Set(groupKeys));

      this._handleCollapsed(this.collapsedItems);
    };

    // Pointer events = one event stream for mouse + touch + pen
    expandCollapseIcon.addEventListener('pointerup', toggle, { passive: false });

    // Remove any existing icon to prevent duplicates when re-rendering header
    titleEl.querySelector(`.${CLASS.COLLAPSE_TOGGLE}`)?.remove();
    titleEl.appendChild(expandCollapseIcon);
  }

  private _handleCollapsedChange(): void {
    const toggleIcon = this.sideBarRoot?.querySelector(SELECTOR.HEADER_TOGGLE_ICON) as HTMLElement;
    if (!toggleIcon) return;
    const collapsedSize = this.collapsedItems.size;
    const groupsLength = Object.keys(this._config?.custom_groups || {}).length;
    const isAllCollapsed = collapsedSize === groupsLength;
    toggleIcon.classList.toggle(CLASS.ACTIVE, isAllCollapsed!);
    toggleIcon.setAttribute('icon', isAllCollapsed ? MDI.PLUS : MDI.MINUS);
  }

  private _addBuiltInPanelsToSidebar(panels: PanelInfo[]): void {
    if (!panels || panels.length === 0) return;
    const scrollbarItems = Array.from(this._scrollbarItems) as SidebarPanelItem[];

    const addedPanels: string[] = [];

    panels.map((panel) => {
      const existingPanel = scrollbarItems.find((el) => {
        const panelId = el.getAttribute(ATTRIBUTE.DATA_PANEL) || el.href.replace('/', '');
        return panelId === panel.url_path;
      });
      if (existingPanel) {
        // Skip if panel already exists
        return;
      }
      // const builtInItem = this._createBuiltInPanelItem(panel);
      const builtInItem = this._createNewItem(panel, true);
      if (builtInItem) {
        this._scrollbar?.appendChild(builtInItem);
        addedPanels.push(panel.url_path!);
      }
    });
    addedPanels.length > 0 && // success
      console.log(
        '%cSIDEBAR-ORGANIZER:%c ✅ Built in panels added',
        'color: #bada55;',
        'color: #40c057; font-weight: 600;',
        addedPanels
      );
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
    const contentDiv = this._createAddedGroupContent(group, isCollapsed) as HTMLElement;
    divider.appendChild(contentDiv);
    if (this._pinnedGroups[group]) {
      contentDiv.id = `pinned-${group}`;
      const haTooltip = document.createElement('ha-tooltip') as any;
      haTooltip.for = `pinned-${group}`;
      haTooltip.innerText = `${group.trim()}`;
      haTooltip.placement = 'right';
      // haTooltip.withoutArrow = true;
      divider.appendChild(haTooltip);
    }
    divider.addEventListener('click', this._toggleGroup.bind(this));
    return divider;
  };

  private _createAddedGroupContent = (group: string, isCollapsed: boolean = false): HTMLElement => {
    if (this._pinnedGroups[group]) {
      const groupDivEl = document.createElement('so-group-divider') as SoGroupDivider;
      groupDivEl.classList.add(CLASS.ADDED_CONTENT);
      groupDivEl.setAttribute(ATTRIBUTE.GROUP, group);
      groupDivEl.classList.toggle(CLASS.COLLAPSED, isCollapsed);
      groupDivEl.customIcon = this._pinnedGroups[group].icon!!;
      groupDivEl.haSidebar = this.HaSidebar;
      return groupDivEl;
    }

    const contentDiv = document.createElement('div');
    contentDiv.classList.add(CLASS.ADDED_CONTENT);
    contentDiv.classList.add('default');
    contentDiv.setAttribute(ATTRIBUTE.GROUP, group);
    contentDiv.innerHTML = `<ha-icon icon="mdi:chevron-down"></ha-icon><span>${group.trim()}</span>`;
    contentDiv.classList.toggle(CLASS.COLLAPSED, isCollapsed);
    return contentDiv;
  };

  private _addBottomItems(): void {
    const bottomItems = this._configPanelMap.get(PANEL_TYPE.BOTTOM_ITEMS) || [];
    const bottomGridItems = this._configPanelMap.get(PANEL_TYPE.BOTTOM_GRID_ITEMS) || [];
    if (bottomItems.length === 0 && bottomGridItems.length === 0) {
      return;
    }
    const panelsList = this._panelsList;
    const afterSpacer = panelsList.querySelector(SELECTOR.AFTER_SPACER) as HTMLElement;
    panelsList.querySelectorAll(`${SELECTOR.DIVIDER}[${ATTRIBUTE.BOTTOM}]`)?.forEach((el) => el.remove());
    // // console.log({ bottomItems, bottomGridItems }, { panelsList, scrollbarItems, afterSpacer });
    // const resetExistingElements = () => {
    //   const existingBottomContainer = panelsList.querySelectorAll(SELECTOR.BOTTOM_CONTAINER);
    //   const emptyExistingGridContainer = panelsList.querySelectorAll(SELECTOR.GRID_CONTAINER);
    //   const dividerExisting = panelsList.querySelectorAll(`${SELECTOR.DIVIDER}[${ATTRIBUTE.BOTTOM}]`);
    //   if (existingBottomContainer.length > 0 || emptyExistingGridContainer.length > 0 || dividerExisting.length > 0) {
    //     existingBottomContainer.forEach((el) => el.remove());
    //     emptyExistingGridContainer.forEach((el) => el.remove());
    //     dividerExisting.forEach((el) => el.remove());
    //   }
    // };
    // resetExistingElements();

    if (bottomItems.length > 0) {
      const bottomContainer = document.createElement('div') as HTMLElement;
      bottomContainer.classList.add('bottom-container');
      bottomItems.forEach((item) => {
        const bottomItem = this._sidebarItems.find((el) => el.getAttribute(ATTRIBUTE.DATA_PANEL) === item);
        if (!bottomItem) return;
        bottomItem.setAttribute(ATTRIBUTE.MOVED, '');
        bottomContainer.appendChild(bottomItem);
      });

      if (bottomContainer.children.length > 0) {
        const bottomDivider = this._createDivider(ATTRIBUTE.BOTTOM);
        panelsList.insertBefore(bottomContainer, afterSpacer);
        panelsList.insertBefore(bottomDivider, afterSpacer);
      }
    }

    if (bottomGridItems.length > 0) {
      const gridContainer = document.createElement('div') as HTMLElement;
      gridContainer.classList.add('grid-container');
      bottomGridItems.forEach((item) => {
        const panel = this._sidebarItems.find((el) => el.getAttribute(ATTRIBUTE.DATA_PANEL) === item);
        if (!panel) return;

        panel.setAttribute(ATTRIBUTE.GRID_ITEM, '');
        panel.addEventListener(EVENT.MOUSEENTER, this._mouseEnterBinded);
        panel.addEventListener(EVENT.MOUSELEAVE, this._mouseLeaveBinded);
        gridContainer.appendChild(panel);
      });

      if (gridContainer.children.length > 0) {
        panelsList.querySelector(SELECTOR.GRID_CONTAINER)?.remove();
        const divider = this._createDivider(ATTRIBUTE.BOTTOM);
        panelsList.insertBefore(gridContainer, afterSpacer);
        panelsList.insertBefore(divider, afterSpacer);
      }
    }
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
      this._config = config;
      const resetConfigPromise = () =>
        new Promise<void>((resolve) => {
          setStorage(STORAGE.UI_CONFIG, this._config);
          localStorage.removeItem(STORAGE.PANEL_ORDER);
          localStorage.removeItem(STORAGE.HIDDEN_PANELS);
          resolve();
        });
      resetConfigPromise().then(() => {
        this._reloadWindow();
      });
    }
  }

  private async _handleCollapsed(collapsedItems: Set<string>) {
    setStorage(STORAGE.COLLAPSE, [...collapsedItems]);
    // Wait for the DOM to update after collapsing/expanding groups
    await nextRender();
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
    const textTransform = this._config?.text_transformation || 'capitalize';

    // Custom Styles
    const customStyles = colorConfig.custom_styles || [];
    const CUSTOM_STYLES = convertCustomStyles(customStyles) || '';

    const defaultColors: DividerColorSettings = getDefaultThemeColors(
      customTheme !== undefined ? this.HaSidebar : undefined
    );

    // console.log('Default Colors:', defaultColors);
    // console.log('theme', customTheme, 'colorConfig', colorConfig, 'defaultColors', defaultColors);
    const getColor = (key: string): string => {
      const color = colorConfig?.[key] ? `${colorConfig[key]} !important` : defaultColors[key];
      // console.log('Color:', key, color);
      return color;
    };
    const forceTransparentBackground = this._config?.force_transparent_background === true;

    const colorCssConfig = {
      '--divider-color': getColor('divider_color'),
      '--divider-bg-color': getColor('background_color'),
      '--divider-border-top-color': getColor('border_top_color'),
      '--scrollbar-thumb-color': getColor('scrollbar_thumb_color'),
      '--sidebar-background-color': getColor('custom_sidebar_background_color'),
      '--divider-border-radius': borderRadius,
      '--divider-margin-radius': marginRadius,
      '--sidebar-text-color': getColor('divider_text_color'),
      '--sidebar-text-transform': textTransform,
    };

    // If force transparent background is enabled, override related colors and add backdrop filter styles
    if (forceTransparentBackground) {
      colorCssConfig['--sidebar-background-color'] = 'transparent';
      colorCssConfig['--so-tooltip-background-color'] = 'var(--primary-background-color)';
      colorCssConfig['--so-tooltip-text-color'] = 'var(--primary-text-color)';
      colorCssConfig['--so-backdrop-filter'] = 'blur(10px)';
      this._styleManager.addStyle([DRAWER_STYLE.toString()], this._haDrawer!.shadowRoot!);
    }

    const CUSTOM_COLOR_CONFIG = `:host {${Object.entries(colorCssConfig)
      .map(([key, value]) => `${key}: ${value};`)
      .join('')}}`;

    this._styleManager.addStyle(
      [CUSTOM_COLOR_CONFIG, CUSTOM_STYLES, DIVIDER_ADDED_STYLE.toString()],
      this.sideBarRoot!
    );
  }

  private _reorderPanelItemsByConfig(currentPanel: string[]): string[] {
    const defaultPanel = getDefaultPanelUrlPath(this.hass);
    const customGroups = this._config.custom_groups || {};
    const bottomMovedItems = this._config.bottom_items || [];
    const bottomGridItems = this._config.bottom_grid_items || [];

    // Get grouped items
    const groupedItems = Object.values(customGroups)
      .flat()
      .filter((item) => currentPanel.includes(item));

    // Filter default items that are not in grouped or bottom items
    const defaultItems = currentPanel.filter(
      (item) => !groupedItems.includes(item) && !bottomMovedItems.includes(item) && !bottomGridItems.includes(item)
    );

    // Move default panel item to the front
    const defaultPanelItem = defaultItems.find((item) => item === defaultPanel);
    if (defaultPanelItem) {
      defaultItems.splice(defaultItems.indexOf(defaultPanelItem), 1);
      groupedItems.unshift(defaultPanelItem);
    }

    // Combine grouped, default, and bottom items
    const reorderedPanels = [...groupedItems, ...defaultItems, ...bottomMovedItems, ...bottomGridItems];

    return reorderedPanels;
  }

  public _checkDiffs = (): void => {
    const baseOrder = this._baseOrder;
    // const _allItems = Array.from(this._allItems);
    const _allItems = Array.from(this._sidebarItems);
    const itemsValidation = mapItemsForDebug(_allItems, true);

    if (itemsValidation.some((item) => item.isValid === false)) {
      const logs = {
        baseOrder: baseOrder,
        notValidItems: itemsValidation.filter((item) => item.isValid === false).map((item) => item.panelId),
      };
      // warning
      console.log(
        '%cSIDEBAR-ORGANIZER:%c ⚠️ DIFF DETECTED',
        'color: #bada55;',
        'color: #fab005; font-weight: 600;',
        logs
      );

      LOGGER.warn('Changes detected:', logs);

      this._diffCheck = false;
      this._store._needReloadToast();
    } else {
      this._diffCheck = true;
      // success
      console.log('%cSIDEBAR-ORGANIZER:%c ✅ Order checked!', 'color: #bada55;', 'color: #40c057; font-weight: 600;');
    }
  };

  // Watch for HA sidebar updates and prevent re-render if not necessary
  private _watchHaSidebarShouldUpdate(): void {
    if (!this.hass || !customElements.get(ELEMENT.HA_SIDEBAR)) {
      return;
    }
    customElements.whenDefined(ELEMENT.HA_SIDEBAR).then((sidebar: CustomElementConstructor) => {
      //info
      console.log('%cSIDEBAR-ORGANIZER:%c ℹ️ Add Sidebar Watch shouldupdate', 'color: #bada55;', 'color: #228be6;');
      const shouldUpdate = sidebar.prototype.shouldUpdate;
      sidebar.prototype.shouldUpdate = function (changedProps: Map<string, unknown>): boolean {
        if (this.hass.config.state !== HA_STATE.RUNNING) {
          console.log('Sidebar should not update due to HA state or irrelevant prop change:', {
            haState: this.hass.config.state,
            changedProps: Array.from(changedProps.keys()),
          });
          return false;
        }
        return shouldUpdate.call(this, changedProps);
      };
    });
  }

  private _createNewItem(itemConfig: NewItemConfig, builtIn: boolean = false): SidebarPanelItem {
    const item = computeNewItem(this.hass, itemConfig, builtIn);
    if (itemConfig.notification !== undefined) {
      this._subscribeNotification(item, itemConfig.notification!);
    }
    item.addEventListener(EVENT.MOUSEENTER, this._mouseEnterBinded);
    item.addEventListener(EVENT.MOUSELEAVE, this._mouseLeaveBinded);
    return item;
  }

  private async _mouseEnter(event: MouseEvent) {
    const sidebarElement = (await this._sidebar.element) as Sidebar;
    const target = event.currentTarget as HTMLElement;
    const targetIsGridItem = target.hasAttribute('grid-item');
    if (sidebarElement.alwaysExpand && !targetIsGridItem) {
      return;
    }

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
    let badge = panel.querySelector(SELECTOR.BADGE) ?? computeBadge();
    let notifyIcon = panel.querySelector(SELECTOR.NOTIFY_ICON) ?? computeNotifyIcon();
    const itemText = panel.querySelector(SELECTOR.ITEM_TEXT) as HTMLElement;
    panel.insertBefore(badge, itemText.nextElementSibling);
    panel.insertBefore(notifyIcon, itemText);
    panel.setAttribute(ATTRIBUTE.DATA_NOTIFICATION, 'true');

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

  private _subscribeVisibility(panel: HTMLElement, template: string) {
    const callback = (result: any) => {
      if (result != null) {
        const isVisible = (typeof result === 'string' ? result.toLowerCase() === 'true' : Boolean(result)) ?? true;
        if (!isVisible) {
          panel.style.display = 'none';
        } else {
          panel.style.removeProperty('display');
        }
      }
    };

    this._subscribeTemplate(template, callback);
  }

  private _toggleGroup(event: MouseEvent) {
    event.stopPropagation();
    const noAnimation = this._config?.animation_off || false;
    const animationDelay = this._config?.animation_delay || 50;
    const target = event.target as HTMLElement;
    const group = target.getAttribute('group');
    // const targetParent = target.parentElement as HTMLElement;
    // console.log('%cSIDEBAR-ORGANIZER:', 'color: #bada55;', 'Toggling group:', group, target, targetParent);

    const items = Array.from(this._scrollbarItems).filter((item) => {
      const itemGroup = item.getAttribute('group');
      return itemGroup === group && !item.hasAttribute('moved');
    }) as HTMLElement[];

    if (!items.length) {
      console.error(`No items found for group: ${group}`);
      return;
    }

    const isCollapsed = items[0].classList.contains(CLASS.COLLAPSED);

    // Accordion mode: collapse all other groups when opening one
    if (this._config?.accordion_mode && isCollapsed) {
      const allGroups = Object.keys(this._config?.custom_groups || {});
      allGroups.forEach((otherGroup) => {
        if (otherGroup !== group && !this.collapsedItems.has(otherGroup)) {
          this._collapseGroup(otherGroup, noAnimation, animationDelay);
        }
      });
    }

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
          item.classList.toggle(CLASS.COLLAPSED, !isCollapsed);
          item.classList.remove(animationClass);
        },
        { once: true }
      );
    });
  }

  private _collapseGroup(group: string, noAnimation: boolean, animationDelay: number) {
    const items = Array.from(this._scrollbarItems).filter((item) => {
      return item.getAttribute('group') === group && !item.hasAttribute('moved');
    }) as HTMLElement[];
    if (!items.length) return;

    this._setItemToLocalStorage(group, true);

    // Update divider state
    const divider = this._scrollbar.querySelector(`${SELECTOR.DIVIDER_ADDED}[${ATTRIBUTE.GROUP}="${group}"]`);
    if (divider) {
      divider.classList.add(CLASS.COLLAPSED);
      divider.querySelector(SELECTOR.ADDED_CONTENT)?.classList.add(CLASS.COLLAPSED);
    }

    if (noAnimation) {
      items.forEach((item) => item.classList.add(CLASS.COLLAPSED));
      return;
    }
    items.forEach((item, index) => {
      item.style.animationDelay = `${index * animationDelay}ms`;
      item.classList.add('slideOut');
      item.addEventListener('animationend', () => {
        item.classList.add(CLASS.COLLAPSED);
        item.classList.remove('slideOut');
      }, { once: true });
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

  public _reloadWindow(timeout: number = 1000): void {
    this._store._showToast('Reloading window to apply changes...');
    setTimeout(() => {
      window.location.reload();
    }, timeout);
  }

  public _getGroupOfPanel = (panel: string): string | null => {
    const group = [...this._configPanelMap.entries()].find(([, items]) => items.includes(panel));
    return group ? group[0] : null;
  };

  _removeSidebarConfigFromStorage = () => {
    return clearSidebarOrganizerStorage();
  };

  _removeUserSidebarData = () => {
    return clearSidebarUserData(this.hass.connection);
  };
}

declare global {
  interface Window {
    SidebarOrganizer: SidebarOrganizer;
  }
}

// Initial Run

if (!window.SidebarOrganizer) {
  if (__DEBUG__) {
    console.clear();
  }
  window.SidebarOrganizer = new SidebarOrganizer();
}
