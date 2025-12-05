import { CLASS, ELEMENT, PATH, SELECTOR } from '@constants';
import { HaExtened, SidebarPanelItem } from '@types';
import { getPromisableResult } from 'get-promisable-result';
import { html, TemplateResult } from 'lit';

const HOLD_DURATION = 300;

export const createExpansionPanel = ({
  content,
  options,
}: {
  content: TemplateResult;
  options: { expanded?: boolean; header: string; icon?: string; secondary?: string; darkBg?: boolean };
}): TemplateResult => {
  const styles = 'margin-bottom: var(--side-dialog-padding); --expansion-panel-content-padding: 0;';
  const darkBg = options.darkBg ? 'background-color: rgba(0, 0, 0, 0.2);' : '';

  return html`
    <ha-expansion-panel
      style=${styles}
      .outlined=${true}
      .expanded=${options?.expanded || false}
      .header=${options.header}
      .secondary=${options?.secondary || ''}
      .leftChevron=${false}
    >
      ${options.icon
        ? html`<ha-icon icon=${options.icon} slot="leading-icon" style="color: var(--secondary-text-color)"></ha-icon>`
        : ''}
      <div style="padding: 1em; ${darkBg}">${content}</div>
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
    configItem.addEventListener(eventType, handleDownEvent, { passive: true });
  });

  ['touchend', 'mouseup'].forEach((eventType) => {
    configItem.addEventListener(eventType, handleUpEvent);
  });
}
export const resetPanelOrder = (paperListBox: HTMLElement): void => {
  // Remove filtered panel items
  paperListBox.querySelectorAll(ELEMENT.ITEM).forEach((item) => {
    const panel = item.getAttribute('data-panel');
    if (panel && panel !== 'config' && panel !== 'developer-tools') {
      paperListBox.removeChild(item);
    }
  });

  // Remove dividers for grouped items
  paperListBox.querySelectorAll(ELEMENT.DIVIDER).forEach((divider) => {
    if (divider.hasAttribute('added') || divider.hasAttribute('ungrouped') || divider.hasAttribute('bottom')) {
      paperListBox.removeChild(divider);
    }
  });
};

export const resetBottomItems = (paperListBox: HTMLElement): void => {
  const bottomItems = paperListBox.querySelectorAll(`${ELEMENT.ITEM}[moved]`) as NodeListOf<HTMLElement>;
  if (bottomItems.length === 0) return;
  const spacerEl = paperListBox.querySelector(SELECTOR.SPACER) as HTMLElement;
  const dividerBottom = paperListBox.querySelector(`${ELEMENT.DIVIDER}[bottom]`) as HTMLElement;
  dividerBottom?.remove();
  bottomItems.forEach((item) => {
    item.removeAttribute('moved');
    paperListBox.insertBefore(item, spacerEl);
  });
};

export const onPanelLoaded = (path: string, paperListbox: HTMLElement): void => {
  if (path === PATH.LOVELACE_DASHBOARD) {
    resetBottomItems(paperListbox);
  }

  const items = Array.from<SidebarPanelItem>(paperListbox?.querySelectorAll<SidebarPanelItem>(ELEMENT.ITEM));

  const activeItem = items.find((item: SidebarPanelItem): boolean => path === item.href);

  const activeParentElement = activeItem
    ? null
    : items.reduce((acc: SidebarPanelItem | null, item: SidebarPanelItem): SidebarPanelItem | null => {
        if (path.startsWith(item.href)) {
          if (!acc || item.href.length > acc.href.length) {
            acc = item;
          }
        }
        return acc;
      }, null);

  // console.log('path', path, 'activeItem', activeItem, 'activeParentElement', activeParentElement);

  items.forEach((item: HTMLElement) => {
    const isActive = (activeItem && activeItem === item) || (!activeItem && activeParentElement === item);

    item.classList.toggle(CLASS.SELECTED, isActive);
    item.tabIndex = isActive ? 0 : -1;
  });

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

export const getInitPanelOrder = async (haEl: HaExtened): Promise<string[]> => {
  const promisableResultOptions = {
    retries: 100,
    delay: 50,
    shouldReject: false,
  };

  const dialog = await getSiderbarEditDialog(haEl).then((dialog) => {
    return dialog?.shadowRoot?.querySelector(ELEMENT.ITEMS_DISPLAY_EDITOR) as any;
  });

  console.log('getInitPanelOrder dialog', dialog);
  const panelItems = await getPromisableResult<string[]>(
    () => {
      return dialog?.items?.map((item: any) => item.value) || [];
    },
    (result: string[]) => result.length > 0,
    promisableResultOptions // Example condition for validation
  );
  console.log('getInitPanelOrder', panelItems);
  return panelItems;
};

export const getSiderbarEditDialog = async (haEl: HaExtened): Promise<any> => {
  console.log('get SiderbarEditDialog');
  const promisableResultOptions = {
    retries: 100,
    delay: 50,
    shouldReject: false,
  };
  const dialog = await getPromisableResult<HTMLElement>(
    () => {
      return haEl.shadowRoot?.querySelector('dialog-edit-sidebar') as any;
    },
    (result: any) => result !== undefined,
    promisableResultOptions // Example condition for validation
  );
  console.log('get SiderbarEditDialog', dialog);
  return dialog;
};
