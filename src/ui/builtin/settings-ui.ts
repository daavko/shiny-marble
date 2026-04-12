import type { EffectContext } from '../../core/effects';
import type { Setting } from '../../platform/settings';
import { createCheckbox, createNumberInput, createRangeInput, createSelectInput, createTextInput } from './input';

export function createBooleanSetting(setting: Setting<boolean>, label: string, context: EffectContext): HTMLElement {
    const [container, input] = createCheckbox(label);
    input.checked = setting.value;

    context.watch([setting], ([newValue]) => {
        input.checked = newValue;
    });
    context.elementEventListener(input, 'change', () => {
        setting.value = input.checked;
    });

    return container;
}

export function createNumberSetting(
    setting: Setting<number>,
    label: string,
    context: EffectContext,
    range: { min?: number; max?: number } = {},
): HTMLElement {
    const [container, input] = createNumberInput(label, range);
    input.valueAsNumber = setting.value;

    context.watch([setting], ([newValue]) => {
        input.valueAsNumber = newValue;
    });

    context.elementEventListener(input, 'change', () => {
        let value = input.valueAsNumber;
        if (range.min != null && value < range.min) {
            value = range.min;
        }
        if (range.max != null && value > range.max) {
            value = range.max;
        }
        setting.value = value;
    });

    return container;
}

export function createNumberRangeSetting(
    setting: Setting<number>,
    label: string,
    context: EffectContext,
    range: { min: number; max: number; step: number },
): HTMLElement {
    const [container, input] = createRangeInput(label, range);
    input.valueAsNumber = setting.value;
    input.dispatchEvent(new Event('input'));

    context.watch([setting], ([newValue]) => {
        input.valueAsNumber = newValue;
        input.dispatchEvent(new Event('input'));
    });

    context.elementEventListener(input, 'change', () => {
        let value = input.valueAsNumber;
        if (value < range.min) {
            value = range.min;
        }
        if (value > range.max) {
            value = range.max;
        }
        setting.value = value;
    });

    return container;
}

export function createStringSetting(setting: Setting<string>, label: string, context: EffectContext): HTMLElement {
    const [container, input] = createTextInput(label);
    input.value = setting.value;

    context.watch([setting], ([newValue]) => {
        input.value = newValue;
    });

    context.elementEventListener(input, 'change', () => (setting.value = input.value));

    return container;
}

export function createSelectSetting<const T extends string>(
    setting: Setting<T>,
    label: string,
    context: EffectContext,
    options: { value: T; label: string; title?: string }[],
): HTMLElement {
    const [container, select] = createSelectInput(label, options);
    select.value = setting.value;

    context.watch([setting], ([newValue]) => {
        select.value = newValue;
    });

    context.elementEventListener(select, 'change', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe because options are typed with T
        setting.value = select.value as T;
    });

    return container;
}
