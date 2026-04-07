import { mdiClose } from '@mdi/js';
import { el, type HTMLElementChild } from '../../core/dom/html';
import { renderIconButton } from './button';

export { default as dialogStyle } from './dialog.css';

export interface DialogRef {
    dialog: HTMLDialogElement;
    dialogBody: HTMLElement;
    closePromise: Promise<string>;
}

export interface DialogConfig {
    customClass?: string;
    large?: boolean;
    closedBy?: 'any' | 'closerequest' | 'none';
}

export function createDialog(title: string, config: DialogConfig, content: HTMLElementChild[]): DialogRef {
    const { promise: closePromise, resolve: closeResolve } = Promise.withResolvers<string>();

    const dialogBody = el('div', { class: 'sm-dialog__content' }, content);
    const dialog = el(
        'dialog',
        {
            class: ['sm-dialog', config.large === true ? 'sm-dialog--large' : '', config.customClass ?? ''],
            attributes: { closedBy: config.closedBy ?? 'any' },
            events: {
                close: () => {
                    closeResolve(dialog.returnValue);
                    dialog.remove();
                },
            },
        },
        [
            el('header', { class: 'sm-dialog__header' }, [
                el('h1', [title]),
                renderIconButton(mdiClose, () => dialog.close()),
            ]),
            dialogBody,
        ],
    );

    return {
        dialog,
        dialogBody,
        closePromise,
    };
}
