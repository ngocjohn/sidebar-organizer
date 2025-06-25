import { CONFIG_NAME, CONFIG_PATH, DEFAULT_CONFIG } from '@constants';
import { HaExtened, SidebarConfig } from '@types';
import YAML from 'yaml';

import { sidebarUseConfigFile, getStorageConfig } from '../storage-utils';
import { _changeStorageConfig, isItemsValid, tryCorrectConfig, validateConfig } from './validators';

const randomId = (): string => Math.random().toString(16).slice(2);

export const fetchFileConfig = async (): Promise<SidebarConfig | undefined> => {
  const errorNotFound = `${CONFIG_NAME} not found. Make sure you have a valid ${CONFIG_NAME}.yaml file in your www folder.`;
  const randomUrl = `${CONFIG_PATH}?hash=${randomId()}`;
  try {
    const response = await fetch(randomUrl, { cache: 'no-store' });
    const yamlStr = await response.text();
    const data = YAML.parse(yamlStr);
    // console.log('data', data);
    return data;
  } catch (e) {
    console.error(`${errorNotFound}`, e);
    return undefined;
  }
};

export const fetchConfig = async (hass: HaExtened['hass']): Promise<SidebarConfig | undefined> => {
  let config = sidebarUseConfigFile() ? await fetchFileConfig() : getStorageConfig();
  if (config) {
    config = { ...DEFAULT_CONFIG, ...config };
    // console.log('Added with init config defaults', config);
    let isValid = isItemsValid(config, hass, true);
    if (typeof isValid === 'object') {
      isValid = isValid.configValid;
    }
    if (!isValid && !sidebarUseConfigFile()) {
      console.log('Config is not valid. Trying to correct it.');
      // Try to correct the config
      config = tryCorrectConfig(config, hass);
      return config;
    } else if (!isValid && sidebarUseConfigFile()) {
      config = DEFAULT_CONFIG;
      return config;
    } else {
      config = validateConfig(config);
      _changeStorageConfig(config);
    }
  }
  if (!config) {
    config = DEFAULT_CONFIG;
    console.log('No config found. Using default config', config);
  }
  return config;
};
