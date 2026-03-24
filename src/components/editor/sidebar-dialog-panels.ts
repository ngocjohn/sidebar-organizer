import {
  ALERT_MSG,
  BOTTOM_SECTION,
  BottomSectionKeys,
  CONFIG_AREA_LABELS,
  CONFIG_SECTION,
  PANEL_AREA,
  PanelAreaTabs,
} from '@constants';
import {
  mdiChevronLeft,
  mdiDotsVertical,
  mdiDrag,
  mdiEyeOffOutline,
  mdiPin,
  mdiSortAlphabeticalVariant,
} from '@mdi/js';
import { SidebarConfig, PANEL_TYPE } from '@types';
import { validateConfig } from '@utilities/configs/validators';
import { nextRender } from '@utilities/dom-utils';
import { getDefaultPanelUrlPath, getPanelTitleFromUrlPath } from '@utilities/panel';
import { showAlertDialog, showConfirmDialog, showPromptDialog } from '@utilities/show-dialog-box';
import { BaseEditor } from 'components/base-editor';
import { isEmpty } from 'es-toolkit/compat';
import { html, TemplateResult, nothing, PropertyValues, CSSResultGroup, css } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import { SoPanelAll } from './shared/so-panel-all';

@customElement('sidebar-dialog-panels')
export class SidebarDialogPanels extends BaseEditor {
  constructor() {
    super(CONFIG_SECTION.PANELS);
  }
  @property({ attribute: false }) _sidebarConfig!: SidebarConfig;

  @state() private _selectedTab: PANEL_AREA = PANEL_AREA.ALL_ITEMS;
  @state() public _selectedBottom: BOTTOM_SECTION = BOTTOM_SECTION.BOTTOM_ITEMS;
  @state() public _selectedGroup: string | null = null;
  @state() private _selectedNotification: string | null = null;
  @state() private _reloadPanelItems: boolean = false;

  @query('so-panel-all') private _panelAll?: SoPanelAll;

  protected updated(_changedProperties: PropertyValues) {
    if (_changedProperties.has('_selectedTab') && this._selectedTab !== undefined) {
      const selectedTab = this._selectedTab;
      if (selectedTab !== PANEL_AREA.CUSTOM_GROUPS) {
        this._selectedGroup = null;
      }
    }

    if (_changedProperties.has('_selectedBottom') && this._selectedBottom !== undefined) {
      const bottomSectionActive = this._selectedBottom as BOTTOM_SECTION;
      this._dialog._dialogPreview._toggleBottomPanel(bottomSectionActive);
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
      let toShow = '';
      const inGroup = Object.keys(customGroups).find((key) => customGroups[key].includes(notify));
      const inBottom = bottomItems.includes(notify);
      if (inGroup) {
        toShow = inGroup;
      } else if (inBottom) {
        toShow = BOTTOM_SECTION.BOTTOM_ITEMS; // or BOTTOM_SECTION.BOTTOM_GRID_ITEMS, depending on where it is, for simplicity we can just toggle bottom items
      }
      this._dialog._dialogPreview._toggleGroup(toShow);
    }
  }

  protected render() {
    const tabSelector = html` <ha-control-select
      .value=${this._selectedTab}
      .options=${PanelAreaTabs}
      @value-changed=${(ev: CustomEvent) => {
        this._selectedTab = ev.detail.value;
      }}
    ></ha-control-select>`;

    const panelContent = {
      [PANEL_AREA.ALL_ITEMS]: this._renderAllItems(),
      [PANEL_AREA.BOTTOM_PANELS]: this._renderBottomItems(),
      [PANEL_AREA.CUSTOM_GROUPS]:
        this._selectedGroup === null ? this._renderCustomGroupList() : this._renderEditGroup(),
      [PANEL_AREA.HIDDEN_ITEMS]: this._renderHiddenItems(),
      [PANEL_AREA.NOTIFICATIONS]: this._renderNotificationConfig(),
    };
    return html`
      <div class="groups-menu-header">${tabSelector}</div>
      <div class="config-content">${panelContent[this._selectedTab]}</div>
    `;
  }

  private _renderAllItems() {
    return html`
      <so-panel-all
        .hass=${this.hass}
        ._store=${this._store}
        ._sidebarConfig=${this._sidebarConfig}
        @group-action=${this._handleGroupActionEvent}
        @item-moved=${this._groupMoved}
      ></so-panel-all>
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
                  <wa-divider orientation="vertical"></wa-divider>
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

    return html`
      ${headerBack}
      <ha-selector
        .hass=${this.hass}
        .value=${notifyConfigValue}
        .configValue=${key}
        .helper=${'Use Jinja template to configure the notification. Result can be icon or text.'}
        .selector=${{
          template: { preview: true },
        }}
        .required=${false}
        @value-changed=${this._handleNotifyConfigChange}
      ></ha-selector>
    `;
  }

  private _isGroupCollapsed(key: string): boolean {
    return this._sidebarConfig?.default_collapsed?.includes(key) ?? false;
  }

  private _isGroupPinned(key: string): boolean {
    return this._sidebarConfig?.pinned_groups?.hasOwnProperty(key) ?? false;
  }

  private _renderGroupActions(key: string, isUncategorized: boolean): TemplateResult {
    if (isUncategorized) {
      const uncategorized_items = this._sidebarConfig?.uncategorized_items ?? false;
      const uncategorizedAsGroup =
        (typeof uncategorized_items === 'boolean' && uncategorized_items === true) ||
        !isEmpty(this._sidebarConfig.custom_groups?.[PANEL_TYPE.UNCATEGORIZED_ITEMS]);

      const uncategorizedActions = [
        { title: 'Show in preview', action: 'preview-item', icon: 'mdi:information-outline' },
        { title: 'Include in group orders', action: 'uncategorized-as-group', icon: 'mdi:format-list-bulleted' },
      ];

      return html`<ha-dropdown @wa-select=${this._handleSubItemAction}>
        <ha-icon-button slot="trigger" .path=${mdiDotsVertical} hide-title></ha-icon-button>

        ${uncategorizedActions.map(
          (action) => html`
            <ha-dropdown-item
              .value=${key}
              .data=${action}
              .type=${action.action === 'uncategorized-as-group' ? 'checkbox' : undefined}
              .checked=${action.action === 'uncategorized-as-group' ? uncategorizedAsGroup : undefined}
            >
              <ha-icon slot="icon" icon=${action.icon}></ha-icon>
              ${action.title}
            </ha-dropdown-item>
          `
        )}
      </ha-dropdown>`;
    }
    const isMobile = window.matchMedia('all and (max-width: 450px), all and (max-height: 500px)').matches;
    const actions = [
      { title: 'Edit items', action: 'edit-items', icon: 'mdi:pencil' },
      { title: 'Rename', action: 'rename', icon: 'mdi:alphabetical' },
      { title: 'Show in preview', action: 'preview-item', icon: 'mdi:information-outline' },
      { title: 'Collapse by default', action: 'collapsed-group', icon: 'mdi:eye-minus-outline' },
      { title: 'Add to pinned groups', action: 'pinned-group', icon: 'mdi:pin-outline' },
      { title: 'Delete', action: 'delete', icon: 'mdi:trash-can-outline' },
    ];

    const collapsed = this._isGroupCollapsed(key);
    const pinned = this._isGroupPinned(key);

    return html`
      ${!isMobile
        ? html`
            <ha-icon-button
              class="action-btn"
              .path=${mdiEyeOffOutline}
              ?is-selected=${collapsed}
              @click=${() => this._handleGroupAction('collapsed-group', key)}
            ></ha-icon-button>

            <wa-divider orientation="vertical"></wa-divider>

            <ha-icon-button
              class="action-btn"
              .path=${mdiPin}
              ?is-selected=${pinned}
              @click=${() => this._handleGroupAction('pinned-group', key)}
            ></ha-icon-button>

            <wa-divider orientation="vertical"></wa-divider>
          `
        : null}

      <wa-dropdown @wa-select=${this._handleSubItemAction}>
        <ha-icon-button slot="trigger" .path=${mdiDotsVertical} hide-title></ha-icon-button>

        ${actions.map(
          (action) => html`
            ${action.action === 'delete' ? html`<wa-divider></wa-divider>` : nothing}
            <ha-dropdown-item
              .value=${key}
              .data=${action}
              .type=${action.action === 'collapsed-group' || action.action === 'pinned-group' ? 'checkbox' : undefined}
              .checked=${action.action === 'collapsed-group'
                ? collapsed
                : action.action === 'pinned-group'
                  ? pinned
                  : undefined}
              .variant=${action.action === 'delete' ? 'danger' : undefined}
            >
              <ha-icon slot="icon" icon=${action.icon}></ha-icon>
              ${action.title}
            </ha-dropdown-item>
          `
        )}
      </wa-dropdown>
    `;
  }

  private _renderCustomGroupRow(group: string, index: number, textTransform: string): TemplateResult {
    const key = group;
    const isUncategorized = key === PANEL_TYPE.UNCATEGORIZED_ITEMS;
    const itemCount = this._sidebarConfig.custom_groups![key].length;

    return html`
      <div class="group-item-row" data-group=${key} data-index=${index}>
        <div class="handle">
          <ha-icon-button .path=${mdiDrag}></ha-icon-button>
        </div>

        <div class="group-name" @click=${() => this._handleGroupAction('edit-items', key)}>
          <ha-icon icon=${`mdi:numeric-${index + 1}-box`}></ha-icon>

          <div class="group-name-items" style="text-transform: ${textTransform}">
            ${key}
            <span>${itemCount} ${itemCount > 1 ? 'items' : 'item'}</span>
          </div>
        </div>

        <div class="group-actions">${this._renderGroupActions(key, isUncategorized)}</div>
      </div>
    `;
  }

  private _renderCustomGroupList(): TemplateResult {
    const customGroupList = Object.keys(this._sidebarConfig.custom_groups || {});
    const textTransform = this._sidebarConfig?.text_transformation ?? 'capitalize';

    return html`
      ${!customGroupList.length
        ? html`<div>No custom groups found</div>`
        : html`
            <ha-sortable handle-selector=".handle" @item-moved=${this._groupMoved}>
              <div class="group-list" id="group-list">
                ${repeat(
                  customGroupList,
                  (group) => group,
                  (group, index) => this._renderCustomGroupRow(group, index, textTransform)
                )}
              </div>
              ${this._renderSpacer()}
            </ha-sortable>
          `}

      <div class="header-row flex-end">
        <ha-button appearance="plain" size="small" @click=${this._togglePromptNewGroup}> Add New Group </ha-button>
      </div>
    `;
  }

  private _handleSubItemAction = (ev: CustomEvent): void => {
    ev.stopPropagation();
    const subItem = (ev.detail?.item as any)?.data as any;
    const key = (ev.detail?.item as any)?.value as string;
    console.log('Sub item action:', subItem, key);
    this._handleGroupAction(subItem.action, key);
  };

  private _groupMoved(ev: CustomEvent): void {
    ev.stopPropagation();
    if (!this._sidebarConfig) return;
    const { oldIndex, newIndex } = ev.detail;
    console.log('Group moved:', oldIndex, newIndex);

    const updatedConfig = (updates: Partial<SidebarConfig>) => {
      this._sidebarConfig = {
        ...this._sidebarConfig,
        ...updates,
      };
      this._dispatchConfig(this._sidebarConfig);
    };

    const customGroups = Object.entries(this._sidebarConfig.custom_groups || {}).concat([]);
    const movedItem = customGroups.splice(oldIndex, 1)[0];
    customGroups.splice(newIndex, 0, movedItem);
    const newCustomGroups = Object.fromEntries(customGroups);
    console.log('Moved item:', movedItem[0], 'from index', oldIndex, 'to index', newIndex);

    updatedConfig({ custom_groups: newCustomGroups });
  }

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

  private _handleGroupActionEvent = (event: CustomEvent): void => {
    event.stopPropagation();
    const { action, key } = event.detail;
    this._handleGroupAction(action, key);
  };
  private _handleGroupAction = async (action: string, key: string) => {
    // console.log('group action', action, key);

    const defaultCollapsed = [...(this._sidebarConfig?.default_collapsed || [])];
    const customGroups = { ...(this._sidebarConfig.custom_groups || {}) };
    const pinnedGroups = { ...(this._sidebarConfig.pinned_groups || {}) };

    const updateSidebarConfig = (updates: Partial<SidebarConfig>) => {
      this._sidebarConfig = {
        ...this._sidebarConfig,
        ...updates,
      };
      this._dispatchConfig(this._sidebarConfig);
      this.requestUpdate();
    };

    const updates: Partial<SidebarConfig> = {};

    switch (action) {
      case 'edit-items':
        if (this._selectedTab !== PANEL_AREA.CUSTOM_GROUPS) {
          this._selectedTab = PANEL_AREA.CUSTOM_GROUPS;
          await nextRender();
        }
        this._selectedGroup = key;
        break;
      case 'rename':
        let newName = await showPromptDialog(this, 'Enter new group name', key, 'Rename');
        if (newName === null || newName === '') return;

        if (Object.keys(customGroups).includes(newName)) {
          await showAlertDialog(this, `${ALERT_MSG.NAME_EXISTS}`);
          return;
        }

        if (defaultCollapsed.includes(key)) {
          const updatedCollapsed = defaultCollapsed.filter((item) => item !== key);
          updatedCollapsed.push(newName);
          updates.default_collapsed = updatedCollapsed;
          console.log('item in collapsed, add renamed group to default collapsed', key, newName, updatedCollapsed);
        }
        const renameGroups = Object.fromEntries(
          Object.entries(customGroups).map(([groupKey, groupItems]) => [
            groupKey === key ? newName : groupKey,
            groupItems,
          ])
        );
        updates.custom_groups = renameGroups;
        updateSidebarConfig(updates);

        break;
      case 'collapsed-group':
        if (defaultCollapsed.includes(key)) {
          updates.default_collapsed = defaultCollapsed.filter((item) => item !== key);
        } else {
          updates.default_collapsed = [...defaultCollapsed, key];
        }
        updateSidebarConfig(updates);
        console.log('item is collapsed', this._sidebarConfig?.default_collapsed);
        break;
      case 'delete':
        const confirmDelete = await showConfirmDialog(
          this,
          `Are you sure you want to delete this group? ${key}`,
          'Delete'
        );
        if (!confirmDelete) return;
        if (defaultCollapsed.includes(key)) {
          updates.default_collapsed = defaultCollapsed.filter((item) => item !== key);
        }
        delete customGroups[key];
        updates.custom_groups = customGroups;
        updateSidebarConfig(updates);
        break;
      case 'pinned-group':
        if (pinnedGroups.hasOwnProperty(key)) {
          delete pinnedGroups[key];
        } else {
          pinnedGroups[key] = true;
        }
        updates.pinned_groups = pinnedGroups;
        updateSidebarConfig(updates);
        break;
      case 'preview':
        this._dialog._dialogPreview._toggleGroup(key, 'show');
        break;
      case 'preview-item':
        this._dialog._dialogPreview._toggleGroup(key);
        break;
      case 'uncategorized-as-group':
        const uncategorized_items = this._sidebarConfig?.uncategorized_items ?? false;
        if (
          (typeof uncategorized_items === 'boolean' && uncategorized_items === true) ||
          !isEmpty(customGroups[PANEL_TYPE.UNCATEGORIZED_ITEMS])
        ) {
          // delete the setting to uncategorized items to be treated as normal items
          updates.uncategorized_items = undefined;
          // delete the uncategorized group if exists to move items back to all items pool
          if (customGroups.hasOwnProperty(PANEL_TYPE.UNCATEGORIZED_ITEMS)) {
            delete customGroups[PANEL_TYPE.UNCATEGORIZED_ITEMS];
          }
          updates.custom_groups = customGroups;
        } else {
          const uncategorizedGroupItems = [...(this._dialog.ungroupedItems || [])];
          updates.custom_groups = {
            ...customGroups,
            [PANEL_TYPE.UNCATEGORIZED_ITEMS]: uncategorizedGroupItems,
          };
        }
        updateSidebarConfig(updates);
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

    const selectorElement = this._renderPanelSelector(PANEL_AREA.CUSTOM_GROUPS, this._selectedGroup);

    return html` ${headerBack} ${selectorElement}`;
  }

  private _renderBottomItems() {
    if (this._selectedTab !== PANEL_AREA.BOTTOM_PANELS) return nothing;
    const bottomSections = BottomSectionKeys.map((key) => ({ value: key, label: CONFIG_AREA_LABELS[key] }));

    const sectionSelector = html` <ha-control-select
      .value=${this._selectedBottom}
      .options=${bottomSections}
      @value-changed=${(ev: CustomEvent) => {
        this._selectedBottom = ev.detail.value;
      }}
    ></ha-control-select>`;

    const sectionMap = {
      [BOTTOM_SECTION.BOTTOM_ITEMS]: this._renderPanelSelector(BOTTOM_SECTION.BOTTOM_ITEMS),
      [BOTTOM_SECTION.BOTTOM_GRID_ITEMS]: this._renderPanelSelector(BOTTOM_SECTION.BOTTOM_GRID_ITEMS),
    };
    return html`
      ${sectionSelector}
      <div class="config-content">${sectionMap[this._selectedBottom]}</div>
    `;
  }

  private _renderPanelSelector(configValue: string, customGroup?: string): TemplateResult {
    const uncategorizedActive = this._dialog._uncategorizedIsActive === true;

    const defaultPanel = getDefaultPanelUrlPath(this.hass);
    const hiddenItems = this._sidebarConfig?.hidden_items || [];
    const currentItems = this._dialog._initCombiPanels.filter(
      (item) => !hiddenItems.includes(item) && item !== defaultPanel
    );
    const pickedItems = uncategorizedActive
      ? this._dialog.pickedWithoutUncategorizedFromCustom
      : this._dialog.pickedItems;

    const selectedType = customGroup ? customGroup : configValue;

    const configItems = customGroup
      ? this._sidebarConfig.custom_groups![customGroup] || []
      : this._sidebarConfig[configValue as keyof SidebarConfig] || [];

    const selectedItems = Object.entries(configItems).map(([, item]) => item);

    const itemsToRemove = pickedItems.filter((item) => !selectedItems.includes(item));
    const itemsToChoose = currentItems.filter((item) => !itemsToRemove.includes(item));
    // console.log('itemsToChoose', itemsToChoose);
    const selector = this._createSelectorOptions(itemsToChoose);

    const renderItems = this._renderSelectedItems(selectedType, selectedItems);
    const renderPinGroupForms = customGroup ? this._renderPinGroupForms(customGroup) : nothing;
    return html`
      ${renderPinGroupForms}
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
              .label=${'Add item'}
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
        <div
          class="preview-container"
          ?grid=${configValue === PANEL_TYPE.BOTTOM_GRID_ITEMS}
          ?hidden=${!selectedItems.length}
        >
          ${renderItems}
        </div>
      </div>
    `;
  }

  private _renderPinGroupForms(groupName: string): TemplateResult {
    const pinnedGroups = this._sidebarConfig?.pinned_groups || {};
    const isPinned = pinnedGroups.hasOwnProperty(groupName);
    const icon = typeof pinnedGroups[groupName] === 'object' ? pinnedGroups[groupName].icon : '';
    const itemData = {
      is_pinned: isPinned,
      icon: icon,
    };
    const schema = [
      {
        name: '',
        type: 'grid',
        schema: [
          {
            name: 'is_pinned',
            label: 'Pin this group',
            type: 'boolean',
            default: false,
          },
          {
            name: 'icon',
            label: 'Icon (optional)',
            disabled: !itemData.is_pinned,
            selector: { icon: {} },
          },
        ],
      },
    ] as const;
    return html`
      <ha-form
        .hass=${this.hass}
        .schema=${schema}
        .data=${itemData}
        .groupName=${groupName}
        .computeLabel=${(schemaItem: any) => {
          return schemaItem.label;
        }}
        @value-changed=${this._handlePinGroupChange}
      ></ha-form>
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
          <div class="icon-item handle" ?grid-item=${selectedType === PANEL_TYPE.BOTTOM_GRID_ITEMS}>
            <ha-icon .icon=${item.icon}></ha-icon><span class="item-text">${item.title}</span>
          </div>
        </a>
      `;
    };
    const typeTitle = selectedType.replace(/_/g, ' ').toUpperCase();
    return html`
      <div class="header-row flex-icon">
        <span>GROUP: ${typeTitle} - ORDER </span>
        <ha-icon-button .path=${mdiSortAlphabeticalVariant} @click=${() => this._sortItems(selectedType)}>
        </ha-icon-button>
      </div>

      ${this._reloadPanelItems
        ? html`<ha-spinner .size=${'small'}></ha-spinner> `
        : html` <ha-sortable handle-selector=".handle" @item-moved=${this._itemMoved}>
            <div
              class="selected-items-preview"
              id="selected-items"
              ?grid=${selectedType === PANEL_TYPE.BOTTOM_GRID_ITEMS}
            >
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
      case PANEL_AREA.BOTTOM_PANELS:
        const bottomSection = this._selectedBottom;
        const bottomItems = [...(this._sidebarConfig[bottomSection] || [])].concat();
        console.log(bottomSection, bottomItems);
        bottomItems.splice(newIndex, 0, bottomItems.splice(oldIndex, 1)[0]);
        console.log('Bottom items after move:', bottomItems);
        updateConfig({ [bottomSection]: bottomItems });
        break;
      case PANEL_AREA.CUSTOM_GROUPS:
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
      type === BOTTOM_SECTION.BOTTOM_ITEMS || type === BOTTOM_SECTION.BOTTOM_GRID_ITEMS
        ? this._sidebarConfig[type as BOTTOM_SECTION.BOTTOM_ITEMS | BOTTOM_SECTION.BOTTOM_GRID_ITEMS] || []
        : this._sidebarConfig.custom_groups?.[type] || [];

    // Create a list of items with their titles
    const itemsWithTitles = selectedItems.map((item: string) => ({
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
    if (type === BOTTOM_SECTION.BOTTOM_ITEMS || type === BOTTOM_SECTION.BOTTOM_GRID_ITEMS) {
      const bottomKey = type as BOTTOM_SECTION.BOTTOM_ITEMS | BOTTOM_SECTION.BOTTOM_GRID_ITEMS;
      let bottomItems = [...(this._sidebarConfig[bottomKey] || [])];
      bottomItems = sortedItemKeys;
      updates[bottomKey] = bottomItems;
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
    const customGroups = { ...(this._sidebarConfig.custom_groups || {}) };
    const alreadyExist = (nameCompare: string) => {
      nameCompare = nameCompare.trim().toLowerCase();
      return Object.keys(customGroups)
        .map((e) => e.trim().toLowerCase())
        .includes(nameCompare);
    };
    // const groupName = prompt('Enter new group name', 'Some Group Name');
    const groupName = await showPromptDialog(this, 'Enter new group name', 'Some Group Name', 'Create');
    if (groupName === null) return;

    if (alreadyExist(groupName)) {
      await showAlertDialog(this, 'Group name already exists. Please choose a different one.');
      return;
    }

    customGroups[groupName] = [];
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
    const uncategorizedActive = this._dialog._uncategorizedIsActive === true;
    const currentConfig = { ...(this._sidebarConfig || {}) };
    // console.log('configValue', configValue, 'value', value);
    const updates: Partial<SidebarConfig> = {};
    if ([BOTTOM_SECTION.BOTTOM_ITEMS, BOTTOM_SECTION.BOTTOM_GRID_ITEMS].includes(configValue)) {
      const bottom = configValue as BOTTOM_SECTION.BOTTOM_ITEMS | BOTTOM_SECTION.BOTTOM_GRID_ITEMS;
      const buttomItems = [...(currentConfig[bottom] || [])];
      const isAddedItems = value.filter((item: string) => !buttomItems.includes(item));
      console.log('isAddedItems', isAddedItems);
      let bottomPanels = [...(this._sidebarConfig[bottom] || [])];
      if (uncategorizedActive && isAddedItems.length > 0) {
        let uncategorizedGroupItems = [...(currentConfig.custom_groups?.[PANEL_TYPE.UNCATEGORIZED_ITEMS] || [])];
        uncategorizedGroupItems = uncategorizedGroupItems.filter((item) => !isAddedItems.includes(item));
        updates.custom_groups = {
          ...(this._sidebarConfig.custom_groups || {}),
          [PANEL_TYPE.UNCATEGORIZED_ITEMS]: uncategorizedGroupItems,
        };
      }
      bottomPanels = value;
      updates[bottom] = bottomPanels;
    } else if (configValue === PANEL_AREA.CUSTOM_GROUPS) {
      const key = customGroup;
      const oldGroupItems = [...(currentConfig.custom_groups?.[key] || [])];
      console.log('oldGroupItems', oldGroupItems);
      const newGroupItems = value;
      const isAddedItems = newGroupItems.filter((item: string) => !oldGroupItems.includes(item));
      console.log('isAddedItems', isAddedItems);

      let customGroups = { ...(this._sidebarConfig.custom_groups || {}) };
      let groupItems = [...(customGroups[key] || [])];
      if (uncategorizedActive && isAddedItems.length > 0) {
        let uncategorizedGroupItems = [...(customGroups[PANEL_TYPE.UNCATEGORIZED_ITEMS] || [])];
        uncategorizedGroupItems = uncategorizedGroupItems.filter((item) => !isAddedItems.includes(item));
        customGroups[PANEL_TYPE.UNCATEGORIZED_ITEMS] = uncategorizedGroupItems;
      }
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
    this.requestUpdate();
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

  private _handlePinGroupChange = (ev: CustomEvent) => {
    ev.stopPropagation();
    const groupName = (ev as any).target.groupName;
    const value = ev.detail.value;
    console.log('Pin group change', groupName, value);
    const pinnedGroups = { ...(this._sidebarConfig?.pinned_groups || {}) };
    if (value.is_pinned) {
      if (value.icon) {
        pinnedGroups[groupName] = { icon: value.icon };
      } else {
        pinnedGroups[groupName] = true;
      }
    } else {
      delete pinnedGroups[groupName];
    }

    this._sidebarConfig = {
      ...this._sidebarConfig,
      pinned_groups: pinnedGroups,
    };
    this._dispatchConfig(this._sidebarConfig);
  };

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
      if (group === BOTTOM_SECTION.BOTTOM_GRID_ITEMS || group === BOTTOM_SECTION.BOTTOM_ITEMS) {
        this._selectedTab = PANEL_AREA.BOTTOM_PANELS;
        this._selectedGroup = null;
        this._selectedBottom =
          group === BOTTOM_SECTION.BOTTOM_GRID_ITEMS ? BOTTOM_SECTION.BOTTOM_GRID_ITEMS : BOTTOM_SECTION.BOTTOM_ITEMS;
      } else {
        this._selectedTab = PANEL_AREA.CUSTOM_GROUPS;
        this._selectedGroup = group;
      }
    }
  }

  static get styles(): CSSResultGroup {
    return [
      super.styles,
      css`
        .groups-menu-header {
          top: 0;
          z-index: 10;
          background-color: var(--mdc-theme-surface);
          /* height: 48px; */
          position: sticky;
          display: block;
        }

        .selected-items-preview {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          overflow-y: auto;
          scrollbar-color: var(--scrollbar-thumb-color) transparent;
          scrollbar-width: thin;
        }
        .selected-items-preview[grid] {
          display: grid;
          grid-template-columns: repeat(auto-fit, 25%);
          /* gap: 8px; */
          align-items: center;
          /* justify-content: center; */
          /* align-content: center; */
          overflow: hidden;
        }
        .selected-items-preview[grid] a {
          width: inherit;
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
        .icon-item[grid-item] {
          /* text-align: center; */
          display: flex;
          width: 100%;
          margin: 8px auto;
          padding: 0;
          max-height: 80px;
          flex-direction: column;
        }
        .icon-item[grid-item] ha-icon {
          /* width: 40px; */
          height: 40px;
          /* margin-bottom: 4px; */
          flex: 0 1 auto;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon-item[grid-item] span.item-text {
          display: block;
          white-space: nowrap;
          flex: 1 1 auto;
          text-overflow: ellipsis;
          overflow: clip;
          max-width: 100%;
        }
        ha-icon-button.action-btn {
          opacity: 0.3;
          color: var(--disabled-text-color);
        }
        ha-icon-button.action-btn:hover {
          opacity: 1;
          color: var(--sidebar-text-color);
        }
        ha-icon-button.action-btn[is-selected] {
          color: var(--ha-color-on-primary-normal, var(--primary-color)) !important;
          opacity: 1 !important;
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-dialog-groups': SidebarDialogPanels;
  }
  interface HASSDomEvents {
    'group-action': { action: string; key: string };
  }
}
