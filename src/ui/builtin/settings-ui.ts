import type { Setting, SettingUpdateCallback } from '../../platform/settings';
import { createCheckbox, createNumberInput, createRangeInput, createSelectInput, createTextInput } from './input';

function addListeners<T>(
    setting: Setting<T>,
    element: HTMLElement,
    settingCallback: SettingUpdateCallback<T>,
    changeListener: (event: Event) => void,
    destroyPromise: Promise<void>,
): void {
    element.addEventListener('change', changeListener);
    setting.addCallback(settingCallback);

    void destroyPromise.then(() => {
        element.removeEventListener('change', changeListener);
        setting.removeCallback(settingCallback);
    });
}

export function createBooleanSetting(
    setting: Setting<boolean>,
    label: string,
    destroyPromise: Promise<void>,
): HTMLElement {
    const [container, input] = createCheckbox(label);
    input.checked = setting.value;

    addListeners(
        setting,
        input,
        (_, newValue) => (input.checked = newValue),
        () => (setting.value = input.checked),
        destroyPromise,
    );

    return container;
}

export function createNumberSetting(
    setting: Setting<number>,
    label: string,
    destroyPromise: Promise<void>,
    range: { min?: number; max?: number } = {},
): HTMLElement {
    const [container, input] = createNumberInput(label, range);
    input.valueAsNumber = setting.value;

    addListeners(
        setting,
        input,
        (_, newValue) => (input.valueAsNumber = newValue),
        () => {
            let value = input.valueAsNumber;
            if (range.min != null && value < range.min) {
                value = range.min;
            }
            if (range.max != null && value > range.max) {
                value = range.max;
            }
            setting.value = value;
        },
        destroyPromise,
    );

    return container;
}

export function createNumberRangeSetting(
    setting: Setting<number>,
    label: string,
    destroyPromise: Promise<void>,
    range: { min: number; max: number; step: number },
): HTMLElement {
    const [container, input] = createRangeInput(label, range);
    input.valueAsNumber = setting.value;
    input.dispatchEvent(new Event('input'));

    addListeners(
        setting,
        input,
        (_, newValue) => {
            input.valueAsNumber = newValue;
            input.dispatchEvent(new Event('input'));
        },
        () => (setting.value = input.valueAsNumber),
        destroyPromise,
    );

    return container;
}

export function createStringSetting(
    setting: Setting<string>,
    label: string,
    destroyPromise: Promise<void>,
): HTMLElement {
    const [container, input] = createTextInput(label);
    input.value = setting.value;

    addListeners(
        setting,
        input,
        (_, newValue) => (input.value = newValue),
        () => (setting.value = input.value),
        destroyPromise,
    );

    return container;
}

export function createSelectSetting<const T extends string>(
    setting: Setting<T>,
    label: string,
    destroyPromise: Promise<void>,
    options: { value: T; label: string; title?: string }[],
): HTMLElement {
    const [container, select] = createSelectInput(label, options);
    select.value = setting.value;

    addListeners(
        setting,
        select,
        (_, newValue) => (select.value = newValue),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe because options are typed with T
        () => (setting.value = select.value as T),
        destroyPromise,
    );

    return container;
}
