import {
  ALERT_MSG,
  CLASS,
  CUSTOM_EVENT,
  ELEMENT,
  HA_EVENT,
  NAMESPACE,
  NAMESPACE_TITLE,
  PATH,
  REPO_URL,
  SELECTOR,
  STORAGE,
  VERSION,
} from '@constants';
import { mdiInformation, mdiArrowExpand } from '@mdi/js';
import { HaExtened, Panels, PartialPanelResolver, SidebarConfig, ThemeSettings } from '@types';
import { fetchConfig, validateConfig } from '@utilities/configs';
import { getCollapsedItems, getInitPanelOrder, isBeforeChange } from '@utilities/configs/misc';
import { getDefaultThemeColors, convertCustomStyles } from '@utilities/custom-styles';
import { fetchDashboards } from '@utilities/dashboard';
import { applyTheme, addAction, createCloseHeading, onPanelLoaded, resetPanelOrder } from '@utilities/dom-utils';
import * as LOGGER from '@utilities/logger';
import { getHiddenPanels, isStoragePanelEmpty, setStorage } from '@utilities/storage-utils';
import { hasTemplate, subscribeRenderTemplate } from '@utilities/ws-templates';
import { navigate } from 'custom-card-helpers';

import './components/sidebar-dialog';

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

    // instance.addEventListener(HAQuerySelectorEvent.ON_PANEL_LOAD, () => {
    //   this._panelLoaded();
    // });

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
    // this._watchPathChanges();
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
  private _dialogLarge: boolean = false;
  private firstSetUpDone = false;
  private setupConfigDone = false;
  private _diffCheck: boolean = false;
  private _prevPath: string | null = null;
  private _currentPath: string;
  private _delayTimeout: number | null = null;
  private _hassPanelsChanged: boolean = false;

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
            if (this._hassPanelsChanged) {
              this._refreshSidebar();
            } else {
              this._checkDashboardChange();
            }
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
    const extraPanels = dashboards.notInSidebar.filter((panel) => _baseOrder.includes(panel));
    const missingPanels = dashboards.inSidebar.filter((panel) => !_baseOrder.includes(panel));
    if (extraPanels.length > 0) {
      console.log('Extra Panels:', extraPanels);
      const _baseOrder = [...this._baseOrder];
      const config = { ...this._config };
      const { custom_groups = {}, bottom_items = [], hidden_items = [] } = config;

      extraPanels.forEach((panel) => {
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
    } else if (missingPanels.length > 0) {
      console.log('Missing Panels:', missingPanels);
      // check if is in  hidden panels
      const hiddenPanels = this._hiddenPanels;
      const _baseOrder = [...this._baseOrder];
      const isHidden = missingPanels.filter((panel) => hiddenPanels.includes(panel));
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
      _baseOrder.push(...missingPanels);
      setStorage(STORAGE.UI_CONFIG, this._config);
      setStorage(STORAGE.HIDDEN_PANELS, hiddenPanels);
      setStorage(STORAGE.PANEL_ORDER, _baseOrder);

      changed = true;
    }
    if (changed) {
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } else {
      setTimeout(() => {
        if (this._config.bottom_items && this._config.bottom_items.length > 0) {
          this._bottomItems = [];
          this._handleBottomPanels(this._config.bottom_items);
        }
      }, 0);
    }
  }

  private async _panelLoaded(): Promise<void> {
    const panelResolver = (await this._panelResolver.element) as PartialPanelResolver;
    const pathName = panelResolver.__route.path;
    const paperListBox = (await this._sidebar.selector.$.query('paper-listbox').element) as HTMLElement;

    if (pathName && paperListBox) {
      // console.log('Dashboard Page Loaded');
      setTimeout(() => {
        if (this._diffCheck && this.firstSetUpDone) {
          // console.log('Diff Check and first setup done');
          onPanelLoaded(pathName, paperListBox);
        }
      }, 100);
    }
  }

  public async run() {
    if (isBeforeChange()) {
      console.warn(ALERT_MSG.NOT_COMPATIBLE);
      return;
    }
    void this._handleFirstConfig();
    this._setupConfigBtn();

    if (!this.firstSetUpDone) {
      this._setDataPanel();
    }

    if (this.firstSetUpDone && !this.setupConfigDone) {
      await this._getConfig();
      this._handleSidebarHeader();
      this.setupConfigDone = true;
      // this._handleNotification();
    }

    // const sidebar = customElements.get('ha-sidebar') as any;
    // this._handleSidebarUpdate(sidebar);
  }

  private _setDataPanel() {
    console.log('Setting Data Panel');
    const scrollbarItems = this._scrollbar.querySelectorAll(ELEMENT.ITEM) as NodeListOf<HTMLElement>;

    Array.from(scrollbarItems).forEach((item) => {
      const anchor = this._getAnchorElement(item);
      const panelName = anchor.getAttribute('href')?.replace('/', '');
      if (panelName) {
        item.setAttribute('data-panel', panelName);
      }
    });

    this.firstSetUpDone = true;
    console.log('Data Panel Set');
  }

  private _handleSidebarUpdate(sidebar: any) {
    if (!sidebar) return;
    const sidebarUpdated = sidebar.prototype.updated;
    const _thisInstace = this;
    sidebar.prototype.updated = function (changedProperties: any) {
      if (sidebarUpdated) {
        sidebarUpdated.call(this, changedProperties);
      }

      if (changedProperties.has('editMode') && this.editMode) {
        // _thisInstace._handleEditMode();
        resetPanelOrder(_thisInstace._scrollbar);
        return;
      } else if (changedProperties.has('editMode') && !this.editMode) {
        const currentOrder = _thisInstace._baseOrder;
        const currentHidden = _thisInstace._hiddenPanels;
        const newPanelOrder = this._panelOrder;
        const hiddenPanels = this._hiddenPanels;
        const hasChanged =
          JSON.stringify(currentOrder) !== JSON.stringify(newPanelOrder) ||
          JSON.stringify(currentHidden) !== JSON.stringify(hiddenPanels);
        if (hasChanged) {
          console.log('Something Changed:', {
            'Current Changed': JSON.stringify(currentOrder) !== JSON.stringify(newPanelOrder),
            'Hidden Changed': JSON.stringify(currentHidden) !== JSON.stringify(hiddenPanels),
          });
          _thisInstace._reloadSidebar(newPanelOrder, hiddenPanels);
          return;
        } else {
          _thisInstace._refreshSidebar();
          return;
        }
      } else if (changedProperties.has('hass') && this.hass?.panels) {
        const oldPanels = changedProperties.get('hass')?.panels || {};
        const newPanels = this.hass.panels;

        // Compare old and new panels
        // check if is new panel added or removed
        const addedPanels = Object.keys(newPanels).filter((panel) => !oldPanels[panel]);
        const removedPanels = Object.keys(oldPanels).filter((panel) => !newPanels[panel]);
        if (addedPanels.length > 0) {
          console.log('Added Panels:', addedPanels);
          _thisInstace._hassPanelsChanged = true;
        } else if (removedPanels.length > 0) {
          console.log('Removed Panels:', removedPanels);
          const config = { ..._thisInstace._config };
          const customGroups = { ...(config.custom_groups || {}) };
          const bottomItems = [...(_thisInstace._bottomItems || [])];
          const hiddenItems = [...(_thisInstace._hiddenPanels || [])];
          removedPanels.forEach((panel) => {
            // remove from custom groups
            Object.entries(customGroups).forEach(([key, value]) => {
              if (value.includes(panel)) {
                customGroups[key] = value.filter((item) => item !== panel);
              }
            });

            // remove from bottom items
            const index = bottomItems.indexOf(panel);
            if (index !== -1) {
              bottomItems.splice(index, 1);
            }
            // remove from hidden items
            const indexHidden = hiddenItems.indexOf(panel);
            if (indexHidden !== -1) {
              hiddenItems.splice(indexHidden, 1);
            }
          });
          // remove from panel order
          _thisInstace._config.custom_groups = customGroups;
          _thisInstace._config.bottom_items = bottomItems;
          _thisInstace._config.hidden_items = hiddenItems;
          setStorage(STORAGE.UI_CONFIG, _thisInstace._config);
          setStorage(STORAGE.HIDDEN_PANELS, hiddenItems);
          _thisInstace._hassPanelsChanged = true;
        }
      }
    };
  }

  private _storageListener(event: StorageEvent) {
    if (event.key === STORAGE.COLLAPSE) {
      const collapsedItems = JSON.parse(event.newValue!);
      this.collapsedItems = new Set(collapsedItems);
      this._handleCollapsed(this.collapsedItems);
    }
  }

  private async _handleHaEvents(event: any) {
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
      case HA_EVENT.LOCATION_CHANGED:
        // this._panelLoaded();
        const changed = detail.replace;
        // console.log('Location Changed', changed);
        if (changed) {
          const path = (await this._panelResolver.element) as PartialPanelResolver;
          const pathName = path.__route.path;
          const paperListbox = this._scrollbar;
          onPanelLoaded(pathName, paperListbox);
        }
        break;
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
    const _panelOrder = this.HaSidebar._panelOrder;
    if (!isStoragePanelEmpty() && !_panelOrder) {
      localStorage.removeItem(STORAGE.PANEL_ORDER);
      localStorage.removeItem(STORAGE.HIDDEN_PANELS);
    } else if (isStoragePanelEmpty()) {
      const initPanelOrder = getInitPanelOrder(this._scrollbar);
      if (initPanelOrder !== null) {
        console.log('Setting Panel Order', initPanelOrder);
        this.HaSidebar._panelOrder = initPanelOrder;
      } else {
        return;
      }
    }
    this._hiddenPanels = getHiddenPanels();
  }

  private async _getConfig() {
    const config = await fetchConfig(this.hass);
    if (config) {
      this._config = config;
      this._setupConfig(this._config);
    }
  }

  private _setupConfigBtn(): void {
    const profileEl = this.sideBarRoot?.querySelector('ha-md-list-item[href="/profile"]') as HTMLElement;
    if (!profileEl) return;
    addAction(profileEl, this._addConfigDialog.bind(this));
  }

  private _handleSidebarHeader(): void {
    const hide_header_toggle = this._config.hide_header_toggle || false;
    if (hide_header_toggle) return;
    const groupKeys = Object.keys(this._config?.custom_groups || {});
    if (groupKeys.length === 0 || Object.values(this._config.custom_groups || {}).flat().length === 0) return;
    const menuEl = this.sideBarRoot?.querySelector(SELECTOR.MENU) as HTMLElement;
    const titleEl = menuEl.querySelector(SELECTOR.MENU_TITLE) as HTMLElement;
    if (!titleEl) return;
    const customTitle = this._config.header_title;
    if (customTitle && customTitle !== '') {
      titleEl.innerText = customTitle;
    }

    titleEl.classList.add('toggle');

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
    } = config;

    this.collapsedItems = getCollapsedItems(custom_groups, default_collapsed);
    this._addAdditionalStyles(color_config);
    this._handleHiddenPanels(hidden_items);
    this._handleBottomPanels(bottom_items);
    this._handleItemsGroup(custom_groups);

    // Start the sidebar ordering
    this._initSidebarOrdering();
  }

  private _subscribeTemplate(key: string, callback: (result: string) => void): void {
    if (!this.hass || !hasTemplate(this._config.notification![key])) {
      console.log('Not a template:', this.hass, this._config.notification![key]);
      return;
    }

    const notifyConfig = this._config.notification![key];
    subscribeRenderTemplate(
      this.hass.connection,
      (result) => {
        callback(result.result);
      },
      {
        template: notifyConfig ?? '',
        variables: {
          config: notifyConfig,
          user: this.hass.user!.name,
        },
        strict: true,
      }
    );
  }

  private _initSidebarOrdering() {
    const currentPanel = this.HaSidebar._panelOrder;
    this._baseOrder = this._handleGroupedPanelOrder(currentPanel);
    setStorage(STORAGE.PANEL_ORDER, this._baseOrder);
    this.HaSidebar._panelOrder = [...this._baseOrder];
    this._reorderGroupedSidebar();
  }

  private _handleHiddenPanels(hiddenItems: string[]) {
    if (!hiddenItems || hiddenItems.length === 0) return;

    const paperListbox = this._scrollbar;
    const children = paperListbox.children;
    const spacerIndex = Array.from(children).findIndex((child) => child.classList.contains('spacer'));
    const panelOrder = Array.from(children)
      .slice(0, spacerIndex)
      .map((child) => child.getAttribute('data-panel'))
      .filter((child) => child !== null);
    this.HaSidebar._panelOrder = panelOrder;

    console.log('Hidden Items Setup Done');
  }

  private _handleBottomPanels(bottomItems: string[]) {
    if (!bottomItems || bottomItems.length === 0) return;
    const scrollbarItems = Array.from(this._scrollbarItems);
    const spacer = this._scrollbar.querySelector(SELECTOR.SPACER) as HTMLElement;
    const divider = this.sideBarRoot!.querySelector(`${SELECTOR.DIVIDER}:not([added]):not([ungrouped])`) as HTMLElement;

    bottomItems.reverse().forEach((item, index) => {
      const panel = scrollbarItems.find((panel) => panel.getAttribute('data-panel') === item);
      if (panel) {
        panel.setAttribute('moved', '');
        this._scrollbar.insertBefore(panel, spacer.nextSibling);
        if (index === 0) {
          // console.log('Adding Divider', panel, item);
          this._scrollbar.insertBefore(divider.cloneNode(true), panel.nextSibling);
        }
      }
    });
    this._bottomItems = [...bottomItems];
    console.log('Bottom items setup done');
  }

  private _addConfigDialog() {
    // check if is in profile page, if not change to profile page first
    if (this.hass.panelUrl !== 'profile') {
      const path = '/profile';

      navigate(this, path);
      setTimeout(() => {
        this._addConfigDialog();
      }, 0);
      return;
    }

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

    const saveBtn = createActionButton('Save', () => {
      const sidebarConfig = this._sidebarDialog!._sidebarConfig;
      const sidebarUseConfigFile = this._sidebarDialog!._useConfigFile;
      this._handleNewConfig(sidebarConfig, sidebarUseConfigFile);
      haDialog.remove();
    });
    const cancelBtn = createActionButton('Cancel', () => haDialog.remove());

    const primaryActionBtn = document.createElement('div');
    primaryActionBtn.slot = 'primaryAction';
    primaryActionBtn.appendChild(cancelBtn);
    primaryActionBtn.appendChild(saveBtn);

    const codeEditorBtn = createActionButton(
      'Code / UI Editor',
      () => {
        this._sidebarDialog?._toggleCodeEditor();
      },
      'secondaryAction'
    );

    // Append dialog and actions
    haDialog.append(sidebarDialog, codeEditorBtn, primaryActionBtn);
    this._styleManager.addStyle(DIALOG_STYLE.toString(), haDialog);
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
      setTimeout(() => {
        window.location.reload();
      }, 100);
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

  private _reloadSidebar(newPanelOrder: string[], hiddenPanels: string[]) {
    console.log('Reloading Sidebar');
    this._hiddenPanels = hiddenPanels;
    this._config = validateConfig(this._config);
    this._baseOrder = this._handleGroupedPanelOrder(newPanelOrder);
    this.HaSidebar._panelOrder = [...this._baseOrder];
    this._refreshSidebar();
  }

  private _refreshSidebar() {
    this._setupConfig(this._config);
    this._handleSidebarHeader();
  }

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
    });
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
    return [...groupedItems, ...defaultItems, ...bottomMovedItems.reverse()];
  }

  private _reorderGroupedSidebar() {
    const customGroups = this._config.custom_groups || {};
    if (!customGroups) return;

    const sidebarInstance = this.sideBarRoot!;
    const scrollbar = this._scrollbar;
    const scrollbarItems = Array.from(this._scrollbarItems) as HTMLElement[];
    const dividerTemplate = sidebarInstance.querySelector(SELECTOR.DIVIDER) as HTMLElement;

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
    const { custom_groups = {}, bottom_items = [] } = this._config;
    const scrollbar = this._scrollbar;
    const scrollbarItems = Array.from(this._scrollbarItems) as HTMLElement[];
    const notEmptyGroups = Object.keys(custom_groups).filter((key) => custom_groups[key].length > 0);
    const dividerOrder = Array.from(scrollbar.querySelectorAll('div.divider:has([group])')).map((divider) =>
      divider.getAttribute('group')
    );

    const groupItems = Object.values(custom_groups).flat();

    const panelOrderNamed = Array.from(scrollbarItems)
      .filter((item) => item.hasAttribute('group'))
      .map((item) => item.getAttribute('data-panel'));

    const bottomMovedItems = Array.from(scrollbarItems)
      .filter((item) => item.hasAttribute('moved'))
      .map((item) => item.getAttribute('data-panel'));

    const hasDiff =
      JSON.stringify(bottom_items) !== JSON.stringify(bottomMovedItems) ||
      JSON.stringify(notEmptyGroups) !== JSON.stringify(dividerOrder) ||
      JSON.stringify(groupItems) !== JSON.stringify(panelOrderNamed);
    console.log('Diff Check:', {
      bottomItemsDiff: JSON.stringify(bottom_items) !== JSON.stringify(bottomMovedItems),
      dividerOrderDiff: JSON.stringify(notEmptyGroups) !== JSON.stringify(dividerOrder),
      panelOrderDiff: JSON.stringify(groupItems) !== JSON.stringify(panelOrderNamed),
    });
    if (hasDiff) {
      this._diffCheck = false;
      LOGGER.warn('Changes detected:', {
        bottomItemsDiff: JSON.stringify(bottom_items) !== JSON.stringify(bottomMovedItems),
        dividerOrderDiff: JSON.stringify(notEmptyGroups) !== JSON.stringify(dividerOrder),
        panelOrderDiff: JSON.stringify(groupItems) !== JSON.stringify(panelOrderNamed),
      });
      // window.location.reload();
      // this._refreshSidebar();
    } else {
      // this._handleNotification();
      this._handleCollapsed(this.collapsedItems);
    }
  };

  private _getAnchorElement(element: HTMLElement): HTMLAnchorElement {
    return element.shadowRoot!.querySelector<HTMLAnchorElement>('a')!;
  }

  private _handleNotification() {
    if (!this._config.notification || Object.keys(this._config.notification).length === 0) return;
    const notifyKey = Object.keys(this._config.notification!);
    const scrollbarItems = this._scrollbar!.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>;
    notifyKey.forEach((key) => {
      const panel = Array.from(scrollbarItems).find((el) => el.getAttribute('data-panel') === key);
      if (panel) {
        this._subscribeNotification(panel, key);
      }
    });
  }

  private _subscribeNotification(panel: HTMLAnchorElement, key: string): void {
    let badge = panel.querySelector('.notification-badge:not(.notification-badge-collapsed)');
    let badgeCollapsed = panel.querySelector('.notification-badge.notification-badge-collapsed');
    if (!badge) {
      badge = document.createElement('span');
      badge.classList.add('notification-badge');
      panel.querySelector('paper-icon-item')?.appendChild(badge);
    }
    if (!badgeCollapsed) {
      badgeCollapsed = document.createElement('span');
      badgeCollapsed.classList.add('notification-badge', 'notification-badge-collapsed');
      panel.querySelector('ha-svg-icon, ha-icon')?.after(badgeCollapsed);
    }

    const callback = (resultContent: any) => {
      if (resultContent) {
        badge.innerHTML = resultContent;
        badgeCollapsed.innerHTML = resultContent;
        panel.setAttribute('data-notification', 'true');
      } else {
        badge.innerHTML = '';
        badgeCollapsed.innerHTML = '';
        panel.removeAttribute('data-notification');
      }
    };

    this._subscribeTemplate(key, callback);
  }

  private _toggleGroup(event: MouseEvent) {
    event.stopPropagation();
    const target = event.target as HTMLElement;
    const group = target.getAttribute('group');
    // console.log('Toggle Group', group, target);
    // const items = this._scrollbar!.querySelectorAll(`a[group="${group}"]:not([moved])`) as NodeListOf<HTMLElement>;

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
