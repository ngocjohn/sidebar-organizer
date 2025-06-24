import {
  ALERT_MSG,
  ATTRIBUTE,
  CLASS,
  CUSTOM_EVENT,
  ELEMENT,
  HA_EVENT,
  NAMESPACE,
  NAMESPACE_TITLE,
  PATH,
  REPO_URL,
  SELECTOR,
  SHOW_AFTER_BOTTOM,
  SLOT,
  STORAGE,
  TAB_STATE,
  VERSION,
} from '@constants';
import { mdiInformation, mdiArrowExpand } from '@mdi/js';
import {
  HaExtened,
  NewItemConfig,
  Panels,
  PartialPanelResolver,
  SidebarConfig,
  SidebarPanelItem,
  ThemeSettings,
} from '@types';
import { applyTheme } from '@utilities/apply-theme';
import { fetchConfig, validateConfig } from '@utilities/configs';
import { getCollapsedItems, isBeforeChange } from '@utilities/configs/misc';
import { getDefaultThemeColors, convertCustomStyles } from '@utilities/custom-styles';
import { fetchDashboards, LovelaceDashboard } from '@utilities/dashboard';
import {
  addAction,
  createCloseHeading,
  getInitPanelOrder,
  getSiderbarEditDialog,
  onPanelLoaded,
} from '@utilities/dom-utils';
import { fetchFrontendUserData, saveFrontendUserData } from '@utilities/frontend';
import { isIcon } from '@utilities/is-icon';
import { TRANSLATED_LABEL } from '@utilities/localize';
import * as LOGGER from '@utilities/logger';
import { showAlertDialog, showConfirmDialog } from '@utilities/show-dialog-box';

import './components/sidebar-dialog';

import { getHiddenPanels, getStorage, removeStorage, setStorage } from '@utilities/storage-utils';
import { ACTION_TYPES, addHandlerActions } from '@utilities/tap-action';
import { hasTemplate, subscribeRenderTemplate } from '@utilities/ws-templates';
import { getPromisableResult } from 'get-promisable-result';
import { HAElement, HAQuerySelector, HAQuerySelectorEvent, OnPanelLoadDetail } from 'home-assistant-query-selector';
import { HomeAssistantStylesManager } from 'home-assistant-styles-manager';
import { html } from 'lit';

import { SidebarConfigDialog } from './components/sidebar-dialog';
import { DIALOG_STYLE, DIVIDER_ADDED_STYLE } from './sidebar-css';

class SidebarOrganizer {
  constructor() {
    const instance = new HAQuerySelector();

    instance.addEventListener(HAQuerySelectorEvent.ON_LISTEN, async (event) => {
      const { HOME_ASSISTANT, HOME_ASSISTANT_MAIN, HA_DRAWER, HA_SIDEBAR } = event.detail;
      this.ha = (await HOME_ASSISTANT.element) as HaExtened;
      this.main = (await HOME_ASSISTANT_MAIN.selector.$.element) as ShadowRoot;
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
    [HA_EVENT.SETTHEME, HA_EVENT.DEFAULT_PANEL, HA_EVENT.DIALOG_CLOSED, HA_EVENT.LOCATION_CHANGED].forEach((event) => {
      window.addEventListener(event, this._handleHaEvents.bind(this));
    });
    this._currentPath = window.location.pathname;
    this._watchPathChanges();
    this._sidebarItems = [];
  }

  private ha?: HaExtened;
  private _config: SidebarConfig = {};
  private HaSidebar: any;
  private main!: ShadowRoot;
  private sideBarRoot!: ShadowRoot;
  private _panelResolver!: HAElement;
  private _sidebar!: HAElement;
  private _haDrawer: any;
  public _baseOrder: string[] = [];
  public _hiddenPanels: string[] = [];
  private _styleManager: HomeAssistantStylesManager;
  private _sidebarDialog?: SidebarConfigDialog;
  private collapsedItems = new Set<string>();
  private _bottomItems: string[] = [];
  private _newItems: string[] = [];
  private _dialogLarge: boolean = false;
  private firstSetUpDone = false;
  private setupConfigDone = false;
  private _diffCheck: boolean = false;
  private _prevPath: string | null = null;
  private _currentPath: string;
  private _delayTimeout: number | null = null;
  private _hassPanelsChanged: boolean = false;
  private _notCompatible: boolean = false;
  private _userHasSidebarSettings: boolean = false;
  private _itemsLength: number | null = null;
  private _sidebarItems: SidebarPanelItem[];
  private _currentDashboards: LovelaceDashboard[] = [];

  get hass(): HaExtened['hass'] {
    return this.ha!.hass;
  }

  get darkMode(): boolean {
    const forceTheme = this._config.color_config?.custom_theme?.mode;
    if (forceTheme === 'dark') {
      return true;
    } else if (forceTheme === 'light') {
      return false;
    } else if (forceTheme === 'auto') {
      return this.hass.themes.darkMode;
    } else {
      return this.hass.themes.darkMode;
    }
  }

  get _scrollbar(): HTMLElement {
    return this.sideBarRoot?.querySelector('ha-md-list.ha-scrollbar') as HTMLElement;
  }

  get _scrollbarItems(): NodeListOf<HTMLElement> {
    return this._scrollbar.querySelectorAll(ELEMENT.ITEM) as NodeListOf<HTMLElement>;
  }

  get _hasSidebarConfig(): boolean {
    const sidebarConfig = localStorage.getItem(STORAGE.UI_CONFIG);
    return sidebarConfig !== null && sidebarConfig !== undefined;
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

  private async _checkUserSidebarSettings() {
    const userData = await fetchFrontendUserData(this.hass.connection, 'sidebar');
    this._userHasSidebarSettings = (userData && userData?.panelOrder?.length > 0) || false;
    console.log('User has sidebar settings:', this._userHasSidebarSettings);
  }

  private _watchEditSidebar() {
    this.main.addEventListener('show-dialog', async (ev: any) => {
      if (ev.detail?.dialogTag === 'dialog-edit-sidebar') {
        console.log('Edit Sidebar Dialog Opened');
        if (!this._userHasSidebarSettings && this._hasSidebarConfig) {
          console.log('User has no sidebar settings, showing alert');
          setTimeout(async () => {
            const dialog = await getSiderbarEditDialog(this.ha!);
            if (dialog) {
              dialog._open = false; // Close the dialog if it was opened
              const confirm = await showConfirmDialog(
                this._haDrawer,
                `You have a saved sidebar configuration in your browser's local storage. Modifying the sidebar using the built-in Home Assistant editor will not apply your saved configuration and the sidebar will revert to the default state. Do you want to show the sidebar organizer dialog instead?`,
                'Show Sidebar Organizer',
                'Cancel'
              );
              if (confirm) {
                dialog._open = false; // Close the dialog if it was opened
                dialog?.remove();
                this._addConfigDialog();
              } else {
                console.log('User chose to continue with the default sidebar editor');
                dialog._open = true; // Keep the dialog open
              }
            }
          }, 100);
        }
      }
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

  // private _watchPathChanges() {
  //   const callback = () => {
  //     // Delay the check to allow path to update fully
  //     if (this._delayTimeout) {
  //       clearTimeout(this._delayTimeout);
  //     }

  //     this._delayTimeout = window.setTimeout(() => {
  //       const newPath = window.location.pathname;
  //       if (newPath !== this._currentPath) {
  //         this._prevPath = this._currentPath;
  //         this._currentPath = newPath;
  //         if (
  //           this._prevPath !== null &&
  //           this._prevPath === PATH.LOVELACE_DASHBOARD &&
  //           this._currentPath !== PATH.LOVELACE_DASHBOARD
  //         ) {
  //           // this._checkDashboardChange();
  //         }
  //       }
  //     }, 200); // Delay in ms
  //   };

  //   const pushState = history.pushState;
  //   const replaceState = history.replaceState;

  //   history.pushState = function (...args) {
  //     pushState.apply(this, args);
  //     callback();
  //   };

  //   history.replaceState = function (...args) {
  //     replaceState.apply(this, args);
  //     callback();
  //   };

  //   window.addEventListener('popstate', callback);
  // }

  private async _handleDashboardChanged(dashboard: LovelaceDashboard): Promise<void> {
    if (!dashboard) return;
    const { url_path, show_in_sidebar } = dashboard;
    console.log('Dashboard URL Path:', url_path, 'in config:', this._getItemInConfig(url_path));
    if (!this._getItemInConfig(url_path)) return;

    const currentDashboards = await fetchDashboards(this.hass);
    const changedItem = currentDashboards.find((d: LovelaceDashboard) => d.url_path === url_path)!;
    console.log('Current Item:', changedItem, 'Changed Dashboard:', dashboard);
    if (show_in_sidebar !== changedItem.show_in_sidebar && !changedItem.show_in_sidebar) {
      // item was hidden from sidebar
      console.log('Dashboard was hidden from sidebar:', url_path);
      // Remove from config
      const config = { ...this._config };
      const { custom_groups = {}, bottom_items = [], hidden_items = [] } = config;
      const inGroup = this._getItemInConfig(url_path);
      if (inGroup === 'bottom_items' || inGroup === 'hidden_items') {
        [bottom_items, hidden_items].forEach((list) => {
          const index = list.indexOf(url_path);
          if (index !== -1) {
            list.splice(index, 1);
          }
        });
      } else {
        // remove from custom groups
        Object.entries(custom_groups).forEach(([key, value]) => {
          if (value.includes(url_path)) {
            custom_groups[key] = value.filter((item) => item !== url_path);
          }
        });
      }
      // remove from panel order
      const _baseOrder = this._baseOrder.filter((panel) => panel !== url_path);
      Object.assign(config, {
        custom_groups,
        bottom_items,
        hidden_items,
      });
      setStorage(STORAGE.UI_CONFIG, config);
      setStorage(STORAGE.HIDDEN_PANELS, hidden_items);
      setStorage(STORAGE.PANEL_ORDER, _baseOrder);
      this._config = config;
      console.log('Updated Config:', this._config);
    }
  }

  private async _checkDashboardChange(): Promise<void> {
    const _baseOrder = this._baseOrder;

    const dashboards = await fetchDashboards(this.hass).then((dashboards) => {
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

    let changed = false;
    const notShowItems = dashboards.notInSidebar.filter((panel) => _baseOrder.includes(panel));
    const addedNewItems = dashboards.inSidebar.filter((panel) => !_baseOrder.includes(panel));
    if (notShowItems.length > 0) {
      console.log('Not show items', notShowItems);
      const _baseOrder = [...this._baseOrder];
      const config = { ...this._config };
      const { custom_groups = {}, bottom_items = [], hidden_items = [] } = config;

      notShowItems.forEach((panel) => {
        // remove from custom groups
        Object.entries(custom_groups).forEach(([key, value]) => {
          if (value.includes(panel)) {
            custom_groups[key] = value.filter((item) => item !== panel);
          }
        });

        [bottom_items, hidden_items].forEach((list) => {
          const i = list.indexOf(panel);
          if (i !== -1) {
            list.splice(i, 1);
          }
        });

        // remove from panel order
        const index = _baseOrder.indexOf(panel);
        if (index !== -1) {
          _baseOrder.splice(index, 1);
        }
      });

      // new panel storage
      Object.assign(config, {
        custom_groups,
        bottom_items,
        hidden_items,
      });
      setStorage(STORAGE.UI_CONFIG, config);
      setStorage(STORAGE.HIDDEN_PANELS, hidden_items);
      setStorage(STORAGE.PANEL_ORDER, _baseOrder);
      changed = true;
    } else if (addedNewItems.length > 0) {
      console.log('Added new Panels:', addedNewItems);
      // check if is in  hidden panels
      const hiddenPanels = this._hiddenPanels;
      const _baseOrder = [...this._baseOrder];
      const isHidden = addedNewItems.filter((panel) => hiddenPanels.includes(panel));
      console.log('Hidden Panels:', isHidden);
      if (isHidden.length > 0) {
        // remove from hidden panels
        hiddenPanels.forEach((panel) => {
          const i = hiddenPanels.indexOf(panel);
          if (i !== -1) {
            hiddenPanels.splice(i, 1);
          }
        });
      }
      this._config.hidden_items = hiddenPanels;
      _baseOrder.push(...addedNewItems);
      setStorage(STORAGE.UI_CONFIG, this._config);
      setStorage(STORAGE.HIDDEN_PANELS, hiddenPanels);
      setStorage(STORAGE.PANEL_ORDER, _baseOrder);

      changed = true;
    }
    if (changed) {
      setTimeout(() => {
        window.location.reload();
      }, 200);
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

  public async run() {
    if (isBeforeChange()) {
      console.warn(ALERT_MSG.NOT_COMPATIBLE, '\n', ALERT_MSG.VERSION_INFO);
      this._notCompatible = true;
      return;
    }
    await this._checkUserSidebarSettings();
    this._setupConfigBtn();

    this._watchEditSidebar();

    if (!this.firstSetUpDone && !this._userHasSidebarSettings) {
      await this._getConfig();
      this._processConfig();
    }
    // if (!this.firstSetUpDone) {
    //   await this._setDataPanel();
    //   await new Promise((resolve) => {
    //     setTimeout(() => {
    //       this._handleFirstConfig();
    //       resolve(true);
    //     }, 0);
    //   });
    // }

    // if (this.firstSetUpDone && !this.setupConfigDone) {
    //   await this._getConfig();
    //   this._handleSidebarHeader();
    //   this.setupConfigDone = true;
    // }
    // if (this.firstSetUpDone && !this.setupConfigDone) {
    //   await this._getConfig();
    //   this._handleSidebarHeader();
    //   this.setupConfigDone = true;
    // }

    // const sidebar = customElements.get('ha-sidebar') as any;
    // this._handleSidebarUpdate(sidebar);
  }

  private _processConfig(): void {
    this._getElements().then((elements) => {
      const { bottom_items, custom_groups, color_config } = this._config;
      const [sidebarItemsContainer, scrollbarItems, spacer] = elements;
      // this.collapsedItems = getCollapsedItems(custom_groups, default_collapsed);
      this._sidebarItems = Array.from(scrollbarItems) as SidebarPanelItem[];

      for (const item of Array.from(scrollbarItems) as SidebarPanelItem[]) {
        const isNewItem = item.hasAttribute('newitem');
        const isConfigOrDevTools = SHOW_AFTER_BOTTOM.includes(item.href);
        if (isNewItem || isConfigOrDevTools) continue; // Skip processing for these items
        item.setAttribute('data-panel', item.href.replace('/', ''));
      }

      const initOrder = Array.from(scrollbarItems)
        .filter((item) => !SHOW_AFTER_BOTTOM.includes(item.href))
        .map((item) => item.getAttribute(ATTRIBUTE.DATA_PANEL) || item.href.replace('/', ''));

      const combinedOrder = this._handleGroupedPanelOrder(initOrder);
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
      // console.log(
      //   'Ordered Items:',
      //   orderedItems.map((item: SidebarPanelItem) => ({
      //     panel: item.getAttribute(ATTRIBUTE.DATA_PANEL),
      //     href: item.href,
      //   }))
      // );

      // rearrange the items in the sidebar by their new order

      this._sidebarItems.forEach((item) => {
        const itemToMove = Array.from(scrollbarItems).find(
          (el) => el.getAttribute(ATTRIBUTE.DATA_PANEL) === item.getAttribute(ATTRIBUTE.DATA_PANEL)
        );
        if (itemToMove && SHOW_AFTER_BOTTOM.indexOf(itemToMove.href) === -1) {
          // Move the item to the new position
          sidebarItemsContainer.insertBefore(itemToMove, spacer);
        }
      });

      // Handle bottom items
      if (bottom_items && bottom_items.length > 0) {
        this._bottomItems = bottom_items;
        this._addBootomItems();
      }

      // Handle custom groups
      if (custom_groups && Object.keys(custom_groups).length > 0) {
        this._handleItemsGroup(custom_groups);
      }

      // Reorder grouped items
      this._reorderGroupedSidebar();

      // Add additional styles
      this._addAdditionalStyles(color_config);
      this._handleSidebarHeader();
      this.setupConfigDone = true;
      this.firstSetUpDone = true;
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
      case HA_EVENT.SETTHEME:
        const themeSetting = detail as ThemeSettings;
        console.log('Theme Changed', themeSetting);
        this._addAdditionalStyles(this._config.color_config);
        break;
      case HA_EVENT.DEFAULT_PANEL:
        this._handleDefaultPanelChange(detail.defaultPanel);
        break;

      // case HA_EVENT.LOCATION_CHANGED:
      //   // this._panelLoaded();
      //   const changed = detail.replace;
      //   // console.log('Location Changed', changed);
      //   if (changed) {
      //     const path = (await this._panelResolver.element) as PartialPanelResolver;
      //     const pathName = path.route?.path || '';
      //     const paperListbox = this._scrollbar;
      //     onPanelLoaded(pathName, paperListbox);
      //   }
      //   break;
    }
  }

  private _handleDefaultPanelChange(defaultPanel: string) {
    const customGroups = this._config?.custom_groups || {};
    let defaultInGroup = false;

    // Remove the default panel from any custom group if it exists
    Object.entries(customGroups).forEach(([key, groupItems]) => {
      const index = groupItems.indexOf(defaultPanel);
      if (index !== -1) {
        defaultInGroup = true;
        groupItems.splice(index, 1); // Remove the panel from the group
        console.log(`Removed ${defaultPanel} from group: ${key}`);
      }
    });

    if (defaultInGroup) {
      // Update the config and reload the page
      console.log('Custom Group Changed, updating config', customGroups);
      this._config = { ...this._config, custom_groups: customGroups };
      setStorage(STORAGE.UI_CONFIG, this._config);
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } else {
      console.log('Default Panel Changed', defaultPanel);
      this._setupConfig(this._config);
    }
  }

  private async _handleFirstConfig() {
    const storedPanelOrder = getStorage(STORAGE.PANEL_ORDER);
    console.log('Stored Panel Order:', storedPanelOrder);
    if (JSON.parse(storedPanelOrder || '[]').length !== this._itemsLength || !storedPanelOrder) {
      console.log('Panel Order Length Mismatch, resetting to default');
      [STORAGE.PANEL_ORDER, STORAGE.COLLAPSE].forEach((key) => {
        removeStorage(key);
      });
      setStorage(STORAGE.PANEL_ORDER, this._baseOrder);
    } else {
      this._baseOrder = JSON.parse(storedPanelOrder);
      console.log('Using Stored Panel Order:', this._baseOrder);
    }

    const storedHiddenPanels = getHiddenPanels();
    this._hiddenPanels = storedHiddenPanels || [];

    this.HaSidebar._panelOrder = [...this._baseOrder];
    this.HaSidebar._hiddenPanels = [...this._hiddenPanels];

    console.log('Initial Panel Order:', this._baseOrder, 'Initial Hidden Panels:', this._hiddenPanels);
    this.firstSetUpDone = true;
  }

  private async _getConfig() {
    const config = await fetchConfig(this.hass);
    console.log('Fetched Config:', config);
    if (config) {
      this._config = config;
      this._setupInitialConfig();
      // this._setupConfig(this._config);
    }
  }

  private _setupInitialConfig() {
    console.log('Setting up initial config');
    const { new_items, default_collapsed, custom_groups, hidden_items } = this._config;
    this.collapsedItems = getCollapsedItems(custom_groups, default_collapsed);
    this._handleHidden(hidden_items || []);
    this._addNewItems(new_items || []);
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
    // await this.hass.loadFragmentTranslation('lovelace');
  }

  private async _addDiaglogRemoveLegacyUserData() {
    const confirmMsg = `For using sidebar organizer you need to clear your synced settings in this user's Home Assistant profile.`;

    const getInitPanelOrderMsg = `User data cleared successfully. Click 'OK' to get the initial panel order, this will reload page.`;

    const clearUserData = async () => {
      try {
        await saveFrontendUserData(this.hass.connection, 'sidebar', {
          panelOrder: [],
          hiddenPanels: [],
        });
        console.log('User data cleared successfully');
        this._checkUserSidebarSettings();
        const confirmGetInitPanelOrder = await showConfirmDialog(this._haDrawer, getInitPanelOrderMsg, 'OK', 'Cancel');
        if (confirmGetInitPanelOrder) {
          if (this._hasSidebarConfig) {
            console.log('User has sidebar config, getting initial panel order');
            window.location.reload();
          } else {
            this._getInitPanelOrder();
          }
          return;
        } else {
          await showAlertDialog(this._haDrawer, 'User data cleared, but initial panel order not set.');
        }
      } catch (err: any) {
        console.error('Error clearing user data:', err);
        await showAlertDialog(this._haDrawer, `Error clearing user data: ${err.message}`);
      }
    };

    const confirm = await showConfirmDialog(this._haDrawer, confirmMsg, 'Clear', 'Cancel');
    if (confirm) {
      await clearUserData();
    } else {
      console.log('User data clearing cancelled');
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

  private async _setupConfig(config: SidebarConfig) {
    const {
      color_config = {},
      bottom_items = [],
      custom_groups = {},
      hidden_items = [],
      default_collapsed = [],
      new_items = [],
    } = config;

    this.collapsedItems = getCollapsedItems(custom_groups, default_collapsed);
    this._handleHiddenPanels(hidden_items);
    this._addNewItems(new_items);
    this._addAdditionalStyles(color_config);
    this._handleBottomPanels(bottom_items);
    this._handleItemsGroup(custom_groups);

    this._initSidebarOrdering();

    // Start the sidebar ordering
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

  private _initSidebarOrdering = async () => {
    const currentPanel = this.HaSidebar._panelOrder;
    console.log('Current Panel Order:', currentPanel);
    this._baseOrder = this._handleGroupedPanelOrder(currentPanel);
    // console.log('init new Base Order:', this._baseOrder);
    setStorage(STORAGE.PANEL_ORDER, this._baseOrder);
    console.log('Base Order:', this._baseOrder);
    this.HaSidebar._panelOrder = this._baseOrder;
    this._handleNewPanelOrder();
  };

  private _handleHidden(hiddenItems: string[]) {
    if (!hiddenItems || hiddenItems.length === 0) return;
    this._hiddenPanels = [...hiddenItems];
    this.HaSidebar._hiddenPanels = [...this._hiddenPanels];
    console.log('Hidden Panels Setup Done');
  }
  private _handleHiddenPanels(hiddenItems: string[]) {
    if (!hiddenItems || hiddenItems.length === 0) return;
    this._hiddenPanels = [...hiddenItems];
    this.HaSidebar._hiddenPanels = [...this._hiddenPanels];
    this._baseOrder = this._baseOrder.filter((panel) => !hiddenItems.includes(panel));
    this.HaSidebar._panelOrder = [...this._baseOrder];
    console.log('Hidden Panels Setup Done');
  }

  private _handleBottomPanels(bottomItems: string[]) {
    if (!bottomItems || bottomItems.length === 0) return;
    const scrollbarItems = Array.from(this._scrollbarItems);
    const spacer = this._scrollbar.querySelector(SELECTOR.SPACER) as HTMLElement;

    [...bottomItems].reverse().forEach((item, index) => {
      const panel = scrollbarItems.find((panel) => panel.getAttribute('data-panel') === item);
      if (panel) {
        panel.setAttribute('moved', '');
        this._scrollbar.insertBefore(panel, spacer.nextSibling);
        if (index === 0) {
          const divider = this.sideBarRoot!.querySelector(
            `${ELEMENT.DIVIDER}:not([added]):not([ungrouped]):not([bottom])`
          ) as HTMLElement;
          // console.log('divider:', divider);
          const bottomDivider = divider.cloneNode(true) as HTMLElement;
          bottomDivider.setAttribute('bottom', '');
          // console.log('Adding Divider', panel, item);
          this._scrollbar.insertBefore(bottomDivider, panel.nextSibling);
        }
      }
    });

    this._bottomItems = [...bottomItems];

    // console.log('Config Bottom Items:', bottomItems, 'instace bottom items:', this._bottomItems);
    console.log('Bottom items setup done');
  }

  private _addBootomItems(): void {
    if (this._bottomItems.length === 0) return;
    const bottomItems = this._bottomItems;
    const scrollbarItems = Array.from(this._scrollbarItems);
    const spacer = this._scrollbar.querySelector(SELECTOR.SPACER) as HTMLElement;

    bottomItems.forEach((item) => {
      const panel = scrollbarItems.find((el) => el.getAttribute(ATTRIBUTE.DATA_PANEL) === item);
      if (panel) {
        panel.setAttribute('moved', '');
      }
    });

    const bottomFirstItem = scrollbarItems.find((el) => el.getAttribute(ATTRIBUTE.DATA_PANEL) === bottomItems[0]);
    const bottomLastItem = scrollbarItems.find(
      (el) => el.getAttribute(ATTRIBUTE.DATA_PANEL) === bottomItems[bottomItems.length - 1]
    );

    if (bottomFirstItem) {
      this._scrollbar.insertBefore(spacer, bottomFirstItem);
      if (bottomLastItem) {
        const divider = this.sideBarRoot!.querySelector(
          `${ELEMENT.DIVIDER}:not([added]):not([ungrouped]):not([bottom])`
        ) as HTMLElement;

        const bottomDivider = divider.cloneNode(true) as HTMLElement;
        bottomDivider.setAttribute('bottom', '');
        this._scrollbar.insertBefore(divider, bottomLastItem.nextSibling);
      }
    }
    console.log('Bottom items setup done');
  }

  private _addConfigDialog() {
    const BTN_LABEL = TRANSLATED_LABEL.BTN_LABEL;
    this._haDrawer.open!! = false;
    // Remove any existing dialog
    const existingDialog = this.main.querySelector(SELECTOR.SIDEBAR_CONFIG_DIALOG) as HTMLElement;
    existingDialog?.remove();

    // Create new dialog elements
    const sidebarDialog = document.createElement(ELEMENT.SIDEBAR_CONFIG_DIALOG) as SidebarConfigDialog;
    sidebarDialog.hass = this.hass;
    sidebarDialog._sideBarRoot = this.sideBarRoot;
    this._sidebarDialog = sidebarDialog;
    this._sidebarDialog.addEventListener(CUSTOM_EVENT.CONFIG_DIFF, () => this._checkDashboardChange());
    // this._sidebarDialog.addEventListener(CUSTOM_EVENT.UI_EDITOR, () => setCodeUILabel());

    const haDialog = document.createElement('ha-dialog') as any;
    const toggleLarge = () => {
      this._dialogLarge = !this._dialogLarge;
      haDialog.toggleAttribute('large', this._dialogLarge);
    };
    const dialogTitle = html`<span slot="heading" style="flex: 1;" .title=${NAMESPACE} @click=${toggleLarge}
      >${NAMESPACE_TITLE} <span style="font-size: small; text-wrap-mode: nowrap;"> (${VERSION})</span></span
    >`;

    const rightHeaderBtns = html`<div>
      <ha-icon-button .label=${'Toggle large'} .path=${mdiArrowExpand} @click=${toggleLarge}></ha-icon-button>
      <ha-icon-button
        .label=${'Documentation'}
        .path=${mdiInformation}
        @click=${() => window.open(REPO_URL)}
      ></ha-icon-button>
    </div>`;

    Object.assign(haDialog, {
      id: SELECTOR.SIDEBAR_CONFIG_DIALOG,
      open: true,
      heading: createCloseHeading(this.hass, dialogTitle, rightHeaderBtns),
      hideActions: false,
      flexContent: true,
      scrimClickAction: '',
      escapeKeyAction: '',
    });

    // Attach close event handler
    haDialog.addEventListener('closed', () => haDialog.remove());

    // Create action buttons
    const createActionButton = (text: string, handler: () => void, slot?: string) => {
      const button = document.createElement(ELEMENT.HA_BUTTON) as any;
      if (slot) button.slot = slot;
      button.innerText = text;
      button.addEventListener('click', handler);
      return button;
    };

    const saveBtn = createActionButton(BTN_LABEL.SAVE, () => {
      const sidebarConfig = this._sidebarDialog!._sidebarConfig;
      const sidebarUseConfigFile = this._sidebarDialog!._useConfigFile;
      this._handleNewConfig(sidebarConfig, sidebarUseConfigFile);
      haDialog.remove();
    });
    const cancelBtn = createActionButton(BTN_LABEL.CANCEL, () => haDialog.remove());

    const primaryActionBtn = document.createElement('div');
    primaryActionBtn.slot = SLOT.PRIMARY_ACTION;
    primaryActionBtn.appendChild(cancelBtn);
    primaryActionBtn.appendChild(saveBtn);

    const codeEditorBtn = createActionButton(
      BTN_LABEL.SHOW_CODE_EDITOR,
      () => {
        this._sidebarDialog?._toggleCodeEditor();
        setCodeUILabel();
      },
      SLOT.SECONDARY_ACTION
    );

    // Append dialog and actions
    haDialog.append(sidebarDialog, codeEditorBtn, primaryActionBtn);
    this._styleManager.addStyle(DIALOG_STYLE.toString(), haDialog);
    const setCodeUILabel = () => {
      const code =
        this._sidebarDialog?._tabState === TAB_STATE.CODE ? BTN_LABEL.SHOW_VISUAL_EDITOR : BTN_LABEL.SHOW_CODE_EDITOR;
      const codeBtn = haDialog.querySelector(`${ELEMENT.HA_BUTTON}[slot=${SLOT.SECONDARY_ACTION}]`) as HTMLElement;
      codeBtn.innerHTML = code;
    };

    this.main.appendChild(haDialog);
  }

  private _handleNewConfig(config: SidebarConfig, useConfigFile: boolean) {
    if (useConfigFile) {
      console.log('Using Config File');
      setTimeout(() => {
        window.location.reload();
      }, 200);
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

      this._refreshSidebar();
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
    this._diffCheck = true;
  }

  private _reloadSidebar = async (newPanelOrder: string[], hiddenPanels: string[]) => {
    console.log('Reloading Sidebar');
    this._hiddenPanels = hiddenPanels;

    const validateConfigPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve(validateConfig(this._config, hiddenPanels));
      }, 100);
    });

    const newPanelOrderPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve(this._handleGroupedPanelOrder(newPanelOrder));
      }, 100);
    });

    const [validatedConfig, newPanelOrderResolved] = await Promise.all([validateConfigPromise, newPanelOrderPromise]);
    console.log('Validated Config:', validatedConfig, 'New Panel Order:', newPanelOrderResolved);
    this._config = validatedConfig as SidebarConfig;
    this._baseOrder = newPanelOrderResolved as string[];
    this.HaSidebar._panelOrder = this._baseOrder;

    // this._baseOrder = this._handleGroupedPanelOrder(newPanelOrder);
    // this.HaSidebar._panelOrder = [...this._baseOrder];
    this._refreshSidebar();
  };

  private _refreshSidebar = async () => {
    console.log('Refreshing Sidebar');

    this._setupConfig(this._config);
    this._handleSidebarHeader();
  };

  private _addAdditionalStyles(color_config: SidebarConfig['color_config'], mode?: string) {
    mode = mode ? mode : this.darkMode ? 'dark' : 'light';
    const customTheme = color_config?.custom_theme?.theme || undefined;
    if (customTheme) {
      applyTheme(this.HaSidebar, this.hass, customTheme, mode);
      // console.log('Custom Theme:', customTheme, 'Mode:', mode);
    }
    const colorConfig = color_config?.[mode] || {};
    const borderRadius = color_config?.border_radius ? `${color_config.border_radius}px` : undefined;
    const marginRadius = borderRadius ? '4px 4px' : '1px 4px 0px';

    // Custom Styles
    const customStyles = colorConfig.custom_styles || [];
    const CUSTOM_STYLES = convertCustomStyles(customStyles) || '';

    const defaultColors = getDefaultThemeColors();
    // console.log('Default Colors:', defaultColors);
    // console.log('theme', theme, 'colorConfig', colorConfig, 'defaultColors', defaultColors);
    const getColor = (key: string): string => {
      const color = colorConfig?.[key] ?? defaultColors[key];
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

    const scrollbarItems = Array.from(this._scrollbarItems) as HTMLElement[];

    // Loop through each group and set the group attribute on matching items
    Object.entries(customGroups).forEach(([group, panel]) => {
      scrollbarItems
        .filter((item) => panel.includes(item.getAttribute('data-panel')!))
        .forEach((item) => {
          item.setAttribute('group', group);
        });
      // console.log('Group:', group, 'Panels:', panel);
    });
    // debugger;
    console.log('Custom Groups Setup Done');
  }

  private _handleGroupedPanelOrder(currentPanel: string[]) {
    const { defaultPanel } = this.hass;
    const bottomMovedItems = this._config.bottom_items || [];
    const customGroups = this._config.custom_groups || {};

    // Get grouped items
    const groupedItems = Object.values(customGroups)
      .flat()
      .filter((item) => currentPanel.includes(item));
    // console.log('Grouped Items:', groupedItems);

    // Filter default items that are not in grouped or bottom items
    const defaultItems = currentPanel.filter(
      (item) => !groupedItems.includes(item) && !bottomMovedItems.includes(item)
    );

    // console.log('Default Items:', defaultItems);

    // Move default panel item to the front
    const defaultPanelItem = defaultItems.find((item) => item === defaultPanel);
    if (defaultPanelItem) {
      defaultItems.splice(defaultItems.indexOf(defaultPanelItem), 1);
      groupedItems.unshift(defaultPanelItem);
    }

    // Combine grouped, default, and bottom items
    return [...groupedItems, ...defaultItems, ...bottomMovedItems];
  }

  private _handleNewPanelOrder() {
    const newPanelOrder = this.HaSidebar._panelOrder;
    console.log('New Panel Order:', newPanelOrder);
    const scrollbar = this._scrollbar;
    const scrollbarItems = Array.from(this._scrollbarItems);
    const spacer = scrollbar.querySelector(SELECTOR.SPACER) as HTMLElement;

    // rearrange the items in the sidebar by their new order
    newPanelOrder.forEach((panel: string) => {
      const item = scrollbarItems.find((item) => item.getAttribute('data-panel') === panel);
      if (item) {
        // console.log('Rearranging Item:', item, 'Panel:', panel);
        scrollbar.insertBefore(item, spacer);
      }
    });
    // move bottom items to the end after the spacer

    const bottomItems = this._bottomItems || [];
    bottomItems.reverse().forEach((item) => {
      const bottomItem = scrollbarItems.find((panel) => panel.getAttribute('data-panel') === item);
      if (bottomItem) {
        // console.log('Moving Bottom Item:', bottomItem, 'Panel:', item);
        scrollbar.insertBefore(bottomItem, spacer.nextSibling);
      }
    });

    // const devTools = this._scrollbar.querySelector(SELECTOR.DEV_TOOLS) as HTMLElement;
    // const bottomDivider = this._scrollbar.querySelector(`${ELEMENT.DIVIDER}[bottom]`) as HTMLElement;
    // if (!devTools || !bottomDivider) return;
    // console.log('Adding Bottom Divider', devTools, bottomDivider);
    // this._scrollbar.insertBefore(devTools, bottomDivider.nextElementSibling);

    this._reorderGroupedSidebar();
  }

  private _reorderGroupedSidebar() {
    const customGroups = this._config.custom_groups || {};
    if (!customGroups) return;

    const sidebarInstance = this.sideBarRoot!;
    const scrollbar = this._scrollbar;

    const scrollbarItems = Array.from(this._scrollbarItems) as HTMLElement[];

    const dividerTemplate = sidebarInstance.querySelector(
      `${SELECTOR.DIVIDER}:not([added]):not([bottom])`
    ) as HTMLElement;

    const createDivider = (group: string) => {
      const newDivider = dividerTemplate.cloneNode(true) as HTMLElement;
      newDivider.setAttribute('group', group);
      newDivider.setAttribute('added', '');

      const contentDiv = document.createElement('div');
      contentDiv.classList.add('added-content');
      contentDiv.setAttribute('group', group);
      contentDiv.innerHTML = `<ha-icon icon="mdi:chevron-down"></ha-icon><span>${group.replace(/_/g, ' ')}</span>`;

      newDivider.appendChild(contentDiv);
      newDivider.addEventListener('click', this._toggleGroup.bind(this));
      // addAction(newDivider, undefined, this._toggleGroup.bind(this, newDivider));
      return newDivider;
    };

    // Insert group dividers before matching group items
    Object.keys(customGroups).forEach((group) => {
      const insertBefore = scrollbarItems.find(
        (item) => item.getAttribute('group') === group && !item.hasAttribute('moved')
      );
      if (insertBefore) {
        const divider = createDivider(group);
        scrollbar.insertBefore(divider, insertBefore);
      }
    });

    // Insert a divider before the first item not in any group
    const firstItemNotInGroup = scrollbarItems.find(
      (item) =>
        !item.hasAttribute('group') &&
        !item.hasAttribute('moved') &&
        item.previousElementSibling?.hasAttribute('group') &&
        scrollbarItems[0] !== item
    );
    if (firstItemNotInGroup) {
      const notInGroupDivider = dividerTemplate.cloneNode(true) as HTMLElement;
      notInGroupDivider.setAttribute('ungrouped', '');
      scrollbar.insertBefore(notInGroupDivider, firstItemNotInGroup);
    }

    // Check differences after a delay
    setTimeout(() => this._checkDiffs(), 100);
  }

  private _checkDiffs = () => {
    console.log('Checking for differences in sidebar configuration...');
    const { custom_groups = {}, bottom_items = [] } = this._config;
    const scrollbar = this._scrollbar;
    const scrollbarItems = Array.from(this._scrollbarItems) as HTMLElement[];
    const notEmptyGroups = Object.keys(custom_groups).filter((key) => custom_groups[key].length > 0);
    const dividerOrder = Array.from(scrollbar.querySelectorAll('div.divider:has([group])')).map((divider) =>
      divider.getAttribute('group')
    );

    // console.log('Not Empty Groups:', notEmptyGroups);
    // console.log('Divider Order:', dividerOrder);

    const groupItems = Object.values(custom_groups).flat();

    const panelOrderNamed = Array.from(scrollbarItems)
      .filter((item) => item.hasAttribute('group'))
      .map((item) => item.getAttribute('data-panel'));

    // console.log('Panel Order Named:', panelOrderNamed, 'Group Items:', groupItems);
    // console.log('Group Items:', groupItems);

    const bottomMovedItems = Array.from(scrollbarItems)
      .filter((item) => item.hasAttribute('moved'))
      .map((item) => item.getAttribute('data-panel'));

    // console.log('Bottom Moved Items:', bottomMovedItems);
    // console.log('Bottom Items:', bottom_items);

    const hasDiff =
      JSON.stringify(bottom_items) !== JSON.stringify(bottomMovedItems) ||
      JSON.stringify(notEmptyGroups) !== JSON.stringify(dividerOrder) ||
      JSON.stringify(groupItems) !== JSON.stringify(panelOrderNamed);

    if (hasDiff) {
      this._diffCheck = false;
      const logs = {
        bottomItemsDiff: JSON.stringify(bottom_items) !== JSON.stringify(bottomMovedItems),
        dividerOrderDiff: JSON.stringify(notEmptyGroups) !== JSON.stringify(dividerOrder),
        panelOrderDiff: JSON.stringify(groupItems) !== JSON.stringify(panelOrderNamed),
      };
      console.log('Diff Check:', logs);
      LOGGER.warn('Changes detected:', logs);

      // window.location.reload();

      // this._refreshSidebar();
    } else {
      this._handleNotification();
      this._handleCollapsed(this.collapsedItems);
    }
  };

  private _getAnchorElement(element: HTMLElement): HTMLAnchorElement {
    return element.shadowRoot!.querySelector<HTMLAnchorElement>('a')!;
  }

  private _hideItem(item: HTMLElement, hide: boolean): void {
    if (hide) {
      item.style.display = 'none';
    } else {
      item.style.removeProperty('display');
    }
  }

  private _createNewItem(itemConfig: NewItemConfig): SidebarPanelItem {
    const hasAction = ACTION_TYPES.some((action) => itemConfig[action] !== undefined);
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
    return item;
  }

  private _handleNotification() {
    if (this._config.notification && Object.keys(this._config.notification).length > 0) {
      const notifyKey = Object.entries(this._config.notification!);
      const scrollbarItems = this._scrollbar.querySelectorAll(ELEMENT.ITEM) as NodeListOf<HTMLElement>;
      notifyKey.forEach(([key, value]) => {
        const panel = Array.from(scrollbarItems).find((el) => el.getAttribute('data-panel') === key);
        if (panel) {
          // console.log('adding notification', panel, key);
          this._subscribeNotification(panel, value);
        }
      });
    }
    if (this._config.new_items && this._config.new_items.length > 0) {
      const itemWithNotify = this._config.new_items.filter((item) => item.notification !== undefined);

      if (itemWithNotify.length === 0) return;
      itemWithNotify.forEach((item) => {
        const panel = this._scrollbar.querySelector(`[data-panel="${item.title}"]`) as HTMLElement;
        if (panel) {
          this._subscribeNotification(panel, item.notification!);
        }
      });
    }
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

    items.forEach((item, index) => {
      const animationClass = isCollapsed ? 'slideIn' : 'slideOut';
      item.style.animationDelay = `${index * 50}ms`;
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
