import { mdiChevronLeft, mdiGestureTap, mdiMessageBadgeOutline } from '@mdi/js';
import { SidebarConfig, HaExtened, NewItemConfig } from '@types';
import { isIcon } from '@utilities/is-icon';
import { TRANSLATED_LABEL } from '@utilities/localize';
import { showConfirmDialog, showPromptDialog } from '@utilities/show-dialog-box';
import { hasTemplate, subscribeRenderTemplate } from '@utilities/ws-templates';
import { capitalize, pick } from 'es-toolkit/compat';
import { html, LitElement, TemplateResult, nothing, PropertyValues, CSSResultGroup, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import memoizeOne from 'memoize-one';

import { dialogStyles } from './dialog-css';
import { computeOptionalActionSchemaFull } from './forms';
import { SidebarConfigDialog } from './sidebar-dialog';

@customElement('sidebar-dialog-new-items')
export class SidebarDialogNewItems extends LitElement {
  @property({ attribute: false }) hass!: HaExtened['hass'];
  @property({ attribute: false }) _dialog!: SidebarConfigDialog;
  @property({ attribute: false }) _sidebarConfig!: SidebarConfig;

  @state() _selectedItemIndex: number | null = null;
  @state() _selectedItem: NewItemConfig | null = null;
  @state() _yamlMode: boolean = false;

  @state() _notificationExpanded: boolean = false;

  protected update(changedProperties: PropertyValues): void {
    super.update(changedProperties);
    if (changedProperties.has('_selectedItemIndex') && this._selectedItemIndex !== null) {
      setTimeout(() => {
        this._observeExpansion();
      }, 100); // Delay to ensure the DOM is updated
    }
  }

  private _observeExpansion() {
    const notificationForm = this.shadowRoot?.getElementById('notification-form');
    const expandable = notificationForm?.shadowRoot?.querySelector('ha-form-expandable');
    const panel = expandable?.shadowRoot?.querySelector('ha-expansion-panel');
    if (!panel) return;

    this._notificationExpanded = panel.hasAttribute('expanded');
    // Ensure the panel has the 'expanded' attribute
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'expanded') {
          const isExpanded = panel.hasAttribute('expanded');
          console.log('Panel expanded changed:', isExpanded);
          // You can call some method here
          this._notificationExpanded = isExpanded;
        }
      }
    });

    observer.observe(panel, {
      attributes: true,
      attributeFilter: ['expanded'],
    });
  }

  private get groupKeys(): string[] {
    return Object.keys(this._sidebarConfig.custom_groups || {});
  }

  private _actionsSchema = [
    {
      title: 'Interaction',
      type: 'expandable',
      flatten: true,
      iconPath: mdiGestureTap,
      schema: [
        {
          name: 'entity',
          selector: { entity: {} },
          helper: 'Entity to control when the button is pressed',
        },
        ...computeOptionalActionSchemaFull(),
      ],
    },
  ] as const;

  private _notificationSchema = [
    {
      type: 'expandable',
      title: 'Notification badge template',
      iconPath: mdiMessageBadgeOutline,
      expanded: false,
      schema: [
        {
          name: 'notification',
          selector: {
            template: {},
          },
        },
      ],
    },
  ] as const;

  private _configSchema = memoizeOne(
    (groupsOptions: string[]) =>
      [
        {
          type: 'grid',
          schema: [
            {
              name: 'icon',
              label: 'Item Icon',
              selector: { icon: {} },
            },
            {
              name: 'group',
              label: 'Item Group',
              required: false,
              selector: {
                select: {
                  mode: 'dropdown',
                  options: [
                    ['bottom', ...groupsOptions].map((group: string) => ({
                      value: group,
                      label: group.replace(/_/g, ' ').toUpperCase(),
                    })),
                  ],
                },
              },
            },
          ],
        },
      ] as const
  );

  protected render(): TemplateResult {
    if (!this.hass || !this._sidebarConfig) {
      return html`<div>Loading...</div>`;
    }
    const itemsList = this._renderNewItemsList();
    const selectedItem = this._renderSelectedItem();

    return html` <div class="config-content">${this._selectedItemIndex === null ? itemsList : selectedItem}</div> `;
  }

  private _renderNewItemsList(): TemplateResult | typeof nothing {
    if (this._selectedItemIndex !== null) return nothing;
    const addBtn = html` <ha-button size="small" @click=${this._togglePromptNewItem}>Add new item </ha-button> `;
    const newItems = this._sidebarConfig?.new_items || [];
    const newItemsList = html`
      ${!newItems.length
        ? html`<div>No new items added yet</div>`
        : html`
            <div class="group-list">
              ${repeat(
                newItems,
                (item) => item.title,
                (item, index) => {
                  const { icon, title } = item;
                  return html`
                    <div class="group-item-row" style="padding-inline-start: 1rem">
                      <div class="group-name" @click=${() => (this._selectedItemIndex = index)}>
                        <ha-icon icon=${icon}></ha-icon>
                        <div class="group-name-items">
                          ${title}
                          <span>${this.getGroupName(title!)}</span>
                        </div>
                      </div>
                      <div class="group-actions">
                        <ha-icon-button .label=${'Edit item'} @click=${() => (this._selectedItemIndex = index)}>
                          <ha-icon icon="mdi:pencil"></ha-icon
                        ></ha-icon-button>
                        <ha-icon-button .label=${'Delete item'} @click=${this._handleDeleteItem.bind(this, index)}>
                          <ha-icon icon="mdi:trash-can-outline"></ha-icon
                        ></ha-icon-button>
                      </div>
                    </div>
                  `;
                }
              )}
            </div>
          `}
    `;

    return html`
      <div class="config-content">
        ${newItemsList}
        <div class="header-row flex-end">${addBtn}</div>
      </div>
    `;
  }

  private _renderSelectedItem(): TemplateResult | typeof nothing {
    if (this._selectedItemIndex === null) return nothing;
    const BTN_LABEL = TRANSLATED_LABEL.BTN_LABEL;
    const newItems = this._sidebarConfig.new_items![this._selectedItemIndex!];
    const headerBack = html` <div class="header-row">
      <ha-icon-button .path=${mdiChevronLeft} @click=${() => (this._selectedItemIndex = null)}> </ha-icon-button>
    </div>`;

    const baseData = { ...this._sidebarConfig.new_items![this._selectedItemIndex!] };
    // console.log('Editing item:', baseData);
    const groupName = this.getGroupName(newItems.title!);
    // console.log('Group name:', groupName);
    let inGroup: string | undefined;
    if (groupName === 'Bottom Panels') {
      inGroup = 'bottom';
    } else if (groupName === 'Ungrouped') {
      inGroup = undefined;
    } else {
      inGroup = groupName;
    }

    // console.log('Item is in group:', inGroup);
    const dataWithoutActions = {
      icon: baseData?.icon,
      group: inGroup,
    };

    const actionData = pick(baseData, ['entity', 'tap_action', 'hold_action', 'double_tap_action']);

    const notificationData = {
      notification: baseData.notification,
    };

    const baseSchema = this._configSchema(this.groupKeys);
    const actionSchema = this._actionsSchema;
    const notificationSchema = this._notificationSchema;

    return html`
      ${headerBack}
      <div class="config-content">
        ${!this._yamlMode
          ? html`
              <div class="group-item-row item-name-row">
                <div class="group-name">
                  <ha-icon icon=${newItems.icon}></ha-icon>
                  <div class="group-name-items">
                    ${newItems.title}
                    <span>${this.getGroupName(newItems.title!)}</span>
                  </div>
                </div>
                <div class="group-actions">
                  <ha-button
                    appearance="plain"
                    size="small"
                    @click=${this._toggleRenameItem.bind(this, this._selectedItemIndex!)}
                    >Rename</ha-button
                  >
                </div>
              </div>

              ${this._createHaForm(dataWithoutActions, baseSchema, 'base')}
              ${this._createHaForm(actionData, actionSchema, 'actions')}
              ${this._createHaForm(notificationData, notificationSchema, 'notification', 'notification-form')}
              ${this._notificationExpanded ? this._renderNotifyResult() : html``}
            `
          : html`
              <ha-yaml-editor
                .hass=${this.hass}
                .defaultValue=${baseData}
                .copyToClipboard=${true}
                .required=${true}
                @value-changed=${(ev: CustomEvent) => {
                  const { isValid, value } = ev.detail;
                  if (isValid) {
                    this._sidebarConfig.new_items![this._selectedItemIndex!] = value;
                    this._dispatchConfig(this._sidebarConfig);
                  }
                }}
              ></ha-yaml-editor>
            `}
        <div class="header-row flex-end">
          <ha-button
            appearance="plain"
            size="small"
            @click=${() => {
              this._yamlMode = !this._yamlMode;
            }}
            >${this._yamlMode ? BTN_LABEL.SHOW_VISUAL_EDITOR : BTN_LABEL.SHOW_CODE_EDITOR}</ha-button
          >
        </div>
      </div>
    `;
  }

  private _renderNotifyResult(): TemplateResult {
    if (!this._selectedItem || !this._selectedItem.notification) {
      return html``;
    }

    const notifyConfigValue = this._selectedItem.notification || '';

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
      <div id="template-preview">
        <span>Template result:</span>
        <pre id="template-preview-content" class="rendered"></pre>
      </div>
    `;
  }

  private _subscribeTemplate(configValue: string, callback: (result: string) => void): void {
    if (!this.hass || !hasTemplate(configValue)) {
      console.log('Not a template', hasTemplate(configValue), configValue);
      return;
    }

    subscribeRenderTemplate(
      this.hass.connection,
      (result) => {
        callback(result.result);
      },
      {
        template: configValue ?? '',
        variables: {
          config: configValue,
          user: this.hass.user!.name,
        },
        strict: true,
      }
    );
  }

  private getGroupName(item: string): string {
    const { custom_groups = {}, bottom_items = [] } = this._sidebarConfig;
    const groupName = Object.keys(custom_groups).find((group) => custom_groups[group].includes(item));

    return groupName || (bottom_items.includes(item) ? 'Bottom Panels' : 'Ungrouped');
  }

  private _createHaForm(data: any, schema: any, configKey?: string | number | undefined, id?: string): TemplateResult {
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${schema}
        .configKey=${configKey}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._valueChanged}
        id=${id ? id : nothing}
      >
      </ha-form>
    `;
  }
  private _computeLabel = (schema: any): string | undefined => {
    if (schema.name === 'entity' && !schema.context?.group_entity) {
      return undefined;
    }
    const label = schema.label || schema.name || schema.title || '';
    return capitalize(label.replace(/_/g, ' '));
  };
  private _computeHelper = (schema: any): string | TemplateResult | undefined => {
    return schema.helper || undefined;
  };

  private _valueChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    if (this._selectedItemIndex === null) return;
    const index = this._selectedItemIndex;
    const currentItem = { ...this._sidebarConfig.new_items![index] };

    const incoming = ev.detail.value as Partial<NewItemConfig>;
    const configKey = (ev.target as any).configKey;
    console.log('Value changed for key:', configKey, incoming);

    let updates: Partial<NewItemConfig> = {};
    if (configKey === 'base') {
      const group = incoming?.group;
      const title = currentItem.title!;
      updates = {
        ...incoming,
      };
      this._handleGroupChange(title, group);
    } else if (configKey === 'actions') {
      const currentActions = pick(currentItem, ['entity', 'tap_action', 'hold_action', 'double_tap_action']);
      if (JSON.stringify(currentActions) !== JSON.stringify(incoming)) {
        updates = {
          ...incoming,
        };
      }
    } else if (configKey === 'notification') {
      if (JSON.stringify(currentItem.notification) !== JSON.stringify(incoming.notification)) {
        updates = {
          notification: incoming.notification,
        };
      }
    }
    if (Object.keys(updates).length > 0) {
      const updatedItem: NewItemConfig = {
        ...currentItem,
        ...updates,
      };

      const newItems = [...(this._sidebarConfig.new_items || [])];
      newItems[index] = updatedItem;
      console.log('Updated item:', updatedItem);
      this._sidebarConfig = {
        ...this._sidebarConfig,
        new_items: newItems,
      };

      this._selectedItem = { ...updatedItem };
      this._dispatchConfig(this._sidebarConfig);
    }
  }

  private _handleGroupChange(title: string, group: string | undefined): void {
    const inGroup = this.getGroupName(title);
    // If item is already in the group, we do nothing
    console.log('Handling group change:', title, 'from', inGroup, 'to', group);
    if (
      inGroup === group ||
      (inGroup === 'Ungrouped' && !group) ||
      (inGroup === 'Bottom Panels' && group === 'bottom')
    ) {
      console.log(`Item "${title}" is already in group "${inGroup}" or ungrouped.`);
      return;
    }
    console.log(`Item "${title}" is in group "${inGroup}", move to "${group}"`);
    if (!group || group === '') {
      this._handleRemoveItem(title);
    } else if (inGroup !== group) {
      this._handleRemoveItem(title);
      // If group is 'bottom', we handle it separately
      if (group === 'bottom') {
        const bottomItems = [...(this._sidebarConfig.bottom_items || [])];
        if (!bottomItems.includes(title)) {
          bottomItems.push(title);
          this._sidebarConfig = {
            ...this._sidebarConfig,
            bottom_items: bottomItems,
          };
        }
        return;
      }
      // Add to new group
      const customGroups = { ...this._sidebarConfig.custom_groups };
      if (!customGroups[group]) {
        customGroups[group] = [];
      }
      customGroups[group].push(title);
      this._sidebarConfig = {
        ...this._sidebarConfig,
        custom_groups: customGroups,
      };
      return;
    }
  }

  private _handleDeleteItem = async (index: number) => {
    const title = this._sidebarConfig.new_items![index].title;
    const confirmDelete = await showConfirmDialog(
      this,
      `Are you sure you want to delete the item "${title}"?`,
      'Delete'
    );
    if (!confirmDelete) return;

    const newItems = [...(this._sidebarConfig.new_items || [])];
    newItems.splice(index, 1);
    this._sidebarConfig = {
      ...this._sidebarConfig,
      new_items: newItems,
    };

    this._handleRemoveItem(title!);

    this._dispatchConfig(this._sidebarConfig);
    this.requestUpdate();
  };

  private _handleRemoveItem = (title: string) => {
    const inGroups = this.getGroupName(title!);
    if (inGroups !== 'Ungrouped') {
      console.log(`Removing item "${title}" from group "${inGroups}"`);
      // If item is in group, we need to remove it from the group
      if (inGroups === 'Bottom Panels') {
        const bottomItems = [...(this._sidebarConfig.bottom_items || [])];
        const itemIndex = bottomItems.indexOf(title!);
        if (itemIndex !== -1) {
          bottomItems.splice(itemIndex, 1);
          this._sidebarConfig = {
            ...this._sidebarConfig,
            bottom_items: bottomItems,
          };
        }
      } else {
        const customGroups = { ...this._sidebarConfig.custom_groups };
        const groupItems = customGroups[inGroups] || [];
        const itemIndex = groupItems.indexOf(title!);
        if (itemIndex !== -1) {
          groupItems.splice(itemIndex, 1);
          customGroups[inGroups] = groupItems;
          this._sidebarConfig = {
            ...this._sidebarConfig,
            custom_groups: customGroups,
          };
        }
      }
    }
  };

  private _toggleRenameItem = async (index: number) => {
    const currentTitle = this._sidebarConfig.new_items![index].title!;
    let newItemTitle = await showPromptDialog(this, 'Enter new item title', 'Rename Item', 'Rename', 'Cancel');
    if (!newItemTitle || newItemTitle === '') return;
    newItemTitle = newItemTitle.trim();

    if (this._sidebarConfig.new_items?.some((item) => item.title === newItemTitle)) {
      await showConfirmDialog(this, `Item with this name already exists. Do you want to edit it?`, 'Edit', 'Cancel');
      return;
    }

    const inGroups = this.getGroupName(currentTitle);

    if (inGroups !== 'Ungrouped') {
      // If item is in group, we need to update that item in the group
      if (inGroups === 'Bottom Panels') {
        const bottomItems = [...(this._sidebarConfig.bottom_items || [])];
        const itemIndex = bottomItems.indexOf(currentTitle);
        if (itemIndex !== -1) {
          bottomItems[itemIndex] = newItemTitle;
          this._sidebarConfig = {
            ...this._sidebarConfig,
            bottom_items: bottomItems,
          };
        }
      } else {
        const customGroups = { ...this._sidebarConfig.custom_groups };
        const groupItems = customGroups[inGroups] || [];
        const itemIndex = groupItems.indexOf(currentTitle);
        if (itemIndex !== -1) {
          groupItems[itemIndex] = newItemTitle;
          customGroups[inGroups] = groupItems;
          this._sidebarConfig = {
            ...this._sidebarConfig,
            custom_groups: customGroups,
          };
        }
      }
    }
    // Update the new item title
    const newItems = [...(this._sidebarConfig.new_items || [])];
    newItems[index] = {
      ...newItems[index],
      title: newItemTitle,
    };
    this._sidebarConfig = {
      ...this._sidebarConfig,
      new_items: newItems,
    };
    this._dispatchConfig(this._sidebarConfig);
    this._selectedItemIndex = index;
    this.requestUpdate();
  };

  private _togglePromptNewItem = async () => {
    let newItemTitle = await showPromptDialog(this, 'Enter new item title', 'New Item', 'Add', 'Cancel');
    if (!newItemTitle || newItemTitle === '') return;
    newItemTitle = newItemTitle.trim();
    if (this._sidebarConfig.new_items?.some((item) => item.title === newItemTitle)) {
      await showConfirmDialog(this, `Item with this name already exists. Do you want to edit it?`, 'Edit', 'Cancel');
      return;
    }
    const newItemConfig = {
      title: newItemTitle,
      icon: `mdi:alpha-${newItemTitle.charAt(0).toLowerCase()}-circle`,
    };

    const newItems = [...(this._sidebarConfig.new_items || [])];
    newItems.push(newItemConfig);
    this._sidebarConfig = {
      ...this._sidebarConfig,
      new_items: newItems,
    };
    this._dispatchConfig(this._sidebarConfig);
    this._selectedItemIndex = newItems.length - 1;
    this.requestUpdate();
  };

  protected firstUpdated(changedProperties: PropertyValues): void {
    super.firstUpdated(changedProperties);
    this._selectedItem = null;
  }

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);
    if (changedProperties.has('_selectedItemIndex')) {
      if (this._selectedItemIndex !== null) {
        this._selectedItem = this._sidebarConfig.new_items![this._selectedItemIndex];
      } else {
        this._selectedItem = null;
        this._yamlMode = false;
      }
    }
  }

  private _dispatchConfig(config: SidebarConfig) {
    const event = new CustomEvent('sidebar-changed', { detail: config, bubbles: true, composed: true });
    this.dispatchEvent(event);
  }

  static get styles(): CSSResultGroup {
    return [
      css`
        .item-name-row {
          padding: 0.5em;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background-color: var(--secondary-background-color);
        }
      `,
      dialogStyles,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-dialog-new-items': SidebarDialogNewItems;
  }
}
