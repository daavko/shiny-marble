import { el } from '../core/dom/html';
import { createRandomElementId } from '../util/string';

export { default as inputStyle } from './input.css';

function createFormControl(label: string, inputElement: HTMLElement, content?: HTMLElement): HTMLElement {
    const id = createRandomElementId();
    inputElement.id = id;
    return el('label', { class: 'sm-form-control', attributes: { for: id } }, [
        el('span', { class: 'sm-form-control__label' }, [label]),
        content ?? inputElement,
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
        attributes: { type: 'number', min, max, step: 'any' },
    });
    return [createFormControl(label, input), input];
}

export function createRangeInput(
    label: string,
    range: { min: number; max: number; step: number },
): [HTMLElement, HTMLInputElement] {
    const { min, max, step } = range;
    const input = el('input', {
        attributes: { type: 'range', min, max, step: step },
    });
    const valueDisplay = el('span', [input.value]);
    input.addEventListener('input', () => {
        valueDisplay.textContent = input.value;
    });
    return [
        createFormControl(label, input, el('div', { class: 'sm-range-input__input-container' }, [input, valueDisplay])),
        input,
    ];
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
