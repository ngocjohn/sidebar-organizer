import { CONFIG_AREA_LABELS, PANEL_AREA } from '@constants';
import { mdiPencilBoxMultipleOutline } from '@mdi/js';
import { CustomGroups, PANEL_TYPE, PanelType, SidebarConfig, SidebardPanelConfig } from '@types';
import { createExpansionPanel, ExpandablePanelProps, isMobile } from '@utilities/dom-utils.js';
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
  *::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  *::-webkit-scrollbar-thumb {
    background-color: var(--scrollbar-thumb-color, rgba(0, 0, 0, 0.2));
    border-radius: 4px;
  }
  *::-webkit-scrollbar-thumb:hover {
    background-color: var(--scrollbar-thumb-hover-color, rgba(0, 0, 0, 0.3));
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
    super(PANEL_AREA.ALL_ITEMS);
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
        ...(configToUpdate.bottom_items?.length ? { [PANEL_TYPE.BOTTOM_ITEMS]: configToUpdate.bottom_items } : {}),
        ...(configToUpdate.bottom_grid_items?.length
          ? { [PANEL_TYPE.BOTTOM_GRID_ITEMS]: configToUpdate.bottom_grid_items }
          : {}),
      },
    };
    return html`
      <div class="all-panels-wrapper">
        <so-item-row no-edit ._item=${this._getPanelInfo(getDefaultPanelUrlPath(this.hass))}></so-item-row>
        ${Object.entries(sectionToRender).map(([groupType, groupConfig]) =>
          this._renderSectionGroup(groupType, groupConfig, PANEL_AREA.CUSTOM_GROUPS)
        )}
        ${Object.entries(bottomSectionsToRender).map(([groupType, groupConfig]) =>
          this._renderSectionGroup(groupType, groupConfig, PANEL_AREA.BOTTOM_PANELS)
        )}
        ${uncategorizedItems.length
          ? this._renderSectionGroup(PANEL_TYPE.UNCATEGORIZED_ITEMS, {
              [PANEL_TYPE.UNCATEGORIZED_ITEMS]: uncategorizedItems,
            })
          : nothing}
      </div>
    `;
  }

  private _renderSectionGroup(
    groupType: PanelType | string,
    groupConfig: CustomGroups,
    panelArea?: PanelType | string
  ): TemplateResult {
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
        ${groupType === PANEL_TYPE.UNCATEGORIZED_ITEMS && !this._dialog._uncategorizedIsActive
          ? html` <ha-button size="small" appearance="plain" @click=${this._toggleUncategorizedItemsActive}
              >Set items to grouped</ha-button
            >`
          : html` <ha-button
              size="small"
              variant="neutral"
              appearance="plain"
              @click=${() => this._toggleExpansionPanels(panelArea)}
              >Expand/Collapse All</ha-button
            >`}
      </div>
      <ha-sortable draggable-selector="ha-expansion-panel" .disabled=${isMobile}>
        <section class="group-wrapper">
          ${repeat(
            Object.entries(groupConfig),
            ([groupName]) => groupName,
            ([groupName, items]) => this._renderGroupedRows(groupName, items, panelArea)
          )}
        </section>
      </ha-sortable>
    `;
  }

  private _renderGroupedRows(groupName: string, items: string[], panelArea?: PanelType | string): TemplateResult {
    const isUncategorized = !this._dialog._uncategorizedIsActive && groupName === PANEL_TYPE.UNCATEGORIZED_ITEMS;
    const iconSlot = html` <ha-svg-icon
      slot="icons"
      label="Edit group"
      .path=${mdiPencilBoxMultipleOutline}
      @click=${(ev: Event) => {
        ev.preventDefault();
        fireEvent(this, 'group-action', { action: 'edit-items', key: groupName, type: panelArea });
      }}
    ></ha-svg-icon>`;
    const expansionOptions: ExpandablePanelProps['options'] = {
      ...(panelArea ? { id: panelArea } : {}),
      header: groupName,
      secondary: isUncategorized ? 'Uncategorized' : undefined,
      noStyle: true,
      outlined: false,
      class: `group-data-wrapper ${isUncategorized ? 'uncategorized' : ''}`,
      ...(!isUncategorized ? { iconSlot } : {}),
    };
    const dataPanelHeader = html` <div class="item-row top">
      <div class="cell icon"></div>
      <div class="cell grows">Title</div>
      ${!isMobile
        ? html`
            <div class="cell">URL Path</div>
            <div class="cell">Component name</div>
          `
        : nothing}
      <div class="cell icon"></div>
    </div>`;
    const groupItemsContent = html` ${dataPanelHeader}
    ${repeat(
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

  private _toggleUncategorizedItemsActive = (): void => {
    console.log('Toggling uncategorized items active state. Currently active:', this._dialog._uncategorizedIsActive);
    fireEvent(this, 'group-action', { action: 'uncategorized-as-group', key: PANEL_TYPE.UNCATEGORIZED_ITEMS });
  };

  private _toggleExpansionPanels = (panelArea?: PanelType | string): void => {
    if (!this._expansionPanels.length) return;
    if (panelArea) {
      console.log('Toggling panels for panel area:', panelArea);
      const filteredPanels = Array.from(this._expansionPanels).filter((panel) => panel.id === panelArea);
      if (!filteredPanels.length) return;
      const someExpanded = filteredPanels.some((panel) => panel.hasAttribute('expanded'));
      filteredPanels.forEach((panel) => {
        if (someExpanded) {
          panel.removeAttribute('expanded');
        } else {
          panel.setAttribute('expanded', '');
        }
      });
      return;
    }

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
    return [
      super.styles,
      css`
        *::-webkit-scrollbar {
          width: 4px;
          height: 8px;
        }
        *::-webkit-scrollbar-thumb {
          background-color: var(--scrollbar-thumb-color, rgba(0, 0, 0, 0.2));
          border-radius: 4px;
        }
        *::-webkit-scrollbar-thumb:hover {
          background-color: var(--scrollbar-thumb-hover-color, rgba(0, 0, 0, 0.3));
        }
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
      `,
    ];
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'so-panel-all': SoPanelAll;
  }
}
