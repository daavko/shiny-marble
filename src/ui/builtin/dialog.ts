import { mdiClose } from '@mdi/js';
import { el, type HTMLElementChild } from '../../core/dom/html';
import { createEffectContext, type EffectContext } from '../../core/effects';
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

export function createDialog(title: string, config: DialogConfig, content: HTMLElementChild[]): DialogRef {
    const { promise: resultPromise, resolve: closeResolve } = Promise.withResolvers<string>();
    const dialogContext = createEffectContext();

    const dialogBody = el('div', { class: 'sm-dialog__content' }, content);
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
                el('h1', [title]),
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
