import {
  ATTRIBUTE,
  CONFIG_AREA_LABELS,
  CONFIG_SECTION,
  PANEL_AREA,
  PanelArea,
  PanelAreaKeys,
  STORAGE,
} from '@constants';
import { mdiDrag } from '@mdi/js';
import {
  CustomGroups,
  NewItemConfig,
  NewItemConfigKeys,
  PANEL_TYPE,
  PanelType,
  SidebarConfig,
  SidebardPanelConfig,
} from '@types';
import { _renderActionItem, ActionType, computeActionList } from '@utilities/action-menu';
import { createExpansionPanel, ExpandablePanelProps, isMobile, stopPropagation } from '@utilities/dom-utils.js';
import { fireEvent } from '@utilities/fire_event';
import { isEmpty, pick } from 'es-toolkit/compat';
import { html, TemplateResult, css, nothing, PropertyValues } from 'lit';
import { customElement, property, queryAll } from 'lit/decorators.js';

import './so-data-item-table';
import { BaseEditor } from '../../base-editor.js';

const expansionPanelStyles = css`
  :host {
    --ha-card-border-radius: var(--ha-border-radius-md);
    --expansion-panel-content-padding: 0;
  }
  :host .top {
    background-color: var(--secondary-background-color) !important;
    color: var(--secondary-text-color);
  }
  :host(.uncategorized) .top {
    background-color: transparent !important;
    border: 0.5px solid var(--divider-color);
  }
`.toString();

interface TableGroupedData {
  items: string[];
  columns?: NewItemConfigKeys[];
  itemActionRenderer?: (item: NewItemConfig) => unknown;
}

type TableExpansionParams = {
  data: TableGroupedData;
  expansionOptions?: ExpandablePanelProps['options'];
};

@customElement('so-panel-all')
export class SoPanelAll extends BaseEditor {
  constructor() {
    super(PANEL_AREA.ALL_ITEMS);
    window.SoPanelAll = this;
  }

  @property({ attribute: false }) _sidebarConfig!: SidebarConfig;
  @queryAll('ha-expansion-panel') private _expansionPanels!: HTMLElement[];

  @property({ attribute: false }) private _showByGroup = false;

  public connectedCallback(): void {
    super.connectedCallback();
    this._showByGroup = window.localStorage.getItem(STORAGE.SHOW_BY_GROUP) === 'true';
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    if (changedProps.has('_showByGroup') || changedProps.has('_sidebarConfig')) {
      this._expansionPanels.forEach((panel) => {
        this._styleManager.addStyle(expansionPanelStyles, panel.shadowRoot!);
      });
    }
  }

  protected render(): TemplateResult {
    return html`
      <div class="all-panels-wrapper">
        <div class="group-title">
          <div></div>
          <ha-dropdown @wa-select=${this._handleGroupByPanelType}>
            <ha-button with-caret size="small" slot="trigger" appearance="outline"
              >Display by: ${this._showByGroup ? 'Groups' : 'Type'}</ha-button
            >
            <ha-dropdown-item .value=${'groups'} ?selected=${this._showByGroup}>Groups</ha-dropdown-item>
            <ha-dropdown-item .value=${'type'} ?selected=${!this._showByGroup}>Type</ha-dropdown-item>
            <wa-divider></wa-divider>
            <ha-dropdown-item @click=${() => this._toggleExpansionPanels()}>Expand/Collapse All</ha-dropdown-item>
          </ha-dropdown>
        </div>
        ${!this._showByGroup ? this._renderPanelsByType() : this._renderByGroupType()}
      </div>
    `;
  }

  private _renderPanelsByType(): TemplateResult {
    const newItems = this._dialog._newItems;
    const panelsWithoutNewItems = this._dialog._initCombiPanels.filter((panel) => !newItems.includes(panel));

    const systemPanelData = {
      data: {
        items: panelsWithoutNewItems,
        columns: ['url_path', 'group', 'notification', 'show_in_sidebar'] as NewItemConfigKeys[],
      },
      expansionOptions: this._computeExpansionOptions({ id: 'system-panels', header: 'System Panels' }),
    };

    return html`
      ${this._renderTableGrouped(systemPanelData)}
      ${newItems.length > 0
        ? this._renderTableGrouped({
            data: { items: newItems, columns: ['group', 'notification'] },
            expansionOptions: this._computeExpansionOptions({
              id: 'new-items',
              header: 'User Created',
              iconSlot: html`<ha-button
                size="small"
                variant="brand"
                appearance="filled"
                slot="icons"
                @click=${() => fireEvent(this, 'navigate-section', { section: CONFIG_SECTION.NEW_ITEMS })}
                >Edit items</ha-button
              >`,
            }),
          })
        : nothing}
    `;
  }

  private _computeGroupData(
    section: PanelArea | string,
    groupName: string,
    groupConfig: CustomGroups | string[],
    itemActionRenderer?: (item: NewItemConfig) => unknown,
    columns?: NewItemConfigKeys[],
    iconSlot?: TemplateResult
  ): TableExpansionParams | null {
    if (
      !groupConfig ||
      (typeof groupConfig === 'object' && isEmpty(groupConfig)) ||
      (Array.isArray(groupConfig) && !groupConfig.length)
    ) {
      return null;
    }

    if (!iconSlot && PanelAreaKeys.includes(section as PanelArea)) {
      iconSlot = this._renderGroupActionDropdown(section, groupName);
    }

    const items = Array.isArray(groupConfig) ? groupConfig : Object.values(groupConfig).flat();
    return {
      data: {
        items,
        columns,
        itemActionRenderer,
      },
      expansionOptions: this._computeExpansionOptions({
        id: section,
        header: groupName,
        iconSlot,
        class: groupName === PANEL_TYPE.UNCATEGORIZED_ITEMS ? 'uncategorized' : undefined,
      }),
    };
  }

  private _renderGroupActionDropdown = (section: PanelArea | string, groupName: string): TemplateResult => {
    let dropdownActions: ActionType[] = ['edit-items', 'preview-item'];
    if (section === PANEL_AREA.CUSTOM_GROUPS && groupName !== PANEL_TYPE.UNCATEGORIZED_ITEMS) {
      dropdownActions.push('divider', 'delete');
    } else if (groupName === PANEL_TYPE.UNCATEGORIZED_ITEMS) {
      dropdownActions.push('divider', 'uncategorized-as-group');
    }

    const actionsToShow = computeActionList(dropdownActions);
    return html`
      <ha-dropdown
        slot="icons"
        @click=${stopPropagation}
        @wa-select=${this._handleActionGroupClick}
        .section=${section}
        .groupName=${groupName}
      >
        <ha-button size="small" variant="neutral" appearance="filled" with-caret slot="trigger">more</ha-button>
        ${actionsToShow.map((item) =>
          _renderActionItem({ item, option: { groupName, section, checked: this._dialog._uncategorizedIsActive } })
        )}
      </ha-dropdown>
    `;
  };

  private _renderByGroupType(): TemplateResult {
    const {
      custom_groups = {},
      bottom_items = [],
      bottom_grid_items = [],
    } = pick(this._sidebarConfig, [
      PANEL_TYPE.CUSTOM_GROUPS,
      PANEL_TYPE.BOTTOM_ITEMS,
      PANEL_TYPE.BOTTOM_GRID_ITEMS,
    ]) as SidebardPanelConfig;

    const uncategorizedItems = this._dialog._uncategorizedIsActive ? [] : this._dialog.uncategorizedItems;

    const customGroupsData = Object.entries(custom_groups)
      .map(([groupName, groupConfig]) => this._computeGroupData(PANEL_AREA.CUSTOM_GROUPS, groupName, groupConfig))
      .filter(Boolean);

    const bottomItemsData = [
      bottom_items.length
        ? this._computeGroupData(PANEL_AREA.BOTTOM_PANELS, PANEL_TYPE.BOTTOM_ITEMS, bottom_items)
        : null,
      bottom_grid_items.length
        ? this._computeGroupData(PANEL_AREA.BOTTOM_PANELS, PANEL_TYPE.BOTTOM_GRID_ITEMS, bottom_grid_items)
        : null,
    ].filter(Boolean);

    const uncategorizedGroupData = uncategorizedItems.length
      ? this._computeGroupData(PANEL_TYPE.UNCATEGORIZED_ITEMS, PANEL_TYPE.UNCATEGORIZED_ITEMS, uncategorizedItems)
      : null;

    return html`
      ${this._renderGroupSection(PANEL_AREA.CUSTOM_GROUPS, customGroupsData, true)}
      ${uncategorizedGroupData
        ? this._renderSectionContent(PANEL_TYPE.UNCATEGORIZED_ITEMS, this._renderTableGrouped(uncategorizedGroupData), {
            label: 'Set items to grouped',
            onClick: this._toggleUncategorizedItemsActive,
            hightLight: true,
          })
        : nothing}
      ${this._renderGroupSection(PANEL_AREA.BOTTOM_PANELS, bottomItemsData, false, false)}
    `;
  }

  private _renderGroupSection(
    section: PANEL_AREA,
    groups: any[],
    showHeader = true,
    withDivider = true
  ): TemplateResult | typeof nothing {
    if (!groups.length) return nothing;

    return this._renderSectionContent(
      section,
      html`${groups.map((groupData) => this._renderTableGrouped(groupData, showHeader))}`,
      undefined,
      withDivider
    );
  }

  private _renderSectionContent(
    sectionName: PanelType | string,
    content: TemplateResult,
    headerActionButton?: { label: string; onClick: () => void; hightLight?: boolean },
    sortable = true
  ): TemplateResult {
    if (!headerActionButton && PanelAreaKeys.includes(sectionName as PanelArea)) {
      headerActionButton = {
        label: 'Expand/Collapse All',
        onClick: () => this._toggleExpansionPanels(sectionName),
      };
    }
    return html`
      <div class="group-title">
        <div>${CONFIG_AREA_LABELS[sectionName] ?? sectionName}</div>
        ${headerActionButton
          ? html`<ha-button
              size="small"
              variant=${headerActionButton.hightLight ? 'brand' : 'neutral'}
              appearance="plain"
              @click=${headerActionButton.onClick}
              >${headerActionButton.label}</ha-button
            >`
          : nothing}
      </div>
      <ha-sortable handle-selector=".sortable-table" .disabled=${isMobile || !sortable}>
        <section class="group-wrapper">${content}</section>
      </ha-sortable>
    `;
  }

  private _renderTableGrouped(probs: TableExpansionParams, sortable = false): TemplateResult {
    const columnsToShow = probs.data.columns ?? ['url_path', 'component_name'];
    const tableContent = html` <so-data-item-table
      .items=${this._computePanelInfoList(probs.data.items)}
      .columns=${columnsToShow}
      .narrow=${this.narrow}
      .itemActionRenderer=${probs.data.itemActionRenderer}
    ></so-data-item-table>`;
    const expansionContent = probs.expansionOptions
      ? createExpansionPanel({
          options: probs.expansionOptions,
          content: tableContent,
        })
      : tableContent;
    const sortableDiv = html`
      <div class="sortable-table">
        <ha-icon-button class="drag-handle" .path=${mdiDrag} title="Drag to reorder"></ha-icon-button>
        ${expansionContent}
      </div>
    `;
    return probs.expansionOptions ? (sortable ? sortableDiv : expansionContent) : tableContent;
  }

  private _computeExpansionOptions = (options: {
    id?: string;
    header: string;
    secondary?: string;
    class?: string;
    iconSlot?: TemplateResult;
  }): ExpandablePanelProps['options'] => {
    return {
      ...options,
      noStyle: true,
      outlined: false,
      class: `group-data-wrapper ${options.class ?? ''}`,
    };
  };

  private _handleActionGroupClick(ev: CustomEvent): void {
    ev.stopPropagation();
    if (!ev.detail || typeof (ev.detail as any).item?.value === 'undefined') {
      return;
    }
    const { section, groupName } = ev.target as any;
    const action = (ev.detail as any).item.value;
    console.log('Group action clicked:', action, 'for group:', groupName, 'in section:', section);
    // Handle the action accordingly, e.g., fire an event or call a method
    fireEvent(this, 'group-action', { action, key: groupName, type: section });
  }

  private _toggleUncategorizedItemsActive = (): void => {
    console.log('Toggling uncategorized items active state. Currently active:', this._dialog._uncategorizedIsActive);
    fireEvent(this, 'group-action', { action: 'uncategorized-as-group', key: PANEL_TYPE.UNCATEGORIZED_ITEMS });
  };

  private _toggleExpansionPanels(panelArea?: PanelType | string): void {
    if (!this._expansionPanels.length) return;
    let sectionToToggle = Array.from(this._expansionPanels);
    if (panelArea) {
      sectionToToggle = Array.from(this._expansionPanels).filter((panel) => panel.id === panelArea);
    }

    const someExpanded = sectionToToggle.some((panel) => panel.hasAttribute(ATTRIBUTE.EXPANDED));
    sectionToToggle.forEach((panel) => {
      if (someExpanded) {
        panel.removeAttribute(ATTRIBUTE.EXPANDED);
      } else {
        panel.setAttribute(ATTRIBUTE.EXPANDED, '');
      }
    });
  }

  private _handleGroupByPanelType(ev: CustomEvent): void {
    ev.stopPropagation();
    if (!ev.detail || typeof (ev.detail as any).item?.value === 'undefined') {
      return;
    }
    const value = (ev.detail as any).item.value;
    this._showByGroup = value === 'groups';
    window.localStorage.setItem(STORAGE.SHOW_BY_GROUP, String(this._showByGroup));
  }

  static get styles() {
    return [
      super.styles,
      css`
        *::-webkit-scrollbar {
          width: 0.2em;
          height: 0.2em;
        }
        *::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
        }
        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
        }

        .all-panels-wrapper {
          display: block;
          position: relative;
          max-height: calc(var(--so-content-fullscreen-max-height) - 48px);
          overflow: auto;
        }
        .group-title {
          scroll-snap-align: start;
          position: sticky;
          top: 0;
          z-index: 1;
          background-color: var(--mdc-theme-surface);
          display: flex;
          align-items: center;
          height: 40px;
          flex-direction: row;
          padding-bottom: var(--side-dialog-gutter);
        }
        .group-title div {
          font-size: var(--ha-font-size-l);
          margin-inline-start: var(--ha-space-2);
          line-height: var(--ha-line-height-normal);
          color: var(--secondary-text-color);
          flex-grow: 1;
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
          min-width: 0;
        }
        .group-wrapper {
          overflow: auto;
          max-height: calc(var(--so-content-fullscreen-max-height) - 48px);
          scroll-snap-type: y mandatory;
        }
        .group-data-wrapper {
          scroll-snap-align: start;
          margin-bottom: var(--side-dialog-gutter);
        }
        .group-data-wrapper .uncategorized {
          background-color: var(--disabled-background-color);
        }
        .group-data-wrapper so-item-row:not(:first-child) > .item-row {
          border-top: 0.5px solid var(--divider-color);
        }
        .sortable-table {
          display: flex;
          flex-direction: row;
          width: 100%;
          align-items: center;
          margin-bottom: var(--side-dialog-gutter);
        }
        .sortable-table .drag-handle {
          align-self: start;
          cursor: grab;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sortable-table .group-data-wrapper {
          width: 100%;
          margin-bottom: 0;
        }
      `,
    ];
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'so-panel-all': SoPanelAll;
  }
}
