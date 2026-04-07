import { svgEl, type SVGElementOptions } from '../../core/dom/html';

export { default as mdiIconStyle } from './mdi-icon.css';

export function renderMdiIcon(iconPath: string, containerOptions: SVGElementOptions = {}): SVGElement {
    let containerOptionsClassList: string[] = [];
    if (Array.isArray(containerOptions.class)) {
        containerOptionsClassList = containerOptions.class;
    } else if (typeof containerOptions.class === 'string') {
        containerOptionsClassList = [containerOptions.class];
    }
    return svgEl(
        'svg',
        {
            ...containerOptions,
            attributes: {
                viewBox: '0 0 24 24',
                ...containerOptions.attributes,
            },
            class: ['sm-mdi-icon', ...containerOptionsClassList],
        },
        [
            svgEl('path', {
                attributes: {
                    d: iconPath,
                },
            }),
        ],
    );
}
