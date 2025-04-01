import { HA_EVENT, NAMESPACE, NAMESPACE_TITLE, REPO_URL, STORAGE, VERSION } from '@constants';
import { mdiInformation, mdiArrowExpand } from '@mdi/js';
import { HaExtened, SidebarConfig, ThemeSettings } from '@types';
import { fetchConfig, validateConfig } from '@utilities/configs';
import { getCollapsedItems, getInitPanelOrder } from '@utilities/configs/misc';
import { getDefaultThemeColors, convertCustomStyles } from '@utilities/custom-styles';
import { fetchDashboards } from '@utilities/dashboard';
import { addAction, createCloseHeading, onPanelLoaded, resetPanelOrder } from '@utilities/dom-utils';
import { getHiddenPanels, isStoragePanelEmpty, setStorage } from '@utilities/storage-utils';
import { navigate } from 'custom-card-helpers';
import { HAQuerySelector, HAQuerySelectorEvent } from 'home-assistant-query-selector';

import './components/sidebar-dialog';

import { HomeAssistantStylesManager } from 'home-assistant-styles-manager';
import { html } from 'lit';

import { SidebarConfigDialog } from './components/sidebar-dialog';
import { DIALOG_STYLE, DIVIDER_ADDED_STYLE } from './sidebar-css';

class SidebarOrganizer {
  constructor() {
    const instance = new HAQuerySelector();
    instance.addEventListener(HAQuerySelectorEvent.ON_LISTEN, async (event) => {
      const { HOME_ASSISTANT, HOME_ASSISTANT_MAIN, HA_DRAWER, HA_SIDEBAR, PARTIAL_PANEL_RESOLVER } = event.detail;
      this.ha = (await HOME_ASSISTANT.element) as HaExtened;
      this._partialPanelResolver = await PARTIAL_PANEL_RESOLVER.element;
      this.main = (await HOME_ASSISTANT_MAIN.selector.$.element) as ShadowRoot;
      this._haDrawer = await HA_DRAWER.element;
      this.HaSidebar = await HA_SIDEBAR.element;
      this.sideBarRoot = (await HA_SIDEBAR.selector.$.element) as ShadowRoot;
      this.run();
    });

    instance.addEventListener(HAQuerySelectorEvent.ON_PANEL_LOAD, () => {
      this._panelLoaded();
    });

    instance.listen();

    this._styleManager = new HomeAssistantStylesManager({
      prefix: NAMESPACE,
      throwWarnings: false,
    });

    window.addEventListener('storage', this._storageListener.bind(this));

    // Listen for HA Events
    [HA_EVENT.SETTHEME, HA_EVENT.DEFAULT_PANEL, HA_EVENT.DIALOG_CLOSED].forEach((event) => {
      window.addEventListener(event, this._handleHaEvents.bind(this));
    });
  }

  private ha?: HaExtened;
  private _config: SidebarConfig = {};
  private HaSidebar: any;
  private main!: ShadowRoot;
  private sideBarRoot!: ShadowRoot;
  private _partialPanelResolver?: any;
  private _haDrawer: any;
  public _baseOrder: string[] = [];
  public _hiddenPanels: string[] = [];
  private _styleManager: HomeAssistantStylesManager;
  private _sidebarDialog?: SidebarConfigDialog;
  private collapsedItems = new Set<string>();
  private firstSetUpDone = false;
  private _bottomItems: string[] = [];
  private _dialogLarge: boolean = false;
  private _notInSidebarCount: number = 0;

  get hass(): HaExtened['hass'] {
    return this.ha!.hass;
  }

  get darkMode(): boolean {
    return this.hass.themes.darkMode;
  }

  get paperListbox(): HTMLElement {
    return this.sideBarRoot?.querySelector('paper-listbox') as HTMLElement;
  }

  private _panelLoaded() {
    if (!this._partialPanelResolver) return;
    const panelResolver = this._partialPanelResolver as any;
    const path = panelResolver?.__route?.path || window.location.pathname;
    onPanelLoaded(path, this.paperListbox);
  }

  public async run() {
    void this._handleFirstConfig();
    this._setupConfigBtn();
    if (!this.firstSetUpDone) {
      await this._getConfig();
      this._addCollapeToggle();
      this.firstSetUpDone = true;
    }

    const sidebar = customElements.get('ha-sidebar') as any;
    this._handleSidebarUpdate(sidebar);
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
        resetPanelOrder(_thisInstace.paperListbox);
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
      } else if (changedProperties.has('hass') && this.hass && this.hass.panels) {
        const oldHass = changedProperties.get('hass');
        const oldPanels = oldHass.panels;
        const newPanels = this.hass.panels;
        // Compare old and new panels
        // check if is new panel added or removed
        const addedPanels = Object.keys(newPanels).filter((panel) => !oldPanels[panel]);
        const removedPanels = Object.keys(oldPanels).filter((panel) => !newPanels[panel]);
        if (addedPanels.length > 0) {
          console.log('Added Panels:', addedPanels);
          // Handle added panel
          const panelOrder = [..._thisInstace._baseOrder];
          const bottomItems = [..._thisInstace._bottomItems];
          // place the new panels before the bottom items
          console.log('Bottom Items:', bottomItems, 'Panel Order:', panelOrder);
          addedPanels.forEach((panel) => {
            const index = bottomItems.indexOf(panel);
            if (index !== -1) {
              panelOrder.splice(index, 0, panel);
            } else {
              panelOrder.push(panel);
            }
          });
          _thisInstace.HaSidebar._panelOrder = panelOrder;
          _thisInstace._baseOrder = panelOrder;
          console.log('New Panel Order:', panelOrder);
          return;
        } else if (removedPanels.length > 0) {
          console.log('Removed Panels:', removedPanels);
          // Handle removed panel
          // remove from config if exists
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
          const panelOrder = [..._thisInstace._baseOrder];
          removedPanels.forEach((panel) => {
            const index = panelOrder.indexOf(panel);
            if (index !== -1) {
              panelOrder.splice(index, 1);
            }
          });
          _thisInstace.HaSidebar._panelOrder = panelOrder;
          _thisInstace._baseOrder = panelOrder;
          _thisInstace._config.custom_groups = customGroups;
          _thisInstace._config.bottom_items = bottomItems;
          _thisInstace._config.hidden_items = hiddenItems;
          setStorage(STORAGE.UI_CONFIG, _thisInstace._config);
          setStorage(STORAGE.HIDDEN_PANELS, hiddenItems);
          console.log('New Panel Order:', panelOrder);
          console.log('New Config:', _thisInstace._config);
          // _thisInstace._refreshSidebar();
          return;
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

  private _handleHaEvents(event: any) {
    // event.stopPropagation();
    event.stopImmediatePropagation();
    const { type, detail } = event;
    switch (type) {
      case HA_EVENT.SETTHEME:
        const themeSetting = detail as ThemeSettings;
        console.log('Theme Changed', themeSetting);
        this._addAdditionalStyles(this._config.color_config);
        break;
      case HA_EVENT.DEFAULT_PANEL:
        this._handleDefaultPanelChange(detail.defaultPanel);
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
      const initPanelOrder = getInitPanelOrder(this.paperListbox);
      if (initPanelOrder !== null) {
        console.log('Setting Panel Order', initPanelOrder);
        this.HaSidebar._panelOrder = initPanelOrder;
      } else {
        return;
      }
    }
    this._hiddenPanels = getHiddenPanels();
    this._notInSidebarCount = await fetchDashboards(this.hass).then((dashboards) => {
      return dashboards.filter((item) => item.show_in_sidebar === false).length;
    });
  }

  private async _getConfig() {
    const config = await fetchConfig(this.hass);
    if (config) {
      this._config = config;
      this._setupConfig(this._config);
    }
  }

  private _setupConfigBtn(): void {
    const profileEl = this.HaSidebar.shadowRoot?.querySelector('a[data-panel="panel"]') as HTMLElement;
    if (!profileEl) return;
    addAction(profileEl, this._addConfigDialog.bind(this));
  }

  private _addCollapeToggle(): void {
    const hide_header_toggle = this._config.hide_header_toggle || false;
    if (hide_header_toggle) return;
    const groupKeys = Object.keys(this._config?.custom_groups || {});
    if (groupKeys.length === 0 || Object.values(this._config.custom_groups || {}).flat().length === 0) return;
    const menuEl = this.sideBarRoot?.querySelector('.menu') as HTMLElement;
    const titleEl = menuEl.querySelector('.title') as HTMLElement;
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

  private _initSidebarOrdering() {
    console.log('Init Sidebar Ordering');
    const currentPanel = this.HaSidebar._panelOrder;
    this._baseOrder = this._handleGroupedPanelOrder(currentPanel);
    this.HaSidebar._panelOrder = [...this._baseOrder];
    this._reorderGroupedSidebar();
  }

  private _handleHiddenPanels(hiddenItems: string[]) {
    if (!hiddenItems || hiddenItems.length === 0) return;

    const paperListbox = this.paperListbox;
    const children = paperListbox.children;
    const spacerIndex = Array.from(children).findIndex((child) => child.classList.contains('spacer'));
    const panelOrder = Array.from(children)
      .slice(0, spacerIndex)
      .map((child) => child.getAttribute('data-panel'))
      .filter((child) => child !== null);
    this.HaSidebar._panelOrder = panelOrder;
  }

  private _handleBottomPanels(bottomItems: string[]) {
    if (!bottomItems || bottomItems.length === 0) return;
    const scrollbarItems = this.paperListbox.querySelectorAll('a') as NodeListOf<HTMLElement>;
    const spacer = this.paperListbox.querySelector('div.spacer') as HTMLElement;
    const divider = this.sideBarRoot!.querySelector('div.divider') as HTMLElement;

    Object.values(bottomItems.reverse()).forEach((item, index) => {
      const panel = Array.from(scrollbarItems).find((el) => el.getAttribute('data-panel') === item);
      if (panel) {
        panel.setAttribute('moved', '');
        this._bottomItems.push(item);
        this.paperListbox.insertBefore(panel, spacer.nextSibling);
        if (index === 0) {
          // console.log('Adding Divider', panel, item);
          this.paperListbox.insertBefore(divider.cloneNode(true), panel.nextSibling);
        }
      }
    });
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
    const existingDialog = this.main.querySelector('#sidebar-config-dialog');
    existingDialog?.remove();

    // Create new dialog elements
    const sidebarDialog = document.createElement('sidebar-config-dialog') as SidebarConfigDialog;
    sidebarDialog.hass = this.hass;
    sidebarDialog._sideBarRoot = this.sideBarRoot;
    this._sidebarDialog = sidebarDialog;

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
      id: 'sidebar-config-dialog',
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
      const button = document.createElement('ha-button') as any;
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
      'CODE EDITOR',
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

    console.log('New Config:', config);
    const isChanged = JSON.stringify(config) !== JSON.stringify(this._config);
    if (!isChanged) {
      console.log('No Changes');
      return;
    } else {
      console.log('Changes Detected');
      // remove empty custom group or alert to abort

      setStorage(STORAGE.HIDDEN_PANELS, config.hidden_items);
      setStorage(STORAGE.UI_CONFIG, config);
      setTimeout(() => {
        window.location.reload();
      }, 200);
    }
  }

  private _handleCollapsed(collapsedItems: Set<string>) {
    const toggleIcon = this.sideBarRoot!.querySelector('ha-icon.collapse-toggle') as HTMLElement;
    const isCollapsed = collapsedItems.size > 0;

    // Update toggle icon
    toggleIcon?.classList.toggle('active', isCollapsed);
    toggleIcon?.setAttribute('icon', isCollapsed ? 'mdi:plus' : 'mdi:minus');

    const scrollbarItems = this.paperListbox!.querySelectorAll('a:not([moved])') as NodeListOf<HTMLElement>;

    // Update visibility of collapsed items
    scrollbarItems.forEach((item) => {
      const group = item.getAttribute('group');
      item.classList.toggle('collapsed', collapsedItems.has(group!));
    });

    // Update dividers and their content
    this.paperListbox!.querySelectorAll('div.divider').forEach((divider) => {
      const group = divider.getAttribute('group');
      const isGroupCollapsed = collapsedItems.has(group!);
      divider.classList.toggle('collapsed', isGroupCollapsed);
      divider.querySelector('div.added-content')?.classList.toggle('collapsed', isGroupCollapsed);
    });
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
    this._addCollapeToggle();
  }

  private _addAdditionalStyles(color_config: SidebarConfig['color_config'], mode?: string) {
    mode = mode ? mode : this.darkMode ? 'dark' : 'light';
    const colorConfig = color_config?.[mode] || {};
    const borderRadius = color_config?.border_radius ? `${color_config.border_radius}px` : undefined;
    const marginRadius = borderRadius ? '4px 4px' : '1px 4px 0px';

    // Custom Styles
    const customStyles = colorConfig.custom_styles || [];
    const CUSTOM_STYLES = convertCustomStyles(customStyles) || '';

    const defaultColors = getDefaultThemeColors();
    // console.log('theme', theme, 'colorConfig', colorConfig, 'defaultColors', defaultColors);
    const getColor = (key: string): string => {
      return colorConfig?.[key] ?? defaultColors[key];
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

    const scrollbarItems = Array.from(this.paperListbox!.querySelectorAll('a')) as HTMLElement[];

    // Loop through each group and set the group attribute on matching items
    Object.entries(customGroups).forEach(([group, panels]) => {
      scrollbarItems
        .filter((item) => panels.includes(item.getAttribute('data-panel')!))
        .forEach((item) => item.setAttribute('group', group));
    });
    console.log('Grouped Items Done');
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
    const scrollbar = this.paperListbox;
    const scrollbarItems = Array.from(scrollbar!.querySelectorAll('a')) as HTMLElement[];
    const dividerTemplate = sidebarInstance.querySelector('div.divider') as HTMLElement;

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
    const scrollbar = this.paperListbox;

    const notEmptyGroups = Object.keys(custom_groups).filter((key) => custom_groups[key].length > 0);
    const dividerOrder = Array.from(scrollbar.querySelectorAll('div.divider:has([group])')).map((divider) =>
      divider.getAttribute('group')
    );

    const groupItems = Object.values(custom_groups).flat();

    const panelOrderNamed = Array.from(scrollbar.querySelectorAll('a[group]') as NodeListOf<HTMLElement>).map((item) =>
      item.getAttribute('data-panel')
    );

    const bottomMovedItems = Array.from(scrollbar.querySelectorAll('a[moved]') as NodeListOf<HTMLElement>).map((item) =>
      item.getAttribute('data-panel')
    );

    const hasDiff =
      JSON.stringify(bottom_items) !== JSON.stringify(bottomMovedItems) ||
      JSON.stringify(notEmptyGroups) !== JSON.stringify(dividerOrder) ||
      JSON.stringify(groupItems) !== JSON.stringify(panelOrderNamed);

    if (hasDiff) {
      console.log('Changes detected:', {
        bottomItemsDiff: JSON.stringify(bottom_items) !== JSON.stringify(bottomMovedItems),
        dividerOrderDiff: JSON.stringify(notEmptyGroups) !== JSON.stringify(dividerOrder),
        panelOrderDiff: JSON.stringify(groupItems) !== JSON.stringify(panelOrderNamed),
      });
      window.location.reload();
      // this._refreshSidebar();
    } else {
      this._handleCollapsed(this.collapsedItems);
    }
  };

  private async _fetchDashboards() {
    return fetchDashboards(this.hass);
  }

  private _toggleGroup(event: MouseEvent) {
    event.stopPropagation();
    const target = event.target as HTMLElement;
    const group = target.getAttribute('group');
    console.log('Toggle Group', group, target);
    const items = this.paperListbox!.querySelectorAll(`a[group="${group}"]:not([moved])`) as NodeListOf<HTMLElement>;

    if (!items.length) {
      console.error(`No items found for group: ${group}`);
      return;
    }

    const isCollapsed = items[0].classList.contains('collapsed');
    this._setItemToLocalStorage(group!, !isCollapsed);

    // Toggle collapsed state for group and its items
    target.classList.toggle('collapsed', !isCollapsed);
    target.parentElement?.classList.toggle('collapsed', !isCollapsed);

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
Promise.resolve(customElements.whenDefined('home-assistant')).then(() => {
  window.SidebarOrganizer = new SidebarOrganizer();
});
