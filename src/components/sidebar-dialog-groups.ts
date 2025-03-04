import { mdiChevronLeft, mdiDotsVertical, mdiDrag, mdiSortAlphabeticalVariant } from '@mdi/js';
import { html, css, LitElement, TemplateResult, nothing, PropertyValues, CSSResult } from 'lit';
import { repeat } from 'lit-html/directives/repeat.js';
import { customElement, property, state } from 'lit/decorators';
import Sortable from 'sortablejs';

import { showAlertDialog, showConfirmDialog, showPromptDialog } from '../helpers';
import { SidebarConfig, HaExtened } from '../types';
import { SidebarConfigDialog } from './sidebar-dialog';

type PANEL_TABS = 'bottomPanel' | 'customGroups';

@customElement('sidebar-dialog-groups')
export class SidebarDialogGroups extends LitElement {
  @property({ attribute: false }) hass!: HaExtened['hass'];
  @property({ attribute: false }) _dialog!: SidebarConfigDialog;
  @property({ attribute: false }) _sidebarConfig!: SidebarConfig;

  @state() private _selectedTab: PANEL_TABS = 'bottomPanel';
  @state() private _selectedGroup: string | null = null;
  @state() private _reloadItems = false;
  @state() private _sortable: Sortable | null = null;

  static get styles(): CSSResult {
    return css`
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
      }
      .header-row.center {
        justify-content: center;
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
      }
      ul.selected-items li:last-child {
        border-bottom: none;
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

  protected firstUpdated(): void {
    this._setGridSelector();
  }

  protected updated(_changedProperties: PropertyValues) {
    if (
      (_changedProperties.has('_selectedTab') && this._selectedTab !== 'customGroups') ||
      (_changedProperties.has('_selectedGroup') && this._selectedGroup !== undefined)
    ) {
      setTimeout(() => {
        this._setGridSelector();
      }, 50); // Small delay to ensure the ha-selector shadow DOM is rendered
    }

    if (_changedProperties.has('_selectedTab') && this._selectedTab !== 'bottomPanel') {
      this._initSortable();
    }

    if (_changedProperties.has('_selectedGroup') && this._selectedGroup !== null) {
      this._sortable?.destroy();
      this._sortable = null;
    } else if (
      _changedProperties.has('_selectedGroup') &&
      this._selectedGroup === null &&
      this._selectedTab !== 'bottomPanel'
    ) {
      this._initSortable();
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
      console.log('sortable initialized');
    }
  };

  private _setGridSelector = (): void => {
    const customSelector = this.shadowRoot?.getElementById('customSelector');
    if (customSelector) {
      const selector = customSelector.shadowRoot?.querySelector('ha-selector-select');
      if (selector) {
        const div = selector.shadowRoot?.querySelector('div');
        if (div) {
          div.style.display = 'grid';
          div.style.gridTemplateColumns = 'repeat(auto-fill, minmax(40.5%, 1fr))';
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
    ];

    const bottomPanel = this._renderBottomItems();
    const customGroupTab = this._selectedGroup === null ? this._renderCustomGroupTab() : this._renderEditGroup();

    const tabSelector = html` <ha-control-select
      .value=${this._selectedTab}
      .options=${tabOpts}
      @value-changed=${(ev: CustomEvent) => {
        this._selectedTab = ev.detail.value;
      }}
    ></ha-control-select>`;

    return html`
      ${tabSelector}
      <div class="config-content">${this._selectedTab === 'bottomPanel' ? bottomPanel : customGroupTab}</div>
    `;
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
        : html`<ha-circular-progress .indeterminate=${true}></ha-circular-progress>`;

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
                  return html` <div class="group-item-row" data-group=${key}>
                    <div class="handle">
                      <ha-icon-button .path=${mdiDrag}></ha-icon-button>
                    </div>
                    <div class="group-name">
                      <ha-icon icon=${`mdi:numeric-${index + 1}-box`}></ha-icon>
                      <div class="group-name-items">
                        ${groupName}
                        <span>${this._sidebarConfig.custom_groups![key].length} items</span>
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
            <div class="header-row">${addBtn}</div>
            ${this._renderSpacer()}
          `}
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
          await showAlertDialog(this, 'Group name already exists. Please choose a different one.');
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
    }
  };

  private _renderEditGroup(): TemplateResult | typeof nothing {
    if (!this._selectedGroup) return nothing;
    const headerBack = html`<div class="header-row ">
      <ha-icon-button .path=${mdiChevronLeft} @click=${() => (this._selectedGroup = null)}> </ha-icon-button>
      ${this._selectedGroup.toLocaleUpperCase()}
    </div>`;

    const selectorElement = this._renderPanelSelector('customGroup', this._selectedGroup);

    return html` ${headerBack} ${selectorElement}`;
  }

  private _renderBottomItems() {
    if (this._selectedTab !== 'bottomPanel') return nothing;
    const selectorList = this._renderPanelSelector('bottomPanels');

    return html` ${selectorList} `;
  }

  private _renderPanelSelector(configValue: string, customGroup?: string): TemplateResult {
    const hassPanels = this.hass?.panels;
    const currentItems = this._dialog._initPanelOrder;
    const pickedItems = this.pickedItems;
    const selectedType = customGroup ? customGroup : 'bottom_items';

    const selectedItems = customGroup
      ? this._sidebarConfig.custom_groups![customGroup] || []
      : this._sidebarConfig.bottom_items || [];

    const selectedItemsArray = Object.entries(selectedItems).map(([, item]) => item);
    // console.log('selectedItemsArray', selectedItemsArray);

    const itemsToRemove = pickedItems.filter((item) => !selectedItemsArray.includes(item));
    const itemsToChoose = currentItems.filter((item) => !itemsToRemove.includes(item));

    const options: { value: string; label: string }[] = [];

    for (const panel of itemsToChoose) {
      const panelName = this.hass.localize(`panel.${hassPanels[panel].title}`) || hassPanels[panel]?.title || panel;
      options.push({ value: panel, label: panelName });
    }

    const selector = {
      select: {
        multiple: true,
        mode: 'list',
        options: options,
      },
    };

    // new array with title instead of key
    const selectedItemsArrayWithTitles = selectedItemsArray.map(
      (item) =>
        this.hass.localize(`panel.${hassPanels[item].title}`) || hassPanels[item]?.title || hassPanels[item].url_path
    );

    const renderItems = html` <div class="header-row flex-icon">
        <span>ITEMS ORDER</span>
        <ha-icon-button .path=${mdiSortAlphabeticalVariant} @click=${() => this._sortItems(selectedType)}>
        </ha-icon-button>
      </div>
      <ul class="selected-items">
        ${repeat(
          selectedItemsArrayWithTitles,
          (item) => item,
          (item) => {
            return html`<li>${item}</li>`;
          }
        )}
      </ul>`;

    return html`
      <div id="items-preview-wrapper">
        <div class="items-container">
          <div class="header-row flex-icon">
            <span>SELECT ITEMS</span>
          </div>
          <ha-selector
            .hass=${this.hass}
            .selector=${selector}
            .value=${selectedItemsArray}
            .configValue=${configValue}
            .customGroup=${customGroup}
            .required=${false}
            id="customSelector"
            @value-changed=${this._handleValueChange}
          >
          </ha-selector>
          ${this._renderSpacer()}
        </div>
        <div class="preview-container">${selectedItemsArray.length ? renderItems : nothing}</div>
      </div>
    `;
  }

  private _renderSpacer() {
    return html`<div style="flex: 1"></div>`;
  }

  private _sortItems(type: string) {
    const hassPanels = this.hass?.panels;
    const selectedItems =
      type !== 'bottom_items' ? this._sidebarConfig.custom_groups![type] || [] : this._sidebarConfig.bottom_items || [];
    console.log(selectedItems);
    // Create a list of items with their titles
    const itemsWithTitles = selectedItems.map((item) => ({
      key: item,
      title:
        this.hass.localize(`panel.${hassPanels[item].title}`) || hassPanels[item]?.title || hassPanels[item].url_path,
    }));

    // Sort in ascending order by title (case-insensitive)
    const ascendingSortedItems = [...itemsWithTitles].sort((a, b) => {
      const titleA = a.title.toUpperCase();
      const titleB = b.title.toUpperCase();
      return titleA.localeCompare(titleB); // Ascending order
    });

    // Check if the original list is already sorted in ascending order
    const isSortedAsc = itemsWithTitles.every((item, index) => item.key === ascendingSortedItems[index].key);

    let sortedItems;
    if (isSortedAsc) {
      // If already sorted in ascending order, sort in descending order
      sortedItems = [...itemsWithTitles].sort((a, b) => {
        const titleA = a.title.toUpperCase();
        const titleB = b.title.toUpperCase();
        return titleB.localeCompare(titleA); // Descending order
      });
    } else {
      // Otherwise, keep the ascending order
      sortedItems = ascendingSortedItems;
    }

    // Get the sorted keys (original item keys)
    const sortedItemKeys = sortedItems.map((item) => item.key);
    console.log('Sorted keys:', sortedItemKeys, 'sortedItems', sortedItems);

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
    if (configValue === 'bottomPanels') {
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

  private _dispatchConfig(config: SidebarConfig) {
    const event = new CustomEvent('sidebar-changed', { detail: config, bubbles: true, composed: true });
    this.dispatchEvent(event);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-dialog-groups': SidebarDialogGroups;
  }
}
