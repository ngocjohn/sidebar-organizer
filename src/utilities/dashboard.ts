import type { HA as HomeAssistant, PanelInfo } from '../types';

import { LitElement } from 'lit';

import { stringCompare } from './compare';
import { getHiddenBuiltInPanels, getPanelsNotShownInSidebar } from './compute-panels';
import { FIXED_PANELS, getDefaultPanelUrlPath, getPanelIcon, getPanelTitle, PANEL_DASHBOARDS } from './panel';

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
  const panels = hass.panels || {};
  const defaultPanel = getDefaultPanelUrlPath(hass);

  // A panel is shown in the sidebar when it has a title, isn't a fixed panel,
  // isn't explicitly hidden (`show_in_sidebar === false`) and isn't a built-in
  // panel that is hidden by default and not already part of the panel order.
  const isShownInSidebar = (panel: PanelInfo): boolean =>
    !FIXED_PANELS.includes(panel.url_path) &&
    !!panel.title &&
    (panel.show_in_sidebar ?? true) &&
    !(panel.default_visible === false && !panelOrder.includes(panel.url_path));

  const inSidebar = Object.values(panels)
    .filter(isShownInSidebar)
    .map((panel) => panel.url_path);

  // Panels that exist but are not shown in the sidebar (no title or hidden).
  const notInSidebar = getPanelsNotShownInSidebar(panels, defaultPanel);

  const currentItems = { inSidebar, notInSidebar };
  const added = inSidebar.filter((item) => item !== defaultPanel && !panelOrder.includes(item));
  // Anything in the stored order that is no longer shown in the sidebar is
  // considered removed. This covers both panels that still exist but are hidden
  // (`notInSidebar`) and orphaned entries whose panel no longer exists in
  // `hass.panels` at all (e.g. an uninstalled integration).
  const removed = panelOrder.filter((item) => item !== defaultPanel && !inSidebar.includes(item));
  return {
    currentItems,
    added,
    removed,
  };
};
