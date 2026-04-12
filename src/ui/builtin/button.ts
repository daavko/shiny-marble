import {
    el,
    type HTMLElementChild,
    type HTMLElementEventListenerMap,
    type HTMLElementOptions,
    type SVGElementOptions,
} from '../../core/dom/html';
import { renderMdiIcon } from './mdi-icon';

export { default as buttonStyle } from './button.css';

type ButtonVariant = 'default' | 'primary' | 'danger';

export interface BlockButtonOptions {
    variant?: ButtonVariant;
    elementOptions?: HTMLElementOptions;
}

const defaultBlockButtonOptions: Required<BlockButtonOptions> = {
    variant: 'default',
    elementOptions: {},
};

const blockButtonStyleClassMap: Record<Exclude<ButtonVariant, 'default'>, string> = {
    primary: 'sm-block-btn--primary',
    danger: 'sm-block-btn--danger',
};

export function renderBlockButton(
    contents: HTMLElementChild | HTMLElementChild[],
    onClick: HTMLElementEventListenerMap['click'],
    options: BlockButtonOptions = {},
): HTMLButtonElement {
    const resolvedOptions = { ...defaultBlockButtonOptions, ...options };

    let additionalOptionsClassList: string[] = [];
    const elementOptionsClass = resolvedOptions.elementOptions.class;
    if (Array.isArray(elementOptionsClass)) {
        additionalOptionsClassList = elementOptionsClass;
    } else if (typeof elementOptionsClass === 'string') {
        additionalOptionsClassList = [elementOptionsClass];
    }

    if (resolvedOptions.variant !== 'default') {
        additionalOptionsClassList.push(blockButtonStyleClassMap[resolvedOptions.variant]);
    }

    return el(
        'button',
        {
            class: ['sm-block-btn', ...additionalOptionsClassList],
            events: {
                ...resolvedOptions.elementOptions.events,
                click: onClick,
            },
        },
        Array.isArray(contents) ? contents : [contents],
    );
}

export interface IconButtonOptions {
    density?: 'default' | 'dense';
    variant?: ButtonVariant;
    elementOptions?: HTMLElementOptions;
}

const defaultIconButtonOptions: Required<IconButtonOptions> = {
    density: 'default',
    variant: 'default',
    elementOptions: {},
};

const iconButtonStyleClassMap: Record<Exclude<ButtonVariant, 'default'>, string> = {
    primary: 'sm-icon-btn--primary',
    danger: 'sm-icon-btn--danger',
};

export function renderIconButton(
    iconPath: string,
    onClick: HTMLElementEventListenerMap['click'],
    options: IconButtonOptions = {},
): HTMLButtonElement {
    const resolvedOptions = { ...defaultIconButtonOptions, ...options };

    let additionalOptionsClassList: string[] = [];
    const elementOptionsClass = resolvedOptions.elementOptions.class;
    if (Array.isArray(elementOptionsClass)) {
        additionalOptionsClassList = elementOptionsClass;
    } else if (typeof elementOptionsClass === 'string') {
        additionalOptionsClassList = [elementOptionsClass];
    }

    if (resolvedOptions.variant !== 'default') {
        additionalOptionsClassList.push(iconButtonStyleClassMap[resolvedOptions.variant]);
    }

    if (resolvedOptions.density === 'dense') {
        additionalOptionsClassList.push('sm-icon-btn--dense');
    }

    return el(
        'button',
        {
            class: ['sm-icon-btn', ...additionalOptionsClassList],
            events: {
                ...resolvedOptions.elementOptions.events,
                click: onClick,
            },
        },
        [renderMdiIcon(iconPath)],
    );
}

type BlockButtonWithIconPosition = 'left' | 'right';

const blockButtonWithIconClassMap: Record<BlockButtonWithIconPosition, string> = {
    left: 'sm-block-btn--icon-left',
    right: 'sm-block-btn--icon-right',
};

export interface BlockButtonWithIconOptions extends BlockButtonOptions {
    iconPosition?: BlockButtonWithIconPosition;
    iconElementOptions?: SVGElementOptions;
}

const defaultBlockButtonWithIconOptions: Required<BlockButtonWithIconOptions> = {
    ...defaultBlockButtonOptions,
    iconPosition: 'left',
    iconElementOptions: {},
};

export function renderBlockButtonWithIcon(
    contents: HTMLElementChild | HTMLElementChild[],
    iconPath: string,
    onClick: HTMLElementEventListenerMap['click'],
    options: BlockButtonWithIconOptions = {},
): HTMLButtonElement {
    const resolvedOptions = { ...defaultBlockButtonWithIconOptions, ...options };

    const icon = renderMdiIcon(iconPath, resolvedOptions.iconElementOptions);
    let passedContentArray: HTMLElementChild[];
    if (Array.isArray(contents)) {
        passedContentArray = contents;
    } else {
        passedContentArray = [contents];
    }

    let additionalOptionsClassList: string[] = [];
    const additionalOptionsClass = resolvedOptions.elementOptions.class;
    if (Array.isArray(additionalOptionsClass)) {
        additionalOptionsClassList = additionalOptionsClass;
    } else if (typeof additionalOptionsClass === 'string') {
        additionalOptionsClassList = [additionalOptionsClass];
    }

    additionalOptionsClassList.push(blockButtonWithIconClassMap[resolvedOptions.iconPosition]);

    return renderBlockButton(
        resolvedOptions.iconPosition === 'left' ? [icon, ...passedContentArray] : [...passedContentArray, icon],
        onClick,
        {
            variant: resolvedOptions.variant,
            elementOptions: {
                ...resolvedOptions.elementOptions,
                class: ['sm-block-btn--with-icon', ...additionalOptionsClassList],
            },
        },
    );
}
