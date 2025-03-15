import { mdiClose } from '@mdi/js';
import { HomeAssistant } from 'custom-card-helpers';
import { html, TemplateResult } from 'lit';
import tinycolor from 'tinycolor2';

import { CustomStyles } from './types';

export const randomId = (): string => Math.random().toString(16).slice(2);
const HOLD_DURATION = 300;

export const createCloseHeading = (
  hass: HomeAssistant | undefined,
  title: string | TemplateResult,
  addedContent?: TemplateResult
) => {
  const headerStyle = `
    display: flex;
    align-items: center;
    direction: var(--direction);
    `;
  return html`
    <div style=${headerStyle}>
      <ha-icon-button
        .label=${hass?.localize('ui.dialogs.generic.close') ?? 'Close'}
        .path=${mdiClose}
        dialogAction="close"
      >
      </ha-icon-button>
      ${title} ${addedContent}
    </div>
  `;
};

export const createExpansionPanel = ({
  content,
  options,
}: {
  content: TemplateResult;
  options: { expanded?: boolean; header: string; icon?: string; secondary?: string };
}): TemplateResult => {
  const styles = 'margin-bottom: var(--side-dialog-padding);';
  return html`
    <ha-expansion-panel
      style=${styles}
      .outlined=${true}
      .expanded=${options?.expanded || false}
      .header=${options.header}
      .secondary=${options?.secondary || ''}
      .leftChevron=${true}
    >
      ${options.icon ? html`<div slot="icons"><ha-icon icon=${options.icon}></ha-icon></div>` : ''} ${content}
    </ha-expansion-panel>
  `;
};

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

const cleanCss = (cssString: string): string | void => {
  if (!cssString) return;

  const cleanedString = cssString
    .replace(/\s*!important/g, '')
    .replace(/;/g, '')
    .replace(/:/g, '');
  return cleanedString;
};

export const convertCustomStyles = (customStyles: CustomStyles[] | null | undefined): string | null => {
  if (!Array.isArray(customStyles) || customStyles.length === 0) {
    return null;
  }
  let cssString = ':host {';

  customStyles
    .filter((style) => style && typeof style === 'object') // Filter out null, undefined, or non-objects
    .forEach((style) => {
      Object.entries(style).forEach(([key, value]) => {
        if (value != null) {
          // Ensure value is not null or undefined
          cssString += `${key}: ${cleanCss(value)} !important;`;
        }
      });
    });

  cssString += '}';
  console.log(cssString);
  return cssString;
};

export const convertPreviewCustomStyles = (
  customStyles: CustomStyles[] | null | undefined
): { [key: string]: string } | null => {
  if (!Array.isArray(customStyles) || customStyles.length === 0) {
    return null;
  }

  const styleObj: { [key: string]: string } = {};

  customStyles
    .filter((style) => style && typeof style === 'object') // Filter out null, undefined, or non-objects
    .forEach((style) => {
      Object.entries(style).forEach(([key, value]) => {
        if (value != null) {
          // Ensure value is not null or undefined
          styleObj[key] = `${cleanCss(value)}`;
        }
      });
    });

  return styleObj;
};
