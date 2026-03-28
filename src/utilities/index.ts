export * from './dom-utils';
export * from './custom-styles';
export * from './show-dialog-box';
export * from './colors';
export * from './preview-items';
export * from './storage-utils';
export * from './logger';
export * from './ws-templates';
export * from './apply-theme';
export * from './is-icon';
export * from './localize';
export * from './tap-action';
export * from './frontend';
export * from './action';
export * from './sidebar-config-changed';
export * from './create-ha-form';
export * from './compare';
export * from './compute-panels';
export * from './merge-with-cleanup';
export * from './object-differences';
export * from './fire_event';

import * as ACTIONS from './action-menu';
import { ARRAY_UTILS } from './array';
import * as COMPUTE_PANELS from './compute-panels';
import * as CONFIG from './configs';
import * as DASHBOARD_HELPERS from './dashboard';
import { mapItemsForDebug } from './dom-utils';
import * as OBJECT_DIFF from './object-differences';
import * as PANEL_HELPER from './panel';

export const UTILITIES = {
  PANEL: PANEL_HELPER,
  COMPUTE_PANELS,
  DASHBOARD: DASHBOARD_HELPERS,
  OBJECT: OBJECT_DIFF,
  CONFIG,
  DOM: { mapItemsForDebug, actionHelper: ACTIONS },
  ARRAY: ARRAY_UTILS,
};
