import { mdiClose } from '@mdi/js';
import { el, type HTMLElementChild } from '../dom/html';
import { renderMdiIcon } from '../ui/mdi-icon';

export interface DialogRef {
    dialog: HTMLDialogElement;
    dialogBody: HTMLElement;
    close: () => void;
    closePromise: Promise<void>;
}

export interface DialogConfig {
    customClass?: string;
    large?: boolean;
}

export function createDialog(title: string, config: DialogConfig, content: HTMLElementChild[]): DialogRef {
    const { promise: closePromise, resolve: closeResolve } = Promise.withResolvers<void>();

    const dialogBody = el('div', { class: 'sm-dialog__content' }, content);
    const dialog = el(
        'dialog',
        {
            class: ['sm-dialog', config.large === true ? 'sm-dialog--large' : '', config.customClass ?? ''],
            attributes: { closedBy: 'any' },
            events: {
                close: () => {
                    closeResolve();
                    dialog.remove();
                },
            },
        },
        [
            el('header', { class: 'sm-dialog__header' }, [
                el('h1', [title]),
                el(
                    'button',
                    {
                        class: 'sm-platform__icon-btn',
                        events: { click: () => dialog.close() },
                    },
                    [renderMdiIcon(mdiClose)],
                ),
            ]),
            dialogBody,
        ],
    );

    return {
        dialog,
        dialogBody,
        close: () => dialog.close(),
        closePromise,
    };
}
