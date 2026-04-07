import { el } from '../../core/dom/html';
import { renderBlockButton } from '../builtin/button';
import { createDialog } from '../builtin/dialog';
import { createTextInput } from '../builtin/input';

export { default as templateNameDialogStyle } from './template-name-dialog.css';

export async function showTemplateNameDialog(currentName: string, newTemplate: boolean): Promise<string> {
    let label: string;
    if (newTemplate) {
        label = 'Enter a name for the new template:';
    } else {
        label = 'Enter a name for the template:';
    }
    const [formControl, nameInput] = createTextInput(label);
    nameInput.value = currentName;
    nameInput.required = true;

    const { dialog, closePromise } = createDialog('Template Name', { customClass: 'sm-template-name-dialog' }, [
        el(
            'form',
            {
                events: {
                    submit: (event) => {
                        event.preventDefault();
                        const name = nameInput.value.trim();
                        if (name.length === 0 || !nameInput.validity.valid) {
                            return;
                        }
                        dialog.close(name);
                    },
                },
            },
            [
                formControl,
                el('div', { class: 'sm-template-name-dialog__button-row' }, [
                    renderBlockButton(
                        'Use this name',
                        () => {
                            // no-op, the form submit handler will take care of this
                        },
                        { attributes: { type: 'submit' } },
                    ),
                    renderBlockButton('Cancel', () => dialog.close(), { attributes: { type: 'button' } }),
                ]),
            ],
        ),
    ]);

    document.body.appendChild(dialog);
    dialog.showModal();

    return closePromise;
}
