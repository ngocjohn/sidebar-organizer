import { ALERT_MSG } from '@constants';
import { mdiChevronLeft, mdiDotsVertical, mdiDrag, mdiSortAlphabeticalVariant } from '@mdi/js';
import { SidebarConfig, HaExtened } from '@types';
import { validateConfig } from '@utilities/configs/validators';
import { showAlertDialog, showConfirmDialog, showPromptDialog } from '@utilities/show-dialog-box';
import { html, css, LitElement, TemplateResult, nothing, PropertyValues, CSSResult } from 'lit';
import { repeat } from 'lit-html/directives/repeat.js';
import { customElement, property, state } from 'lit/decorators';
import Sortable from 'sortablejs';

import { SidebarConfigDialog } from './sidebar-dialog';

// type PANEL_TABS = 'bottomPanel' | 'customGroups' | 'hiddenItems';
enum PANEL {
  BOTTOM_PANEL = 'bottomPanel',
  CUSTOM_GROUP = 'customGroup',
  HIDDEN_ITEMS = 'hiddenItems',
}

@customElement('sidebar-dialog-groups')
export class SidebarDialogGroups extends LitElement {
  @property({ attribute: false }) hass!: HaExtened['hass'];
  @property({ attribute: false }) _dialog!: SidebarConfigDialog;
  @property({ attribute: false }) _sidebarConfig!: SidebarConfig;

  @state() private _selectedTab: PANEL = PANEL.BOTTOM_PANEL;
  @state() public _selectedGroup: string | null = null;
  @state() private _reloadItems = false;
  @state() private _reloadPanelItems: boolean = false;
  @state() private _sortable: Sortable | null = null;
  @state() private _panelSortable: Sortable | null = null;

  protected firstUpdated(): void {
    this._setGridSelector();
  }

  protected updated(_changedProperties: PropertyValues) {
    if (
      (_changedProperties.has('_selectedTab') && this._selectedTab !== PANEL.CUSTOM_GROUP) ||
      (_changedProperties.has('_selectedGroup') && this._selectedGroup !== undefined)
    ) {
      setTimeout(() => {
        this._setGridSelector();
      }, 50); // Small delay to ensure the ha-selector shadow DOM is rendered
    }

    if (_changedProperties.has('_selectedTab') && this._selectedTab !== undefined) {
      this._dialog._dialogPreview._toggleBottomPanel(this._selectedTab === PANEL.BOTTOM_PANEL);
      if (this._selectedTab !== PANEL.CUSTOM_GROUP) {
        this._selectedGroup = null;
      }
      if (this._selectedTab === PANEL.BOTTOM_PANEL) {
        this._initPanelSortable();
      }
    }
    if (
      _changedProperties.has('_selectedTab') &&
      this._selectedTab !== PANEL.BOTTOM_PANEL &&
      this._selectedTab !== PANEL.HIDDEN_ITEMS
    ) {
      this._initSortable();
    }

    if (_changedProperties.has('_selectedGroup') && this._selectedGroup !== null) {
      this._sortable?.destroy();
      this._sortable = null;
      this._initPanelSortable();
    } else if (
      _changedProperties.has('_selectedGroup') &&
      this._selectedGroup === null &&
      this._selectedTab !== PANEL.BOTTOM_PANEL &&
      this._selectedTab !== PANEL.HIDDEN_ITEMS
    ) {
      this._initSortable();
      this._panelSortable?.destroy();
      this._panelSortable = null;
    }

    if (_changedProperties.has('_selectedGroup')) {
      this._dialog._dialogPreview._toggleGroup(this._selectedGroup);
    }
  }

  private _initSortable = (): void => {
    const groupList = this.shadowRoot?.querySelector('#group-list') as HTMLElement;

    if (groupList) {
      // console.log('initSortable', groupList);
      this._sortable = new Sortable(groupList, {
        handle: '.handle',
        ghostClass: 'sortable-ghost',
        animation: 150,
        onEnd: (evt) => {
          this._handleSortEnd(evt);
        },
      });
      // console.log('sortable initialized');
    }
  };

  private _initPanelSortable = (): void => {
    const selectedItems = this.shadowRoot?.querySelector('#selected-items') as HTMLElement;

    if (selectedItems) {
      this._panelSortable = new Sortable(selectedItems, {
        handle: '.handle',
        ghostClass: 'sortable-ghost',
        animation: 150,
        onEnd: (evt) => {
          this._handlePanelSortEnd(evt);
        },
      });
      console.log('panel sortable initialized');
    }
  };

  private _handlePanelSortEnd(evt: Sortable.SortableEvent): void {
    if (!this._sidebarConfig) return;
    evt.preventDefault();
    const oldIndex = evt.oldIndex as number;
    const newIndex = evt.newIndex as number;

    const updateConfig = (updates: Partial<SidebarConfig>) => {
      this._sidebarConfig = {
        ...this._sidebarConfig,
        ...updates,
      };
      this._dispatchConfig(this._sidebarConfig);
      setTimeout(() => {
        this._checkSortedItems();
      }, 50);
    };

    switch (this._selectedTab) {
      case PANEL.BOTTOM_PANEL:
        const bottomItems = [...(this._sidebarConfig.bottom_items || [])];
        const [removedItem] = bottomItems.splice(oldIndex, 1);
        bottomItems.splice(newIndex, 0, removedItem);
        updateConfig({ bottom_items: bottomItems });
        // console.log('bottom new order:', bottomItems);
        break;
      case PANEL.CUSTOM_GROUP:
        const customGroups = { ...(this._sidebarConfig.custom_groups || {}) };
        const groupName = this._selectedGroup;
        if (groupName) {
          const groupItems = [...(customGroups[groupName] || [])];
          console.log(groupName, groupItems);
          const [removedItem] = groupItems.splice(oldIndex, 1);
          groupItems.splice(newIndex, 0, removedItem);
          customGroups[groupName] = groupItems;
          updateConfig({ custom_groups: customGroups });
          // console.log(`New:`, groupName, groupItems);
        }
        break;
    }
  }

  private _checkSortedItems() {
    const selectedItems = this.shadowRoot?.querySelector('#selected-items') as HTMLElement;
    if (!selectedItems) return;
    const selectedItemsList = this._selectedGroup
      ? this._sidebarConfig.custom_groups![this._selectedGroup]
      : this._sidebarConfig.bottom_items || [];

    const selectedItemsArray = Array.from(selectedItems.querySelectorAll('li')).map((item) =>
      item.getAttribute('data-panel')
    );

    const isSame = selectedItemsArray.every((item, index) => item === selectedItemsList[index]);
    if (!isSame) {
      this._reloadPanelItems = true;
      this._panelSortable?.destroy();
      this._panelSortable = null;
      setTimeout(() => {
        this._reloadPanelItems = false;
        setTimeout(() => {
          this._initPanelSortable();
        }, 200);
      }, 200);
    }
  }

  private _setGridSelector = (): void => {
    const selectorEl =
      this.shadowRoot?.getElementById('customSelector') || this.shadowRoot?.getElementById('customSelectorHidden');
    if (selectorEl) {
      const selector = selectorEl?.shadowRoot?.querySelector('ha-selector-select');
      if (selector) {
        const div = selector.shadowRoot?.querySelector('div');
        if (div) {
          div.style.display = 'grid';
          div.style.gridTemplateColumns = 'var(--grid-flex-columns)';
        }
      }
    }
  };

  private _handleSortEnd(evt: Sortable.SortableEvent): void {
    if (!this._sidebarConfig || !this._sidebarConfig.custom_groups) return;
    evt.preventDefault();
    const oldIndex = evt.oldIndex as number;
    const newIndex = evt.newIndex as number;

    // Explicitly type the groupItems as an array of tuples [string, string[]]
    const groupItems: [string, string[]][] = Object.keys(this._sidebarConfig.custom_groups).map((key) => [
      key,
      this._sidebarConfig.custom_groups![key],
    ]);
    // Reorder the items based on the drag and drop indexes
    const [removedItem] = groupItems.splice(oldIndex, 1);
    groupItems.splice(newIndex, 0, removedItem);

    // Rebuild the object, explicitly typing the accumulator
    const newGroupItems = groupItems.reduce((acc: { [key: string]: string[] }, [key, value]) => {
      acc[key] = value; // Directly assign the value (which is an array)
      return acc;
    }, {});

    console.log('newGroupItems', Object.keys(newGroupItems));
    this._sidebarConfig = {
      ...this._sidebarConfig,
      custom_groups: newGroupItems,
    };

    this._dispatchConfig(this._sidebarConfig);

    setTimeout(() => {
      this._checkReload();
    }, 50);
  }

  private _checkReload() {
    const customGroups = Object.keys(this._sidebarConfig.custom_groups || {});
    const groupList = this.shadowRoot?.getElementById('group-list') as HTMLElement;
    if (!groupList) return;
    const listItems = Array.from(groupList.querySelectorAll('div.group-item-row')).map((item) =>
      item.getAttribute('data-group')
    );
    // console.log('listItems', listItems, 'customGroups', customGroups);

    const isSame = customGroups.every((group, index) => group === listItems[index]);
    if (!isSame) {
      this._reloadItems = true;
      this._sortable?.destroy();
      this._sortable = null;

      setTimeout(() => {
        this._reloadItems = false;
        setTimeout(() => {
          this._initSortable();
        }, 200);
      }, 200);
    }
  }

  private get pickedItems() {
    const bottomItems = this._sidebarConfig?.bottom_items || [];
    const customGroups = this._sidebarConfig?.custom_groups || {};
    const pickedItems = [...bottomItems, ...Object.values(customGroups).flat()];
    return pickedItems;
  }

  protected render() {
    const tabOpts = [
      { value: 'bottomPanel', label: 'Bottom Panel' },
      { value: 'customGroup', label: 'Group Panel' },
      { value: 'hiddenItems', label: 'Hidden Items' },
    ];

    const tabSelector = html` <ha-control-select
      .value=${this._selectedTab}
      .options=${tabOpts}
      @value-changed=${(ev: CustomEvent) => {
        this._selectedTab = ev.detail.value;
      }}
    ></ha-control-select>`;

    const bottomPanel = this._renderBottomItems();
    const hiddenItems = this._renderHiddenItems();
    const customGroup = this._selectedGroup === null ? this._renderCustomGroupTab() : this._renderEditGroup();

    const tabMap = {
      bottomPanel: bottomPanel,
      customGroup: customGroup,
      hiddenItems: hiddenItems,
    };

    return html`
      ${tabSelector}
      <div class="config-content">${tabMap[this._selectedTab]}</div>
    `;
  }

  private _renderHiddenItems() {
    const hiddenItems = this._sidebarConfig?.hidden_items || [];
    const initPanelItems = this._dialog._initCombiPanels;

    const selector = this._createSelectorOptions(initPanelItems);

    const selectedItems = Object.entries(hiddenItems).map(([, item]) => item);

    return html` <div class="items-container">
      <div class="header-row flex-icon">
        <span>HIDDEN ITEMS</span>
      </div>
      <ha-selector
        .hass=${this.hass}
        .selector=${selector}
        .value=${selectedItems}
        .required=${false}
        id="customSelectorHidden"
        @value-changed=${this._handleHiddenItemsChange}
      >
      </ha-selector>
      ${this._renderSpacer()}
    </div>`;
  }

  private _renderCustomGroupTab(): TemplateResult {
    const customGroupList = Object.keys(this._sidebarConfig.custom_groups || []);
    const addBtn = html`
      <ha-button
        style="--mdc-theme-primary: var(--accent-color); place-self: flex-end;"
        @click=${this._togglePromptNewGroup}
        >Add New Group</ha-button
      >
    `;
    const isCollapsed = (key: string): boolean => {
      return this._sidebarConfig?.default_collapsed?.includes(key) ?? false;
    };

    const _createActionMap = (key: string) => {
      const actions = [
        { title: 'Edit items', action: 'edit-items', icon: 'mdi:pencil' },
        { title: 'Rename', action: 'rename', icon: 'mdi:alphabetical' },
        { title: 'Show in preview', action: 'preview-item', icon: 'mdi:information-outline' },
        // Default 'collapsed-group' action
        {
          title: isCollapsed(key) ? 'Remove from collapsed by default' : 'Add to collapsed by default',
          action: 'collapsed-group',
          icon: isCollapsed(key) ? 'mdi:eye-minus' : 'mdi:eye-plus',
        },
        { title: 'Delete', action: 'delete', icon: 'mdi:trash-can-outline' },
      ];
      return actions;
    };
    const loading =
      customGroupList.length === 0
        ? html`<div>No custom groups found</div>`
        : html`<ha-spinner .size=${'small'}></ha-spinner>`;

    return html`
      ${!customGroupList.length || this._reloadItems
        ? loading
        : html`
            <div class="group-list" id="group-list">
              ${repeat(
                customGroupList || [],
                (key) => key,
                (key, index) => {
                  const groupName = key.replace(/_/g, ' ').toUpperCase();
                  let actionMap = _createActionMap(key);
                  const itemCount = this._sidebarConfig.custom_groups![key].length;
                  return html` <div class="group-item-row" data-group=${key}>
                    <div class="handle">
                      <ha-icon-button .path=${mdiDrag}></ha-icon-button>
                    </div>
                    <div class="group-name" @click=${() => this._handleGroupAction('edit-items', key)}>
                      <ha-icon icon=${`mdi:numeric-${index + 1}-box`}></ha-icon>
                      <div class="group-name-items">
                        ${groupName}
                        <span>${itemCount} ${itemCount > 1 ? 'items' : 'item'}</span>
                      </div>
                    </div>
                    <div class="group-actions">
                      <ha-icon
                        ?hidden=${!isCollapsed(key)}
                        icon="mdi:eye-off-outline"
                        style="color: var(--disabled-color)"
                      ></ha-icon>
                      <ha-button-menu
                        .corner=${'TOP_LEFT'}
                        .fixed=${true}
                        .menuCorner=${'END'}
                        .activatable=${true}
                        .naturalMenuWidth=${true}
                        @closed=${(ev: Event) => ev.stopPropagation()}
                        ><ha-icon-button slot="trigger" .path=${mdiDotsVertical}></ha-icon-button>
                        ${actionMap.map((action) => {
                          return html`<mwc-list-item
                            .graphic=${'icon'}
                            @click=${() => this._handleGroupAction(action.action, key)}
                            ><ha-icon slot="graphic" icon=${action.icon}></ha-icon> ${action.title}</mwc-list-item
                          >`;
                        })}
                      </ha-button-menu>
                    </div>
                  </div>`;
                }
              )}
            </div>

            ${this._renderSpacer()}
          `}
      <div class="header-row flex-end">${addBtn}</div>
    `;
  }

  private _handleGroupAction = async (action: string, key: string) => {
    console.log('group action', action, key);

    const defaultCollapsed = [...(this._sidebarConfig?.default_collapsed || [])];
    const updateConfig = (updates: any) => {
      this._sidebarConfig = {
        ...this._sidebarConfig,
        custom_groups: updates,
      };
      this._dispatchConfig(this._sidebarConfig);
      this.requestUpdate();
    };

    const updateDefaultCollapsed = (updates: string[]) => {
      this._sidebarConfig = {
        ...this._sidebarConfig,
        default_collapsed: updates,
      };
      this._dispatchConfig(this._sidebarConfig);
      this.requestUpdate();
    };

    switch (action) {
      case 'edit-items':
        this._selectedGroup = key;
        break;
      case 'rename':
        let newName = await showPromptDialog(
          this,
          'Enter new group name',
          key.replace(/_/g, ' ').toUpperCase(),
          'Rename'
        );
        if (newName === null || newName === '') return;
        newName = newName.trim().replace(/\s/g, '_').toLowerCase();
        const customGroups = { ...(this._sidebarConfig.custom_groups || {}) };
        if (Object.keys(customGroups).includes(newName)) {
          await showAlertDialog(this, `${ALERT_MSG.NAME_EXISTS}`);
          return;
        }
        const inCollapsed = defaultCollapsed.includes(key) ?? false;
        if (inCollapsed) {
          defaultCollapsed.splice(defaultCollapsed.indexOf(key), 1);
          defaultCollapsed.push(newName);
          updateDefaultCollapsed(defaultCollapsed);
          console.log('item in collapsed, add renamed group to default collapsed', key, newName, defaultCollapsed);
        }
        const groupItems = customGroups[key];
        const indexOfKey = Object.keys(customGroups).indexOf(key);
        delete customGroups[key];
        customGroups[newName] = groupItems;
        if (indexOfKey) {
          const newOrder = Object.keys(customGroups);
          newOrder.splice(indexOfKey, 0, newName);
          const reorderedGroups = newOrder.reduce((acc: { [key: string]: string[] }, key) => {
            acc[key] = customGroups[key];
            return acc;
          }, {});
          updateConfig(reorderedGroups);
        } else {
          updateConfig(customGroups);
        }
        break;
      case 'collapsed-group':
        const isCollapsed = defaultCollapsed.indexOf(key) !== -1;
        if (isCollapsed) {
          defaultCollapsed.splice(defaultCollapsed.indexOf(key), 1);
        } else {
          defaultCollapsed.push(key);
        }
        updateDefaultCollapsed(defaultCollapsed);
        console.log('item is collapsed', this._sidebarConfig?.default_collapsed);
        break;
      case 'delete':
        const confirmDelete = await showConfirmDialog(
          this,
          `Are you sure you want to delete this group? ${key.replace(/_/g, ' ').toLocaleUpperCase()}`,
          'Delete'
        );
        if (!confirmDelete) return;
        const deletedInCollapsed = defaultCollapsed.indexOf(key) !== -1;
        if (deletedInCollapsed) {
          defaultCollapsed.splice(defaultCollapsed.indexOf(key), 1);
          updateDefaultCollapsed(defaultCollapsed);
          console.log('item in collapsed, remove group from default collapsed', key, defaultCollapsed);
        }
        const currentGroups = { ...(this._sidebarConfig.custom_groups || {}) };
        delete currentGroups[key];
        updateConfig(currentGroups);
        break;
      case 'preview':
        this._dialog._dialogPreview._toggleGroup(key, 'show');
        break;
      case 'preview-item':
        this._dialog._dialogPreview._toggleGroup(key);
        break;
    }
  };

  private _renderEditGroup(): TemplateResult | typeof nothing {
    if (!this._selectedGroup) return nothing;
    const headerBack = html`<div class="header-row ">
      <ha-icon-button .path=${mdiChevronLeft} @click=${() => (this._selectedGroup = null)}> </ha-icon-button>
      ${this._selectedGroup.toLocaleUpperCase()}
      <ha-button @click=${() => this._handleGroupAction('preview', this._selectedGroup!)}> PREVIEW </ha-button>
    </div>`;

    const selectorElement = this._renderPanelSelector('customGroup', this._selectedGroup);

    return html` ${headerBack} ${selectorElement}`;
  }

  private _renderBottomItems() {
    if (this._selectedTab !== 'bottomPanel') return nothing;
    const selectorList = this._renderPanelSelector('bottom_items');

    return html` ${selectorList} `;
  }

  private _renderPanelSelector(configValue: string, customGroup?: string): TemplateResult {
    const currentItems = this._dialog._initPanelOrder;
    const pickedItems = this.pickedItems;
    const selectedType = customGroup ? customGroup : 'bottom_items';

    const configItems = customGroup
      ? this._sidebarConfig.custom_groups![customGroup] || []
      : this._sidebarConfig.bottom_items || [];

    const selectedItems = Object.entries(configItems).map(([, item]) => item);

    const itemsToRemove = pickedItems.filter((item) => !selectedItems.includes(item));
    const itemsToChoose = currentItems.filter((item) => !itemsToRemove.includes(item));

    const selector = this._createSelectorOptions(itemsToChoose);

    const renderItems = this._renderSelectedItems(selectedType, selectedItems);

    return html`
      <div id="items-preview-wrapper">
        <div class="items-container">
          <div class="header-row flex-icon">
            <span>SELECT ITEMS</span>
          </div>
          <ha-selector
            .hass=${this.hass}
            .selector=${selector}
            .value=${selectedItems}
            .configValue=${configValue}
            .customGroup=${customGroup}
            .required=${false}
            id="customSelector"
            @value-changed=${this._handleValueChange}
          >
          </ha-selector>
          ${this._renderSpacer()}
        </div>
        <div class="preview-container" ?hidden=${!selectedItems.length}>${renderItems}</div>
      </div>
    `;
  }

  private _renderSelectedItems(selectedType: string, selectedItems: string[]): TemplateResult {
    const hassPanels = this.hass?.panels;
    const selectedItemsArrayWithTitles = selectedItems.map((item) => {
      return {
        key: item,
        title:
          this.hass.localize(`panel.${hassPanels[item]?.title}`) ||
          hassPanels[item]?.title ||
          hassPanels[item].url_path,
      };
    });

    return html`
      <div class="header-row flex-icon">
        <span>ITEMS ORDER</span>
        <ha-icon-button .path=${mdiSortAlphabeticalVariant} @click=${() => this._sortItems(selectedType)}>
        </ha-icon-button>
      </div>

      ${this._reloadPanelItems
        ? html`<ha-spinner .size=${'small'}></ha-spinner> `
        : html`<ul class="selected-items" id="selected-items">
            ${repeat(
              selectedItemsArrayWithTitles,
              (item) => item,
              (item, index) => {
                return html`<li data-panel=${item.key} data-index=${index}>
                  <div class="handle">
                    <ha-icon icon="mdi:drag"></ha-icon>
                  </div>
                  ${item.title}
                </li>`;
              }
            )}
          </ul>`}
    `;
  }

  private _renderSpacer() {
    return html`<div style="flex: 1"></div>`;
  }

  private _sortItems(type: string) {
    const hassPanels = this.hass?.panels;
    const selectedItems =
      type !== 'bottom_items' ? this._sidebarConfig.custom_groups![type] || [] : this._sidebarConfig.bottom_items || [];
    // Create a list of items with their titles
    const itemsWithTitles = selectedItems.map((item) => ({
      key: item,
      title:
        this.hass.localize(`panel.${hassPanels[item]?.title}`) || hassPanels[item]?.title || hassPanels[item].url_path,
    }));

    // Sort in ascending order by title (case-insensitive)
    const ascendingSortedItems = [...itemsWithTitles].sort((a, b) => {
      const titleA = a.title.toUpperCase();
      const titleB = b.title.toUpperCase();
      return titleA.localeCompare(titleB); // Ascending order
    });

    // Check if the original list is already sorted in ascending order
    const isSortedAsc = itemsWithTitles.every((item, index) => item.key === ascendingSortedItems[index].key);

    let sortedItems: { key: string; title: string }[];
    if (isSortedAsc) {
      // If already sorted in ascending order, sort in descending order
      sortedItems = [...itemsWithTitles].sort((a, b) => {
        const titleA = a.title.toUpperCase();
        const titleB = b.title.toUpperCase();
        return titleB.localeCompare(titleA); // Descending order
      });
    } else {
      sortedItems = ascendingSortedItems;
    }

    // Get the sorted keys (original item keys)
    const sortedItemKeys = sortedItems.map((item) => item.key);

    const updates: Partial<SidebarConfig> = {};
    // Update the config with the new sorted keys
    if (type === 'bottom_items') {
      let bottomItems = [...(this._sidebarConfig.bottom_items || [])];
      bottomItems = sortedItemKeys;
      updates.bottom_items = bottomItems;
    } else {
      let customGroups = { ...(this._sidebarConfig.custom_groups || {}) };
      let group = [...(customGroups[type] || [])];
      group = sortedItemKeys;
      customGroups[type] = group;
      updates.custom_groups = customGroups;
    }

    if (Object.keys(updates).length > 0) {
      this._sidebarConfig = {
        ...this._sidebarConfig,
        ...updates,
      };
      console.log('items sorted');
      this._dispatchConfig(this._sidebarConfig);
    }
  }

  private _createSelectorOptions(items: string[]) {
    const hassPanels = this.hass?.panels;

    const options = items.map((panel) => {
      const panelName = this.hass.localize(`panel.${hassPanels[panel]?.title}`) || hassPanels[panel]?.title || panel;
      return { value: panel, label: panelName };
    });

    options.sort((a, b) => a.label.localeCompare(b.label));

    const selector = {
      select: {
        multiple: true,
        mode: 'list',
        options: options,
      },
    };
    return selector;
  }

  private _togglePromptNewGroup = async () => {
    // const groupName = prompt('Enter new group name', 'Some Group Name');
    const groupName = await showPromptDialog(this, 'Enter new group name', 'Some Group Name', 'Create');
    if (groupName === null) return;
    let newName = groupName.trim().replace(/\s/g, '_').toLowerCase();
    const customGroups = { ...(this._sidebarConfig.custom_groups || {}) };
    if (Object.keys(customGroups).includes(newName)) {
      await showAlertDialog(this, 'Group name already exists. Please choose a different one.');
      return;
    }
    customGroups[newName] = [];
    this._sidebarConfig = {
      ...this._sidebarConfig,
      custom_groups: customGroups,
    };

    this._dispatchConfig(this._sidebarConfig);
    this.requestUpdate();
  };

  private _handleValueChange(ev: any) {
    ev.stopPropagation();
    const configValue = ev.target.configValue;
    const customGroup = ev.target.customGroup;
    const value = ev.detail.value;

    // console.log('configValue', configValue, 'value', value);

    const updates: Partial<SidebarConfig> = {};
    if (configValue === 'bottom_items') {
      let bottomPanels = [...(this._sidebarConfig.bottom_items || [])];
      bottomPanels = value;
      updates.bottom_items = bottomPanels;
    } else if (configValue === 'customGroup') {
      const key = customGroup;
      let customGroups = { ...(this._sidebarConfig.custom_groups || {}) };
      let groupItems = [...(customGroups[key] || [])];
      groupItems = value;
      customGroups[key] = groupItems;
      updates.custom_groups = customGroups;
    }

    if (Object.keys(updates).length > 0) {
      this._sidebarConfig = {
        ...this._sidebarConfig,
        ...updates,
      };
      console.log('updates', updates);
    }
    this._dispatchConfig(this._sidebarConfig);
  }

  private _handleHiddenItemsChange(ev: any) {
    ev.stopPropagation();
    const value = ev.detail.value;
    console.log('new value', value);
    const { custom_groups, bottom_items } = validateConfig(this._sidebarConfig, value);
    this._updatePanels(value);

    const updates: Partial<SidebarConfig> = {};

    let customGroups = { ...(this._sidebarConfig.custom_groups || {}) };
    let bottomItems = [...(this._sidebarConfig.bottom_items || [])];
    let hiddenItems = [...(this._sidebarConfig.hidden_items || [])];
    if (custom_groups) {
      customGroups = custom_groups;
      updates.custom_groups = customGroups;
    }
    if (bottom_items) {
      bottomItems = bottom_items;
      updates.bottom_items = bottomItems;
    }

    hiddenItems = [...value];
    updates.hidden_items = hiddenItems;

    if (Object.keys(updates).length > 0) {
      this._sidebarConfig = {
        ...this._sidebarConfig,
        ...updates,
      };
    }

    this._dispatchConfig(this._sidebarConfig);
  }

  private _updatePanels(hiddenItems: string[]) {
    const combinedPanels = this._dialog._initCombiPanels;
    let initPanelOrder = [...(this._dialog._initPanelOrder || [])];

    initPanelOrder = combinedPanels.filter((panel) => !hiddenItems.includes(panel));
    this._dialog._initPanelOrder = initPanelOrder;
  }

  private _dispatchConfig(config: SidebarConfig) {
    const event = new CustomEvent('sidebar-changed', { detail: config, bubbles: true, composed: true });
    this.dispatchEvent(event);
  }

  static get styles(): CSSResult {
    return css`
      :host *[hidden] {
        display: none;
      }
      :host #customSelectorHidden {
        --grid-flex-columns: repeat(auto-fill, minmax(30.5%, 1fr));
      }
      :host #customSelector {
        --grid-flex-columns: repeat(auto-fill, minmax(40.5%, 1fr));
      }
      @media all and (max-width: 700px), all and (max-height: 500px) {
        :host #customSelectorHidden,
        :host #customSelector {
          --grid-flex-columns: repeat(auto-fill, minmax(30.5%, 1fr));
        }
      }

      .config-content {
        display: flex;
        flex-direction: column;
        gap: var(--side-dialog-gutter);
        margin-top: 1rem;
        min-height: 250px;
      }

      .group-list {
        /* border-block: solid 1px var(--divider-color); */
        border-block: 0.5px solid var(--divider-color);
        --mdc-icon-button-size: 42px;
      }

      .group-item-row {
        position: relative;
        width: 100%;
        justify-content: space-between;
        display: flex;
        align-items: center;
        margin-block: var(--side-dialog-gutter);
      }
      .group-item-row .handle {
        cursor: grab;
        color: var(--secondary-text-color);
        margin-inline-end: var(--side-dialog-padding);
        flex: 0 0 42px;
      }
      .group-name {
        flex: 1 1 auto;
        gap: var(--side-dialog-padding);
        display: flex;
        align-items: center;
      }
      .group-name:hover {
        cursor: pointer;
        color: var(--primary-color);
      }
      .group-name > ha-icon {
        color: var(--secondary-text-color);
      }
      .group-name-items {
        display: flex;
        flex-direction: column;
      }

      .group-name-items span {
        font-size: 0.8rem;
        color: var(--secondary-text-color);
        line-height: 0.8rem;
      }

      .group-actions {
        display: flex;
        /* gap: 8px; */
        align-items: center;
        /* opacity: 1 !important; */
        margin-inline: var(--side-dialog-gutter);
        color: var(--secondary-text-color);
      }
      .header-row {
        display: inline-flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        --mdc-icon-button-size: 42px;
        height: auto;
      }
      .header-row.center {
        justify-content: center;
      }
      .header-row.flex-end {
        justify-content: flex-end;
      }

      .header-row.flex-icon {
        justify-content: flex-end;
        background-color: var(--divider-color);
        min-height: 42px;
      }
      .header-row.flex-icon > span {
        margin-inline-start: 0.5rem;
        flex: 1;
      }
      .header-row.flex-icon > ha-icon {
        margin-inline-end: 0.5rem;
        flex: 0;
      }

      .sortable-ghost {
        opacity: 0.5;
        background-color: var(--primary-color);
      }

      #items-preview-wrapper {
        display: flex;
        flex-direction: row;
        gap: var(--side-dialog-gutter);
        justify-content: center;
      }
      @media all and (max-width: 700px), all and (max-height: 500px) {
        #items-preview-wrapper {
          flex-wrap: wrap;
        }
      }
      .items-container {
        display: block;
        border: 1px solid var(--divider-color);
        flex: 1 1 100%;
        height: 100%;
      }
      .preview-container {
        min-width: 230px;
        display: flex;
        flex-direction: column;
        width: 100%;
        border: 1px solid var(--divider-color);
        /* display: block; */
      }
      ul.selected-items {
        list-style-type: none;
        padding-inline-start: 0px;
        font-family: monospace;
        color: var(--codemirror-atom);
        text-align: center;
        line-height: 150%;
        margin: 0;
      }
      ul.selected-items li {
        padding: 0.5rem;
        border-bottom: 0.5px solid var(--divider-color);
        display: flex;
        align-items: anchor-center;
      }
      ul.selected-items li:last-child {
        border-bottom: none;
      }

      ul.selected-items li .handle {
        cursor: grab;
        flex: 0 0 42px;
        color: var(--secondary-text-color);
        margin-inline-end: var(--side-dialog-padding);
      }
      ul.selected-items li .handle:hover {
        cursor: grabbing;
      }

      code {
        font-family: monospace;
        background-color: var(--code-editor-background-color);
        color: var(--codemirror-atom);
        border: 0.5px solid var(--divider-color);
        padding: 2px 4px;
        font-size: inherit;
        text-align: center;
        line-height: 150%;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-dialog-groups': SidebarDialogGroups;
  }
}
