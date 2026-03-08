import { PANEL_TYPE, type SidebarConfig, type SidebardPanelConfig } from '@types';
import { forEach, pick } from 'es-toolkit/compat';

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
  console.debug('Cleaning items from all panels...', { baseConfig, itemsToRemove, configToUpdate });
  const cleanedConfigItems = cleanItemsFromConfig(configToUpdate, itemsToRemove);
  console.debug('Cleaned config items:', cleanedConfigItems, 'before configToUpdate:', configToUpdate);

  return cleanedConfigItems;
};
