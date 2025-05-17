import { mdiChevronLeft, mdiGestureTap } from '@mdi/js';
import { SidebarConfig, HaExtened, NewItemConfig } from '@types';
import { TRANSLATED } from '@utilities/localize';
import { showConfirmDialog, showPromptDialog } from '@utilities/show-dialog-box';
import { html, LitElement, TemplateResult, nothing, PropertyValues, CSSResultGroup } from 'lit';
import { repeat } from 'lit-html/directives/repeat.js';
import { customElement, property, state } from 'lit/decorators';
import memoizeOne from 'memoize-one';

import { dialogStyles } from './dialog-css';
import { SidebarConfigDialog } from './sidebar-dialog';
const DEFAULT_ACTIONS = ['more-info', 'toggle', 'navigate', 'perform-action', 'assist'];

const _configSchema = memoizeOne(
  () =>
    [
      {
        name: 'title',
        label: 'Item Title',
        selector: { text: { type: 'text' } },
      },
      {
        name: 'icon',
        label: 'Item Icon',
        selector: { icon: {} },
      },
      {
        name: 'url_path',
        label: 'URL Path',
        selector: { text: { type: 'text' } },
      },
      {
        name: '',
        type: 'expandable',
        title: 'Notification template',
        schema: [
          {
            name: 'notification',
            selector: {
              template: {},
            },
          },
        ],
      },
      {
        name: '',
        type: 'expandable',
        iconPath: mdiGestureTap,
        title: 'Interactions action',
        flatten: true,
        schema: [
          {
            name: 'entity',
            selector: { entity: {} },
          },
          {
            name: '',
            type: 'optional_actions',
            flatten: true,
            schema: [
              {
                name: 'tap_action',
                label: 'Tap Action',
                selector: {
                  ui_action: {
                    actions: DEFAULT_ACTIONS,
                    default_action: 'none',
                  },
                },
              },
              {
                name: 'hold_action',
                label: 'Hold Action',
                selector: {
                  ui_action: {
                    actions: DEFAULT_ACTIONS,
                    default_action: 'none',
                  },
                },
              },

              {
                name: 'double_tap_action',
                label: 'Double Tap Action',
                selector: {
                  ui_action: {
                    actions: DEFAULT_ACTIONS,
                    default_action: 'none',
                  },
                },
              },
            ],
          },
        ],
      },
    ] as const
);

@customElement('sidebar-dialog-new-items')
export class SidebarDialogNewItems extends LitElement {
  @property({ attribute: false }) hass!: HaExtened['hass'];
  @property({ attribute: false }) _dialog!: SidebarConfigDialog;
  @property({ attribute: false }) _sidebarConfig!: SidebarConfig;

  @state() _selectedItemIndex: number | null = null;
  @state() _selectedItem: NewItemConfig | null = null;
  @state() _yamlMode: boolean = false;

  protected render(): TemplateResult {
    const itemsList = this._renderNewItemsList();
    const selectedItem = this._renderSelectedItem();

    return html` <div class="config-content">${itemsList} ${selectedItem}</div> `;
  }

  private _renderNewItemsList(): TemplateResult | typeof nothing {
    if (this._selectedItemIndex !== null) return nothing;
    const addBtn = html`
      <ha-button
        outlined
        style="--mdc-theme-primary: var(--accent-color); place-self: flex-end;"
        .label=${'Add new item'}
        @click=${this._togglePromptNewItem}
      >
      </ha-button>
    `;
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
    const BTN_LABEL = TRANSLATED(this.hass).BTN_LABEL;
    const newItems = this._sidebarConfig.new_items![this._selectedItemIndex!];
    const headerBack = html` <div class="header-row">
      <ha-icon-button .path=${mdiChevronLeft} @click=${() => (this._selectedItemIndex = null)}> </ha-icon-button>
      ${newItems.title}
      <ha-button
        outlined
        .label=${this._yamlMode ? BTN_LABEL.SHOW_VISUAL_EDITOR : BTN_LABEL.SHOW_CODE_EDITOR}
        style="--mdc-theme-primary: var(--accent-color); place-self: flex-end;"
        @click=${() => {
          this._yamlMode = !this._yamlMode;
        }}
      ></ha-button>
    </div>`;
    const data = {
      ...this._sidebarConfig.new_items?.[this._selectedItemIndex!],
    };
    const configSchema = _configSchema();
    return html`
      ${headerBack}
      <div class="config-content">
        ${!this._yamlMode
          ? html`
              <ha-form
                .hass=${this.hass}
                .data=${data}
                .schema=${configSchema}
                .computeLabel=${this._computeLabel}
                @value-changed=${this._valueChanged}
              >
              </ha-form>
            `
          : html`
              <ha-yaml-editor
                .hass=${this.hass}
                .defaultValue=${data}
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
      </div>
    `;
  }

  private getGroupName(item: string): string {
    const groups = this._sidebarConfig.custom_groups || {};
    const bottomPanels = this._sidebarConfig.bottom_items || [];
    const groupName = Object.keys(groups).find((group) => groups[group].includes(item));
    if (groupName) {
      return groupName;
    } else if (bottomPanels.includes(item)) {
      return 'Bottom Panels';
    } else {
      return 'Ungrouped';
    }
  }

  private _computeLabel = (schema: any) => {
    let label: string;
    if (schema.name === 'entity' || schema.name === 'notification') {
      label = '';
    } else if (!schema.label) {
      label = schema.name;
    } else {
      label = schema.label;
    }
    return label;
  };

  private _valueChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const index = this._selectedItemIndex;
    if (index === null) return;
    let newItemConfig = ev.detail.value;
    newItemConfig.title = newItemConfig.title.trim();
    newItemConfig.url_path = newItemConfig.url_path?.trim();

    const newItems = [...(this._sidebarConfig.new_items || [])];
    const newItem = { ...newItems[index], ...newItemConfig };

    newItems[index] = newItem;
    this._sidebarConfig = {
      ...this._sidebarConfig,
      new_items: newItems,
    };
    this._dispatchConfig(this._sidebarConfig);
  }

  private _handleDeleteItem = async (index: number) => {
    const confirmDelete = await showConfirmDialog(
      this,
      `Are you sure you want to delete the item "${this._sidebarConfig.new_items![index].title}"?`,
      'Delete'
    );
    if (!confirmDelete) return;

    const newItems = [...(this._sidebarConfig.new_items || [])];
    newItems.splice(index, 1);
    this._sidebarConfig = {
      ...this._sidebarConfig,
      new_items: newItems,
    };
    this._dispatchConfig(this._sidebarConfig);
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
    return [dialogStyles];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-dialog-new-items': SidebarDialogNewItems;
  }
}
