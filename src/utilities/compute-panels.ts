import { HA as HomeAssistant } from '@types';
import { PanelInfo } from '@types';
import memoizeOne from 'memoize-one';

import { stringCompare } from './compare';

const SHOW_AFTER_SPACER = ['config', 'developer-tools'];

const SORT_VALUE_URL_PATHS = {
  energy: 1,
  map: 2,
  logbook: 3,
  history: 4,
  'developer-tools': 9,
  config: 11,
};

const panelSorter = (reverseSort: string[], defaultPanel: string, a: PanelInfo, b: PanelInfo, language: string) => {
  const indexA = reverseSort.indexOf(a.url_path!);
  const indexB = reverseSort.indexOf(b.url_path!);
  if (indexA !== indexB) {
    if (indexA < indexB) {
      return 1;
    }
    return -1;
  }
  return defaultPanelSorter(defaultPanel, a, b, language);
};

const defaultPanelSorter = (defaultPanel: string, a: PanelInfo, b: PanelInfo, language: string) => {
  // Put all the Lovelace at the top.
  const aLovelace = a.component_name === 'lovelace';
  const bLovelace = b.component_name === 'lovelace';

  if (a.url_path === defaultPanel) {
    return -1;
  }
  if (b.url_path === defaultPanel) {
    return 1;
  }

  if (aLovelace && bLovelace) {
    return stringCompare(a.title!, b.title!, language);
  }
  if (aLovelace && !bLovelace) {
    return -1;
  }
  if (bLovelace) {
    return 1;
  }

  const aBuiltIn = a.url_path! in SORT_VALUE_URL_PATHS;
  const bBuiltIn = b.url_path! in SORT_VALUE_URL_PATHS;

  if (aBuiltIn && bBuiltIn) {
    return SORT_VALUE_URL_PATHS[a.url_path!] - SORT_VALUE_URL_PATHS[b.url_path!];
  }
  if (aBuiltIn) {
    return -1;
  }
  if (bBuiltIn) {
    return 1;
  }
  // both not built in, sort by title
  return stringCompare(a.title!, b.title!, language);
};

export const computePanels = memoizeOne(
  (
    panels: HomeAssistant['panels'],
    defaultPanel: string,
    panelsOrder: string[],
    hiddenPanels: string[],
    locale: HomeAssistant['locale']
  ): [PanelInfo[], PanelInfo[]] => {
    if (!panels) {
      return [[], []];
    }

    const beforeSpacer: PanelInfo[] = [];
    const afterSpacer: PanelInfo[] = [];

    Object.values(panels).forEach((panel) => {
      if (hiddenPanels.includes(panel.url_path) || (!panel.title && panel.url_path !== defaultPanel)) {
        return;
      }
      (SHOW_AFTER_SPACER.includes(panel.url_path) ? afterSpacer : beforeSpacer).push(panel);
    });

    const reverseSort = [...panelsOrder].reverse();

    beforeSpacer.sort((a, b) => panelSorter(reverseSort, defaultPanel, a, b, locale.language));
    afterSpacer.sort((a, b) => panelSorter(reverseSort, defaultPanel, a, b, locale.language));

    return [beforeSpacer, afterSpacer];
  }
);
