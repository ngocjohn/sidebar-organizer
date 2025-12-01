import { ELEMENT } from '@constants';
import { SidebarConfig } from '@types';

import { fireEvent, HASSDomEvent, ValidHassDomEvent } from './fire_event';

declare global {
  // for fire event
  interface HASSDomEvents {
    'show-dialog': ShowDialogParams<unknown>;
    'close-dialog': undefined;
    'dialog-closed': DialogClosedParams;
  }
  // for add event listener
  interface HTMLElementEventMap {
    'show-dialog': HASSDomEvent<ShowDialogParams<unknown>>;
    'dialog-closed': HASSDomEvent<DialogClosedParams>;
  }
}

export interface SidebarConfigDialogParams {
  config: SidebarConfig;
}
export const loadSidebarOrganizerDialog = () => import('../components/sidebar-organizer-dialog');

export const showDialogSidebarOrganizer = (el: HTMLElement, dialogParam: SidebarConfigDialogParams): void => {
  fireEvent(el, 'show-dialog', {
    dialogTag: ELEMENT.SIDEBAR_CONFIG_DIALOG_WRAPPER,
    dialogImport: loadSidebarOrganizerDialog,
    dialogParams: dialogParam,
  });
};

export interface HassDialog<T = HASSDomEvents[ValidHassDomEvent]> extends HTMLElement {
  showDialog(params: T);
  closeDialog?: () => boolean;
}

interface ShowDialogParams<T> {
  dialogTag: keyof HTMLElementTagNameMap;
  dialogImport: () => Promise<unknown>;
  dialogParams: T;
  addHistory?: boolean;
}

export interface DialogClosedParams {
  dialog: string;
}
