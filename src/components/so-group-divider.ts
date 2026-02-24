import { html, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
@customElement('so-group-divider')
export class SoGroupDivider extends LitElement {
  @property({ attribute: false }) public haSidebar: any;
  @property({ attribute: 'group' }) public group: string = '';
  @property({ attribute: 'custom-icon' }) public customIcon!: string;
  @state() public expanded: boolean = false;

  protected createRenderRoot() {
    return this;
  }
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('hass-toggle-menu', this._handleToggleMenu.bind(this));
  }
  disconnectedCallback() {
    window.removeEventListener('hass-toggle-menu', this._handleToggleMenu.bind(this));
    super.disconnectedCallback();
  }

  private async _handleToggleMenu() {
    await new Promise((resolve) => setTimeout(resolve, 50));
    this.expanded = this.haSidebar.alwaysExpand;
  }
  protected firstUpdated(_changedProperties: PropertyValues): void {
    super.firstUpdated(_changedProperties);
    this.expanded = this.haSidebar.alwaysExpand;
  }
  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);
    if (changedProperties.has('haSidebar')) {
      this.expanded = this.haSidebar.alwaysExpand;
    }
  }
  protected render() {
    return html`
      ${!this.expanded
        ? html` <ha-icon ?custom=${true} .icon=${this.customIcon}> </ha-icon> `
        : html`<ha-icon icon="mdi:chevron-down"></ha-icon><span>${this.group.trim()}</span>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'so-group-divider': SoGroupDivider;
  }
}
