import { mdiClose } from '@mdi/js';
import { HomeAssistant, applyThemesOnElement } from 'custom-card-helpers';
import { html, TemplateResult } from 'lit';

import { HaExtened } from '../types';

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

export const applyTheme = (element: any, hass: HaExtened['hass'], theme: string, mode?: string): void => {
  if (!element) return;
  // console.log('applyTheme', theme, mode);
  const themeData = hass.themes.themes[theme];
  if (themeData) {
    // Filter out only top-level properties for CSS variables and the modes property
    const filteredThemeData = Object.keys(themeData)
      .filter((key) => key !== 'modes')
      .reduce(
        (obj, key) => {
          obj[key] = themeData[key];
          return obj;
        },
        {} as Record<string, string>
      );

    if (!mode) {
      mode = hass.themes.darkMode ? 'dark' : 'light';
      // Get the current mode (light or dark)
    } else {
      mode = mode;
    }
    const modeData = themeData.modes && typeof themeData.modes === 'object' ? themeData.modes[mode] : {};
    // Merge the top-level and mode-specific variables
    // const allThemeData = { ...filteredThemeData, ...modeData };
    const allThemeData = { ...filteredThemeData, ...modeData };
    const allTheme = { default_theme: hass.themes.default_theme, themes: { [theme]: allThemeData } };
    applyThemesOnElement(element, allTheme, theme, false);
  }
};

export const resetPanelOrder = (paperListBox: HTMLElement): void => {
  const scrollbarItems = paperListBox!.querySelectorAll('a') as NodeListOf<HTMLElement>;
  const bottomItems = Array.from(scrollbarItems).filter((item) => item.hasAttribute('moved'));
  bottomItems.forEach((item) => {
    const nextItem = item.nextElementSibling;
    if (nextItem && nextItem.classList.contains('divider')) {
      paperListBox.removeChild(nextItem);
    }
    paperListBox.removeChild(item);
  });
};

export const onPanelLoaded = (path: string, paperListbox: HTMLElement): void => {
  const listItems = paperListbox?.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>;
  const activeLink = paperListbox?.querySelector<HTMLAnchorElement>(`a[href="${path}"]`);
  const configEl = paperListbox?.querySelector('a[data-panel="config"]') as HTMLElement;
  configEl?.setAttribute('aria-selected', configEl === activeLink ? 'true' : 'false');

  if (listItems.length) {
    listItems.forEach((item: HTMLAnchorElement) => {
      const isActive = item === activeLink;
      item.classList.toggle('iron-selected', isActive);
      item.setAttribute('aria-selected', isActive.toString());
    });
  }

  const dividers = paperListbox?.querySelectorAll('div.divider') as NodeListOf<HTMLElement>;
  dividers.forEach((divider) => {
    const group = divider.getAttribute('group');
    const items = paperListbox?.querySelectorAll(`a[group="${group}"]`) as NodeListOf<HTMLAnchorElement>;
    const ariaSelected = Object.values(items).some((item) => item.getAttribute('aria-selected') === 'true');
    divider.classList.toggle('child-selected', ariaSelected);
    divider.setAttribute('aria-selected', ariaSelected.toString());
  });
};
