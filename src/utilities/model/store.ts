import type { Panels } from '@types';

import { ELEMENT, NAMESPACE, STORAGE } from '@constants';
import { HaExtened, PANEL_TYPE, PanelInfo, SidebardPanelConfig } from '@types';
import * as COMPUTE_PANELS from '@utilities/compute-panels';
import { cleanItemsFromConfig } from '@utilities/configs';
import * as CONFIG from '@utilities/configs';
import { compareDashboardItems, DashboardComparison, fetchDashboards, LovelaceDashboard } from '@utilities/dashboard';
import * as DASHBOARD_HELPERS from '@utilities/dashboard';
import { subscribeFrontendUserData } from '@utilities/frontend';
import * as OBJECT_DIFF from '@utilities/object-differences';
import * as PANEL_HELPER from '@utilities/panel';
import { shallowEqual } from '@utilities/shallow-equal';
import { setStorage } from '@utilities/storage-utils';
import { showToast } from '@utilities/toast-notify';
import { isEmpty, pick } from 'es-toolkit/compat';
import { UnsubscribeFunc } from 'home-assistant-js-websocket';

import { SidebarOrganizer } from '../../sidebar-organizer';
import { HomeAssistant } from '../../types/ha';

type DataTableItem = Pick<
  LovelaceDashboard,
  'icon' | 'title' | 'show_in_sidebar' | 'require_admin' | 'mode' | 'url_path'
> & {
  default: boolean;
  filename: string;
  localized_type: string;
  type: string;
};

interface DashboardState {
  defaultPanel?: PanelInfo;
  dashboards?: LovelaceDashboard[];
}

interface DashboardPanels {
  initialPanels?: DataTableItem[];
  added?: PanelInfo[];
  notShowInSidebar?: PanelInfo[];
  removed?: string[];
}
export default class Store {
  private haElement: HaExtened;
  private _organizer: SidebarOrganizer;
  public hass: HomeAssistant;

  public _dashboardState?: DashboardState = {};
  public _dasboardPanels?: DashboardPanels = {};

  public _panelHasChanged = false;
  public _defaultPanelHasChanged = false;

  private unsubData?: Promise<UnsubscribeFunc>;

  public _utils = {
    PANEL: PANEL_HELPER,
    COMPUTE_PANELS,
    DASHBOARD: DASHBOARD_HELPERS,
    OBJECT: OBJECT_DIFF,
    CONFIG,
  };

  constructor(ha: HaExtened, organizer: SidebarOrganizer) {
    this.haElement = ha;
    this._organizer = organizer;
    this.hass = ha.hass;
  }

  get notConfigured(): boolean {
    return Boolean(this._organizer._hasSidebarConfig && !this._organizer._userHasSidebarSettings);
  }

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
          const newDefaultPanel = PANEL_HELPER.getPanelTitleFromUrlPath(this.hass, defaultPanel) || defaultPanel;
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

  private _getPanelItems = async (userDefault: boolean = false): Promise<DataTableItem[]> => {
    const configLovelaceDashboards = (await this._organizer._panelResolver.selector.query(
      ELEMENT.CONFIG_LOVELACE_DASHBOARDS
    ).element) as any;
    const defaultPanel = !userDefault
      ? this.hass.systemData?.default_panel || 'home'
      : PANEL_HELPER.getDefaultPanelUrlPath(this.hass);
    return configLovelaceDashboards._getItems(configLovelaceDashboards._dashboards, defaultPanel, this.hass.panels);
  };

  public _subscribePanels(): void {
    if (Boolean(this._organizer._userHasSidebarSettings || !this._organizer._hasSidebarConfig)) {
      return;
    }

    console.log('%cSTORE:', 'color: #4dabf7;', 'Subscribing to sidebar panels changes');
    const hasUserDefaultPanel = Boolean(this.hass.userData?.default_panel);
    if (!this._dasboardPanels?.initialPanels) {
      this._getPanelItems(hasUserDefaultPanel).then((items) => {
        this._dasboardPanels = {
          initialPanels: [...items],
          notShowInSidebar:
            items.filter((item) => !item.show_in_sidebar).map((item) => this.hass.panels[item.url_path]!) || [],
        };
        console.log(
          '%cSTORE:',
          'color: #4dabf7;',
          'Fetched initial panels and computed not_show_in_sidebar',
          this._dasboardPanels
        );
      });
    }

    this._utils.PANEL.subscribePanels(this.hass.connection, async (panels: Panels) => {
      const initDasboardPanels = this._dasboardPanels!;
      const initialPanels = initDasboardPanels.initialPanels || [];
      const newDasboards = await this._getPanelItems(hasUserDefaultPanel);
      // Get deleted panels and added panels, by comparing new dashboards with initial panels
      const removed = initialPanels
        .filter((item) => Object.values(newDasboards).every((newItem) => newItem.url_path !== item.url_path))
        .map((item) => item.url_path);
      // Get added panels, by filtering new dashboards that are not in initial panels
      const added = newDasboards.filter((item) => !initialPanels.some((oldItem) => oldItem.url_path === item.url_path));
      const notShowInSidebar =
        newDasboards.filter((item) => !item.show_in_sidebar).map((item) => panels[item.url_path]!) || [];
      if (
        added.length > 0 ||
        removed.length > 0 ||
        !shallowEqual(notShowInSidebar, initDasboardPanels.notShowInSidebar || [])
      ) {
        this._dasboardPanels = {
          ...initDasboardPanels,
          ...(!isEmpty(added) && { added: added.map((item) => panels[item.url_path]!) }),
          ...(!isEmpty(removed) && { removed: removed }),
          ...(!isEmpty(notShowInSidebar) && { notShowInSidebar }),
        };
        console.log(
          '%cSTORE:',
          'color: #4dabf7;',
          'Detected changes in sidebar panels',
          { added, removed, notShowInSidebar },
          'Updated dashboard panels state:',
          this._dasboardPanels
        );
        this._panelHasChanged = true;
      } else {
        console.log('%cSTORE:', 'color: #4dabf7;', 'No changes detected in sidebar panels');
        this._panelHasChanged = false;
      }
    });
  }

  public _shouldUpdateConfig = async (): Promise<Boolean> => {
    let shouldReload = false;
    if (!this._panelHasChanged || !this._dasboardPanels) {
      console.log('%cSTORE:', 'color: #4dabf7;', 'No panel changes to handle');
      return shouldReload;
    }
    const { notShowInSidebar, removed } = this._dasboardPanels;
    const configHelper = this._utils.CONFIG;
    const itemToRemove = new Set([...(removed || []), ...(notShowInSidebar?.map((item) => item.url_path) || [])]);
    if (itemToRemove.size !== 0) {
      const config = { ...this._organizer._config };
      const hasItemsToRemove = configHelper.getAllConfigItems(config).some((item) => itemToRemove.has(item));
      if (hasItemsToRemove) {
        console.log(
          '%cSTORE:',
          'color: #4dabf7;',
          'Panel changes affect current config. Updating config to remove deleted panels...'
        );
        const updatedConfig = configHelper.cleanItemsFromAllPanels(config, itemToRemove as Set<string>);
        const newConfig = { ...config, ...updatedConfig };
        setStorage(STORAGE.UI_CONFIG, newConfig);
        shouldReload = true;
      } else {
        console.log(
          '%cSTORE:',
          'color: #4dabf7;',
          'Panel changes do not affect current config. No need to update config.'
        );
      }
    }
    return shouldReload;
  };

  public async _subscribeDashboardData(): Promise<void> {
    console.log('%cSTORE:', 'color: #4dabf7;', 'Subscribing to frontend system core data changes');
    const dashboardState: DashboardState = {};
    dashboardState.dashboards = await fetchDashboards(this.hass);
    dashboardState.defaultPanel = PANEL_HELPER.getDefaultPanel(this.hass);
    this._dashboardState = dashboardState;
    console.log('%cSTORE:', 'color: #4dabf7;', 'Fetched dashboards and default panel', this._dashboardState);
  }

  public async _handleDashboardUpdate(): Promise<Boolean> {
    let hasChanged = false;
    const { dashboards, defaultPanel } = this._dashboardState || {};
    const { _baseOrder, _config } = this._organizer;

    const updatedDefaultPanel = PANEL_HELPER.getDefaultPanel(this.hass);
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
        PANEL_TYPE.BOTTOM_GRID,
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
    console.log(
      '%cSTORE:',
      'color: #4dabf7;',
      'Handling default panel change to',
      defaultPanel,
      'Updating config and reloading page...'
    );
    const config = { ...this._organizer._config };
    const updatedConfig = this._utils.CONFIG.cleanItemsFromAllPanels(config, [defaultPanel]);
    const newConfig = { ...config, ...updatedConfig };
    setStorage(STORAGE.UI_CONFIG, newConfig);
    this._organizer._reloadWindow();
  }

  public resetDashboardState(): void {
    this._dashboardState = undefined;
    this.unsubData = undefined;
    this._dasboardPanels = undefined;
    this._panelHasChanged = false;
    this._defaultPanelHasChanged = false;
    console.log('%cSTORE:', 'color: #4dabf7;', 'Reset dashboard state');
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

  public _haNotRunningToast = (): void => {
    const toastParams = {
      id: 'sidebar-organizer-ha-not-running',
      message: `${NAMESPACE.toUpperCase()}: Home Assistant is still starting up. Reload page after Home Assistant has fully started.`,
      duration: -1,
      dismissable: false,
      action: {
        text: 'Reload',
        action: () => this._organizer._reloadWindow(),
      },
    };
    showToast(this.haElement, toastParams);
  };
}
