import { ALERT_MSG } from '@constants';
import { mdiChevronLeft, mdiDotsVertical, mdiDrag, mdiSortAlphabeticalVariant } from '@mdi/js';
import { SidebarConfig, HaExtened } from '@types';
import { validateConfig } from '@utilities/configs/validators';
import { isIcon } from '@utilities/is-icon';
import { getDefaultPanelUrlPath, getPanelTitleFromUrlPath } from '@utilities/panel';
import { showAlertDialog, showConfirmDialog, showPromptDialog } from '@utilities/show-dialog-box';
import { hasTemplate, subscribeRenderTemplate } from '@utilities/ws-templates';
import { html, LitElement, TemplateResult, nothing, PropertyValues, CSSResultGroup, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import { dialogStyles } from './dialog-css';
import { SidebarConfigDialog } from './sidebar-dialog';
// type PANEL_TABS = 'bottomPanel' | 'customGroups' | 'hiddenItems';
enum PANEL {
  BOTTOM_PANEL = 'bottomPanel',
  CUSTOM_GROUP = 'customGroup',
  HIDDEN_ITEMS = 'hiddenItems',
  NOTIFICATION = 'notification',
}

@customElement('sidebar-dialog-groups')
export class SidebarDialogGroups extends LitElement {
  @property({ attribute: false }) hass!: HaExtened['hass'];
  @property({ attribute: false }) _dialog!: SidebarConfigDialog;
  @property({ attribute: false }) _sidebarConfig!: SidebarConfig;

  @state() private _selectedTab: PANEL = PANEL.BOTTOM_PANEL;
  @state() public _selectedGroup: string | null = null;
  @state() private _selectedNotification: string | null = null;
  @state() private _reloadItems = false;
  @state() private _reloadPanelItems: boolean = false;

  protected updated(_changedProperties: PropertyValues) {
    if (_changedProperties.has('_selectedTab') && this._selectedTab !== undefined) {
      this._dialog._dialogPreview._toggleBottomPanel(this._selectedTab === PANEL.BOTTOM_PANEL);
      if (this._selectedTab !== PANEL.CUSTOM_GROUP) {
        this._selectedGroup = null;
      }
    }

    if (_changedProperties.has('_selectedGroup')) {
      this._dialog._dialogPreview._toggleGroup(this._selectedGroup);
    }

    if (_changedProperties.has('_selectedNotification')) {
      const notify = this._selectedNotification || '';
      if (!notify) {
        this._dialog._dialogPreview._toggleGroup(notify);
      }
      const customGroups = this._sidebarConfig.custom_groups || {};
      const bottomItems = this._sidebarConfig.bottom_items || [];
      let toShow;
      const inGroup = Object.keys(customGroups).find((key) => customGroups[key].includes(notify));
      const inBottom = bottomItems.includes(notify);
      if (inGroup) {
        toShow = inGroup;
      } else if (inBottom) {
        toShow = 'bottom_items';
      }
      this._dialog._dialogPreview._toggleGroup(toShow);
    }
  }

  protected render() {
    const tabOpts = [
      { value: 'bottomPanel', label: 'Bottom Panel' },
      { value: 'customGroup', label: 'Group Panel' },
      { value: 'hiddenItems', label: 'Hidden Items' },
      { value: 'notification', label: 'Notification' },
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
    const customGroup = this._selectedGroup === null ? this._renderCustomGroupList() : this._renderEditGroup();
    const notification = this._renderNotificationConfig();

    const tabMap = {
      bottomPanel: bottomPanel,
      customGroup: customGroup,
      hiddenItems: hiddenItems,
      notification: notification,
    };

    return html`
      ${tabSelector}
      <div class="config-content">${tabMap[this._selectedTab]}</div>
    `;
  }

  private _renderHiddenItems() {
    const hiddenItems = this._sidebarConfig?.hidden_items || [];
    const newItems = this._sidebarConfig?.new_items?.map((item) => item.title) || [];
    const initPanelItems = this._dialog._initCombiPanels.filter((item) => !newItems.includes(item));

    const selector = this._createSelectorOptions(initPanelItems, 'dropdown');

    const selectedItems = Object.entries(hiddenItems).map(([, item]) => item);

    return html` <div class="items-container" style="flex: none">
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

  private _renderNotificationConfig() {
    const hassPanels = this.hass?.panels;
    const newItems = this._sidebarConfig?.new_items?.map((item) => item.title) || [];
    const items = this._dialog._initCombiPanels.filter((item) => !newItems.includes(item));

    const options = items.map((panel) => {
      const panelName = getPanelTitleFromUrlPath(this.hass, panel);
      return { value: panel, label: panelName, icon: hassPanels[panel]?.icon || 'mdi:view-dashboard' };
    });

    // Filter out items that are already in the notification config
    const notifyConfig = this._sidebarConfig.notification || {};
    const existingNotifications = Object.keys(notifyConfig);
    const itemToSelect = options.filter((item) => !existingNotifications.includes(item.value));

    const selector = {
      select: {
        multiple: false,
        custom_value: false,
        mode: 'dropdown',
        options: itemToSelect,
        sort: true,
        required: false,
      },
    };

    const selectedNotification = this._sidebarConfig.notification || {};

    const selected = options.filter((item) => Object.keys(selectedNotification).includes(item.value));

    const selectedEl = html`
      <div class="group-list">
        ${repeat(
          selected,
          (item) => item,
          (item) => {
            return html`
              <div class="group-item-row" style="padding-inline-start: 1rem">
                <div class="group-name" @click=${() => (this._selectedNotification = item.value)}>
                  <ha-icon icon=${item.icon}></ha-icon>
                  <div class="group-name-items">
                    ${item.label}
                    <span>${item.value}</span>
                  </div>
                </div>
                <div class="group-actions">
                  <ha-icon-button .label=${'Edit item'} @click=${() => (this._selectedNotification = item.value)}
                    ><ha-icon icon="mdi:pencil"></ha-icon
                  ></ha-icon-button>
                  <ha-icon-button
                    .label=${'Delete item'}
                    @click=${async () => {
                      const confirmDelete = await showConfirmDialog(
                        this,
                        `Are you sure you want to delete this notification? ${item.label}`,
                        'Delete'
                      );
                      if (!confirmDelete) return;
                      const notifyConfig = { ...(this._sidebarConfig.notification || {}) };
                      delete notifyConfig[item.value];
                      this._sidebarConfig = {
                        ...this._sidebarConfig,
                        notification: notifyConfig,
                      };
                      this._dispatchConfig(this._sidebarConfig);
                    }}
                    ><ha-icon icon="mdi:trash-can-outline"></ha-icon
                  ></ha-icon-button>
                </div>
              </div>
            `;
          }
        )}
      </div>
    `;

    return this._selectedNotification === null
      ? html`
          <ha-selector
            .hass=${this.hass}
            .selector=${selector}
            .value=${this._selectedNotification ?? ''}
            .required=${false}
            .label=${'Select panel for configuration'}
            .placeholder=${'Select panel'}
            @value-changed=${(ev: CustomEvent) => {
              this._selectedNotification = ev.detail.value;
            }}
          ></ha-selector>
          ${selectedEl}
        `
      : this._renderNotifyConfig();
  }

  private _renderNotifyConfig() {
    if (!this._selectedNotification) return nothing;
    const key = this._selectedNotification;
    const panelName = getPanelTitleFromUrlPath(this.hass, key) || key;
    const notifyConfig = this._sidebarConfig.notification || {};
    const notifyConfigValue = notifyConfig[key] || '';
    const headerBack = html`<div class="header-row ">
      <ha-icon-button .path=${mdiChevronLeft} @click=${() => (this._selectedNotification = null)}> </ha-icon-button>
      ${panelName.toUpperCase()}
      <ha-button
        appearance="plain"
        size="small"
        @click=${() => {
          this._selectedNotification = null;
        }}
        >Done</ha-button
      >
    </div>`;
    this._subscribeTemplate(notifyConfigValue, (result) => {
      const templatePreview = this.shadowRoot?.getElementById('template-preview-content') as HTMLElement;
      if (templatePreview) {
        let _result: string = result;
        if (isIcon(result)) {
          _result = `<ha-icon icon="${result}"></ha-icon>`;
        }
        templatePreview.innerHTML = _result;
      }
    });
    return html`
      ${headerBack}
      <ha-selector
        .hass=${this.hass}
        .value=${notifyConfigValue}
        .configValue=${key}
        .helper=${'Use Jinja template to configure the notification. Result can be icon or text.'}
        .selector=${{
          template: {},
        }}
        .required=${false}
        @value-changed=${this._handleNotifyConfigChange}
      ></ha-selector>

      <div class="config-content">
        <div id="template-preview">
          <span>Template result:</span>
          <pre id="template-preview-content" class="rendered"></pre>
        </div>
      </div>
    `;
  }

  private _subscribeTemplate(configValye: string, callback: (result: string) => void): void {
    if (!this.hass || !hasTemplate(configValye)) {
      console.log('Not a template:', this.hass, !hasTemplate(configValye));
      return;
    }

    subscribeRenderTemplate(
      this.hass.connection,
      (result) => {
        callback(result.result);
      },
      {
        template: configValye ?? '',
        variables: {
          config: configValye,
          user: this.hass.user!.name,
        },
        strict: true,
      }
    );
  }

  private _renderCustomGroupList(): TemplateResult {
    const customGroupList = Object.keys(this._sidebarConfig.custom_groups || []).map((key) => ({
      key,
      label: key.replace(/_/g, ' ').toUpperCase(),
    }));
    const addBtn = html`
      <ha-button appearance="plain" size="small" @click=${this._togglePromptNewGroup}>Add New Group</ha-button>
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
            <ha-sortable handle-selector=".handle" @item-moved=${this._groupMoved}>
              <div class="group-list" id="group-list">
                ${repeat(
                  customGroupList || [],
                  (group) => group.key,
                  (group, index) => {
                    const key = group.key;
                    const groupName = group.label;
                    let actionMap = _createActionMap(key);
                    const itemCount = this._sidebarConfig.custom_groups![key].length;
                    return html` <div class="group-item-row" data-group=${key} data-index=${index}>
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
                          @click=${() => this._handleGroupAction('collapsed-group', key)}
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
            </ha-sortable>
          `}
      <div class="header-row flex-end">${addBtn}</div>
    `;
  }

  private _groupMoved = (ev: CustomEvent): void => {
    ev.stopPropagation();
    console.log('Group to be moved:', Object.keys(this._sidebarConfig.custom_groups || {}));
    const { oldIndex, newIndex } = ev.detail;
    const groupList = Object.entries(this._sidebarConfig.custom_groups || {}).concat();

    groupList.splice(newIndex, 0, groupList.splice(oldIndex, 1)[0]);

    const newGroupList = Object.fromEntries(groupList);
    console.log('New group list:', Object.keys(newGroupList));
    this._sidebarConfig = {
      ...this._sidebarConfig,
      custom_groups: newGroupList,
    };
    this._dispatchConfig(this._sidebarConfig);
  };

  private _handleNotifyConfigChange(ev: CustomEvent) {
    const configValue = (ev as any).target.configValue;
    const value = ev.detail.value;

    const notifyConfig = { ...(this._sidebarConfig.notification || {}) };
    if (!value || value === '') {
      delete notifyConfig[configValue];
    }
    if (value && value !== '') {
      notifyConfig[configValue] = value;
    }
    this._sidebarConfig = {
      ...this._sidebarConfig,
      notification: notifyConfig,
    };

    this._dispatchConfig(this._sidebarConfig);
  }

  private _handleGroupAction = async (action: string, key: string) => {
    // console.log('group action', action, key);

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
      <ha-button
        appearance="plain"
        size="small"
        @click=${() => this._handleGroupAction('preview', this._selectedGroup!)}
      >
        PREVIEW
      </ha-button>
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
    const defaultPanel = getDefaultPanelUrlPath(this.hass);
    const hiddenItems = this._sidebarConfig?.hidden_items || [];
    const currentItems = this._dialog._initCombiPanels.filter(
      (item) => !hiddenItems.includes(item) && item !== defaultPanel
    );
    const pickedItems = this._dialog.pickedItems;
    const selectedType = customGroup ? customGroup : 'bottom_items';

    const configItems = customGroup
      ? this._sidebarConfig.custom_groups![customGroup] || []
      : this._sidebarConfig.bottom_items || [];

    const selectedItems = Object.entries(configItems).map(([, item]) => item);

    const itemsToRemove = pickedItems.filter((item) => !selectedItems.includes(item));
    const itemsToChoose = currentItems.filter((item) => !itemsToRemove.includes(item));
    // console.log('itemsToChoose', itemsToChoose);
    const selector = this._createSelectorOptions(itemsToChoose);

    const renderItems = this._renderSelectedItems(selectedType, selectedItems);

    return html`
      <div id="items-preview-wrapper">
        <div class="items-container">
          <div class="header-row flex-icon">
            <span>SELECT ITEMS</span>
          </div>
          <div class="selector-container">
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
          </div>
          ${this._renderSpacer()}
        </div>
        <div class="preview-container" ?hidden=${!selectedItems.length}>${renderItems}</div>
      </div>
    `;
  }

  private _renderSelectedItems(selectedType: string, selectedItems: string[]): TemplateResult {
    const hassPanels = this.hass?.panels;
    const icon = (item: string) => {
      return this._dialog._newItemMap.get(item)?.icon || hassPanels[item]?.icon || '';
    };

    const selectedItemsArrayWithTitles = selectedItems.map((item) => {
      return {
        key: item,
        title:
          this.hass.localize(`panel.${hassPanels[item]?.title}`) ||
          hassPanels[item]?.title ||
          hassPanels[item]?.url_path ||
          item,
        icon: icon(item),
      };
    });

    const renderItem = (item: { key: string; title: string; icon: string }, index: number) => {
      return html`
        <a data-panel=${item.key} data-index=${index}>
          <div class="icon-item handle">
            <ha-icon .icon=${item.icon}></ha-icon><span class="item-text">${item.title}</span>
          </div>
        </a>
      `;
    };
    const typeTitle = selectedType === 'bottom_items' ? 'BOTTOM' : selectedType.replace(/_/g, ' ').toUpperCase();
    return html`
      <div class="header-row flex-icon">
        <span>GROUP: ${typeTitle} - ORDER </span>
        <ha-icon-button .path=${mdiSortAlphabeticalVariant} @click=${() => this._sortItems(selectedType)}>
        </ha-icon-button>
      </div>

      ${this._reloadPanelItems
        ? html`<ha-spinner .size=${'small'}></ha-spinner> `
        : html` <ha-sortable handle-selector=".handle" @item-moved=${this._itemMoved}>
            <div class="selected-items-preview" id="selected-items">
              ${repeat(
                selectedItemsArrayWithTitles,
                (item) => item.key,
                (item, index) => {
                  return renderItem(item, index);
                }
              )}
            </div></ha-sortable
          >`}
    `;
  }

  private _itemMoved = (ev: CustomEvent): void => {
    ev.stopPropagation();
    if (!this._sidebarConfig) return;
    const { oldIndex, newIndex } = ev.detail;
    const updateConfig = (updates: Partial<SidebarConfig>) => {
      this._sidebarConfig = {
        ...this._sidebarConfig,
        ...updates,
      };
      this._dispatchConfig(this._sidebarConfig);
    };

    switch (this._selectedTab) {
      case PANEL.BOTTOM_PANEL:
        const bottomItems = [...(this._sidebarConfig.bottom_items || [])].concat();
        console.log('Bottom items before move:', bottomItems);
        bottomItems.splice(newIndex, 0, bottomItems.splice(oldIndex, 1)[0]);
        console.log('Bottom items after move:', bottomItems);
        updateConfig({ bottom_items: bottomItems });
        break;
      case PANEL.CUSTOM_GROUP:
        const customGroups = { ...(this._sidebarConfig.custom_groups || {}) };
        const groupName = this._selectedGroup;
        if (groupName) {
          const groupItems = [...(customGroups[groupName] || [])].concat();
          console.log(groupName, groupItems);
          groupItems.splice(newIndex, 0, groupItems.splice(oldIndex, 1)[0]);
          customGroups[groupName] = groupItems;
          console.log(`New:`, groupName, groupItems);
          updateConfig({ custom_groups: customGroups });
        }
        break;
    }
  };

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
        this.hass.localize(`panel.${hassPanels[item]?.title}`) ||
        hassPanels[item]?.title ||
        hassPanels[item]?.url_path ||
        item,
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

  private _createSelectorOptions(items: string[], mode: string = 'list') {
    const defaultPanel = getDefaultPanelUrlPath(this.hass);
    const options = items.map((panel) => {
      const isDefault = panel === defaultPanel;
      const panelName = getPanelTitleFromUrlPath(this.hass, panel) || panel;
      return { value: panel, label: panelName + (isDefault ? ' (default)' : '') };
    });

    // options.sort((a, b) => a.label.localeCompare(b.label));

    const selector = {
      select: {
        multiple: true,
        mode: mode,
        options: options,
        sort: true,
        reorder: true,
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
    this._updatePanels(value);
    const newConfig = validateConfig(this._sidebarConfig, value);
    // const newConfig = removeHiddenItems(this._sidebarConfig, value);

    this._sidebarConfig = {
      ...this._sidebarConfig,
      ...newConfig,
    };

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

  public clickedPanelInPreview(panel: string, group?: string | null): void {
    console.log('Clicked panel in preview:', panel, group);
    if (group) {
      const selectedTab = group === 'bottom_items' ? PANEL.BOTTOM_PANEL : PANEL.CUSTOM_GROUP;
      this._selectedTab = selectedTab;
      this._selectedGroup = group === 'bottom_items' ? null : group;
    }
  }

  static get styles(): CSSResultGroup {
    return [
      css`
        .selected-items-preview {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          overflow-y: auto;
          scrollbar-color: var(--scrollbar-thumb-color) transparent;
          scrollbar-width: thin;
        }
        a {
          text-decoration: none;
          color: var(--sidebar-text-color);
          font-weight: 500;
          font-size: 14px;
          position: relative;
          display: block;
          outline: 0;
          border-radius: 4px;
          /* width: 248px; */
          cursor: pointer;
        }
        a:hover > .icon-item {
          background-color: var(--secondary-background-color);
        }
        .icon-item {
          box-sizing: border-box;
          margin: 4px;
          padding-left: 12px;
          padding-inline-start: 12px;
          padding-inline-end: initial;
          border-radius: 4px;
          display: flex;
          min-height: 40px;
          align-items: center;
          padding: 0 16px;
        }
        .icon-item > ha-icon {
          width: 56px;
          color: var(--sidebar-icon-color);
        }
        .icon-item span.item-text {
          display: block;
          max-width: calc(100% - 56px);
        }
      `,
      dialogStyles,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-dialog-groups': SidebarDialogGroups;
  }
}
