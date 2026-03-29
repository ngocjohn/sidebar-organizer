import { CONFIG_AREA_LABELS, PANEL_AREA, VISIBILITY_SECTION, VisibilitySectionKeys } from '@constants';
import { SidebarConfig } from '@types';
import { createHaForm } from '@utilities/create-ha-form';
import { isEmpty, pick } from 'es-toolkit/compat';
import { html, TemplateResult, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { BaseEditor } from '../../base-editor';
import { SelectSelector } from '../../types';
import { VISIBILITY_OBJECT_SCHEMA } from '../forms';

const selectorGridStyleToChange = css`
  :host > div {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }
`.toString();

export enum VISIBLE_TYPE {
  GROUPS = 'groups',
  ITEMS = 'items',
}

type VisibleType = VISIBLE_TYPE.GROUPS | VISIBLE_TYPE.ITEMS;

@customElement('so-panel-visibility')
export class SoPanelVisibility extends BaseEditor {
  constructor() {
    super(PANEL_AREA.VISIBILITY);
    window.SoPanelVisibility = this;
  }

  @property({ attribute: false }) _sidebarConfig!: SidebarConfig;
  @state() public _selectedSection: VISIBILITY_SECTION = VISIBILITY_SECTION.HIDDEN_ITEMS;

  @state() private _itemsTemplateMap = new Map<string, string>();
  @state() private _groupsTemplateMap = new Map<string, string>();

  protected willUpdate(_changedProperties: PropertyValues): void {
    super.willUpdate(_changedProperties);
    if (_changedProperties.has('_sidebarConfig')) {
      const visibilityTemplates = this._sidebarConfig?.visibility_templates || {};
      this._itemsTemplateMap = new Map(Object.entries(visibilityTemplates.items || {}));
      this._groupsTemplateMap = new Map(Object.entries(visibilityTemplates.groups || {}));
    }
  }
  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);
    if (changedProperties.has('_selectedSection') && this._selectedSection === VISIBILITY_SECTION.HIDDEN_ITEMS) {
      this._changeSelectorGridStyle();
    }
  }

  private async _changeSelectorGridStyle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 50)); // Wait for the DOM to update
    const selectorToModify = this.shadowRoot
      ?.querySelector('ha-selector#selector-hidden_items')
      ?.shadowRoot?.querySelector('ha-selector-select');
    if (selectorToModify) {
      this._styleManager.addStyle(selectorGridStyleToChange, selectorToModify.shadowRoot || selectorToModify);
    }
  }
  protected render(): TemplateResult {
    const visibilitySections = VisibilitySectionKeys.map((key) => ({
      value: key,
      label: CONFIG_AREA_LABELS[key],
    }));

    const sectionSelector = html` <ha-control-select
      .value=${this._selectedSection}
      .options=${visibilitySections}
      @value-changed=${(ev: CustomEvent) => {
        this._selectedSection = ev.detail.value;
      }}
    ></ha-control-select>`;

    const sectionMap = {
      [VISIBILITY_SECTION.HIDDEN_ITEMS]: this._renderHiddenItems(),
      [VISIBILITY_SECTION.VISIBILITY_TEMPLATES]: this._renderVisibilityTemplates(),
    };
    return html`
      ${sectionSelector}
      <div class="config-content">${sectionMap[this._selectedSection]}</div>
    `;
  }

  private _renderHiddenItems(): TemplateResult {
    const hiddenItems = this._sidebarConfig?.hidden_items || [];
    const itemToChoose = this._panelsWithoutNewItems;
    const selectorConfig = this._computeSelectorOptions(itemToChoose, 'list', false, false);
    const selectedValues = Object.entries(hiddenItems).map(([, item]) => item);

    return html` <div class="items-container" style="flex: none">
      <div class="header-row flex-icon">
        <span>HIDDEN ITEMS</span>
      </div>
      ${this._createHaSelector(selectorConfig, selectedValues, 'hidden_items')} ${this._renderSpacerDiv()}
    </div>`;
  }

  private _renderVisibilityTemplates(): TemplateResult {
    const singleItemsConfig = this._singleItemsData;
    const selectorConfig = this._computeOptionsSelector(VISIBLE_TYPE.ITEMS);
    const singleSchema = VISIBILITY_OBJECT_SCHEMA(VISIBLE_TYPE.ITEMS, selectorConfig);
    // groups
    const groupsConfig = this._groupsData;
    const groupsSelectorConfig = this._computeOptionsSelector(VISIBLE_TYPE.GROUPS);
    const groupsSchema = VISIBILITY_OBJECT_SCHEMA(VISIBLE_TYPE.GROUPS, groupsSelectorConfig);
    return html`
      ${createHaForm(this, groupsSchema, groupsConfig, { configKey: 'groups' })}
      ${createHaForm(this, singleSchema, singleItemsConfig, { configKey: 'items' })}
    `;
  }

  _valueChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const configKey = (ev.target as any).configKey;
    const incomingValue = ev.detail.value;
    if (!incomingValue) {
      return;
    }
    console.debug('Value changed for key:', configKey, 'incoming value:', incomingValue);
    const updatedTemplates = Object.values(incomingValue).reduce((acc: Record<string, string>, current: any) => {
      // Only include entries that have a valid name and value
      if (current.name && current.value !== undefined && current.value !== null && current.value !== '') {
        acc[current.name] = current.value;
      }
      return acc;
    }, {});

    if (isEmpty(updatedTemplates)) {
      console.debug('No valid templates found in incoming value, skipping update.');
      this.requestUpdate();
      return;
    }
    const currentTemplates = this._sidebarConfig?.visibility_templates || {};
    const newVisibilityTemplates = { ...currentTemplates, [configKey]: updatedTemplates };
    this._configChanged({
      visibility_templates: newVisibilityTemplates,
    });
  }

  private _computeOptionsSelector(type: VisibleType): SelectSelector {
    const customGroupKeys = Object.keys(this._sidebarConfig?.custom_groups || {}) || [];
    const { groups = {}, items = {} } = pick(this._sidebarConfig?.visibility_templates || {}, ['groups', 'items']);
    const itemsToUse = type === VISIBLE_TYPE.GROUPS ? customGroupKeys : this._panelsWithoutNewItems;

    const options = itemsToUse.map((item) => {
      return { value: item, label: this._utils.PANEL.getPanelTitleFromUrlPath(this.hass, item) || item };
    });

    const selectedItems = type === VISIBLE_TYPE.GROUPS ? Object.keys(groups) : Object.keys(items);

    const itemsToChoose = options.filter((item) => !selectedItems.includes(item.value));

    const selectorConfig = {
      select: {
        multiple: false,
        custom_value: false,
        mode: 'dropdown',
        options: itemsToChoose,
        sort: true,
        required: false,
      },
    };
    return selectorConfig as SelectSelector;
  }

  protected _handleSelectorChange(e: CustomEvent): void {
    console.debug('selector change from SoPanelVisibility handler');
    e.stopPropagation();
    const { key, subKey } = e.target as any;
    const value = e.detail.value;
    console.debug('value changed:', value, 'key:', key, 'subKey:', subKey);
    if (key === 'hidden_items') {
      this._updateInitPanels(value);
      const cleanedConfig = this._utils.CONFIG.validateConfig(this._sidebarConfig, value);
      this._configChanged({ ...cleanedConfig });
      return;
    } else {
      console.log('Unknown key changed:', key);
    }
  }

  private _updateInitPanels(hiddenItems: string[]) {
    const combinedPanels = this._dialog._initCombiPanels;
    let initPanelOrder = [...(this._dialog._initPanelOrder || [])];

    // Remove hidden items from init panels
    initPanelOrder = combinedPanels.filter((panel) => !hiddenItems.includes(panel));
    // Add back any panels that are in the current init panels but not in the updated list
    this._dialog._initPanelOrder = initPanelOrder;
  }

  private get _singleItemsData(): { name: string; value: string }[] {
    return Array.from(this._itemsTemplateMap.entries()).map(([key, value]) => ({ name: key, value }));
  }
  private get _groupsData(): { name: string; value: string }[] {
    return Array.from(this._groupsTemplateMap.entries()).map(([key, value]) => ({ name: key, value }));
  }

  static get styles() {
    return [super.styles, css``];
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'so-panel-visibility': SoPanelVisibility;
  }
}
