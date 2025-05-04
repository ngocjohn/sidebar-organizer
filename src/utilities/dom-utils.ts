import { CLASS, ELEMENT, PATH, SELECTOR } from '@constants';
import { mdiClose } from '@mdi/js';
import { HomeAssistant } from 'custom-card-helpers';
import { html, TemplateResult } from 'lit';

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

export const resetPanelOrder = (paperListBox: HTMLElement): void => {
  const scrollbarItems = paperListBox!.querySelectorAll(ELEMENT.ITEM) as NodeListOf<HTMLElement>;
  const bottomItems = Array.from(scrollbarItems).filter((item) => item.hasAttribute('moved'));
  if (bottomItems.length === 0) return;
  bottomItems.forEach((item) => {
    const nextItem = item.nextElementSibling;
    if (nextItem && nextItem.classList.contains('divider')) {
      paperListBox.removeChild(nextItem);
    }
    item.removeAttribute('moved');
    paperListBox.removeChild(item);
  });
};

export const resetBottomItems = (paperListBox: HTMLElement): void => {
  const bottomItems = paperListBox.querySelectorAll(`${ELEMENT.ITEM}[moved]`) as NodeListOf<HTMLElement>;
  if (bottomItems.length === 0) return;
  const spacerEl = paperListBox.querySelector(SELECTOR.SPACER) as HTMLElement;
  bottomItems.forEach((item) => {
    const nextItem = item.nextElementSibling;
    if (nextItem && nextItem.classList.contains('divider')) {
      paperListBox.removeChild(nextItem);
    }
    paperListBox.removeChild(item);
    item.removeAttribute('moved');
    paperListBox.insertBefore(item, spacerEl);
  });
};

export const onPanelLoaded = (path: string, paperListbox: HTMLElement): void => {
  if (path === PATH.LOVELACE_DASHBOARD) {
    resetBottomItems(paperListbox);
  }
  path = path.slice(1);
  const listItems = Array.from(paperListbox.querySelectorAll(ELEMENT.ITEM)) as HTMLElement[];

  const activeLink = paperListbox?.querySelector<HTMLElement>(`${ELEMENT.ITEM}[data-panel="${path}"]`);

  const configEl = paperListbox?.querySelector(`${ELEMENT.ITEM}[data-panel="config"]`) as HTMLElement;
  configEl?.classList.toggle(CLASS.SELECTED, configEl === activeLink);

  if (activeLink) {
    setTimeout(() => {
      listItems.forEach((item: HTMLElement) => {
        const isActive = item === activeLink;
        item.classList.toggle(CLASS.SELECTED, isActive);
        // item.setAttribute('aria-selected', isActive.toString());
      });
    }, 0);
  }

  const dividers = paperListbox?.querySelectorAll('div.divider') as NodeListOf<HTMLElement>;
  if (dividers.length === 0) return;
  dividers.forEach((divider) => {
    const group = divider.getAttribute('group');
    const items = paperListbox?.querySelectorAll(`${ELEMENT.ITEM}[group="${group}"]`) as NodeListOf<HTMLElement>;
    const childSelected = Object.values(items).some((item) => item.classList.contains(CLASS.SELECTED));
    divider.classList.toggle('child-selected', childSelected);
    divider.setAttribute('aria-selected', childSelected.toString());
  });
};
