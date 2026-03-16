import type { Panels } from '@types';

import { ELEMENT, NAMESPACE, STORAGE } from '@constants';
import { HaExtened } from '@types';
import * as COMPUTE_PANELS from '@utilities/compute-panels';
import * as CONFIG from '@utilities/configs';
import * as DASHBOARD_HELPERS from '@utilities/dashboard';
import { DashboardPanels, DataTableItem } from '@utilities/dashboard';
import { nextRender } from '@utilities/dom-utils';
import { CoreFrontendUserData, subscribeFrontendUserData } from '@utilities/frontend';
import * as OBJECT_DIFF from '@utilities/object-differences';
import * as PANEL_HELPER from '@utilities/panel';
import { shallowEqual } from '@utilities/shallow-equal';
import { setStorage } from '@utilities/storage-utils';
import { showToast } from '@utilities/toast-notify';
import { isEmpty } from 'es-toolkit/compat';
import { UnsubscribeFunc } from 'home-assistant-js-websocket';

import { SidebarOrganizer } from '../../sidebar-organizer';
import { HomeAssistant } from '../../types/ha';

export default class Store {
  private haElement: HaExtened;
  private _organizer: SidebarOrganizer;
  public hass: HomeAssistant;

  public _dashboardPanels?: DashboardPanels = {};

  public _panelHasChanged = false;
  public _defaultPanelHasChanged = false;

  public _coreUserData?: CoreFrontendUserData | null;
  private _unsubCoreData?: Promise<UnsubscribeFunc>;

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
    this.resetDashboardState();
  }

  get pluginConfigured(): boolean {
    return Boolean(this._organizer._hasSidebarConfig && !this._organizer._userHasSidebarSettings);
  }
  public _getCoreData() {
    if (!this.pluginConfigured) {
      return;
    }
    const defaultPanel = PANEL_HELPER.getDefaultPanelUrlPath(this.hass);
    console.log(
      '%cSTORE:',
      'color: #4dabf7;',
      'Subscribing to core frontend user data',
      'Current user default panel:',
      defaultPanel
    );
    this._unsubCoreData = subscribeFrontendUserData(this.hass.connection, 'core', async ({ value }) => {
      this._coreUserData = value;
      // console.log('%cSTORE:', 'color: #4dabf7;', 'Received core frontend user data:', value);
      const userDefaultPanel = value?.default_panel;
      const hasChangeInDefaultPanel = Boolean(userDefaultPanel && defaultPanel !== userDefaultPanel);
      if (hasChangeInDefaultPanel) {
        console.log(
          '%cSTORE:',
          'color: #4dabf7;',
          'User default panel changed to',
          userDefaultPanel,
          'from',
          defaultPanel
        );
        this._needReloadToast();
        return;
      }
      await nextRender();
      this._organizer._checkDiffs();
    });
  }
  public _profilePageDisconnect() {
    if (this._unsubCoreData) {
      this._unsubCoreData.then((unsub) => unsub());
      this._unsubCoreData = undefined;
      console.log('%cSTORE:', 'color: #4dabf7;', 'Unsubscribed from core frontend user data', this._coreUserData);
    }
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

  public async _subscribePanels(): Promise<void> {
    if (Boolean(this._organizer._userHasSidebarSettings || !this._organizer._hasSidebarConfig)) {
      return;
    }

    console.log('%cSTORE:', 'color: #4dabf7;', 'Subscribing to sidebar panels changes');
    const hasUserDefaultPanel = Boolean(this.hass.userData?.default_panel);
    if (!this._dashboardPanels?.initialPanels) {
      console.log('%cSTORE:', 'color: #4dabf7;', 'Initializing dashboard panels state');
      await this._getPanelItems(hasUserDefaultPanel).then((items) => {
        this._dashboardPanels = {
          initialPanels: [...items],
          notShowInSidebar:
            items.filter((item) => !item.show_in_sidebar).map((item) => this.hass.panels[item.url_path]!) || [],
        };
      });
      console.log('%cSTORE:', 'color: #4dabf7;', 'Initial dashboard panels state set to', this._dashboardPanels);
    }

    this._utils.PANEL.subscribePanels(this.hass.connection, async (panels: Panels) => {
      const initDasboardPanels = this._dashboardPanels ?? { initialPanels: [], notShowInSidebar: [] };
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
        this._dashboardPanels = {
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
          this._dashboardPanels
        );
        this._panelHasChanged = true;
        await nextRender();
        this._needReloadToast();
      } else {
        this._panelHasChanged = false;
      }
    });
  }

  public _shouldUpdateConfig = async (): Promise<Boolean> => {
    let shouldReload = false;
    if (!this._panelHasChanged || !this._dashboardPanels) {
      return shouldReload;
    }
    const { notShowInSidebar, removed } = this._dashboardPanels;
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

  public resetDashboardState(): void {
    this._dashboardPanels = undefined;
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
