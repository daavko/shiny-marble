import {
    el,
    type HTMLElementChild,
    type HTMLElementEventListenerMap,
    type HTMLElementOptions,
    type SVGElementOptions,
} from '../core/dom/html';
import { renderMdiIcon } from './mdi-icon';

export function renderBlockButton(
    contents: HTMLElementChild | HTMLElementChild[],
    onClick: HTMLElementEventListenerMap['click'],
    additionalOptions: HTMLElementOptions = {},
): HTMLButtonElement {
    let additionalOptionsClassList: string[] = [];
    if (Array.isArray(additionalOptions.class)) {
        additionalOptionsClassList = additionalOptions.class;
    } else if (typeof additionalOptions.class === 'string') {
        additionalOptionsClassList = [additionalOptions.class];
    }

    return el(
        'button',
        {
            class: ['sm-platform__block-btn', ...additionalOptionsClassList],
            events: {
                ...additionalOptions.events,
                click: onClick,
            },
        },
        Array.isArray(contents) ? contents : [contents],
    );
}

export function renderBlockButtonWithIcon(
    contents: HTMLElementChild | HTMLElementChild[],
    iconPath: string,
    iconPosition: 'left' | 'right',
    onClick: HTMLElementEventListenerMap['click'],
    additionalOptions: HTMLElementOptions = {},
    additionalIconOptions: SVGElementOptions = {},
): HTMLButtonElement {
    const icon = renderMdiIcon(iconPath, additionalIconOptions);
    let passedContentArray: HTMLElementChild[];
    if (Array.isArray(contents)) {
        passedContentArray = contents;
    } else {
        passedContentArray = [contents];
    }

    let additionalOptionsClassList: string[] = [];
    if (Array.isArray(additionalOptions.class)) {
        additionalOptionsClassList = additionalOptions.class;
    } else if (typeof additionalOptions.class === 'string') {
        additionalOptionsClassList = [additionalOptions.class];
    }

    if (iconPosition === 'left') {
        additionalOptionsClassList.push('sm-platform__block-btn--icon-left');
    } else {
        additionalOptionsClassList.push('sm-platform__block-btn--icon-right');
    }

    return renderBlockButton(
        iconPosition === 'left' ? [icon, ...passedContentArray] : [...passedContentArray, icon],
        onClick,
        {
            ...additionalOptions,
            class: ['sm-platform__block-btn--with-icon', ...additionalOptionsClassList],
        },
    );
}
