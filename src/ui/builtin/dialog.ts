import { mdiClose } from '@mdi/js';
import { el, type HTMLElementChild } from '../../core/dom/html';
import { createEffectContext, type EffectContext } from '../../platform/reactivity/effects';
import { el$, type ReactiveHTMLElementChild } from '../../platform/reactivity/reactive-html';
import type { ReadonlySignal } from '../../platform/reactivity/signals';
import { renderIconButton } from './button';

export { default as dialogStyle } from './dialog.css';

export interface DialogRef {
    dialog: HTMLDialogElement;
    dialogBody: HTMLElement;
    resultPromise: Promise<string>;
    dialogContext: EffectContext;
}

export type DialogSize = 'small' | 'medium' | 'large';

const dialogSizeClasses: Record<DialogSize, string> = {
    small: 'sm-dialog--small',
    medium: 'sm-dialog--medium',
    large: 'sm-dialog--large',
};

export interface DialogConfig {
    customClass?: string;
    size?: DialogSize;
    closedBy?: 'any' | 'closerequest' | 'none';
}

export function createDialog(
    title: string | ReadonlySignal<string>,
    config: DialogConfig,
    content: HTMLElementChild[] | ((ctx: EffectContext) => ReactiveHTMLElementChild[]),
): DialogRef {
    const { promise: resultPromise, resolve: closeResolve } = Promise.withResolvers<string>();
    const dialogContext = createEffectContext();

    let dialogBody: HTMLElement;
    if (typeof content === 'function') {
        dialogBody = el$('div', { effectContext: dialogContext, class: 'sm-dialog__content' }, content(dialogContext));
    } else {
        dialogBody = el('div', { class: 'sm-dialog__content' }, content);
    }
    const dialog = el(
        'dialog',
        {
            class: ['sm-dialog', dialogSizeClasses[config.size ?? 'medium'], config.customClass ?? ''],
            attributes: { closedBy: config.closedBy ?? 'any' },
            events: {
                close: () => {
                    dialogContext.destroy();
                    closeResolve(dialog.returnValue);
                    dialog.remove();
                },
            },
        },
        [
            el('header', { class: 'sm-dialog__header' }, [
                el$('h1', { effectContext: dialogContext }, [title]),
                renderIconButton(mdiClose, () => {
                    dialog.close();
                }),
            ]),
            dialogBody,
        ],
    );

    return {
        dialog,
        dialogBody,
        resultPromise,
        dialogContext,
    };
}
