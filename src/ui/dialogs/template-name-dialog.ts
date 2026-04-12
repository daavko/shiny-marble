import { el } from '../../core/dom/html';
import { renderBlockButton } from '../builtin/button';
import { createDialog } from '../builtin/dialog';
import { createTextInput } from '../builtin/input';

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

    const { dialog, resultPromise } = createDialog('Template Name', { size: 'small' }, [
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
                el('div', { class: ['sm-row', 'sm-row--end', 'sm-mt-16'] }, [
                    renderBlockButton(
                        'Use this name',
                        () => {
                            // no-op, the form submit handler will take care of this
                        },
                        { variant: 'primary', elementOptions: { attributes: { type: 'submit' } } },
                    ),
                    renderBlockButton('Cancel', () => dialog.close(), {
                        elementOptions: { attributes: { type: 'button' } },
                    }),
                ]),
            ],
        ),
    ]);

    document.body.appendChild(dialog);
    dialog.showModal();

    return resultPromise;
}
