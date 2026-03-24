import { CONFIG_AREA_LABELS, PANEL_AREA } from '@constants';
import { mdiPencilBoxMultipleOutline } from '@mdi/js';
import { CustomGroups, PANEL_TYPE, PanelType, SidebarConfig, SidebardPanelConfig } from '@types';
import { createExpansionPanel, ExpandablePanelProps } from '@utilities/dom-utils.js';
import { fireEvent } from '@utilities/fire_event';
import { getDefaultPanelUrlPath } from '@utilities/panel.js';
import { isEmpty, pick } from 'es-toolkit/compat';
import { html, TemplateResult, css, nothing } from 'lit';
import { customElement, property, queryAll } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import { BaseEditor } from '../../base-editor.js';
const expansionPanelStyles = css`
  :host {
    --ha-card-border-radius: var(--ha-border-radius-md);
    --expansion-panel-content-padding: 0;
  }
  .top {
    background-color: var(--secondary-background-color) !important;
    color: var(--secondary-text-color);
  }
  :host(.uncategorized) .top {
    background-color: transparent !important;
  }
`.toString();

@customElement('so-panel-all')
export class SoPanelAll extends BaseEditor {
  constructor() {
    super();
  }
  @property({ attribute: false }) _sidebarConfig!: SidebarConfig;
  @queryAll('ha-expansion-panel') private _expansionPanels!: HTMLElement[];

  protected firstUpdated(): void {
    this._expansionPanels.forEach((panel) => {
      this._styleManager.addStyle(expansionPanelStyles, panel.shadowRoot!);
    });
  }

  protected render(): TemplateResult {
    const configToUpdate = pick(this._sidebarConfig, [
      PANEL_TYPE.CUSTOM_GROUPS,
      PANEL_TYPE.BOTTOM_ITEMS,
      PANEL_TYPE.BOTTOM_GRID_ITEMS,
    ]) as SidebardPanelConfig;

    const uncategorizedItems = this._dialog._uncategorizedIsActive ? [] : this._dialog.uncategorizedItems;

    const sectionToRender: Record<string, CustomGroups> = {
      [CONFIG_AREA_LABELS[PANEL_AREA.CUSTOM_GROUPS]]: {
        ...(configToUpdate.custom_groups || {}),
      },
    };
    const bottomSectionsToRender: Record<string, CustomGroups> = {
      [CONFIG_AREA_LABELS[PANEL_AREA.BOTTOM_PANELS]]: {
        ...(configToUpdate.bottom_grid_items?.length
          ? { [PANEL_TYPE.BOTTOM_GRID_ITEMS]: configToUpdate.bottom_grid_items }
          : {}),
        ...(configToUpdate.bottom_items?.length ? { [PANEL_TYPE.BOTTOM_ITEMS]: configToUpdate.bottom_items } : {}),
      },
    };
    return html`
      <div class="all-panels-wrapper">
        <so-item-row no-edit ._item=${this._getPanelInfo(getDefaultPanelUrlPath(this.hass))}></so-item-row>
        ${Object.entries(sectionToRender).map(([groupType, groupConfig]) =>
          this._renderSectionGroup(groupType, groupConfig)
        )}
        ${Object.entries(bottomSectionsToRender).map(([groupType, groupConfig]) =>
          this._renderSectionGroup(groupType, groupConfig)
        )}
        ${uncategorizedItems.length
          ? this._renderSectionGroup(PANEL_TYPE.UNCATEGORIZED_ITEMS, {
              [PANEL_TYPE.UNCATEGORIZED_ITEMS]: uncategorizedItems,
            })
          : nothing}
      </div>
    `;
  }
  private _renderSectionGroup(groupType: PanelType | string, groupConfig: CustomGroups): TemplateResult {
    if (
      !groupConfig ||
      (typeof groupConfig === 'object' && isEmpty(groupConfig)) ||
      (Array.isArray(groupConfig) && !groupConfig.length)
    ) {
      return html``;
    }

    return html`
      <wa-divider style="margin: 4px 0; --color: var(--divider-color);"></wa-divider>

      <div class="group-title">
        <div>${CONFIG_AREA_LABELS[groupType] ?? groupType}</div>
        ${groupType === PANEL_TYPE.UNCATEGORIZED_ITEMS
          ? nothing
          : html` <ha-button size="small" variant="neutral" appearance="plain" @click=${this._toggleExpansionPanels}
              >Expand/Collapse All</ha-button
            >`}
      </div>
      <ha-sortable draggable-selector="ha-expansion-panel">
        <section class="group-wrapper">
          ${repeat(
            Object.entries(groupConfig),
            ([groupName]) => groupName,
            ([groupName, items]) => this._renderGroupedRows(groupName, items)
          )}
        </section>
      </ha-sortable>
    `;
  }

  private _renderGroupedRows(groupName: string, items: string[]): TemplateResult {
    const isUncategorized = groupName === PANEL_TYPE.UNCATEGORIZED_ITEMS;
    const expansionOptions: ExpandablePanelProps['options'] = {
      header: groupName,
      secondary: isUncategorized ? 'Uncategorized' : undefined,
      noStyle: true,
      outlined: false,
      class: `group-data-wrapper ${isUncategorized ? 'uncategorized' : ''}`,
      iconSlot: html` <ha-svg-icon
        slot="icons"
        label="Edit group"
        .path=${mdiPencilBoxMultipleOutline}
        @click=${(ev: Event) => {
          ev.preventDefault();
          fireEvent(this, 'group-action', { action: 'edit-items', key: groupName });
        }}
      ></ha-svg-icon>`,
    };

    const groupItemsContent = html` ${repeat(
      items,
      (item) => item,
      (item) => html`<so-item-row ._item=${this._getPanelInfo(item)}></so-item-row>`
    )}`;

    return html`
      ${createExpansionPanel({
        options: expansionOptions,
        content: groupItemsContent,
      })}
    `;
  }
  private _toggleExpansionPanels = (): void => {
    if (!this._expansionPanels.length) return;
    const someExpanded = Array.from(this._expansionPanels).some((panel) => panel.hasAttribute('expanded'));
    this._expansionPanels.forEach((panel) => {
      if (someExpanded) {
        panel.removeAttribute('expanded');
      } else {
        panel.setAttribute('expanded', '');
      }
    });
  };

  static get styles() {
    return css`
      .all-panels-wrapper {
        display: block;
        position: relative;
        max-height: calc(var(--so-content-fullscreen-max-height) - 48px);
        overflow: auto;
        scroll-snap-type: y mandatory;
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
    `;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'so-panel-all': SoPanelAll;
  }
}
