import type { HaExtened, HaDrawer } from 'types';
import type { HomeAssistant } from 'types/ha';

import { ALERT_MSG, SELECTOR, STORAGE } from '@constants';
import { getPanelItems } from '@utilities/compute-panels';
import { getSiderbarEditDialog } from '@utilities/dom-utils';
import { clearSidebarUserData } from '@utilities/frontend';
import { DialogBoxParams, DialogType, showDialogBox } from '@utilities/show-dialog-box';
import { showDialogSidebarOrganizer } from '@utilities/show-dialog-sidebar-organizer';
import { isStoragePanelEmpty, setStorage } from '@utilities/storage-utils';
import { SidebarOrganizer } from 'main';

export default class DialogHandler {
  readonly haElement: HaExtened;
  readonly _organizer: SidebarOrganizer;
  readonly _haDrawer: HaDrawer;
  public hass: HomeAssistant;

  constructor(haDrawer: HaDrawer, ha: HaExtened, organizer: SidebarOrganizer) {
    this._haDrawer = haDrawer;
    this.haElement = ha;
    this._organizer = organizer;
    this.hass = ha.hass;
  }

  private async _showDialogBox(type: DialogType, params: DialogBoxParams): Promise<any> {
    return await showDialogBox(this._haDrawer, type, params);
  }

  async _alert(message: string, confirmText?: string): Promise<void> {
    return await this._showDialogBox('alert', {
      text: message,
      confirmText,
    });
  }

  async _confirm(message: string, confirmText: string = 'OK', dismissText?: string): Promise<boolean> {
    return await this._showDialogBox('confirm', {
      text: message,
      confirmText,
      dismissText,
    });
  }

  async _prompt(
    message: string,
    placeholder: string,
    confirmText: string = 'OK',
    dismissText: string = 'Cancel'
  ): Promise<string | null> {
    return await this._showDialogBox('prompt', {
      text: message,
      placeholder,
      confirmText,
      dismissText,
      inputType: 'string',
      defaultValue: '',
    });
  }

  public _checkStorageOrder = async (): Promise<void> => {
    if (!isStoragePanelEmpty()) {
      return;
    }
    console.log('%cDIALOG-HANDLER:', 'color: #4dabf7;', 'Storage order is empty, initializing ...');
    if (this._organizer._baseOrder.length > 0) {
      console.log(
        '%cDIALOG-HANDLER:',
        'color: #4dabf7;',
        'Setting storage order to base order',
        this._organizer._baseOrder
      );
      setStorage(STORAGE.PANEL_ORDER, [...this._organizer._baseOrder]);
      return;
    }
    console.log('%cDIALOG-HANDLER:', 'color: #4dabf7;', 'No base order found, computing from current sidebar items');
    const { order, hidden } = await getPanelItems(this.hass);
    setStorage(STORAGE.PANEL_ORDER, [...order]);
    setStorage(STORAGE.HIDDEN_PANELS, [...hidden]);
    console.log(
      '%cDIALOG-HANDLER:',
      'color: #4dabf7;',
      'Computed and set storage order:',
      order,
      'hidden panels:',
      hidden
    );
    return;
  };

  public async _addDialogUserDataClear(): Promise<void> {
    console.log('%cDIALOG-HANDLER:', 'color: #4dabf7;', 'Prompting user to clear sidebar user data ...');
    const confirm = await this._confirm(ALERT_MSG.CLEAN_USER_DATA, 'Clear Data', 'Cancel');
    if (!confirm) {
      console.log('%cDIALOG-HANDLER:', 'color: #4dabf7;', 'User canceled clearing sidebar user data.');
      return;
    }
    // Get current panel data before clearing
    try {
      const currentData = await getPanelItems(this.hass);
      await clearSidebarUserData(this.hass.connection).then(() => {
        // Restore current panel data
        setStorage(STORAGE.PANEL_ORDER, [...currentData.order]);
        setStorage(STORAGE.HIDDEN_PANELS, [...currentData.hidden]);
      });
      console.log('%cDIALOG-HANDLER:', 'color: #4dabf7;', 'Sidebar user data cleared and current data restored.');
      await this._alert('Sidebar user data cleared successfully', 'Show Organizer Dialog');
      this._showConfigDialogEditor();
    } catch (err: any) {
      console.error(
        '%cDIALOG-HANDLER:',
        'color: #f77676;',
        'Error clearing sidebar user data:',
        err instanceof Error ? err.message : err
      );
      await this._alert('Error clearing sidebar user data. See console for details.', 'OK');
    }
  }

  public async _addLegacyEditWarning(): Promise<void> {
    console.log('%cDIALOG-HANDLER:', 'color: #4dabf7;', 'Showing legacy edit warning dialog ...');
    const confirmToEdit = await this._confirm(ALERT_MSG.LEGACY_EDIT_WARNING, 'Edit with Organizer', 'System Dialog');
    if (!confirmToEdit) {
      console.log('%cDIALOG-HANDLER:', 'color: #4dabf7;', 'User chose to use system dialog.');
      return;
    }
    return this._showConfigDialogEditor();
  }

  public async _handleEditModeAttempt(): Promise<void> {
    console.log('%cDIALOG-HANDLER:', 'color: #4dabf7;', 'Handling edit mode attempt ...');
    const dialog = await this._waitForSidebarDialog();
    if (!dialog) return;

    dialog._open = false;

    const forceShowConfirm = Boolean(!this._organizer._userHasSidebarSettings && this._organizer._hasSidebarConfig);
    if (forceShowConfirm) {
      const confirmToEdit = await this._confirm(
        ALERT_MSG.HAS_SIDEBAR_CONFIG_WARNING,
        'Edit with Organizer',
        'Continue'
      );
      if (confirmToEdit) {
        dialog.remove();
        console.log('%cDIALOG-HANDLER:', 'color: #4dabf7;', 'User chose to continue with system dialog.');
        return this._showConfigDialogEditor();
      }
    } else {
      console.log(
        '%cDIALOG-HANDLER:',
        'color: #4dabf7;',
        'User has sidebar settings, adding button to open organizer dialog.'
      );
    }

    dialog._open = true;
    this._injectOrganizerButton(dialog);
  }

  private _injectOrganizerButton(dialog: any): void {
    setTimeout(() => {
      const button = this._createButtonToOpenOrganizer(dialog);
      const actions =
        dialog.shadowRoot?.querySelector(SELECTOR.ACTION_SLOT) ??
        dialog.shadowRoot?.querySelector(SELECTOR.HA_DIALOG_FOOTER).shadowRoot?.querySelector(SELECTOR.FOOTER);
      if (actions && !actions.querySelector('ha-button')) {
        console.log('Actions Element:', actions);
        actions.prepend(button);
      }
    }, 100);
  }

  private _createButtonToOpenOrganizer(dialog: any): HTMLElement {
    const button = document.createElement('ha-button');
    button.slot = 'actions';
    button.innerText = 'Switch to Sidebar Organizer';
    button.addEventListener('click', async () => {
      dialog.closeDialog();
      dialog.remove();
      if (this._organizer._userHasSidebarSettings) {
        console.log(
          '%cDIALOG-HANDLER:',
          'color: #4dabf7;',
          'User has sidebar settings, add dialog to clear user data before opening organizer.'
        );
        this._addDialogUserDataClear();
        return;
      }
      this._showConfigDialogEditor();
    });
    return button;
  }

  private async _waitForSidebarDialog(): Promise<any> {
    let dialog = null;
    for (let i = 0; i < 10 && !dialog; i++) {
      dialog = await getSiderbarEditDialog(this.haElement);
      if (!dialog) {
        console.log('Waiting for dialog-edit-sidebar to be available...');
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    return dialog;
  }
  public _showConfigDialogEditor = async (): Promise<void> => {
    this._haDrawer.open!! = false;
    this._organizer.HaSidebar.editMode = false;
    this._checkStorageOrder();

    showDialogSidebarOrganizer(this.haElement, { config: this._organizer._config });
  };
}
