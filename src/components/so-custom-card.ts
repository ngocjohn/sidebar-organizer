import { HomeAssistant, HuiCardElement, LovelaceCardConfig } from '@types';
import { html, LitElement, nothing, PropertyValues, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('so-custom-card')
export class SoCustomCard extends LitElement {
  @property({ attribute: false }) public _hass!: HomeAssistant;
  @property({ attribute: false }) public cardConfig?: LovelaceCardConfig;
  @state() private _huiCardElement?: HuiCardElement;
  @state() private _expanded = false;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this._expanded = this._hass.dockedSidebar === 'docked';
    if (this._huiCardElement) {
      this._huiCardElement.hass = hass;
    }
  }

  get hass(): HomeAssistant {
    return this._hass;
  }

  protected createRenderRoot() {
    return this;
  }

  protected willUpdate(changedProps: PropertyValues): void {
    super.willUpdate(changedProps);

    if (!this._huiCardElement && this.cardConfig && this._hass) {
      const huiCard = this._createHuiCard(this.cardConfig);
      this._huiCardElement = huiCard;
    }
  }

  private _createHuiCard(config?: LovelaceCardConfig): HuiCardElement | undefined {
    if (!config) {
      return;
    }
    const element = document.createElement('hui-card') as HuiCardElement;
    element.config = config;
    element.hass = this.hass;
    element.load();
    return element;
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.cardConfig || !this.hass) {
      return nothing;
    }

    return this._expanded ? html`${this._huiCardElement}` : nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'so-custom-card': SoCustomCard;
  }
}
