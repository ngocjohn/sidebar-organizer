import { CONFIG_NAME, CONFIG_PATH, DEFAULT_CONFIG } from '@constants';
import { HaExtened, SidebarConfig } from '@types';
import YAML from 'yaml';

import { sidebarUseConfigFile, getStorageConfig } from '../storage-utils';
import { _changeStorageConfig, isItemsValid, validateConfig } from './validators';

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
    console.log('Added with init config', config);
    const isValid = isItemsValid(config, hass);
    if (!isValid) {
      config = DEFAULT_CONFIG;
      return config;
    }
    config = validateConfig(config);
    _changeStorageConfig(config);
  }
  return config;
};
