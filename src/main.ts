import { HAQuerySelector, HAQuerySelectorEvent } from 'home-assistant-query-selector';
import { HomeAssistantStylesManager } from 'home-assistant-styles-manager';

import { SidebarConfigDialog } from './components/sidebar-dialog';
import { NAMESPACE, NAMESPACE_TITLE, STORAGE } from './const';
import { fetchConfig, getDefaultThemeColors } from './helpers';
import { DIALOG_STYLE, DIVIDER_ADDED_STYLE } from './sidebar-css';
import { HaExtened, SidebarConfig, ThemeSettings } from './types';
import './components/sidebar-dialog';
import { addAction, createCloseHeading, getStorage, setStorage } from './utils';

class SidebarOrganizer {
  constructor() {
    const instance = new HAQuerySelector();
    instance.addEventListener(HAQuerySelectorEvent.ON_LISTEN, async (event) => {
      const { HOME_ASSISTANT, HOME_ASSISTANT_MAIN, HA_SIDEBAR, PARTIAL_PANEL_RESOLVER } = event.detail;
      this.ha = (await HOME_ASSISTANT.element) as HaExtened;
      this._partialPanelResolver = await PARTIAL_PANEL_RESOLVER.element;
      this.main = (await HOME_ASSISTANT_MAIN.selector.$.element) as ShadowRoot;
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
    window.addEventListener('settheme', this._handleThemeChange.bind(this));
    window.addEventListener('hass-default-panel', this._handleDefaultPanelChange.bind(this));
  }

  private ha?: HaExtened;
  private _config: SidebarConfig = {};
  private HaSidebar: any;
  private main!: ShadowRoot;
  private sideBarRoot!: ShadowRoot;
  private _partialPanelResolver?: any;
  public _baseOrder: string[] = [];
  private _styleManager: HomeAssistantStylesManager;
  private _sidebarDialog?: SidebarConfigDialog;
  private collapsedItems = new Set<string>();
  private firstSetUpDone = false;
  private _bottomItems: string[] = [];

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
    const paperListbox = this.paperListbox;
    const listItems = paperListbox?.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>;
    const activeLink = paperListbox?.querySelector<HTMLAnchorElement>(`a[href="${path}"]`);
    const configEl = paperListbox?.querySelector('a[data-panel="config"]') as HTMLElement;
    configEl?.setAttribute('aria-selected', configEl === activeLink ? 'true' : 'false');

    if (listItems.length) {
      listItems.forEach((item: HTMLAnchorElement) => {
        const isActive = item === activeLink;
        item.classList.toggle('iron-selected', isActive);
        item.setAttribute('aria-selected', isActive.toString());
      });
    }

    const dividers = paperListbox?.querySelectorAll('div.divider') as NodeListOf<HTMLElement>;
    dividers.forEach((divider) => {
      const group = divider.getAttribute('group');
      const items = paperListbox?.querySelectorAll(`a[group="${group}"]`) as NodeListOf<HTMLAnchorElement>;
      const ariaSelected = Object.values(items).some((item) => item.getAttribute('aria-selected') === 'true');
      divider.classList.toggle('child-selected', ariaSelected);
      divider.setAttribute('aria-selected', ariaSelected.toString());
    });
  }

  public async run() {
    void this._handleFirstConfig();
    this._setupConfigBtn();
    if (!this.firstSetUpDone) {
      await this._getConfig();
      this._handleSetupCollapsed();
      this._addCollapeToggle();
      this.firstSetUpDone = true;
    }

    const sidebar = customElements.get('ha-sidebar');
    this._handleSidebarUpdate(sidebar);
  }

  private _handleSidebarUpdate(sidebar: any) {
    const sidebarUpdated = sidebar.prototype.updated;
    const _thisInstace = this;
    sidebar.prototype.updated = function (changedProperties: any) {
      if (sidebarUpdated) {
        sidebarUpdated.call(this, changedProperties);
      }

      if (changedProperties.has('editMode') && this.editMode) {
        _thisInstace._handleEditMode();
        return;
      } else if (changedProperties.has('editMode') && !this.editMode) {
        _thisInstace._reloadSidebar();
        return;
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

  private _handleThemeChange(event: any) {
    event.stopPropagation();
    const themeSetting = event.detail as ThemeSettings;
    console.log('Theme Changed', themeSetting);
    this._addAdditionalStyles(this._config.color_config);
  }

  private _handleDefaultPanelChange(event: any) {
    event.stopPropagation();
    const defaultPanel = event.detail.defaultPanel;
    console.log('Default Panel Changed', defaultPanel);
    const firstPanel = this._baseOrder[0];
    const customGroup = this._config?.custom_groups || {};
    let defaultInGroup: boolean = false;
    Object.keys(customGroup).forEach((key) => {
      const defaultPanelInGroup = customGroup[key].findIndex((item: string) => item === defaultPanel);
      if (defaultPanelInGroup !== -1) {
        defaultInGroup = true;
        customGroup[key].splice(defaultPanelInGroup, 1);
        console.log(customGroup[key]);
      }
    });
    if (defaultInGroup) {
      console.log('Default Panel Removed from Group', defaultPanel, customGroup);
      this._config = { ...this._config, custom_groups: customGroup };
      setStorage(STORAGE.UI_CONFIG, this._config);
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } else if (firstPanel !== defaultPanel && !defaultInGroup) {
      console.log('Default Panel Changed', defaultPanel);
      this._setupConfig(this._config);
    }
  }

  private _handleFirstConfig() {
    const storageOrder = getStorage(STORAGE.PANEL_ORDER) || '[]';
    if (!storageOrder || JSON.parse(storageOrder).length === 0) {
      const paperListbox = this.paperListbox;
      console.log('Panel is empty');
      const children = paperListbox.children;
      const spacerIndex = Array.from(children).findIndex((child) => child.classList.contains('spacer'));
      const panelOrder = Array.from(children)
        .slice(0, spacerIndex)
        .map((child) => child.getAttribute('data-panel'));
      setStorage(STORAGE.PANEL_ORDER, panelOrder);
      console.log('Setting Panel Order', panelOrder);
      this.HaSidebar._panelOrder = panelOrder;
    } else {
      return;
    }
  }

  private async _getConfig() {
    const config = await fetchConfig();
    if (config) {
      this._config = config;
      this._setupConfig(this._config);
    }
  }

  private _setupConfigBtn() {
    const profileEl = this.HaSidebar.shadowRoot.querySelector('a[data-panel="panel"]') as HTMLElement;
    addAction(profileEl, this._addConfigDialog.bind(this));
  }

  private _addPanelBoxListener = () => {
    const paperListbox = this.paperListbox;
    const listItems = paperListbox.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>;
    listItems.forEach((item) => {
      addAction(item, this._handlePanelItemTouch.bind(this, item));
    });
  };

  private _handlePanelItemTouch(item: HTMLAnchorElement) {
    const target = item as HTMLElement;

    console.log('Panel Item Touched', target);
  }

  private _addCollapeToggle() {
    const groupKeys = Object.keys(this._config?.custom_groups || {});
    const menuEl = this.sideBarRoot.querySelector('.menu') as HTMLElement;
    const titleEl = menuEl.querySelector('.title') as HTMLElement;
    if (!titleEl) return;
    const customTitle = this._config.header_title;
    if (customTitle && customTitle !== '') {
      titleEl.innerText = customTitle;
    }

    if (Object.keys(this._config.custom_groups || {}).length === 0 || this._config.hide_header_toggle) return;
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
    const { color_config, bottom_items, custom_groups } = config;

    const asyncProcess = async () => {
      this._addAdditionalStyles(color_config);
      this._handleBottomPanels(bottom_items);
      this._handleItemsGroup(custom_groups);
    };
    await asyncProcess();
    this._initSidebarOrdering();
  }

  private _initSidebarOrdering() {
    const currentPanel = this.HaSidebar._panelOrder;
    this._baseOrder = this._handleGroupedPanelOrder(currentPanel);
    this.HaSidebar._panelOrder = [...this._baseOrder];
    this._reorderGroupedSidebar();
  }

  private _handleBottomPanels(bottomItems?: string[]) {
    if (!bottomItems) return;
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
    // Close menu if in narrow mode
    if (this.HaSidebar.narrow) {
      this.main.dispatchEvent(new Event('hass-toggle-menu', { bubbles: true, composed: true }));
    }

    // Remove any existing dialog
    const existingDialog = this.main.querySelector('#sidebar-config-dialog');
    existingDialog?.remove();

    // Create new dialog elements
    const sidebarDialog = document.createElement('sidebar-config-dialog') as SidebarConfigDialog;
    sidebarDialog.hass = this.hass;
    sidebarDialog._sideBarRoot = this.sideBarRoot;
    this._sidebarDialog = sidebarDialog;

    const haDialog = document.createElement('ha-dialog') as any;
    Object.assign(haDialog, {
      id: 'sidebar-config-dialog',
      open: true,
      heading: createCloseHeading(this.hass, NAMESPACE_TITLE + ' Configuration'),
      hideActions: false,
      flexContent: true,
      scrimClickAction: '',
      escapeKeyAction: '',
    });
    console.log('Dialog', haDialog);
    // Attach close event handler
    haDialog.addEventListener('closed', () => haDialog.remove());

    // Create action buttons
    const createActionButton = (slot: string, text: string, handler: () => void) => {
      const button = document.createElement('ha-button') as any;
      button.slot = slot;
      button.innerText = text;
      button.addEventListener('click', handler);
      return button;
    };

    const primaryAction = createActionButton('primaryAction', 'Save', () => {
      const sidebarConfig = this._sidebarDialog!._sidebarConfig;
      const sidebarUseConfigFile = this._sidebarDialog!._useConfigFile;
      this._handleNewConfig(sidebarConfig, sidebarUseConfigFile);
      haDialog.remove();
    });

    const secondaryAction = createActionButton('secondaryAction', 'Cancel', () => haDialog.remove());

    // Append dialog and actions
    haDialog.append(sidebarDialog, primaryAction, secondaryAction);
    this._styleManager.addStyle(DIALOG_STYLE, haDialog);
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
      setTimeout(() => {
        window.location.reload();
      }, 200);
    }
  }

  private _handleSetupCollapsed() {
    const customGroups = this._config.custom_groups || {};
    const defaultCollapsed = this._config.default_collapsed || [];
    const sidebarCollapsed = getStorage(STORAGE.COLLAPSE) || '[]';

    if (sidebarCollapsed !== '[]') {
      const groupsKeys = Object.keys(customGroups);
      const collapsedItems = JSON.parse(sidebarCollapsed);
      if (collapsedItems.length > groupsKeys.length) {
        // remove keys different from groups keys
        collapsedItems.forEach((key: string) => {
          if (!groupsKeys.includes(key)) {
            collapsedItems.splice(collapsedItems.indexOf(key), 1);
          }
        });
        setStorage(STORAGE.COLLAPSE, collapsedItems);
      }
      // set the filtered
      this.collapsedItems = new Set([...collapsedItems, ...defaultCollapsed]);
    } else {
      this.collapsedItems = new Set(...defaultCollapsed);
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

  private _reloadSidebar() {
    const panelOrder = this.HaSidebar._panelOrder;
    this._baseOrder = this._handleGroupedPanelOrder(panelOrder);
    this.HaSidebar._panelOrder = [...this._baseOrder];
    console.log('Reloading Sidebar');
    this._setupConfig(this._config);
    this._addCollapeToggle();
  }

  private _addAdditionalStyles(color_config: SidebarConfig['color_config']) {
    const theme = this.hass.themes.darkMode ? 'dark' : 'light';
    const colorConfig = color_config?.[theme] || {};
    const borderRadius = color_config?.border_radius ? `${color_config.border_radius}px` : undefined;
    const marginRadius = borderRadius ? '4px 4px' : '1px 4px 0px';
    const defaultColors = getDefaultThemeColors();
    // console.log('theme', theme, 'colorConfig', colorConfig, 'defaultColors', defaultColors);
    const getColor = (key: string): string => {
      return colorConfig?.[key] ?? defaultColors[key];
    };

    const lineColor = getColor('divider_color');
    const background = getColor('background_color');
    const borderTopColor = getColor('border_top_color');
    const scrollbarThumbColor = getColor('scrollbar_thumb_color');
    const sidebarBackgroundColor = getColor('custom_sidebar_background_color');

    const dividerConfigColor = `
			:host {
				--divider-color: ${lineColor};
				--divider-bg-color: ${background};
				--divider-border-top-color: ${borderTopColor};
        --scrollbar-thumb-color: ${scrollbarThumbColor};
        --sidebar-background-color: ${sidebarBackgroundColor};
				--divider-border-radius: ${borderRadius};
				--divider-margin-radius: ${marginRadius};
		}`;

    this._styleManager.addStyle([dividerConfigColor, DIVIDER_ADDED_STYLE], this.sideBarRoot!);
  }

  private _handleEditMode() {
    const scrollbarItems = this.paperListbox!.querySelectorAll('a') as NodeListOf<HTMLElement>;
    const addedItems = Array.from(scrollbarItems).filter((item) => item.hasAttribute('moved'));
    addedItems.forEach((item) => {
      // remove divider if the next element of item is div.divide
      const nextItem = item.nextElementSibling;
      if (nextItem && nextItem.classList.contains('divider')) {
        console.log('remove divider', nextItem);
        this.paperListbox.removeChild(nextItem);
      }

      console.log('remove item', item);
      this.paperListbox.removeChild(item);
    });
  }

  private _handleItemsGroup(customGroups?: { [key: string]: string[] }) {
    if (!customGroups) return;
    const scrollbarItems = this.paperListbox!.querySelectorAll('a') as NodeListOf<HTMLElement>;

    Object.keys(customGroups).forEach((group) => {
      const config = Object.values(customGroups[group]);

      // Filter the items that belong to the group
      const items = Array.from(scrollbarItems).filter((item) => {
        const panel = item.getAttribute('data-panel');
        return config.includes(panel!);
      });
      // Set group attribute and store the grouped items in currentPanel
      if (items.length > 0) {
        items.forEach((item) => {
          item.setAttribute('group', group);
        });
      }
    });
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
      scrollbar.insertBefore(dividerTemplate.cloneNode(true), firstItemNotInGroup);
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
    } else {
      this._handleCollapsed(this.collapsedItems);
    }
  };

  private _toggleGroup(event: Event) {
    event.stopPropagation();
    const target = event.target as HTMLElement;
    const group = target.getAttribute('group');
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
