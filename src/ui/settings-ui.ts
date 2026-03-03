import type { Setting } from '../platform/settings';
import { createCheckbox, createNumberInput, createSelectInput, createTextInput } from './input';

export type SettingCleanupCallback = () => void;

export function createBooleanSetting(
    setting: Setting<unknown, boolean>,
    label: string,
): [HTMLElement, SettingCleanupCallback] {
    const [container, input] = createCheckbox(label);
    input.checked = setting.serializeValue(setting.get());

    const changeListener = (): void => setting.set(setting.parseValue(input.checked));
    input.addEventListener('change', changeListener);

    const callback = (): void => {
        input.checked = setting.serializeValue(setting.get());
    };
    setting.addCallback(callback);

    return [
        container,
        (): void => {
            input.removeEventListener('change', changeListener);
            setting.removeCallback(callback);
        },
    ];
}

export function createNumberSetting(
    setting: Setting<unknown, number>,
    label: string,
    range: { min?: number; max?: number } = {},
): [HTMLElement, SettingCleanupCallback] {
    const [container, input] = createNumberInput(label, range);
    input.valueAsNumber = setting.serializeValue(setting.get());

    const changeListener = (): void => {
        let value = input.valueAsNumber;
        if (range.min != null && value < range.min) {
            value = range.min;
        }
        if (range.max != null && value > range.max) {
            value = range.max;
        }
        setting.set(value);
    };
    input.addEventListener('change', changeListener);

    const callback = (): void => {
        input.valueAsNumber = setting.serializeValue(setting.get());
    };
    setting.addCallback(callback);

    return [
        container,
        (): void => {
            input.removeEventListener('change', changeListener);
            setting.removeCallback(callback);
        },
    ];
}

export function createStringSetting(
    setting: Setting<unknown, string>,
    label: string,
): [HTMLElement, SettingCleanupCallback] {
    const [container, input] = createTextInput(label);
    input.value = setting.serializeValue(setting.get());

    const changeListener = (): void => setting.set(setting.parseValue(input.value));
    input.addEventListener('change', changeListener);

    const callback = (): void => {
        input.value = setting.serializeValue(setting.get());
    };
    setting.addCallback(callback);

    return [
        container,
        (): void => {
            input.removeEventListener('change', changeListener);
            setting.removeCallback(callback);
        },
    ];
}

export function createSelectSetting<const T extends string>(
    setting: Setting<T, string>,
    label: string,
    options: { value: T; label: string; title?: string }[],
): [HTMLElement, SettingCleanupCallback] {
    const [container, select] = createSelectInput(label, options);
    select.value = setting.serializeValue(setting.get());

    const changeListener = (): void => setting.set(setting.parseValue(select.value));
    select.addEventListener('change', changeListener);

    const callback = (): void => {
        select.value = setting.serializeValue(setting.get());
    };
    setting.addCallback(callback);

    return [
        container,
        (): void => {
            select.removeEventListener('change', changeListener);
            setting.removeCallback(callback);
        },
    ];
}
