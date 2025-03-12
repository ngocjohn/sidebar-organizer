import iro from '@jaames/iro';
import { mdiRefresh } from '@mdi/js';
import { html, css, LitElement, TemplateResult, PropertyValues, CSSResultGroup, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators';
import { styleMap } from 'lit/directives/style-map.js';
import tinycolor from 'tinycolor2';

import { COLOR_CONFIG_KEYS, PREVIEW_MOCK_PANELS } from '../const';
import { applyTheme, getDefaultThemeColors } from '../helpers';
import { DividerColorSettings, HaExtened, PanelInfo, SidebarConfig } from '../types';
import { convertPreviewCustomStyles, createExpansionPanel } from '../utils';
import { SidebarConfigDialog } from './sidebar-dialog';

enum THEME_STATE {
  LOADING = 1,
  READY = 2,
  ERROR = 3,
}

@customElement('sidebar-dialog-colors')
export class SidebarDialogColors extends LitElement {
  @property({ attribute: false }) hass!: HaExtened['hass'];
  @property({ attribute: false }) _dialog!: SidebarConfigDialog;
  @property({ attribute: false }) _sidebarConfig!: SidebarConfig;

  @state() private _colorConfigMode: string = '';
  @state() private _picker: iro.ColorPicker | null = null;
  @state() private _currentConfigValue: string | undefined;
  @state() private _baseColorFromTheme: DividerColorSettings = {};

  @state() private _state: THEME_STATE = THEME_STATE.LOADING;

  private _colorHelper: tinycolor = tinycolor;
  private _initColor: string = '';
  @state() private _initCustomStyles: Array<Record<string, string>> = [];
  @state() private _yamlEditor: any;

  connectedCallback(): void {
    super.connectedCallback();
  }

  protected firstUpdated(_changedProperties: PropertyValues): void {
    super.firstUpdated(_changedProperties);
    const colorMode = this.hass.themes.darkMode ? 'dark' : 'light';
    // console.log('colorMode', colorMode);
    this._colorConfigMode = colorMode;
    setTimeout(() => {
      const yamlEditor = this.shadowRoot?.querySelector('ha-yaml-editor');
      if (yamlEditor) {
        this._yamlEditor = yamlEditor;
        console.log('yamlEditor', this._yamlEditor);
      }
    }, 0);
  }

  protected shouldUpdate(_changedProperties: PropertyValues): boolean {
    if (_changedProperties.has('_sidebarConfig') && this._sidebarConfig) {
      return true;
    }
    if (_changedProperties.has('_colorConfigMode') && this._colorConfigMode) {
      this._setTheme(this._colorConfigMode);
      this._initCustomStyles = this._sidebarConfig.color_config?.[this._colorConfigMode]?.custom_styles || [];
      // console.log('initCustomStyles', this._initCustomStyles);
      return true;
    }

    if (_changedProperties.has('_dialog') && this._dialog._paperListbox) {
      return true;
    }

    if (_changedProperties.has('_yamlEditor') && this._yamlEditor !== undefined) {
      this._yamlEditor._codeEditor.linewrap = true;
      const cardActions = this._yamlEditor.shadowRoot?.querySelector('.card-actions');
      const actionStyles = {
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        padding: '0',
        border: 'none',
      };
      if (cardActions) {
        Object.assign(cardActions.style, actionStyles);
      }
      return true;
    }

    return true;
  }

  protected updated(_changedProperties: PropertyValues): void {
    super.updated(_changedProperties);
    if (_changedProperties.has('_currentConfigValue') && this._currentConfigValue !== undefined) {
      setTimeout(() => {
        this._initColorPicker();
      }, 50);
    } else if (_changedProperties.has('_currentConfigValue') && this._currentConfigValue === undefined) {
      this._destroyColorPicker();
    }
  }

  private _getDefaultColors(): void {
    const previewEl = this.shadowRoot?.getElementById('theme-container');
    if (!previewEl) return;
    const defaultColors = getDefaultThemeColors(previewEl);
    this._baseColorFromTheme = defaultColors;
  }

  private _destroyColorPicker(): void {
    this._picker = null;
    const pickerWrapper = this.shadowRoot?.querySelector('.picker-wrapper') as HTMLElement;
    const pickerEl = this.shadowRoot?.getElementById('picker');
    if (pickerWrapper && pickerEl) {
      pickerWrapper.setAttribute('hidden', '');
      pickerEl.innerHTML = '';
    }
  }

  private _initColorPicker(): void {
    const isColorActive = this._currentConfigValue !== undefined;
    const pickerWrapper = this.shadowRoot?.querySelector('.picker-wrapper') as HTMLElement;
    const pickerContainer = this.shadowRoot?.getElementById('picker');
    if (!pickerWrapper || !pickerContainer) return;
    pickerWrapper.toggleAttribute('hidden', !isColorActive);
    const colorMode = this._colorConfigMode;
    const color_config = this._sidebarConfig.color_config?.[colorMode] || {};
    const configValue = this._currentConfigValue as string;
    const colorValue = color_config[configValue] || this._baseColorFromTheme[configValue];
    console.log('color mode: ' + colorMode, 'configValue', configValue, 'colorValue', colorValue);

    const colorObj = tinycolor(colorValue);
    const colorType = colorObj.getFormat();
    const colorInitValue = colorType === 'hex' ? colorObj.toHex8String() : colorObj.toRgbString();

    this._initColor = color_config[configValue] ?? undefined;

    this._picker = iro.ColorPicker(pickerContainer, {
      width: 150,
      color: colorInitValue,
      borderWidth: 1,
      borderColor: '#fff',
      layoutDirection: 'horizontal',
      layout: [
        { component: iro.ui.Wheel, options: {} },
        {
          component: iro.ui.Slider,
          options: {
            sliderType: 'hue',
          },
        },
        {
          component: iro.ui.Slider,
          options: {
            sliderType: 'saturation',
          },
        },
        {
          component: iro.ui.Slider,
          options: {
            sliderType: 'value',
          },
        },
        {
          component: iro.ui.Slider,
          options: {
            sliderType: 'alpha',
          },
        },
      ],
    });

    this._picker.on(['color:init', 'color:change'], (color: any) => {
      this._currentConfigValue = configValue;
      const initColor = this._picker?.props.color as string;
      const changedColor = tinycolor(initColor);
      const colorType = changedColor.getFormat();
      const updateColor = colorType === 'hex' ? color.hex8String : color.rgbaString;
      this._handleConfigChange(this._currentConfigValue, updateColor);
    });
  }

  private _handleConfigChange(configValue: string, colorValue: string) {
    const colorMode = this._colorConfigMode;
    const colorConfig = { ...(this._sidebarConfig.color_config || {}) };
    const currentModeConfig = { ...(colorConfig[colorMode] || {}) };
    currentModeConfig[configValue] = colorValue;
    this._sidebarConfig = {
      ...this._sidebarConfig,
      color_config: {
        ...colorConfig,
        [colorMode]: currentModeConfig,
      },
    };
    this._dispatchConfig(this._sidebarConfig);
  }

  private get singleMode(): boolean {
    let singleMode: boolean = false;
    const selectedTheme = this.hass.themes.theme;
    if ((selectedTheme && selectedTheme === 'default') || selectedTheme === '') {
      singleMode = true;
    } else {
      const themeObj = this.hass.themes.themes[selectedTheme];
      const modes = themeObj.modes;
      if (!modes || typeof modes !== 'object') {
        singleMode = true;
      } else if (Object.keys(modes).length === 1) {
        singleMode = true;
      }
    }
    return singleMode;
  }

  /* --------------------------- THEME CONFIGURATION -------------------------- */
  private _setTheme(mode: string): void {
    const theme = this.hass.themes.theme;
    const themeContainer = this.shadowRoot?.getElementById('theme-container');
    applyTheme(themeContainer, this.hass, theme, mode);
    setTimeout(() => {
      this._getDefaultColors();
    }, 0);
  }

  protected render() {
    return html`
      <div id="theme-container"></div>
      <div id="color-preview-container">
        <div class="color-container">${this._renderHeaderConfigFields()} ${this._renderColorConfigFields()}</div>
        <div class="preview-container">${this._renderPreview()}</div>
      </div>
    `;
  }

  private _renderBorderRadiusField() {
    return html`
      <div class="color-item">
        <div class="header-row">
          <ha-icon
            ?hidden=${this._sidebarConfig?.color_config?.border_radius === undefined}
            icon="mdi:refresh"
            @click=${() => this._resetColorConfig('border_radius')}
          ></ha-icon>
          ${this._createPicker({
            label: 'Border Radius (px)',
            value: this._sidebarConfig?.color_config?.border_radius || '',
            placeHolder: 0,
            configValue: 'border_radius',
            pickerType: 'border_radius' as 'border_radius',
            modeConfig: 'light',
          })}
        </div>
      </div>
    `;
  }

  private _renderHeaderConfigFields(): TemplateResult {
    const headerTitle = this._sidebarConfig?.header_title ?? '';
    const headerToggle = this._sidebarConfig?.hide_header_toggle ?? false;

    const headerConfig = [
      {
        value: headerTitle,
        configValue: 'header_title',
        label: 'Header Title',
        placeholder: 'Sidebar Organizer',
        pickerType: 'text' as 'text',
      },
      {
        value: headerToggle,
        label: 'Hide Header Toggle',
        configValue: 'hide_header_toggle',
        pickerType: 'boolean' as 'boolean',
      },
    ];

    const content = html`
      <div class="config-colors header">${headerConfig.map((item) => this._createPicker(item))}</div>
    `;

    return createExpansionPanel({
      content,
      options: {
        expanded: true,
        header: 'Header Configuration',
        icon: 'mdi:format-text',
        secondary: 'Customize the header of the sidebar',
      },
    });
  }

  private _renderColorConfigFields(): TemplateResult {
    const configKeySelected = this._currentConfigValue !== undefined;
    const colorSelector = html`
      <ha-control-select
        .value=${this._colorConfigMode}
        .options=${[
          { value: 'light', label: 'Light Mode' },
          { value: 'dark', label: 'Dark Mode' },
        ]}
        @value-changed=${(ev: CustomEvent) => {
          this._colorConfigMode = ev.detail.value;
        }}
        ?hidden=${this.singleMode}
      ></ha-control-select>
    `;
    const headerInfo = html`<div class="header-row" ?hidden=${configKeySelected}>
      <div class="title">Theme: ${this.hass.themes.theme}</div>
      <ha-button @click=${() => this._resetColorConfig('currentMode')}>RESET ALL</ha-button>
    </div> `;

    const pickerActive = html` <div class="header-row">
      <ha-button @click=${() => this._picker?.color.reset()}>Reset</ha-button>
      <ha-button @click=${() => this._handleColorPicker('cancel')}>Cancel</ha-button>
      <ha-button @click=${() => this._handleColorPicker('save')}>Save</ha-button>
    </div>`;

    const content = html`
      ${colorSelector} ${headerInfo}

      <div class="config-colors">
        ${COLOR_CONFIG_KEYS.map((item) => this._renderDividerColor(item.value, item.label))}
        ${this._renderBorderRadiusField()} ${this._renderCustomStylesField()}
      </div>
      <div class="picker-wrapper" hidden>
        <div id="picker"></div>
        ${pickerActive}
      </div>
    `;

    return createExpansionPanel({
      content,
      options: {
        expanded: false,
        header: 'Color Configuration',
        icon: 'mdi:palette',
        secondary: 'Customize the colors of the sidebar',
      },
    });
  }

  private _handleColorPicker(action: string) {
    const currentColor = this._picker?.color;
    if (!currentColor) return;
    const currentConfigValue = this._currentConfigValue as string;
    switch (action) {
      case 'cancel':
        const initColor = this._initColor;
        this._toggleColorPicker(currentConfigValue);
        this._handleConfigChange(currentConfigValue, initColor);
        this._initColor = '';
        break;
      case 'save':
        this._toggleColorPicker(currentConfigValue);
        this._initColor = '';
        break;
      case 'hex':
        const hexColor = currentColor.hex8String;
        this._handleConfigChange(currentConfigValue, hexColor);
        this._picker?.color.set(hexColor);
        console.log('hexColor', hexColor);
        break;
      case 'rgb':
        const rgbColor = currentColor.rgbaString;
        this._picker?.color.set(rgbColor);
        this._handleConfigChange(currentConfigValue, rgbColor);
        console.log('hexColor', rgbColor);
        break;
    }
  }

  private _renderDividerColor(configValue: string, label: string): TemplateResult {
    if (!this._sidebarConfig) return html``;

    const mode = this._colorConfigMode as 'light' | 'dark';
    const colorSettings = this._sidebarConfig?.color_config || {};
    const colorModeConfig = colorSettings[mode] || {};
    const baseColorFromTheme = this._baseColorFromTheme;

    const baseValue = colorModeConfig[configValue] ?? baseColorFromTheme[configValue];
    const value = colorModeConfig[configValue] || '';
    const isDefault =
      colorModeConfig[configValue] === undefined || colorModeConfig[configValue] === baseColorFromTheme[configValue];

    // Function to determine text color based on background
    const getTextColor = (color: string) => {
      if (!color) return;
      let colorObj = tinycolor(color);
      const isTransparent = colorObj.getAlpha() <= 0.5;
      const backgroundColor =
        colorModeConfig['custom_sidebar_background_color'] || baseColorFromTheme['custom_sidebar_background_color'];

      if (isTransparent) colorObj = tinycolor(backgroundColor);
      return colorObj.isLight() ? '#000' : '#fff';
    };

    const colorPickerBoxStyle = {
      backgroundColor: baseValue,
      color: getTextColor(baseValue),
      borderColor: tinycolor(getTextColor(baseValue)).setAlpha(0.2).toString(),
    };

    return html`
      <div class="color-item" id=${configValue}>
        <div class="header-row config-item">
          <ha-icon-button
            ?hidden=${isDefault || this._currentConfigValue !== undefined}
            .path=${mdiRefresh}
            color="var(--sidebar-text-color)"
            @click=${() => this._resetColorConfig(configValue)}
          ></ha-icon-button>

          ${this._createPicker({
            label,
            value,
            configValue,
            placeHolder: baseColorFromTheme[configValue],
            modeConfig: mode,
            pickerType: 'text',
          })}
          ${this._currentConfigValue === configValue
            ? html` <div class="change-format">
                <ha-button @click=${() => this._handleColorPicker('hex')}>HEX</ha-button>
                <ha-button @click=${() => this._handleColorPicker('rgb')}>RGBA</ha-button>
              </div>`
            : html` <a
                href="#"
                class="color-picker-box"
                style=${styleMap(colorPickerBoxStyle)}
                @click=${() => this._toggleColorPicker(configValue)}
              >
                <ha-icon icon="mdi:format-color-fill"></ha-icon>
              </a>`}
        </div>
      </div>
    `;
  }

  private _renderCustomStylesField(): TemplateResult {
    if (!this._sidebarConfig || !this._colorConfigMode) return html``;

    return html`
      <div class="color-item" id="custom_styles">
          <ha-yaml-editor
            .hass=${this.hass}
            .defaultValue=${this._initCustomStyles}
            .copyClipboard=${true}
            .configValue=${'custom_styles'}
            .hasExtraActions=${true}
            .label=${'Custom Styles'}
            .required=${false}
            @value-changed=${this._handleYamlChange}
            style="flex: 1;"
          >
            <ha-button slot="extra-actions" @click=${() => this._resetColorConfig('custom_styles')}>Reset</ha-button>
          </ha-yaml-editor>
        </div>
      </div>
    `;
  }

  private _handleYamlChange(ev: CustomEvent): void {
    ev.stopPropagation();
    const detail = ev.detail;
    const { isValid, value } = detail;
    if (!isValid) return;

    const currentColorMode = this._colorConfigMode;
    const colorConfig = { ...(this._sidebarConfig.color_config || {}) };
    const currentModeConfig = { ...(colorConfig[currentColorMode] || {}) };
    currentModeConfig['custom_styles'] = value;
    this._sidebarConfig = {
      ...this._sidebarConfig,
      color_config: {
        ...colorConfig,
        [currentColorMode]: currentModeConfig,
      },
    };
    this._dispatchConfig(this._sidebarConfig);
    console.log('Updated custom styles:', value);
  }

  private _toggleColorPicker(configValue: string) {
    console.log(configValue);
    const colorItems = this.shadowRoot?.querySelectorAll('.color-item');
    if (!colorItems) return;

    colorItems.forEach((item) => {
      const itemID = item.getAttribute('id');
      const isSelected = item.hasAttribute('selected');
      if (itemID === configValue) {
        item.toggleAttribute('selected', !isSelected);
        this._currentConfigValue = isSelected ? undefined : configValue;
      } else {
        item.toggleAttribute('hidden', !isSelected);
      }
    });

    if (![...colorItems].some((item) => item.hasAttribute('selected'))) {
      colorItems.forEach((item) => item.removeAttribute('hidden'));
    }
  }

  private _createPicker({
    label,
    value,
    configValue,
    placeHolder,
    pickerType,
    modeConfig,
  }: {
    label?: string;
    value: any;
    configValue: string;
    placeHolder?: string | number;
    pickerType: 'text' | 'border_radius' | 'boolean';
    modeConfig?: 'light' | 'dark';
  }) {
    const pickerTypeMap = {
      text: {
        selector: { text: { selector: { text: {} } } },
        flexStyle: true,
        required: true,
      },
      border_radius: {
        selector: { number: { min: 0, max: 100, step: 1, mode: 'box' } },
        flexStyle: true,
        required: false,
        classList: 'color-picker',
        helper: 'Enter a value for border radius (px)',
      },
      boolean: {
        selector: { boolean: {} },
      },
    };

    const configType = `${configValue}_${pickerType}`;
    return html`
      <ha-selector
        style="width: 100%;"
        .hass=${this.hass}
        .label=${label}
        .placeholder=${placeHolder}
        .selector=${pickerTypeMap[pickerType].selector}
        .required=${false}
        .value=${value}
        .configValue=${configValue}
        .modeConfig=${modeConfig}
        .configType=${configType}
        @value-changed=${this._handleColorChange}
      >
      </ha-selector>
    `;
  }

  private _resetColorConfig(configValue: string): void {
    if (!this._sidebarConfig.color_config) return;

    let colorConfig = { ...(this._sidebarConfig.color_config || {}) };
    let currentModeConfig = { ...(colorConfig[this._colorConfigMode] || {}) };

    if (configValue === 'border_radius') {
      delete colorConfig.border_radius;
    } else if (configValue === 'currentMode') {
      delete colorConfig[this._colorConfigMode];
    } else if (configValue === 'custom_styles') {
      delete currentModeConfig.custom_styles;
      this._initCustomStyles = [];
      this._yamlEditor._codeEditor.value = '';
      colorConfig[this._colorConfigMode] = currentModeConfig;
    } else {
      delete currentModeConfig[configValue];
      colorConfig[this._colorConfigMode] = currentModeConfig;
    }

    this._sidebarConfig = {
      ...this._sidebarConfig,
      color_config: colorConfig,
    };
    this._dispatchConfig(this._sidebarConfig);

    console.log('Updated colorConfig:', this._sidebarConfig.color_config);
  }

  private _dispatchConfig(config: SidebarConfig) {
    const event = new CustomEvent('sidebar-changed', { detail: config, bubbles: true, composed: true });
    this.dispatchEvent(event);
  }
  private _handleColorChange(ev: any) {
    ev.stopPropagation();
    const configValue = ev.target.configValue;
    const configType = ev.target.configType;
    const configMode = ev.target.modeConfig;
    const value = ev.detail.value;
    console.log('configValue', configValue, 'configType', configType, 'value', value, 'configMode', configMode);
    if (['header_title', 'hide_header_toggle'].includes(configValue)) {
      this._handleHeaderConfigChange(configValue, value);
      return;
    }

    const updates: Partial<SidebarConfig['color_config']> = {};

    let colorConfig = { ...(this._sidebarConfig.color_config || {}) };
    let currentModeConfig = { ...(colorConfig[configMode] || {}) };

    if (configType.includes('_text')) {
      if (!value || value === '' || value === undefined) {
        delete currentModeConfig[configValue];
        updates[configMode] = currentModeConfig;
      } else {
        currentModeConfig[configValue] = value;
        updates[configMode] = currentModeConfig;
      }
      console.log('colorConfig', updates[configMode]);
    } else if (configValue === 'border_radius') {
      if (!value || value === '' || value === undefined) {
        delete colorConfig[configValue];
      } else {
        colorConfig[configValue] = value;
        updates.border_radius = value;
      }
      console.log('border_radius changed', configValue);
    }

    if (Object.keys(updates).length > 0) {
      this._sidebarConfig = {
        ...this._sidebarConfig,
        color_config: {
          ...colorConfig,
          ...updates,
        },
      };
    }

    this._dispatchConfig(this._sidebarConfig);
  }

  private _handleHeaderConfigChange(configValue: string, value: string | boolean) {
    const updates: Partial<SidebarConfig> = {};
    if (configValue === 'header_title') {
      if (!value || value === '' || value === undefined) {
        delete this._sidebarConfig.header_title;
      } else {
        updates.header_title = value as string;
      }
    } else if (configValue === 'hide_header_toggle') {
      updates.hide_header_toggle = value as boolean;
    }

    console.log('headerConfig', updates);
    this._sidebarConfig = { ...this._sidebarConfig, ...updates };
    this._dispatchConfig(this._sidebarConfig);
  }

  private _renderPreview(): TemplateResult {
    const { mockCustomGroups, mockDefaultPage } = PREVIEW_MOCK_PANELS;
    const _paperListbox = this._dialog._paperListbox;

    const groups =
      Object.keys(this._sidebarConfig?.custom_groups || {}).length >= 2
        ? Object.keys(this._sidebarConfig.custom_groups!)
        : Object.keys(mockCustomGroups);

    const _toggleClick = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
      const target = ev.target as HTMLElement;
      const isActive = target.classList.contains('collapsed');
      const targetParent = target.parentElement;
      const itemsEl = targetParent?.nextElementSibling as HTMLElement;
      if (itemsEl && targetParent?.getAttribute('group') === itemsEl.getAttribute('group')) {
        itemsEl.classList.toggle('collapsed', !isActive);
      }
      target.classList.toggle('collapsed', !isActive);
    };

    const _renderPanelItem = (item: PanelInfo) => {
      const { icon, title } = item;
      return html`<a href="#">
        <div class="icon-item"><ha-icon icon=${icon}></ha-icon><span class="item-text">${title}</span></div>
      </a>`;
    };

    // const lovelacePanel = _paperListbox['defaultPage'][0] || { title: 'Home', icon: 'mdi:home' };
    const lovelacePanel = _renderPanelItem(_paperListbox['defaultPage'][0] || mockDefaultPage[0]);
    const bottomSys = _paperListbox['bottomSystem'].map((item: PanelInfo) => {
      return _renderPanelItem(item);
    });
    const bottomPanel = _paperListbox['bottomItems'].map((item: PanelInfo) => {
      return _renderPanelItem(item);
    });

    return html` <div class="header-row center primary">Preview - ${this._colorConfigMode}</div>
      <div class="divider-preview" style=${this._computePreviewStyle()} id="divider-preview">
        <div class="groups-container">
          ${lovelacePanel}
          ${Array.from({ length: groups.length }, (_, i) => {
            const collapsed = i === 0 ? true : false;
            const title = groups[i].replace('_', ' ');
            const someGroupItems = _paperListbox[groups[i]] ?? mockCustomGroups[groups[i]] ?? [];

            return html`<div class="divider-container" @click=${(ev: Event) => _toggleClick(ev)} group=${groups[i]}>
                <div class=${collapsed ? 'added-content' : 'added-content collapsed'}>
                  <ha-icon icon="mdi:chevron-down"></ha-icon>
                  <span>${title}</span>
                </div>
              </div>
              ${someGroupItems.length !== 0
                ? html`<div group=${groups[i]} class=${collapsed ? 'group-items' : 'group-items collapsed'}>
                    ${someGroupItems.map((item: PanelInfo) => {
                      return _renderPanelItem(item);
                    })}
                  </div>`
                : nothing} `;
          })}
          <div class="spacer"></div>
          ${bottomPanel}
          <div class="divider"></div>
          ${bottomSys}
        </div>
      </div>`;
  }

  private _computePreviewStyle() {
    if (!this._sidebarConfig) return;
    const colorMode = this._colorConfigMode;
    const color_config = this._sidebarConfig?.color_config || {};
    const borderRadius = color_config?.border_radius || 0;
    const colorConfig = color_config?.[colorMode] || {};
    const customStyles = colorConfig.custom_styles || [];
    const styleAddedCustom = convertPreviewCustomStyles(customStyles);
    console.log('Converted Custom Styles:', styleAddedCustom);

    const getColor = (key: string): string => {
      return colorConfig?.[key] ?? this._baseColorFromTheme[key];
    };

    const styleAdded = {
      '--divider-color': getColor('divider_color'),
      '--divider-bg-color': getColor('background_color'),
      '--divider-border-top-color': getColor('border_top_color'),
      '--scrollbar-thumb-color': getColor('scrollbar_thumb_color'),
      '--sidebar-background-color': getColor('custom_sidebar_background_color'),
      '--divider-border-radius': `${borderRadius}px`,
      '--sidebar-text-color': getColor('divider_text_color'),
      '--sidebar-icon-color': getColor('sidebar_icon_color'),
      ...styleAddedCustom,
    };

    console.log('styleAdded', styleAdded);
    return styleMap(styleAdded);
  }

  static get styles(): CSSResultGroup {
    return [
      css`
        :host *[hidden] {
          display: none !important;
        }

        #color-preview-container {
          display: flex;
          flex-direction: row;
          gap: var(--side-dialog-gutter);
          justify-content: center;
        }
        @media all and (max-width: 700px), all and (max-height: 500px) {
          #color-preview-container {
            flex-wrap: wrap;
          }
        }
        .color-container {
          display: block;
          /* border: 1px solid var(--divider-color); */
          flex: auto;
          height: 100%;
        }

        .preview-container {
          min-width: 260px;
          flex: 0;
          display: flex;
          flex-direction: column;
          width: 100%;
          background-color: var(--primary-background-color);
          border: 1px solid var(--divider-color);
          /* display: block; */
        }
        .header-row {
          display: inline-flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          --mdc-icon-button-size: 42px;
          /* padding-block: 0.5rem; */
        }
        .header-row.center {
          justify-content: center;
        }

        .header-row.config-item {
          place-items: anchor-center;
          color: var(--secondary-text-color);
        }
        .header-row.config-item ha-icon:hover {
          cursor: pointer;
          color: var(--primary-color);
        }
        .primary {
          font-size: 1.2rem;
          font-weight: 500;
          background: var(--app-header-background-color);
          padding-block: 0.5rem;
          text-transform: uppercase;
        }
        .title {
          font-size: 1.05rem;
          margin-block: 0.5rem;
          line-height: 100%;
        }

        .config-colors {
          display: flex;
          flex-direction: column;
          gap: var(--side-dialog-gutter);
          padding-block: var(--side-dialog-gutter);
        }

        .config-colors.header {
          flex-direction: row;
        }

        .config-colors .color-item {
          display: flex;
        }

        .change-format {
          display: inline-block;
          flex: 0;
          width: fit-content;
        }

        a.color-picker-box {
          width: fit-content;
          position: relative;
          display: inline-block;
          box-sizing: border-box;
          padding: 0.5rem 0.5rem;
          min-height: 2em;
          border: 1px solid;
          outline: none;
          overflow: visible;
          color: var(--sidebar-text-color);
          background-color: var(--divider-bg-color);
          text-align: center;
          cursor: pointer;
          text-decoration: none;
          margin-inline: 0.5rem;
          border-radius: inherit;
          transition: all 0.3s ease;
        }

        .picker-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-top: var(--side-dialog-padding);
          flex-direction: column;
          gap: var(--side-dialog-padding);
        }

        .picker-buttons {
          display: flex;
          width: 100%;
          justify-content: space-around;
          align-items: center;
        }

        .divider-preview {
          display: block;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          height: 100%;
          width: 100%;
          background-color: var(--sidebar-background-color);
          max-height: 580px;
        }

        .groups-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          overflow-y: auto;
          scrollbar-color: var(--scrollbar-thumb-color) transparent;
          scrollbar-width: thin;
        }

        .divider-container {
          padding: 0;
          margin-top: 1px;
          box-sizing: border-box;
          box-sizing: border-box;
          margin: 1px 4px 0px;
          /* width: 248px; */
        }

        .added-content {
          display: flex;
          justify-content: flex-start;
          align-items: center;
          color: var(--sidebar-text-color);
          background-color: var(--divider-bg-color);
          letter-spacing: 1px;
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.3s ease;
          border-top: 1px solid var(--divider-border-top-color);
          border-radius: var(--divider-border-radius, none);
          box-sizing: border-box;
          padding-left: 12px;
          padding-inline-end: initial;
          min-height: 40px;
          text-transform: capitalize;
          &:hover {
            color: var(--primary-color);
            background-color: rgb(from var(--primary-color) r g b / 0.1);
          }
        }

        .added-content > span,
        .added-content > ha-icon {
          pointer-events: none;
          transition: all 150ms ease;
        }

        .divider-container:hover .added-content > span {
          transform: translateX(30px);
          transition: all 150ms ease;
        }

        .added-content > span {
          transform: translateX(30px);
        }
        .added-content.collapsed > span {
          transform: translateX(10px);
        }

        .added-content.collapsed > ha-icon {
          transform: rotate(-90deg);
        }

        .group-items {
          max-height: 1000px;
          display: block;
          transition: all 0.3s ease;
        }

        .group-items.collapsed {
          max-height: 0px;
          overflow: hidden;
        }

        .divider {
          /* padding: 10px 0; */
          display: block;
        }

        .divider::before {
          content: '';
          display: block;
          height: 1px;
          background-color: var(--divider-color);
        }
        .spacer {
          flex: 1;
        }
        a {
          text-decoration: none;
          color: var(--sidebar-text-color);
          font-weight: 500;
          font-size: 14px;
          position: relative;
          display: block;
          outline: 0;
          &:hover {
            color: var(--primary-color);
            background-color: rgb(from var(--primary-color) r g b / 0.1);
          }
          /* width: 248px; */
        }

        .icon-item {
          box-sizing: border-box;
          margin: 4px;
          padding-left: 12px;
          padding-inline-start: 12px;
          padding-inline-end: initial;
          border-radius: 4px;
          display: flex;
          min-height: 40px;
          align-items: center;
          padding: 0 16px;
        }
        .icon-item > ha-icon {
          width: 56px;
          color: var(--sidebar-icon-color);
        }
        .icon-item span.item-text {
          display: block;
          max-width: calc(100% - 56px);
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-dialog-colors': SidebarDialogColors;
  }
  interface Window {
    SidebarDialogColors: SidebarDialogColors;
  }
}
