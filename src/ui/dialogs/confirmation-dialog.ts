import { el } from '../../core/dom/html';
import { type BlockButtonOptions, renderBlockButton } from '../builtin/button';
import { createDialog } from '../builtin/dialog';

export interface ConfirmationDialogButton {
    label: string;
    value: string;
    buttonOptions?: BlockButtonOptions;
}

export async function showConfirmationDialog(
    title: string,
    message: string,
    buttons: ConfirmationDialogButton[],
): Promise<string> {
    const { dialog, resultPromise } = createDialog(title, { closedBy: 'none' }, [
        el('p', [message]),
        el(
            'div',
            { class: ['sm-row', 'sm-row--end', 'sm-mt-16'] },
            buttons.map((button) =>
                renderBlockButton(button.label, () => dialog.close(button.value), button.buttonOptions),
            ),
        ),
    ]);

    document.body.appendChild(dialog);
    dialog.showModal();

    return await resultPromise;
}
