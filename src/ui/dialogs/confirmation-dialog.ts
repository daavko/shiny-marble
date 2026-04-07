import { el } from '../../core/dom/html';
import { renderBlockButton } from '../builtin/button';
import { createDialog } from '../builtin/dialog';

export { default as confirmationDialogStyle } from './confirmation-dialog.css';

export interface ConfirmationDialogButton {
    label: string;
    value: string;
}

export async function showConfirmationDialog(
    title: string,
    message: string,
    buttons: ConfirmationDialogButton[],
): Promise<string> {
    const buttonElements = buttons.map((button) => renderBlockButton(button.label, () => dialog.close(button.value)));

    const { dialog, closePromise } = createDialog(title, { customClass: 'sm-confirmation-dialog', closedBy: 'none' }, [
        el('p', { class: 'sm-confirmation-dialog__message' }, [message]),
        el('div', { class: 'sm-confirmation-dialog__buttons' }, buttonElements),
    ]);

    document.body.appendChild(dialog);
    dialog.showModal();

    return await closePromise;
}
