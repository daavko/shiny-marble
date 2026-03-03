import { el } from '../dom/html';
import { createRandomElementId } from '../util/string';

function createFormControl(label: string, inputElement: HTMLElement): HTMLElement {
    const id = createRandomElementId();
    inputElement.id = id;
    return el('label', { class: 'sm-form-control', attributes: { for: id } }, [
        el('span', { class: 'sm-form-control__label' }, [label]),
        inputElement,
    ]);
}

export function createCheckbox(label: string): [HTMLElement, HTMLInputElement] {
    const checkbox = el('input', {
        attributes: { type: 'checkbox' },
    });
    return [createFormControl(label, checkbox), checkbox];
}

export function createTextInput(label: string): [HTMLElement, HTMLInputElement] {
    const input = el('input', {
        attributes: { type: 'text' },
    });
    return [createFormControl(label, input), input];
}

export function createNumberInput(
    label: string,
    range: { min?: number; max?: number } = {},
): [HTMLElement, HTMLInputElement] {
    const { min, max } = range;
    const input = el('input', {
        attributes: { type: 'number', min, max },
    });
    return [createFormControl(label, input), input];
}

export function createSelectInput(
    label: string,
    options: { value: string; label: string; title?: string }[],
): [HTMLElement, HTMLSelectElement] {
    const select = el(
        'select',
        options.map((option) =>
            el('option', { attributes: { value: option.value, title: option.title } }, [option.label]),
        ),
    );
    return [createFormControl(label, select), select];
}
