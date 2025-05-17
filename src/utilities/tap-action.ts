import { NewItemConfig } from '../types';
type ActionType = 'double_tap' | 'hold' | 'tap';

export const ACTION_TYPES = ['tap_action', 'hold_action', 'double_tap_action'];

export function addHandlerActions(element: HTMLElement, config: NewItemConfig) {
  const handler = new ActionHandler(element, config, sendAction);
  element.addEventListener('pointerdown', handler.handleStart.bind(handler));
  element.addEventListener('pointerup', handler.handleEnd.bind(handler));

  element.addEventListener('contextmenu', (e) => e.preventDefault());
  element.style.cursor = 'pointer';
}

function sendAction(element: HTMLElement, config: NewItemConfig, actionType: ActionType) {
  const getAction = (action: string) => {
    const actionConfig = config?.[action] || { action: 'none' };
    return actionConfig;
  };

  const actionConfig = {
    tap_action: getAction('tap_action'),
    hold_action: getAction('hold_action'),
    double_tap_action: getAction('double_tap_action'),
    entity: config?.entity || null,
  };

  // if (!config.entity || config.entity === null) {
  //   console.warn('No entity found for action');
  //   return;
  // }

  const event = new CustomEvent('hass-action', {
    detail: {
      action: actionType,
      config: actionConfig,
    },
    bubbles: true,
    composed: true,
  });
  element.dispatchEvent(event);
}

class ActionHandler {
  constructor(
    element: HTMLElement,
    config: NewItemConfig,
    sendAction: (element: HTMLElement, config: NewItemConfig, actionType: ActionType) => void
  ) {
    this.element = element;
    this.config = config;
    this.sendAction = sendAction;
    this.tapTimeout = null;
    this.lastTap = 0;
    this.startTime = null;
    this.isSwiping = false;
  }
  private element: HTMLElement;
  private config: NewItemConfig;
  private sendAction: (element: HTMLElement, config: NewItemConfig, actionType: ActionType) => void;
  private tapTimeout: number | null;
  private lastTap: number;
  private startTime: number | null;
  private isSwiping: boolean;
  private startX: number | null = null;
  private startY: number | null = null;

  handleEnd(e: PointerEvent) {
    if (this.startTime === null) return;

    const currentTime = Date.now();
    const holdDuration = currentTime - this.startTime;

    const deltaX = Math.abs((e.clientX || 0) - (this.startX || 0));
    const deltaY = Math.abs((e.clientY || 0) - (this.startY || 0));
    const moveThreshold = 20; // pixels

    if (deltaX > moveThreshold || deltaY > moveThreshold) {
      this.isSwiping = true;
      this.startTime = null;
      console.log('Swipe detected, ignoring tap/hold/double_tap');
      return; // Ignore swipe as a valid tap/hold/double_tap
    }

    const doubleTapDuration = currentTime - this.lastTap;
    this.lastTap = currentTime;
    this.startTime = null;

    if (holdDuration > 500) {
      console.log('Hold detected');
      this.sendAction(this.element, this.config, 'hold');
    } else if (doubleTapDuration < 300) {
      console.log('Double tap detected');
      this.sendAction(this.element, this.config, 'double_tap');
    } else {
      this.tapTimeout = window.setTimeout(() => {
        console.log('Single tap detected');
        this.sendAction(this.element, this.config, 'tap');
      }, 300);
    }
  }
  handleStart(e: PointerEvent) {
    e.preventDefault();
    this.startTime = Date.now();
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.isSwiping = false;
    clearTimeout(this.tapTimeout as number);
  }
}
