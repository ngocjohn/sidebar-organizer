import { mdiClose, mdiInformation } from '@mdi/js';
import { HomeAssistant } from 'custom-card-helpers';
import { html, TemplateResult } from 'lit';
import tinycolor from 'tinycolor2';

import { repository, version, description, name } from '../package.json';

const repoLink = `${repository.url}`;
export const randomId = (): string => Math.random().toString(16).slice(2);
const HOLD_DURATION = 300;

export const createCloseHeading = (
  hass: HomeAssistant | undefined,
  title: string | TemplateResult,
  addedContent?: TemplateResult
) => html`
  <div class="header_title">
    <ha-icon-button
      .label=${hass?.localize('ui.dialogs.generic.close') ?? 'Close'}
      .path=${mdiClose}
      dialogAction="close"
    >
    </ha-icon-button>
    <span style="flex: 1;">${title}</span>
    ${addedContent}
    <ha-icon-button .path=${mdiInformation} @click=${() => window.open(repoLink)}> </ha-icon-button>
  </div>
`;

export const color2rgba = (color: string, alpha: number = 1): string | void => {
  const colorObj = tinycolor(color);
  if (!colorObj.isValid()) return;
  const newColor = colorObj.setAlpha(colorObj.getAlpha() / alpha).toRgbString();
  return newColor;
};

export const hex2rgb = (hex: string): [number, number, number] => {
  return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
};

export function addAction(configItem: HTMLElement, action?: () => void, clickAction?: () => void): void {
  // Variable to keep track of whether the user is holding the mouse or touch
  let isMouseHold = false;
  let isLongPress = false;
  let timeoutref: ReturnType<typeof setTimeout> | undefined;

  // Function to handle the common logic for both touch and mouse down events
  const handleDownEvent = (e: Event) => {
    e.stopPropagation();
    // Check if it's a mouse event and ensure it's the left button (button 0)
    if (e instanceof MouseEvent && e.button !== 0) return;

    isMouseHold = true;
    isLongPress = false;

    // Set a timeout for 300ms to trigger the long press action
    timeoutref = setTimeout(() => {
      if (isMouseHold && action) {
        isLongPress = true;
        action(); // Trigger long-press action
        // console.log('Long press detected');
      }
    }, HOLD_DURATION);
  };

  const handleUpEvent = (e: Event) => {
    e.stopPropagation();

    // Clear the timeout if the user releases
    if (timeoutref) clearTimeout(timeoutref);
    isMouseHold = false;

    // Prevent click action if it was a long-press
    if (isLongPress) {
      e.preventDefault();
      isLongPress = false;
    }
    // Trigger click action if hold was not a long press
    if (!isLongPress && clickAction) {
      clickAction();
    }
  };

  // Add event listeners for both mouse and touch
  ['touchstart', 'mousedown'].forEach((eventType) => {
    configItem.addEventListener(eventType, handleDownEvent);
  });

  ['touchend', 'mouseup'].forEach((eventType) => {
    configItem.addEventListener(eventType, handleUpEvent);
  });
}

export const getStorage = (key: string): string | null => {
  return localStorage.getItem(key);
};

export const setStorage = (key: string, value: any): void => {
  return localStorage.setItem(key, JSON.stringify(value));
};

export const removeStorage = (key: string): void => {
  return localStorage.removeItem(key);
};

export const logConsoleInfo = () => {
  const repo = repository.url;
  const namepsace = name.toUpperCase();
  const sponsor = 'https://github.com/sponsors/ngocjohn';
  const line1 = `   🗂️ ${namepsace} 🧹 v${version} 🗄️`;
  const line2 = `   ${repo}`;
  const length = Math.max(line1.length, line2.length) + 3;
  const pad = (text: string, length: number) => text + ' '.repeat(length - text.length);

  console.groupCollapsed(
    `%c${pad(line1, length)}\n%c${pad(line2, length)}`,
    'color: orange; font-weight: bold; background: transparent',
    'font-weight: bold; background: dimgray'
  );
  console.info(`${description}`);
  console.info(`Github: ${repo}`);
  console.info(`If you like the project, consider supporting the developer: ${sponsor}`);
  console.groupEnd();
};
