import { SidebarConfig, LovelaceCardConfig, LovelaceConfig } from '@types';
import { loadCardPicker } from '@utilities/loader';
import { BaseEditor } from 'components/base-editor';
import {
  CardSectionArrangementKeys,
  CardSectionArrangementType,
  CONFIG_SECTION,
  CUSTOM_CARD_SECTION,
  CustomCardSection,
} from 'constants/config-area';
import { html, TemplateResult, CSSResultGroup, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface ElementEditorConfig {
  section: CustomCardSection;
  arrangement: CardSectionArrangementType;
  cardConfig?: LovelaceCardConfig;
}
@customElement('sidebar-dialog-custom-cards')
export class SidebarDialogCustomCards extends BaseEditor {
  constructor() {
    super(CONFIG_SECTION.CUSTOM_CARDS);
    window.SoDialogCustomCards = this;
  }
  public connectedCallback(): void {
    super.connectedCallback();
    console.debug('SidebarDialogCustomCards connected to the DOM');
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    console.debug('SidebarDialogCustomCards disconnected from the DOM');
  }
  @property({ attribute: false }) _sidebarConfig!: SidebarConfig;
  @state() private _elementEditorConfig?: ElementEditorConfig;

  @state() private _lovelace?: LovelaceConfig;
  @state() private _huiCardPicker?: any;

  protected willUpdate(changedProps: PropertyValues): void {
    super.willUpdate(changedProps);
    if (changedProps.has('_sidebarConfig') && this._sidebarConfig?.custom_cards) {
      console.debug('Sidebar config updated, loading Lovelace config for custom cards');
      const cards = Object.values(this._sidebarConfig.custom_cards)
        .flatMap((arrangement) => Object.values(arrangement))
        .flat() as LovelaceCardConfig[];
      this._lovelace = {
        views: [
          {
            cards,
          },
        ],
      };
    }
  }

  protected async firstUpdated(_changedProperties: PropertyValues): Promise<void> {
    super.firstUpdated(_changedProperties);
    if (this._lovelace) {
      console.debug('First updated, loading card picker with Lovelace config:', this._lovelace);
      this._huiCardPicker = await loadCardPicker(this.hass, this._lovelace);
      this._huiCardPicker.hass = this.hass;
      this._huiCardPicker.lovelace = this._lovelace;
      console.debug('Card picker loaded:', this._huiCardPicker);
    }
  }
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }
  protected render(): TemplateResult {
    if (this._elementEditorConfig) {
      return this._renderElementEditor();
    }

    const customCardsOptions = {
      [CUSTOM_CARD_SECTION.TOP_CONTAINER]: {
        label: 'Top Container',
        description: 'Choose which cards to add to the top container of the sidebar',
        options: [...CardSectionArrangementKeys],
      },
      [CUSTOM_CARD_SECTION.BOTTOM_CONTAINER]: {
        label: 'Bottom Container',
        description: 'Choose which cards to add to the bottom container of the sidebar',
        options: [...CardSectionArrangementKeys],
      },
    };

    return html`
      <div class="options-container">
        ${Object.entries(customCardsOptions).map(
          ([sectionKey, { label, description, options }]) => html`
            <div class="option-group">
              <h3>${label}</h3>
              <p>${description}</p>
              ${options.map(
                (option) => html`
                  <ha-button
                    size="small"
                    @click=${() =>
                      this._openElementEditor(sectionKey as CustomCardSection, option as CardSectionArrangementType)}
                  >
                    ${option.replace('_', ' ')}
                  </ha-button>
                `
              )}
            </div>
          `
        )}
      </div>
    `;
  }

  private _renderElementEditor(): TemplateResult {
    if (!this._elementEditorConfig) {
      return html`<p>Error: No element editor config found.</p>`;
    }
    return html`
      <ha-button @click=${() => this._closeElementEditor()}>Back</ha-button>
      <hui-card-element-editor
        .hass=${this.hass}
        .lovelace=${this._lovelace}
        .value=${this._elementEditorConfig.cardConfig}
      ></hui-card-element-editor>
    `;
  }

  private _openElementEditor(section: CustomCardSection, arrangement: CardSectionArrangementType) {
    const cardConfig = this._sidebarConfig?.custom_cards?.[section]?.[arrangement] || [];
    const verticalStackConfig = this._cumputeVerticalStackConfig(cardConfig);
    this._elementEditorConfig = { section, arrangement, cardConfig: verticalStackConfig };
    console.debug('Opening element editor with config:', this._elementEditorConfig);
  }

  private _closeElementEditor() {
    this._elementEditorConfig = undefined;
  }

  private _cumputeVerticalStackConfig(cards: LovelaceCardConfig[]) {
    return {
      type: 'vertical-stack',
      cards: cards,
    };
  }

  static get styles(): CSSResultGroup {
    return css`
      .options-container {
        display: flex;
        flex-direction: column;
        gap: 1em;
      }
      .option-group {
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        padding: 8px;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-dialog-custom-cards': SidebarDialogCustomCards;
  }
}
