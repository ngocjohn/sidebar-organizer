import { STORAGE } from '@constants';
import { HA as HomeAssistant } from '@types';
import memoizeOne from 'memoize-one';

import { PanelInfo } from '../types';
import { stringCompare } from './compare';
import { fetchFrontendUserData } from './frontend';
import { BUILT_IN_PANELS, FIXED_PANELS, getDefaultPanelUrlPath, SHOW_AFTER_SPACER_PANELS } from './panel';
import { getStorage } from './storage-utils';

export interface DisplayItem {
  icon?: string | Promise<string | undefined>;
  iconPath?: string;
  value: string;
  label: string;
  description?: string;
  disableSorting?: boolean;
  disableHiding?: boolean;
}

// const SHOW_AFTER_SPACER = ['config', 'developer-tools'];

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

    const allPanels = Object.values(panels).filter((panel) => !FIXED_PANELS.includes(panel.url_path));

    allPanels.forEach((panel) => {
      const isDefaultPanel = panel.url_path === defaultPanel;

      if (
        !isDefaultPanel &&
        (!panel.title ||
          hiddenPanels.includes(panel.url_path) ||
          (panel.default_visible === false && !panelsOrder.includes(panel.url_path)))
      ) {
        return;
      }
      (SHOW_AFTER_SPACER_PANELS.includes(panel.url_path) ? afterSpacer : beforeSpacer).push(panel);
    });

    const reverseSort = [...panelsOrder].reverse();

    beforeSpacer.sort((a, b) => panelSorter(reverseSort, defaultPanel, a, b, locale.language));
    afterSpacer.sort((a, b) => panelSorter(reverseSort, defaultPanel, a, b, locale.language));

    return [beforeSpacer, afterSpacer];
  }
);

export const computeInitialPanelOrder = (
  panels: HomeAssistant['panels'],
  defaultPanel: string,
  locale: HomeAssistant['locale']
): { beforeSpacer: PanelInfo[]; builtInDefaultNotVisible: PanelInfo[] } => {
  if (!panels) {
    return { beforeSpacer: [], builtInDefaultNotVisible: [] };
  }

  const beforeSpacer: PanelInfo[] = [];
  const builtInDefaultNotVisible: PanelInfo[] = [];

  const allPanels = Object.values(panels).filter(
    (panel) => ![...FIXED_PANELS, SHOW_AFTER_SPACER_PANELS].includes(panel.url_path)
  );

  allPanels.forEach((panel) => {
    const isDefaultPanel = panel.url_path === defaultPanel;

    if (
      !isDefaultPanel &&
      (!panel.title || (panel.default_visible === false && !BUILT_IN_PANELS.includes(panel.url_path)))
    ) {
      return;
    }
    (BUILT_IN_PANELS.includes(panel.url_path) ? builtInDefaultNotVisible : beforeSpacer).push(panel);
  });
  const reverseSort = [...Object.keys(panels)].reverse();

  beforeSpacer.sort((a, b) => panelSorter(reverseSort, defaultPanel, a, b, locale.language));

  return { beforeSpacer, builtInDefaultNotVisible };
};

export const getBuiltInPanels = async (panels: HomeAssistant['panels'], defaultPanel: string): Promise<PanelInfo[]> => {
  if (!panels) {
    return [];
  }
  return Object.values(panels).filter(
    (panel) => BUILT_IN_PANELS.includes(panel.url_path!) && panel.url_path !== defaultPanel
  );
};

type BasePanelData = {
  panelOrder?: string[];
  hiddenPanels?: string[];
};

export const getBasePanelData = async (hass: HomeAssistant): Promise<BasePanelData> => {
  let panelOrder: string[] | undefined;
  let hiddenPanels: string[] | undefined;
  try {
    const data = await fetchFrontendUserData(hass.connection, 'sidebar');
    panelOrder = data?.panelOrder;
    hiddenPanels = data?.hiddenPanels;

    if (!panelOrder) {
      const storedOrder = getStorage(STORAGE.PANEL_ORDER);
      panelOrder = JSON.parse(storedOrder || 'null') || [];
    }
    if (!hiddenPanels) {
      const storedHidden = getStorage(STORAGE.HIDDEN_PANELS);
      hiddenPanels = JSON.parse(storedHidden || 'null') || [];
    }
  } catch (err: any) {
    console.error('Error fetching frontend user data for sidebar:', err);
  }
  return { panelOrder, hiddenPanels };
};

export const getPanelItems = async (hass: HomeAssistant): Promise<{ order: string[]; hidden: string[] }> => {
  const { panelOrder, hiddenPanels } = await getBasePanelData(hass);
  const defaultPanel = getDefaultPanelUrlPath(hass);
  const [beforeSpacer] = computePanels(hass.panels, defaultPanel, panelOrder || [], hiddenPanels || [], hass.locale);
  const panels = hass.panels ? Object.values(hass.panels) : [];
  const orderSet = new Set(panelOrder || []);
  const hiddenSet = new Set(hiddenPanels || []);

  for (const panel of panels) {
    if (panel.default_visible === false && !orderSet.has(panel.url_path) && !hiddenSet.has(panel.url_path)) {
      hiddenSet.add(panel.url_path);
    }
  }

  if (hiddenSet.has(defaultPanel)) {
    hiddenSet.delete(defaultPanel);
  }

  const hidden = Array.from(hiddenSet);
  const order = [...beforeSpacer, ...panels.filter((p) => hidden.includes(p.url_path))].map((p) => p.url_path!);

  return { order, hidden };
};
