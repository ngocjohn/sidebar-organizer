import { LovelaceConfig } from 'types/frontend-lovelace';
import { HomeAssistant } from 'types/ha';

const VERTICAL_STACK_EDITOR_TAG = 'hui-stack-card-editor';
// Hack to load ha-components needed for editor
export const loadHaComponents = () => {
  if (!customElements.get('ha-form')) {
    (customElements.get('hui-button-card') as any)?.getConfigElement();
  }
  if (!customElements.get('ha-entity-picker')) {
    (customElements.get('hui-entities-card') as any)?.getConfigElement();
  }
  if (!customElements.get('ha-card-conditions-editor')) {
    (customElements.get('hui-conditional-card') as any)?.getConfigElement();
  }
  if (!customElements.get('ha-form-multi_select')) {
    // Load the component by invoking a related component's method
    (customElements.get('hui-entities-card') as any)?.getConfigElement();
  }
  if (!customElements.get('hui-entity-editor')) {
    // Load the component by invoking a related component's method
    (customElements.get('hui-glance-card') as any)?.getConfigElement();
  }
};

export const loadCustomElement = async <T = any>(name: string) => {
  let Component = customElements.get(name) as T;
  if (Component) {
    return Component;
  }
  await customElements.whenDefined(name);
  return customElements.get(name) as T;
};

export const loadVerticalStackConfigElement = async () => {
  if (!customElements.get('hui-vertical-stack-card')) {
    const element = document.createElement('hui-vertical-stack-card') as any;
    if (element.getConfigElement) {
      console.log('Loading hui-vertical-stack-card config element...');
      await element.getConfigElement();
    }
  }
  return customElements.get('hui-vertical-stack-card') as any;
};

export const loadVerticalStackConfigEditor = async (config: any) => {
  await loadVerticalStackConfigElement();
  try {
    const editorElement = document.createElement(VERTICAL_STACK_EDITOR_TAG) as any;
    if (editorElement.setConfig) {
      editorElement.setConfig(config);
    }
    return editorElement;
  } catch (error) {
    console.error(`Error loading ${VERTICAL_STACK_EDITOR_TAG}:`, error);
  }
};

export const loadCardPicker = async (hass: HomeAssistant, lovelace: LovelaceConfig): Promise<HTMLElement> => {
  if (customElements.get('hui-card-picker')) {
    console.debug('hui-card-picker already loaded');
    const element = document.createElement('hui-card-picker') as any;
    element.hass = hass;
    element.lovelace = lovelace;
    return element;
  }
  console.debug('Loading hui-card-picker...');
  const element = document.createElement('hui-card-picker') as any;
  element.hass = hass;
  element.lovelace = lovelace;
  return element;
};
