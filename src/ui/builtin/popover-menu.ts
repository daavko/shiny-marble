import { el } from '../../core/dom/html';

export { default as popoverMenuStyle } from './popover-menu.css';

export type PopoverVerticalPosition = 'top' | 'bottom';
export type PopoverHorizontalPosition = 'left' | 'right' | 'center';

export interface PopoverMenuItem {
    label: string;
    onClick: () => void;
}

export interface PopoverMenuConfig {
    container?: HTMLElement;
    vertical: PopoverVerticalPosition;
    horizontal: PopoverHorizontalPosition;
}

export type PopoverCloseFn = () => void;

const popoverVerticalPositionValueMap: Record<PopoverVerticalPosition, string> = {
    top: 'top',
    bottom: 'bottom',
};

const popoverHorizontalPositionValueMap: Record<PopoverHorizontalPosition, string> = {
    left: 'span-left',
    right: 'span-right',
    center: 'center',
};

function createPopoverItem(item: PopoverMenuItem): HTMLElement {
    return el(
        'button',
        {
            class: 'sm-popover-menu__item',
            events: { click: item.onClick },
        },
        [item.label],
    );
}

export function openPopoverMenu(
    triggerElement: HTMLElement,
    items: PopoverMenuItem[],
    config: PopoverMenuConfig,
): PopoverCloseFn {
    // the Popover API has no way to open a popover as modal, so we have to make our own backdrop
    const backdrop = el('div', {
        class: 'sm-popover-menu-backdrop',
        events: { click: () => menu.hidePopover() },
    });
    const menu = el(
        'div',
        {
            class: ['sm-popover-menu'],
            styleCustomProperties: {
                '--sm-popover-menu-vertical-position': popoverVerticalPositionValueMap[config.vertical],
                '--sm-popover-menu-horizontal-position': popoverHorizontalPositionValueMap[config.horizontal],
            },
            attributes: { popover: true },
            events: {
                toggle: (event) => {
                    if (event.newState === 'closed') {
                        backdrop.remove();
                        menu.remove();
                    }
                },
            },
        },
        items.map((item) => createPopoverItem(item)),
    );

    const menuContainer = config.container ?? document.body;

    menuContainer.appendChild(backdrop);
    menuContainer.appendChild(menu);

    menu.showPopover({ source: triggerElement });

    return () => menu.hidePopover();
}
