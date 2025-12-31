import { STORAGE } from '@constants';
import { SidebarConfig } from '@types';

export const getStorage = (key: string): string | null => {
  return localStorage.getItem(key);
};

export const setStorage = (key: string, value: any): void => {
  // console.log('%cSTORAGE-UTILS:', 'color: #4dabf7;', `Setting localStorage key "${key}" to:`, value);

  return localStorage.setItem(key, JSON.stringify(value));
};

export const removeStorage = (key: string): void => {
  return localStorage.removeItem(key);
};

export const getHiddenPanels = (): string[] => {
  const hiddenPanels = localStorage.getItem(STORAGE.HIDDEN_PANELS);
  if (!hiddenPanels || hiddenPanels === 'null' || hiddenPanels === 'undefined') return [];
  return JSON.parse(hiddenPanels);
};

export const sidebarUseConfigFile = (): boolean => {
  const useJson = localStorage.getItem(STORAGE.USE_CONFIG_FILE) || '""';
  return JSON.parse(useJson) === 'true';
};

export const getStorageConfig = (): SidebarConfig | undefined => {
  const config = localStorage.getItem(STORAGE.UI_CONFIG);
  if (!config || JSON.parse(config).length === 0) return undefined;
  return JSON.parse(config);
};

export const isStoragePanelEmpty = (): boolean => {
  const storagePanel = localStorage.getItem(STORAGE.PANEL_ORDER);
  return !storagePanel || JSON.parse(storagePanel).length === 0;
};
