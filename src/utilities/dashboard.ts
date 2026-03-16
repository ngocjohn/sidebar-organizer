import type { HA as HomeAssistant, PanelInfo } from '../types';

import { LitElement } from 'lit';

import { stringCompare } from './compare';
import { getHiddenBuiltInPanels } from './compute-panels';
import { getDefaultPanelUrlPath, getPanelIcon, getPanelTitle, PANEL_DASHBOARDS } from './panel';

export type LovelaceDashboard = LovelaceYamlDashboard | LovelaceStorageDashboard;

interface LovelaceGenericDashboard {
  id: string;
  url_path: string;
  require_admin: boolean;
  show_in_sidebar: boolean;
  icon?: string;
  title: string;
}

export interface LovelaceYamlDashboard extends LovelaceGenericDashboard {
  mode: 'yaml';
  filename: string;
}

export interface LovelaceStorageDashboard extends LovelaceGenericDashboard {
  mode: 'storage';
}

export interface LovelaceDashboardMutableParams {
  require_admin: boolean;
  show_in_sidebar: boolean;
  icon?: string;
  title: string;
}

export interface LovelaceDashboardCreateParams extends LovelaceDashboardMutableParams {
  url_path: string;
  mode: 'storage';
}

export type DataTableItem = Pick<
  LovelaceDashboard,
  'icon' | 'title' | 'show_in_sidebar' | 'require_admin' | 'mode' | 'url_path'
> & {
  default: boolean;
  filename: string;
  localized_type: string;
  type: string;
};

export interface DashboardPanels {
  initialPanels?: DataTableItem[];
  added?: PanelInfo[];
  notShowInSidebar?: PanelInfo[];
  removed?: string[];
}
export const fetchDashboards = (hass: HomeAssistant): Promise<LovelaceDashboard[]> =>
  hass.callWS({
    type: 'lovelace/dashboards/list',
  });

export const createDashboard = (hass: HomeAssistant, values: LovelaceDashboardCreateParams) =>
  hass.callWS<LovelaceDashboard>({
    type: 'lovelace/dashboards/create',
    ...values,
  });

export const updateDashboard = (hass: HomeAssistant, id: string, updates: Partial<LovelaceDashboardMutableParams>) =>
  hass.callWS<LovelaceDashboard>({
    type: 'lovelace/dashboards/update',
    dashboard_id: id,
    ...updates,
  });

export const deleteDashboard = (hass: HomeAssistant, id: string) =>
  hass.callWS({
    type: 'lovelace/dashboards/delete',
    dashboard_id: id,
  });

export interface HaConfigDashboards extends LitElement {
  _dashboards: LovelaceDashboard[];
}

export interface DashboardItems {
  inSidebar: string[];
  notInSidebar: string[];
}

export async function _getCurrentDashboardItems(hass: HomeAssistant): Promise<DashboardItems> {
  const items = await fetchDashboards(hass).then((dashboards) => {
    const inSidebar: string[] = [];
    const notInSidebar: string[] = [];
    dashboards.forEach((dashboard) => {
      if (dashboard.show_in_sidebar) {
        inSidebar.push(dashboard.url_path);
      } else {
        notInSidebar.push(dashboard.url_path);
      }
    });
    return { inSidebar, notInSidebar };
  });
  return items;
}

export interface DashboardComparison {
  currentItems: DashboardItems;
  added: string[];
  removed: string[];
}
export const compareDashboardItems = async (
  hass: HomeAssistant,
  sidebarPanelList: string[]
): Promise<DashboardComparison> => {
  const currentItems = await _getCurrentDashboardItems(hass);
  const hiddenBuiltInPanels = getHiddenBuiltInPanels(hass);
  const added = currentItems.inSidebar.filter((item) => !sidebarPanelList.includes(item));
  const removed = [currentItems.notInSidebar, hiddenBuiltInPanels]
    .flat()
    .filter((panel) => sidebarPanelList.includes(panel));
  return { currentItems, added, removed };
};

export const getPanelItems = async (hass: HomeAssistant): Promise<DataTableItem[]> => {
  const dashboards = await fetchDashboards(hass);
  const defaultUrlPath = getDefaultPanelUrlPath(hass);
  const panels = hass.panels || {};

  const result: DataTableItem[] = [];
  PANEL_DASHBOARDS.forEach((panel) => {
    const panelInfo = panels[panel];
    if (!panelInfo) {
      return;
    }
    const item: DataTableItem = {
      icon: getPanelIcon(panelInfo),
      title: getPanelTitle(hass, panelInfo) || panelInfo.url_path,
      show_in_sidebar: panelInfo.show_in_sidebar || false,
      mode: 'storage',
      url_path: panelInfo.url_path,
      filename: '',
      default: defaultUrlPath === panelInfo.url_path,
      require_admin: panelInfo.require_admin || false,
      type: 'built_in',
      localized_type: 'built_in',
    };
    result.push(item);
  });

  result.push(
    ...dashboards
      .sort((a, b) => stringCompare(a.title, b.title, hass.locale.language))
      .map(
        (dashboard) =>
          ({
            filename: '',
            ...dashboard,
            default: defaultUrlPath === dashboard.url_path,
            type: 'user_created',
            localized_type: 'user_created',
          }) satisfies DataTableItem
      )
  );
  return result;
};

export const comparePanelItems = async (hass: HomeAssistant, panelOrder: string[]): Promise<DashboardComparison> => {
  const currentItems = await getPanelItems(hass).then((items) => {
    const notInSidebar = items.filter((item) => !item.show_in_sidebar).map((item) => item.url_path);
    const inSidebar = items.filter((item) => item.show_in_sidebar).map((item) => item.url_path);
    return { inSidebar, notInSidebar };
  });
  const added = currentItems.inSidebar.filter((item) => !panelOrder.includes(item));
  const removed = currentItems.notInSidebar.filter((item) => panelOrder.includes(item));
  return {
    currentItems,
    added,
    removed,
  };
};
