import { NewItemConfig, NewItemConfigKeys } from '@types';
import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

const columnLabels: Record<NewItemConfigKeys | string, string> = {
  title: 'Title',
  url_path: 'URL Path',
  component_name: 'Component Name',
  group: 'Group',
  show_in_sidebar: 'Hidden',
  notification: 'Notification',
};

@customElement('so-data-item-table')
export class SoDataItemTable extends LitElement {
  @property({ type: Array }) public items: NewItemConfig[] = [];
  @property({ attribute: false }) public columns: NewItemConfigKeys[] = [];
  @property({ attribute: false }) public itemActionRenderer?: (item: NewItemConfig) => unknown;

  @property({ type: Boolean, attribute: 'hide-header' }) public hideHeader = false;
  @property({ type: Boolean, reflect: true }) public narrow = false;

  protected createRenderRoot() {
    return this;
  }

  protected render() {
    const headers = html`
      <div class="item-row top">
        <div class="cell icon"></div>
        <div class="cell grows">${columnLabels['title']}</div>
        ${this.columns.length > 0 && !this.narrow
          ? this.columns.map(
              (col) =>
                html`<div class="cell" ?square=${['show_in_sidebar', 'notification'].includes(col)}>
                  ${columnLabels[col] || col}
                </div>`
            )
          : nothing}
        <div class="cell icon"></div>
      </div>
    `;
    return html` <div class="data-table">
      ${!this.hideHeader ? headers : nothing}
      ${this.items.map((item) => {
        const showInSidebar = item.show_in_sidebar === false ? html`<ha-icon icon="mdi:eye-off"></ha-icon>` : nothing;
        const hasNotification = item.notification ? html`<ha-icon icon="mdi:check"></ha-icon>` : nothing;
        return html`
          <div class="item-row">
            <div class="cell icon">
              <ha-icon icon=${item.icon ?? 'mdi:help-circle-outline'}></ha-icon>
            </div>
            <div class="cell grows">${item.title}</div>
            ${this.columns.length > 0 && !this.narrow
              ? this.columns.map(
                  (col) =>
                    html`<div class="cell" ?square=${['show_in_sidebar', 'notification'].includes(col)}>
                      ${col === 'show_in_sidebar'
                        ? showInSidebar
                        : col === 'notification'
                          ? hasNotification
                          : ((item[col] ?? '-') as string)}
                    </div>`
                )
              : nothing}
            <div class="cell icon">${this.itemActionRenderer ? this.itemActionRenderer(item) : nothing}</div>
          </div>
        `;
      })}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'so-data-item-table': SoDataItemTable;
  }
}
