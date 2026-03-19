import { PANEL_TYPE, type SidebarConfig, type SidebardPanelConfig } from '@types';
import { forEach, isEmpty, pick } from 'es-toolkit/compat';

export const cleanItems = (items: string[], itemsToRemoveSet: Set<string>): string[] => {
  return items.filter((item) => !itemsToRemoveSet.has(item));
};

export function cleanItemsFromConfig(
  groups: SidebardPanelConfig,
  itemsToRemove: string[] | Set<string>
): SidebardPanelConfig {
  const itemsToRemoveSet: Set<string> = itemsToRemove instanceof Set ? itemsToRemove : new Set(itemsToRemove);

  const updatesConfig: SidebardPanelConfig = {};

  forEach(groups, (value, key) => {
    if (Array.isArray(value)) {
      updatesConfig[key] = cleanItems(value, itemsToRemoveSet);
    } else {
      updatesConfig[key] = {};
      forEach(value, (subValue, subKey) => {
        updatesConfig[key][subKey] = cleanItems(subValue, itemsToRemoveSet);
      });
    }
  });

  return updatesConfig;
}
export const cleanItemsFromAllPanels = (
  baseConfig: SidebarConfig,
  itemsToRemove: string[] | Set<string>
): SidebardPanelConfig => {
  const configToUpdate = pick(baseConfig, [
    PANEL_TYPE.CUSTOM,
    PANEL_TYPE.BOTTOM,
    PANEL_TYPE.HIDDEN,
    PANEL_TYPE.BOTTOM_GRID,
  ]) as SidebardPanelConfig;
  const cleanedConfigItems = cleanItemsFromConfig(configToUpdate, itemsToRemove);

  return cleanedConfigItems;
};

export const removeEmptyValues = (object: Record<string, any>): Record<string, any> => {
  if (typeof object !== 'object' || object === null) {
    return object;
  }
  const cleanedObject = JSON.parse(JSON.stringify(object));
  for (const [key, value] of Object.entries(object)) {
    const keyToDelete = typeof value === 'object' && isEmpty(value);
    if (keyToDelete) {
      delete cleanedObject[key];
    }
  }
  return cleanedObject;
};

export const cleanConfig = (config: SidebarConfig): SidebarConfig => {
  const diffs: string[] = [];
  const cleanedConfig = JSON.parse(JSON.stringify(config)) as SidebarConfig;
  const entries = Object.entries(cleanedConfig);
  for (const [key, value] of entries) {
    if (typeof value === 'object' && value !== null) {
      const cleanedValue = removeEmptyValues(value);
      if (isEmpty(cleanedValue)) {
        delete cleanedConfig[key];
        diffs.push(key);
      } else {
        cleanedConfig[key] = cleanedValue;
      }
    } else if (value === undefined || value === '') {
      delete cleanedConfig[key];
      diffs.push(key);
    }
  }
  if (diffs.length > 0 && __DEBUG__) {
    console.groupCollapsed('%cCLEAN-ITEMS:', 'color: #999999;', 'Empty properties detected');
    console.log('Removed empty properties:', diffs);
    console.log('Cleaned config:', cleanedConfig);
    console.groupEnd();
  }
  return cleanedConfig;
};
