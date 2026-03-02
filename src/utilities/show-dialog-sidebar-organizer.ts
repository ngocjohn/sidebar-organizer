import { ELEMENT } from '@constants';
import { SidebarConfig } from '@types';

import { fireEvent } from './fire_event';

export interface SidebarConfigDialogParams {
  config: SidebarConfig;
}
export const loadSidebarOrganizerDialog = () => import('../components/sidebar-organizer-dialog');
export const loadSidebarOrganizerDialogWA = () => import('../components/sidebar-organizer-dialog_wa');

export const showDialogSidebarOrganizer = (
  el: HTMLElement,
  dialogParam: SidebarConfigDialogParams,
  newDialog: boolean = false
): void => {
  fireEvent(el, 'show-dialog', {
    dialogTag: newDialog ? ELEMENT.SIDEBAR_CONFIG_DIALOG_WA : ELEMENT.SIDEBAR_CONFIG_DIALOG_WRAPPER,
    dialogImport: newDialog ? loadSidebarOrganizerDialogWA : loadSidebarOrganizerDialog,
    dialogParams: dialogParam,
  });
};
