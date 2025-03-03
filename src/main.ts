import { HAQuerySelector, HAQuerySelectorEvent } from 'home-assistant-query-selector';
import { HomeAssistantStylesManager } from 'home-assistant-styles-manager';

import tinycolor from 'tinycolor2';

import { HaExtened, SidebarConfig, ThemeSettings } from './types';
import { addAction, createCloseHeading, getStorage, setStorage, logConsoleInfo } from './utils';
import { NAMESPACE, STORAGE } from './const';
import { fetchConfig, getDefaultThemeColors, isColorMissing } from './helpers';
import { DIALOG_STYLE, DIVIDER_ADDED_STYLE } from './sidebar-css';

import './components/sidebar-dialog';
import { SidebarConfigDialog } from './components/sidebar-dialog';

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

  private _colorHelper: tinycolor = tinycolor;

  get hass(): HaExtened['hass'] {
    return this.ha!.hass;
  }

  get darkMode() {
    return this.hass.themes.darkMode;
  }

  get paperListbox(): HTMLElement {
    return this.sideBarRoot?.querySelector('paper-listbox') as HTMLElement;
  }

  get isMobile(): boolean {
    return this.HaSidebar.narrow;
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
      this._addPanelBoxListener();
      this.firstSetUpDone = true;
    }

    const sidebar = customElements.get('ha-sidebar');
    this._handleSidebarUpdate(sidebar);
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
    addAction(profileEl, this._addDialog.bind(this));
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

  private _addDialog() {
    if (this.HaSidebar.narrow) {
      this.main.dispatchEvent(new Event('hass-toggle-menu', { bubbles: true, composed: true }));
    }
    const sidebarHaDialog = this.main.querySelector('ha-dialog#sidebar-config-dialog');
    if (sidebarHaDialog) {
      sidebarHaDialog.remove();
    }

    const sidebarDialog = document.createElement('sidebar-config-dialog') as SidebarConfigDialog;
    sidebarDialog.hass = this.hass;
    sidebarDialog._sideBarRoot = this.sideBarRoot;
    this._sidebarDialog = sidebarDialog;

    const haDialog = document.createElement('ha-dialog') as any;
    haDialog.id = 'sidebar-config-dialog';
    haDialog.open = true;
    haDialog.heading = createCloseHeading(this.hass, 'Sidebar Config');
    haDialog.hideActions = false;
    haDialog.flexContent = true;
    haDialog.scrimClickAction = '';
    haDialog.escapeKeyAction = '';

    haDialog.addEventListener('closed', () => {
      haDialog.remove();
    });

    const primaryAction = document.createElement('ha-button') as any;
    primaryAction.slot = 'primaryAction';
    primaryAction.innerText = 'Save';
    primaryAction.addEventListener('click', () => {
      const sidebarConfig = this._sidebarDialog!._sidebarConfig;
      // console.log('Saving Config', JSON.stringify(sidebarConfig));
      this._handleNewConfig(sidebarConfig);
      haDialog.remove();
    });

    const secondaryAction = document.createElement('ha-button') as any;
    secondaryAction.slot = 'secondaryAction';
    secondaryAction.innerText = 'Cancel';
    secondaryAction.addEventListener('click', () => {
      console.log('Canceling Config');
      haDialog.remove();
    });

    haDialog.appendChild(sidebarDialog);
    haDialog.appendChild(primaryAction);
    haDialog.appendChild(secondaryAction);
    this._styleManager.addStyle(DIALOG_STYLE, haDialog);
    this.main.appendChild(haDialog);
  }

  private _handleNewConfig(config: SidebarConfig) {
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
    // console.log('Handling Collapsed');
    const toggleIcon = this.sideBarRoot!.querySelector('ha-icon.collapse-toggle') as HTMLElement;
    const collapsed = collapsedItems.size > 0;
    toggleIcon?.classList.toggle('active', collapsed);
    toggleIcon?.setAttribute('icon', collapsed ? 'mdi:plus' : 'mdi:minus');
    const scrollbar = this.paperListbox;
    const scrollbarItems = scrollbar!.querySelectorAll('a:not([moved])') as NodeListOf<HTMLElement>;
    // Hide collapsed items
    // console.log('Collapsed Items', scrollbar);

    scrollbarItems.forEach((item) => {
      const group = item.getAttribute('group');
      const collapsed = collapsedItems.has(group!);
      item.classList.toggle('collapsed', collapsed);
    });

    scrollbar.querySelectorAll('div.divider').forEach((divider) => {
      const group = divider.getAttribute('group');
      const collapsed = collapsedItems.has(group!);
      divider.classList.toggle('collapsed', collapsed);
      divider.querySelector('div.added-content')?.classList.toggle('collapsed', collapsed);
    });
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

  _handleEditMode() {
    const sidebarInstance = this.sideBarRoot!;
    const scrollbar = sidebarInstance.querySelector('paper-listbox.ha-scrollbar') as HTMLElement;
    const scrollbarItems = scrollbar!.querySelectorAll('a') as NodeListOf<HTMLElement>;
    const addedItems = Array.from(scrollbarItems).filter((item) => item.hasAttribute('moved'));
    addedItems.forEach((item) => {
      // remove divider if the next element of item is div.divide
      const nextItem = item.nextElementSibling;
      if (nextItem && nextItem.classList.contains('divider')) {
        console.log('remove divider', nextItem);
        scrollbar.removeChild(nextItem);
      }

      console.log('remove item', item);
      scrollbar.removeChild(item);
    });
  }

  private _handleItemsGroup(customGroups?: { [key: string]: string[] }) {
    if (!customGroups) return;
    const scrollbar = this.paperListbox;
    const scrollbarItems = scrollbar!.querySelectorAll('a') as NodeListOf<HTMLElement>;

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
    // console.log(currentPanel);
    const defaultPanel = this.hass.defaultPanel;
    const bottomMovedItems = this._config.bottom_items || [];
    const customGroups = this._config.custom_groups || {};

    const groupedItems: string[] = [];

    Object.values(customGroups)
      .flat()
      .forEach((item) => {
        const inCurrentPanel = currentPanel.includes(item);
        if (inCurrentPanel) groupedItems.push(item);
      });

    // Combine the grouped items before the default items
    const defaultItems = currentPanel
      .filter((item: string) => !groupedItems.includes(item))
      .filter((item: string) => !bottomMovedItems.includes(item));

    const defaultPanelItem = defaultItems.find((item) => item === defaultPanel);

    if (defaultPanelItem) {
      defaultItems.splice(defaultItems.indexOf(defaultPanelItem), 1);
      groupedItems.unshift(defaultPanelItem);
    }

    const combinedItems = [...groupedItems, ...defaultItems, ...bottomMovedItems.reverse()];
    return combinedItems;
  }

  private _reorderGroupedSidebar() {
    // console.log('Reordering Grouped Sidebar');
    const customGroups = this._config.custom_groups || {};
    if (!customGroups) return;
    const sidebarInstance = this.sideBarRoot!;
    const scrollbar = this.paperListbox;
    const scrollbarItems = scrollbar!.querySelectorAll('a') as NodeListOf<HTMLElement>;
    const divider = sidebarInstance.querySelector('div.divider') as HTMLElement;

    const newDivider = (group: string) => {
      const newDivider = divider.cloneNode(true) as HTMLElement;
      const title = group.replace(/_/g, ' ');
      const icon = 'mdi:chevron-down';
      newDivider.setAttribute('group', `${group}`);
      newDivider.setAttribute('added', '');
      const contentDiv = document.createElement('div');
      contentDiv.classList.add('added-content');
      contentDiv.setAttribute('group', `${group}`);
      contentDiv.innerHTML = `
			<ha-icon icon=${icon}></ha-icon>
			<span>${title}</span>
			`;

      newDivider.appendChild(contentDiv);
      return newDivider;
    };

    // Insert the dividers
    Object.keys(customGroups).forEach((group) => {
      const insertBefore = Array.from(scrollbarItems).find(
        (item) => item.getAttribute('group') === group && !item.hasAttribute('moved')
      );

      if (insertBefore) {
        const newAddedDivider = newDivider(group);
        scrollbar.insertBefore(newAddedDivider, insertBefore);
        newAddedDivider.addEventListener('click', (event) => {
          this._toggleGroup(event);
        });
      }
    });

    // fimd first item not in a group and insert divider before it
    const itemsNotInGroup = Array.from(scrollbarItems).find(
      (item) =>
        !item.hasAttribute('group') &&
        !item.hasAttribute('moved') &&
        item.previousElementSibling?.hasAttribute('group') &&
        scrollbarItems[0] !== item
    );
    if (itemsNotInGroup) {
      scrollbar.insertBefore(divider.cloneNode(true), itemsNotInGroup);
    }

    setTimeout(() => {
      this._checkDiffs();
    }, 100);
  }

  private _checkDiffs = () => {
    const customGroups = this._config.custom_groups || {};
    const bottomItems = this._config.bottom_items || [];
    const scrollbar = this.paperListbox;

    const notEmptyGroups = Object.keys(customGroups).filter((key) => customGroups[key].length !== 0);
    const dividerOrder = Array.from(scrollbar.querySelectorAll('div.divider:has([group]')).map((divider) =>
      divider.getAttribute('group')
    );

    const groupItems = Object.values(customGroups).flat();
    const panelOrderNamed = Array.from(scrollbar.querySelectorAll('a') as NodeListOf<HTMLElement>)
      .filter((item) => item.hasAttribute('group'))
      .map((item) => item.getAttribute('data-panel'));

    const bottomMovedItems = Array.from(scrollbar.querySelectorAll('a[moved]')).map((item) =>
      item.getAttribute('data-panel')
    );

    const bottomItemsDiff = JSON.stringify(bottomItems) !== JSON.stringify(bottomMovedItems);
    const dividerOrderDiff = JSON.stringify(notEmptyGroups) !== JSON.stringify(dividerOrder);
    const panelOrderDiff = JSON.stringify(groupItems) !== JSON.stringify(panelOrderNamed);

    if (bottomItemsDiff || dividerOrderDiff || panelOrderDiff) {
      console.log('something changed', bottomItemsDiff, dividerOrderDiff, panelOrderDiff);
      window.location.reload();
      return;
    } else {
      this._handleCollapsed(this.collapsedItems);
    }
  };

  _toggleGroup(event: Event) {
    event.stopPropagation();
    const target = event.target as HTMLElement;
    const group = target.getAttribute('group');
    const scrollbar = this.paperListbox as HTMLElement;
    const items = scrollbar.querySelectorAll(`a[group="${group}"]:not([moved])`) as NodeListOf<HTMLElement>;

    // Check if there are any matching items
    if (items.length === 0) {
      console.error(`No items found for group: ${group}`);
      return;
    }

    const collapsed = items[0].classList.contains('collapsed');

    this._setItemToLocalStorage(group!, !collapsed);

    target.parentElement?.classList.toggle('collapsed', !collapsed);
    target.classList.toggle('collapsed', !collapsed);
    items.forEach((item, index) => {
      const animateClass = collapsed ? 'slideIn' : 'slideOut';
      item.style.animationDelay = `${index * 50}ms`;
      item.classList.add(animateClass);
      item.addEventListener('animationend', () => {
        item.classList.toggle('collapsed', !collapsed);
        item.classList.remove(animateClass);
      });
    });
  }

  _setItemToLocalStorage(group: string, collapsed: boolean) {
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
  logConsoleInfo();
  window.SidebarOrganizer = new SidebarOrganizer();
});
