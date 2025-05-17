import { COLOR_CONFIG_KEYS } from '@constants';
import iro from '@jaames/iro';
import { mdiRefresh } from '@mdi/js';
import { DividerColorSettings, HaExtened, SidebarConfig } from '@types';
import { applyTheme } from '@utilities/apply-theme';
import { getDefaultThemeColors } from '@utilities/custom-styles';
import { createExpansionPanel } from '@utilities/dom-utils';
import { html, css, LitElement, TemplateResult, PropertyValues, CSSResultGroup, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators';
import { styleMap } from 'lit/directives/style-map.js';
import tinycolor from 'tinycolor2';

import { SidebarConfigDialog } from './sidebar-dialog';

enum THEME_STATE {
  LOADING = 1,
  READY = 2,
  ERROR = 3,
}

const HOME_ASSISTANT_THEME = 'default';

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

  private _initColor: string = '';
  @state() private _initCustomStyles: Array<Record<string, string>> = [];
  @state() private _yamlEditor: any;

  connectedCallback(): void {
    super.connectedCallback();
  }

  protected firstUpdated(_changedProperties: PropertyValues): void {
    super.firstUpdated(_changedProperties);
    const colorMode = this.hass.themes.darkMode ? 'dark' : 'light';
    this._colorConfigMode = colorMode;
  }

  protected shouldUpdate(_changedProperties: PropertyValues): boolean {
    if (_changedProperties.has('_sidebarConfig') && this._sidebarConfig) {
      return true;
    }
    if (_changedProperties.has('_colorConfigMode') && this._colorConfigMode) {
      this._setTheme(this._colorConfigMode);
      this._state = THEME_STATE.LOADING;
      this._initCustomStyles = this._sidebarConfig.color_config?.[this._colorConfigMode]?.custom_styles || [];
      setTimeout(() => {
        this._state = THEME_STATE.READY;
      }, 500);
      return true;
    }

    // if (_changedProperties.has('_yamlEditor') && this._yamlEditor !== undefined) {
    //   this._yamlEditor._codeEditor.linewrap = true;
    //   const cardActions = this._yamlEditor.shadowRoot?.querySelector('.card-actions');
    //   const actionStyles = {
    //     display: 'flex',
    //     justifyContent: 'space-between',
    //     width: '100%',
    //     padding: '0',
    //     border: 'none',
    //   };
    //   if (cardActions) {
    //     Object.assign(cardActions.style, actionStyles);
    //   }
    //   return true;
    // }

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

    if (_changedProperties.has('_state') && this._state === THEME_STATE.READY) {
      this._getYamlEditor();
    }

    if (_changedProperties.has('_sidebarConfig') && this._sidebarConfig.color_config?.custom_theme) {
      const oldTheme = _changedProperties.get('_sidebarConfig')?.color_config?.custom_theme?.theme as
        | string
        | undefined;
      const newTheme = this._sidebarConfig.color_config!.custom_theme.theme as string;
      if (oldTheme && oldTheme !== newTheme) {
        if (!this._supportsMode(newTheme)) {
          console.log('Theme does not support modes');
          const lightRgx = /light/i;
          const darkRgx = /dark/i;
          const isLightMode = lightRgx.test(newTheme);
          const isDarkMode = darkRgx.test(newTheme);
          if (isLightMode) {
            this._colorConfigMode = 'light';
          } else if (isDarkMode) {
            this._colorConfigMode = 'dark';
          } else {
            this._colorConfigMode = this.hass.themes.darkMode ? 'dark' : 'light';
          }
          // console.log('isLightMode', isLightMode, 'isDarkMode', isDarkMode);
          // console.log('this._colorConfigMode', this._colorConfigMode);
        } else {
          console.log('Theme supports modes');
          const themeObj = this.hass.themes.themes[newTheme];
          const modes = themeObj.modes;
          if (modes && typeof modes === 'object') {
            const modeKeys = Object.keys(modes);
            if (modeKeys.length > 0) {
              this._colorConfigMode = modeKeys[0];
            } else {
              this._colorConfigMode = this.hass.themes.darkMode ? 'dark' : 'light';
            }
          } else {
            this._colorConfigMode = this.hass.themes.darkMode ? 'dark' : 'light';
          }
        }
      }
    }
  }

  private _supportsMode(themeName: string): boolean {
    if (!(themeName in this.hass.themes.themes)) {
      return false;
    }
    if (this.hass.themes.themes[themeName].modes === undefined) {
      return false;
    }
    return (
      'modes' in this.hass.themes.themes[themeName] &&
      this.hass.themes.themes[themeName].modes &&
      Object.keys(this.hass.themes.themes[themeName].modes!).length > 1
    );
  }

  private _getYamlEditor() {
    const yamlEditor = this.shadowRoot?.querySelector('ha-yaml-editor');
    if (yamlEditor) {
      this._yamlEditor = yamlEditor;
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

  /* --------------------------- THEME CONFIGURATION -------------------------- */
  private _setTheme(mode: string): void {
    const theme = this._sidebarConfig?.color_config?.custom_theme?.theme || this.hass.themes.theme;
    const themeContainer = this.shadowRoot?.getElementById('theme-container');
    applyTheme(themeContainer, this.hass, theme, mode);
    setTimeout(() => {
      this._getDefaultColors();
      this._initCustomStyles = this._sidebarConfig.color_config?.[mode]?.custom_styles || [];
    }, 0);
    // console.log('Color compoment applied theme:', theme, 'mode:', mode);
    if (this._dialog._dialogPreview && this._dialog._dialogPreview._colorConfigMode !== mode) {
      this._dialog._dialogPreview._colorConfigMode = mode;
    }
  }

  protected render(): TemplateResult {
    return html`
      <div id="theme-container"></div>
      <div class="color-container">${this._renderHeaderConfigFields()} ${this._renderColorConfigFields()}</div>
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

    const content = html` <div class="config-colors">${headerConfig.map((item) => this._createPicker(item))}</div> `;

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
    const themeSelect = this._renderThemePickerRow();

    const headerInfo = html`<div class="header-row" ?hidden=${configKeySelected}>
      <div class="title">
        Theme: ${this._sidebarConfig?.color_config?.custom_theme?.theme || this.hass.themes.theme}
      </div>
      <ha-button @click=${() => this._resetColorConfig('currentMode')}>RESET ALL</ha-button>
    </div> `;

    const pickerActive = html` <div class="header-row">
      <ha-button @click=${() => this._picker?.color.reset()}>Reset</ha-button>
      <ha-button @click=${() => this._handleColorPicker('cancel')}>Cancel</ha-button>
      <ha-button @click=${() => this._handleColorPicker('save')}>Save</ha-button>
    </div>`;

    const colorConfigContent = html`
      <div class="config-colors grid">
        ${COLOR_CONFIG_KEYS.map((item) => this._renderDividerColor(item.value, item.label))}
        ${this._renderBorderRadiusField()} ${this._renderCustomStylesField()}
      </div>
      <div class="picker-wrapper" hidden>
        <div id="picker"></div>
        ${pickerActive}
      </div>
    `;

    const colorConfig = createExpansionPanel({
      content: colorConfigContent,
      options: {
        expanded: false,
        header: 'Custom colors and styles',
      },
    });

    const content = html`
      <div>${themeSelect} ${headerInfo}</div>
      ${colorConfig}
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

  private _renderThemePickerRow(): TemplateResult {
    const themeModes = [
      { value: 'light', label: 'Light Mode' },
      { value: 'dark', label: 'Dark Mode' },
    ];

    const themeSettings = this._sidebarConfig?.color_config?.custom_theme;
    const curTheme = themeSettings?.theme || this.hass.themes.theme;
    const colorMode = this._colorConfigMode as 'light' | 'dark';

    const themeSelect = html`
      <div class="config-colors">
        <ha-selector
          .hass=${this.hass}
          .label=${this.hass.localize('ui.panel.profile.themes.dropdown_label')}
          .value=${curTheme}
          .selector=${{
            theme: {
              include_default: false,
            },
          }}
          .required=${false}
          @value-changed=${this._handleThemeChange}
        ></ha-selector>
        <ha-selector
          .hass=${this.hass}
          .label=${'Theme Mode'}
          .value=${themeSettings?.mode || 'auto'}
          .disabled=${!this._supportsMode(curTheme)}
          .selector=${{
            select: {
              mode: 'dropdown',
              options: [
                { value: 'auto', label: 'Auto' },
                ...themeModes.map((mode) => ({ value: mode.value, label: mode.label })),
              ],
            },
          }}
          }
          @value-changed=${this._handleForceModeChange}
          .required=${false}
        ></ha-selector>
      </div>
    `;

    const modesRadio = html` <div class="header-row">
      <div class="title">Select mode to edit:</div>
      <div class="inputs">
        <ha-formfield .label=${'Light Mode'}>
          <ha-radio @change=${this._handleDarkMode} name="dark_mode" value="light" .checked=${colorMode === 'light'}>
          </ha-radio>
        </ha-formfield>
        <ha-formfield .label=${'Dark Mode'}>
          <ha-radio @change=${this._handleDarkMode} name="dark_mode" value="dark" .checked=${colorMode === 'dark'}>
          </ha-radio>
        </ha-formfield>
      </div>
    </div>`;

    return html`${themeSelect} ${this._supportsMode(curTheme) ? modesRadio : nothing}`;
  }

  private _handleDarkMode(ev: CustomEvent): void {
    const selectedMode = (ev.target as HTMLInputElement).value;
    this._colorConfigMode = selectedMode;
  }

  private _handleThemeChange(ev: CustomEvent): void {
    ev.stopPropagation();
    const theme = ev.detail.value;
    if (!this._sidebarConfig) return;
    const colorConfig = { ...(this._sidebarConfig.color_config || {}) };

    if (colorConfig.custom_theme?.theme === theme) {
      // If the selected theme is already applied, do nothing
      return;
    }

    if (theme === HOME_ASSISTANT_THEME) {
      // Remove custom theme settings if the default theme is selected
      delete colorConfig.custom_theme;
      this._sidebarConfig = {
        ...this._sidebarConfig,
        color_config: colorConfig,
      };
      this._dispatchConfig(this._sidebarConfig);
      this._colorConfigMode = this.hass.themes.darkMode ? 'dark' : 'light';
      return;
    } else {
      const themeSettings = { ...(colorConfig.custom_theme || {}) };
      themeSettings.theme = theme;
      colorConfig.custom_theme = themeSettings;
      this._sidebarConfig = {
        ...this._sidebarConfig,
        color_config: colorConfig,
      };
      this._dispatchConfig(this._sidebarConfig);
      // Set the color mode based on the selected theme
    }
  }

  private _handleForceModeChange(ev: CustomEvent): void {
    ev.stopPropagation();
    const selectedMode = ev.detail.value;
    const themeSettings = { ...(this._sidebarConfig?.color_config?.custom_theme || {}) };
    if (selectedMode === 'auto' || selectedMode === '') {
      delete themeSettings.mode;
    } else {
      themeSettings.mode = selectedMode;
    }
    this._sidebarConfig = {
      ...this._sidebarConfig,
      color_config: {
        ...this._sidebarConfig.color_config,
        custom_theme: themeSettings,
      },
    };
    this._dispatchConfig(this._sidebarConfig);
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
    if (this._state === THEME_STATE.LOADING) {
      return html`<ha-circular-progress .indeterminate=${true} .size=${'small'}></ha-circular-progress>`;
    }

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
            style="flex: 1; overflow: auto;"
          >
            <ha-button slot="extra-actions" style="float: inline-end;"  @click=${() => this._resetColorConfig('custom_styles')}>Reset</ha-button>
          </ha-yaml-editor>
        </div>
      </div>
    `;
  }

  private _handleYamlChange(ev: CustomEvent): void {
    ev.stopPropagation();
    const detail = ev.detail;
    const { isValid, value } = detail;
    const isArray = Array.isArray(value);

    const updates: Partial<SidebarConfig['color_config']> = {};

    const currentColorMode = this._colorConfigMode as 'light' | 'dark';
    let colorConfig = { ...(this._sidebarConfig.color_config || {}) };
    let currentModeConfig = { ...(colorConfig[currentColorMode] || {}) };

    if (!isValid) {
      return;
    } else if (!isArray) {
      console.error('Invalid custom styles:', value);
      updates[currentColorMode] = { ...currentModeConfig, custom_styles: [] };
    } else {
      updates[currentColorMode] = { ...currentModeConfig, custom_styles: value };
    }

    if (Object.keys(updates).length > 0) {
      this._sidebarConfig = {
        ...this._sidebarConfig,
        color_config: {
          ...colorConfig,
          ...updates,
        },
      };
      this._dispatchConfig(this._sidebarConfig);
    }
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
    const colorMode = this._colorConfigMode as 'light' | 'dark';
    const colorConfig = { ...(this._sidebarConfig.color_config || {}) };
    const currentModeConfig = { ...(colorConfig[colorMode] || {}) };

    if (configValue === 'border_radius') {
      delete colorConfig.border_radius;
    } else if (configValue === 'currentMode') {
      delete colorConfig[colorMode];
    } else if (configValue === 'custom_styles') {
      this._initCustomStyles = [];
      this._yamlEditor._codeEditor.value = '';
      // Explicitly set custom_styles to an empty array before spreading
      currentModeConfig.custom_styles = [];
      colorConfig[colorMode] = currentModeConfig;
      console.log('Reset custom styles:', colorConfig[colorMode]);
    } else {
      delete currentModeConfig[configValue];
      colorConfig[colorMode] = currentModeConfig;
    }

    this._sidebarConfig = {
      ...this._sidebarConfig,
      color_config: colorConfig,
    };
    console.log('Reset color config:', this._sidebarConfig.color_config);
    this._dispatchConfig(this._sidebarConfig);
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

  static get styles(): CSSResultGroup {
    return [
      css`
        :host *[hidden] {
          display: none !important;
        }

        .color-container {
          display: block;
          /* border: 1px solid var(--divider-color); */
          flex: auto;
          height: 100%;
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
          display: grid;
          gap: var(--side-dialog-gutter);
          padding-block: var(--side-dialog-gutter);
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        }

        .config-colors.grid > *:nth-last-child(1) {
          grid-column: 1 / -1; /* Spans all columns */
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
        .inputs {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          margin: 0 12px;
          flex: 1;
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
