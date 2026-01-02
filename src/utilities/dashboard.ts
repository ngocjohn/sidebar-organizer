import type { HA as HomeAssistant } from '../types';

import { LitElement } from 'lit';

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
export const compareDashboardItems = async (hass: HomeAssistant, panels: string[]): Promise<DashboardComparison> => {
  const currentItems = await _getCurrentDashboardItems(hass);
  const added = currentItems.inSidebar.filter((item) => !panels.includes(item));
  const removed = currentItems.notInSidebar.filter((panel) => panels.includes(panel));
  return { currentItems, added, removed };
};
