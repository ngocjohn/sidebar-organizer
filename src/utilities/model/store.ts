import { NAMESPACE, STORAGE } from '@constants';
import { HaExtened, PANEL_TYPE, PanelInfo, SidebardPanelConfig } from '@types';
import * as COMPUTE_PANELS from '@utilities/compute-panels';
import { cleanItemsFromConfig } from '@utilities/configs';
import { compareDashboardItems, DashboardComparison, fetchDashboards, LovelaceDashboard } from '@utilities/dashboard';
import { subscribeFrontendUserData } from '@utilities/frontend';
import * as PANEL_UTILS from '@utilities/panel';
import { shallowEqual } from '@utilities/shallow-equal';
import { setStorage } from '@utilities/storage-utils';
import { showToast } from '@utilities/toast-notify';
import { fetchUsers } from '@utilities/user';
import { pick } from 'es-toolkit/compat';
import { UnsubscribeFunc } from 'home-assistant-js-websocket';
import { SidebarOrganizer } from 'main';
import { HomeAssistant } from 'types/ha';

interface DashboardState {
  defaultPanel?: PanelInfo;
  dashboards?: LovelaceDashboard[];
}

export default class Store {
  readonly haElement: HaExtened;
  private _organizer: SidebarOrganizer;
  public hass: HomeAssistant;
  public _panelHelper = PANEL_UTILS;
  public _computePanels = COMPUTE_PANELS;

  public _dashboardState?: DashboardState = {};
  private unsubData?: Promise<UnsubscribeFunc>;

  constructor(ha: HaExtened, organizer: SidebarOrganizer) {
    this.haElement = ha;
    this._organizer = organizer;
    this.hass = ha.hass;
  }

  public _getUsers = async () => {
    return await fetchUsers(this.hass);
  };

  public _subscribeUserDefaultPanel(): void {
    if (Boolean(this._organizer._userHasSidebarSettings || !this._organizer._hasSidebarConfig)) {
      return;
    }
    this.unsubData = subscribeFrontendUserData(this.hass.connection, 'core', ({ value }) => {
      if (value !== null) {
        const defaultPanel = value.default_panel;
        if (defaultPanel && this._organizer._baseOrder[0] !== defaultPanel) {
          console.log(
            '%cSTORE:',
            'color: #4dabf7;',
            'Default panel changed to',
            defaultPanel,
            'from',
            this._organizer._baseOrder[0]
          );
          const newDefaultPanel = PANEL_UTILS.getPanelTitleFromUrlPath(this.hass, defaultPanel) || defaultPanel;
          const toastParams = {
            id: 'sidebar-organizer-default-panel-changed',
            message: `${NAMESPACE.toUpperCase()}: Default panel changed to ${newDefaultPanel}. Reload page to apply changes.`,
            action: {
              text: 'Reload',
              action: () => this._handleDefaultPanelChange(defaultPanel),
            },
            duration: -1,
            dismissable: false,
          };
          showToast(this.haElement, toastParams);
        }
      }
    });
  }

  public async _subscribeDashboardData(): Promise<void> {
    console.log('%cSTORE:', 'color: #4dabf7;', 'Subscribing to frontend system core data changes');
    const dashboardState: DashboardState = {};
    dashboardState.dashboards = await fetchDashboards(this.hass);
    dashboardState.defaultPanel = PANEL_UTILS.getDefaultPanel(this.hass);
    this._dashboardState = dashboardState;
    console.log('%cSTORE:', 'color: #4dabf7;', 'Fetched dashboards and default panel', this._dashboardState);
  }

  public async _handleDashboardUpdate(): Promise<Boolean> {
    let hasChanged = false;
    const { dashboards, defaultPanel } = this._dashboardState || {};
    const { _baseOrder, _config } = this._organizer;

    const updatedDefaultPanel = PANEL_UTILS.getDefaultPanel(this.hass);
    const defaultPanelChanged = !shallowEqual(defaultPanel, updatedDefaultPanel);

    const { currentItems, added, removed } = (await compareDashboardItems(
      this.hass,
      _baseOrder
    )) as DashboardComparison;
    const currentItemsLength = Object.values(currentItems).flat().length;
    const addedOrItemChanged = Boolean(
      added.length > 0 || dashboards?.length !== currentItemsLength || dashboards?.length < currentItemsLength
    );
    if (defaultPanelChanged || removed.length > 0) {
      const itemToRemove = [...removed, defaultPanel?.url_path || ''].filter(Boolean);
      const config = { ..._config };
      const configToUpdate = pick(config, [
        PANEL_TYPE.CUSTOM,
        PANEL_TYPE.BOTTOM,
        PANEL_TYPE.HIDDEN,
      ]) as SidebardPanelConfig;
      const updatedPanels = cleanItemsFromConfig(configToUpdate, itemToRemove);
      const configChanged = !shallowEqual(configToUpdate, updatedPanels);
      if (configChanged) {
        console.log('%cSTORE:', 'color: #4dabf7;', 'Dashboard items changed. Updating config...');

        const newConfig = { ...config, ...updatedPanels };
        setStorage(STORAGE.UI_CONFIG, newConfig);
        hasChanged = true;
      } else {
        console.log('%cSTORE:', 'color: #4dabf7;', 'No config changes detected.');
      }
    } else if (addedOrItemChanged) {
      console.log('%cSTORE:', 'color: #4dabf7;', 'Dashboard items added or changed. reload page to apply changes.');
      hasChanged = true;
    }

    return hasChanged;
  }

  public _handleDefaultPanelChange(defaultPanel: string): void {
    const config = { ...this._organizer._config };
    const configToUpdate = pick(config, [
      PANEL_TYPE.CUSTOM,
      PANEL_TYPE.BOTTOM,
      PANEL_TYPE.HIDDEN,
    ]) as SidebardPanelConfig;
    const updatedPanels = cleanItemsFromConfig(configToUpdate, [defaultPanel]);
    const newConfig = { ...config, ...updatedPanels };
    setStorage(STORAGE.UI_CONFIG, newConfig);
    this._organizer._reloadWindow();
  }

  public resetDashboardState(): void {
    this._dashboardState = undefined;
    this.unsubData = undefined;
  }

  public _needReloadToast = (): void => {
    const toastParams = {
      id: 'sidebar-organizer-panels-changed-reload',
      message: `${NAMESPACE.toUpperCase()}: Changes detected in sidebar panels. Reload page to apply changes.`,
      action: {
        text: 'Reload',
        action: () => this._organizer._reloadWindow(),
      },
      duration: -1,
      dismissable: false,
    };
    showToast(this.haElement, toastParams);
  };

  public _showToast = (message: string, duration = 1000): void => {
    showToast(this.haElement, {
      message: `${NAMESPACE.toUpperCase()}: ${message}`,
      duration,
    });
  };
}
