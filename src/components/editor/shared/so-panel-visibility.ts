import { CONFIG_AREA_LABELS, PANEL_AREA, VISIBILITY_SECTION, VisibilitySectionKeys } from '@constants';
import { SidebarConfig } from '@types';
import { createExpansionPanel, ExpandablePanelProps } from '@utilities/dom-utils';
import { fireEvent } from '@utilities/fire_event';
import { pick } from 'es-toolkit/compat';
import { html, TemplateResult, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import { BaseEditor } from '../../base-editor';
import { SelectSelector } from '../../types';

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
type VisibilityTemplateEntry = { name: string; value: string };

const TYPE_LABELS: Record<VisibleType, string> = {
  items: 'Individual Items Configuration',
  groups: 'Groups Configuration',
};
const TYPE_SELECTOR_LABELS: Record<VisibleType, string> = {
  items: 'Select an item',
  groups: 'Select a group',
};

const TYPE_HELPER_TEXT: Record<VisibleType, string> = {
  groups: 'A group entry applies to all panels in the group.',
  items:
    'If a panel is included in a group with a visibility setting, the individual panel setting will be ignored in favor of the group setting.',
};
@customElement('so-panel-visibility')
export class SoPanelVisibility extends BaseEditor {
  constructor() {
    super(PANEL_AREA.VISIBILITY);
    window.SoPanelVisibility = this;
  }

  @property({ attribute: false }) _sidebarConfig!: SidebarConfig;
  @state() public _selectedSection: VISIBILITY_SECTION = VISIBILITY_SECTION.HIDDEN_ITEMS;

  protected updated(changedProperties: PropertyValues): void {
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
  private get _visibilityTemplatesData() {
    const visibilityTemplates = this._sidebarConfig?.visibility_templates || {};
    const itemsConfig = Array.from(Object.entries(visibilityTemplates?.items || {})).map(([key, value]) => ({
      name: key,
      value,
    }));
    const groupsConfig = Array.from(Object.entries(visibilityTemplates?.groups || {})).map(([key, value]) => ({
      name: key,
      value,
    }));
    return {
      items: [...itemsConfig],
      groups: [...groupsConfig],
    };
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
    const DATA = this._visibilityTemplatesData;
    return html`
      ${Object.values(VISIBLE_TYPE).map((type) => {
        const selectorConfig = this._computeOptionsSelector(type);
        const selectedValue = DATA[type];
        return this._renderTemplateConfig(type, this._createHaSelectorObject(selectorConfig, selectedValue, type));
      })}
    `;
  }

  private _renderTemplateConfig(type: VisibleType, content: TemplateResult): TemplateResult {
    const expansionOptions: ExpandablePanelProps['options'] = {
      header: TYPE_LABELS[type],
      noStyle: true,
      expanded: true,
    };
    return createExpansionPanel({ options: expansionOptions, content });
  }

  private _createHaSelectorObject(
    selectorConfig: SelectSelector,
    value: VisibilityTemplateEntry[] | undefined,
    key: VisibleType,
    subKey?: string | number
  ): TemplateResult {
    const objectSelectorConfig = {
      selector: {
        object: {
          label_field: 'name',
          description_field: 'value',
          multiple: true,
          fields: {
            name: {
              label: TYPE_SELECTOR_LABELS[key as string] || 'Name',
              selector: selectorConfig,
              required: false,
            },
            value: {
              label: 'Visibility Template',
              selector: { template: { preview: true } },
              required: false,
            },
          },
        },
      },
    };

    return html`<ha-selector
      .hass=${this.hass}
      .value=${value}
      .selector=${objectSelectorConfig.selector}
      .required=${false}
      .key=${key}
      .subKey=${subKey}
      .label=${TYPE_HELPER_TEXT[key as string] || ''}
      id=${ifDefined(key !== undefined ? `selector-${key}` : undefined)}
      @value-changed=${this._valueChanged}
    ></ha-selector>`;
  }

  private _valueChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const configKey = (ev.target as any)?.key;
    const value = ev.detail.value;
    console.debug('Value changed for key:', configKey, 'New value:', value);
    const updatedValue = Array.isArray(value)
      ? value.reduce(
          (acc, entry) => {
            if (entry.name) {
              acc[entry.name] = entry.value;
            }
            return acc;
          },
          {} as Record<string, string>
        )
      : {};

    this._sidebarConfig = {
      ...this._sidebarConfig,
      visibility_templates: {
        ...this._sidebarConfig.visibility_templates,
        [configKey || '']: updatedValue,
      },
    };
    fireEvent(this, 'sidebar-config-changed', { config: this._sidebarConfig });
  }

  private _computeOptionsSelector(type: VisibleType): SelectSelector {
    const customGroupKeys = Object.keys(this._sidebarConfig?.custom_groups || {}) || [];
    const { groups = {}, items = {} } = pick(this._sidebarConfig?.visibility_templates || {}, ['groups', 'items']);
    const itemsToUse =
      type === VISIBLE_TYPE.GROUPS
        ? customGroupKeys.filter((key) => key !== 'uncategorized_items')
        : this._panelsWithoutNewItems;

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

  static get styles() {
    return [super.styles, css``];
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'so-panel-visibility': SoPanelVisibility;
  }
}
