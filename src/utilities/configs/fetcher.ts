import { CONFIG_NAME, CONFIG_PATH, DEFAULT_CONFIG, STORAGE } from '@constants';
import { HaExtened, SidebarConfig } from '@types';
import YAML from 'yaml';

import { sidebarUseConfigFile, getStorageConfig, setStorage } from '../storage-utils';
import { _changeStorageConfig, isItemsValid, tryCorrectConfig, validateConfig } from './validators';

const randomId = (): string => Math.random().toString(16).slice(2);

export const fetchFileConfig = async (): Promise<SidebarConfig | undefined> => {
  const errorNotFound = `${CONFIG_NAME} not found. Make sure you have a valid ${CONFIG_NAME}.yaml file in your www folder.`;
  const randomUrl = `${CONFIG_PATH}?hash=${randomId()}`;
  try {
    const response = await fetch(randomUrl, { cache: 'no-store' });
    if (!response.ok) return undefined;
    const yamlStr = await response.text();
    const data = YAML.parse(yamlStr);
    // console.log('data', data);
    return data;
  } catch (e) {
    console.error(`${errorNotFound}`, e);
    return undefined;
  }
};

/**
 * If this browser has never chosen a config
 * source (no "use config file" key in localStorage) and a valid sidebar-organizer.yaml
 * exists in /local, switch to the config file automatically. This makes every browser
 * and device follow the shared file without toggling "Use config file" on each one.
 * An explicit choice made in the editor (true or false) is always respected.
 */
const autoEnableConfigFile = async (): Promise<void> => {
  if (window.localStorage.getItem(STORAGE.USE_CONFIG_FILE) !== null) return;
  const data = await fetchFileConfig();
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    console.log(`${CONFIG_NAME}.yaml found - using the config file for this browser.`);
    setStorage(STORAGE.USE_CONFIG_FILE, true);
  }
};

export const fetchConfig = async (hass: HaExtened['hass']): Promise<SidebarConfig | undefined> => {
  await autoEnableConfigFile();
  let config = sidebarUseConfigFile() ? await fetchFileConfig() : getStorageConfig();
  if (config) {
    config = { ...config };
    // console.log('Added with init config defaults', config);
    const isValid = await isItemsValid(config, hass, true).then((result) =>
      typeof result === 'boolean' ? result : result.valid
    );

    if (!isValid) {
      console.log('Config is not valid. Trying to correct it.');
      // Try to correct the config
      config = await tryCorrectConfig(config, hass);
      if (!sidebarUseConfigFile()) {
        setStorage(STORAGE.UI_CONFIG, config);
      }
      return config;
    } else {
      config = validateConfig(config);
      _changeStorageConfig(config);
    }
  }
  if (!config) {
    console.log('No config found..');
    return undefined;
  }
  return config;
};
