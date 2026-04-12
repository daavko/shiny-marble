import { el } from '../../core/dom/html';

export { default as tooltipStyle } from './tooltip.css';

export type TooltipVerticalPosition = 'top' | 'bottom' | 'center';
export type TooltipHorizontalPosition = 'left' | 'right' | 'center';

const tooltipVerticalPositionValueMap: Record<TooltipVerticalPosition, string> = {
    top: 'top',
    bottom: 'bottom',
    center: 'center',
};

const tooltipHorizontalPositionValueMap: Record<TooltipHorizontalPosition, string> = {
    left: 'left',
    right: 'right',
    center: 'center',
};

export interface TooltipConfig {
    container?: HTMLElement;
    vertical: TooltipVerticalPosition;
    horizontal: TooltipHorizontalPosition;
}

export function bindTooltip(target: HTMLElement, label: string, config: TooltipConfig): void {
    const extraClassList: string[] = [];

    if (config.vertical === 'center') {
        extraClassList.push('sm-tooltip--horizontal-offset');
    }
    if (config.horizontal === 'center') {
        extraClassList.push('sm-tooltip--vertical-offset');
    }

    const tooltip = el(
        'div',
        {
            class: ['sm-tooltip', ...extraClassList],
            styleCustomProperties: {
                '--sm-tooltip-vertical-position': tooltipVerticalPositionValueMap[config.vertical],
                '--sm-tooltip-horizontal-position': tooltipHorizontalPositionValueMap[config.horizontal],
            },
            attributes: { popover: 'manual' },
        },
        [label],
    );

    const container = config.container ?? document.body;
    container.appendChild(tooltip);

    target.addEventListener('pointerenter', () => tooltip.showPopover({ source: target }));
    target.addEventListener('pointerleave', () => tooltip.hidePopover());
}
