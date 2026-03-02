import { ATTRIBUTE } from '@constants';
import { html, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
@customElement('so-group-divider')
export class SoGroupDivider extends LitElement {
  @property({ attribute: false }) public haSidebar: any;
  @property({ attribute: 'group' }) public group: string = '';
  @property({ attribute: 'custom-icon' }) public customIcon!: string;
  @state() public expanded: boolean = false;
  @state() private _observer!: MutationObserver;

  protected createRenderRoot() {
    return this;
  }
  connectedCallback() {
    super.connectedCallback();
  }
  disconnectedCallback() {
    this._observer.disconnect();
    console.log('disconnected', this.group, this._observer);
    super.disconnectedCallback();
  }

  protected firstUpdated(_changedProperties: PropertyValues): void {
    super.firstUpdated(_changedProperties);
    this.expanded = this.haSidebar.alwaysExpand;
    this._observer = new MutationObserver((mutations) => {
      mutations.forEach(({ attributeName }): void => {
        if (attributeName === ATTRIBUTE.EXPANDED) {
          this.expanded = this.haSidebar.alwaysExpand;
        }
      });
    });
    this._observer.observe(this.haSidebar, { attributes: true });
  }

  protected render() {
    return html`
      ${!this.expanded
        ? html` <ha-icon custom .icon=${this.customIcon}> </ha-icon> `
        : html`<ha-icon icon="mdi:chevron-down"></ha-icon><span>${this.group.trim()}</span>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'so-group-divider': SoGroupDivider;
  }
}
