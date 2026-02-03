import { pick } from 'es-toolkit/compat';

import { NewItemConfig } from '../types';
import { ActionsSharedConfig } from './action';
type ActionType = 'double_tap' | 'hold' | 'tap';

export const ACTION_TYPES = ['tap_action', 'hold_action', 'double_tap_action'];

export const getActionConfig = (config: NewItemConfig): ActionsSharedConfig =>
  pick(config, ['entity', ...ACTION_TYPES]) as ActionsSharedConfig;

export function addHandlerActions(element: HTMLElement, config: ActionsSharedConfig) {
  const handler = new ActionHandler(element, config, sendAction);
  element.addEventListener('pointerdown', handler.handleStart.bind(handler));
  element.addEventListener('pointerup', handler.handleEnd.bind(handler));

  element.addEventListener('contextmenu', (e) => e.preventDefault());

  element.addEventListener('click', (e) => {
    e.preventDefault(); // no href="#" jump
    e.stopImmediatePropagation(); // stop HA / other click handlers, if desired
  });

  element.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // manually trigger the pointer logic or directly send a tap:
      handler.handleStart(e as any);
      handler.handleEnd(e as any);
    }
  });
  element.style.cursor = 'pointer';
}

function sendAction(element: HTMLElement, config: ActionsSharedConfig, actionType: ActionType) {
  // if (!config.entity || config.entity === null) {
  //   console.warn('No entity found for action');
  //   return;
  // }

  setTimeout(() => {
    const event = new CustomEvent('hass-action', {
      detail: {
        action: actionType,
        config: config,
      },
      bubbles: true,
      composed: true,
    });
    element.dispatchEvent(event);
  }, 1);
}

class ActionHandler {
  constructor(
    element: HTMLElement,
    config: ActionsSharedConfig,
    sendAction: (element: HTMLElement, config: ActionsSharedConfig, actionType: ActionType) => void
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
  private config: ActionsSharedConfig;
  private sendAction: (element: HTMLElement, config: ActionsSharedConfig, actionType: ActionType) => void;
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
        // console.log('Single tap detected');
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
