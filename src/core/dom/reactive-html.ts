import type { EffectContext } from '../effects';
import { isSignal, type ReadonlySignal, signal } from '../signals';
import {
    type AnyElementEventListenerMap,
    bindElementEvents,
    coerceAttributeValue,
    type CssKeys,
    el,
    type HTMLElementChild,
    type HTMLElementEventListenerMap,
    setElementClasses,
    svgEl,
    type SVGElementChild,
    type SVGElementEventListenerMap,
} from './html';

type AttributeValue = string | number | boolean | null | undefined;
export type ReactiveAttributesRecord = Record<string, AttributeValue | ReadonlySignal<AttributeValue>>;

type OptionalStringSignal = string | ReadonlySignal<string | null | undefined>;

export interface ReactiveElementOptions {
    effectContext: EffectContext;
    class?: string | string[];
    reactiveClass?: Record<string, ReadonlySignal<boolean | null | undefined>>;
    id?: OptionalStringSignal;
    style?: Partial<Record<CssKeys, OptionalStringSignal>>;
    styleCustomProperties?: Record<string, OptionalStringSignal>;
    attributes?: ReactiveAttributesRecord;
}

export interface ReactiveHTMLElementOptions extends ReactiveElementOptions {
    events?: HTMLElementEventListenerMap;
}

export interface ReactiveSVGElementOptions extends ReactiveElementOptions {
    events?: SVGElementEventListenerMap;
}

export interface ReactiveAnyElementOptions extends ReactiveElementOptions {
    events?: AnyElementEventListenerMap;
}

export function el$<T extends keyof HTMLElementTagNameMap>(
    name: T,
    options: ReactiveHTMLElementOptions,
    children?: (HTMLElementChild | ReadonlySignal<HTMLElementChild | HTMLElementChild[]>)[],
): HTMLElementTagNameMap[T] {
    const element = el(name);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    setReactiveCommonPropsAndChildren(element, options as ReactiveAnyElementOptions, children);
    return element;
}

export function svgEl$<T extends keyof SVGElementTagNameMap>(
    name: T,
    options: ReactiveSVGElementOptions,
    children?: (SVGElementChild | ReadonlySignal<SVGElementChild | SVGElementChild[]>)[],
): SVGElementTagNameMap[T] {
    const element = svgEl(name);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    setReactiveCommonPropsAndChildren(element, options as ReactiveAnyElementOptions, children);
    return element;
}

export function setReactiveCommonPropsAndChildren(
    element: HTMLElement | SVGElement,
    options: ReactiveAnyElementOptions,
    childrenCreatorFn?: (HTMLElementChild | ReadonlySignal<HTMLElementChild | HTMLElementChild[]>)[],
): void {
    const ctx = options.effectContext;
    if (options.id != null) {
        if (isSignal(options.id)) {
            ctx.watch(
                [options.id],
                ([id]) => {
                    if (id == null) {
                        element.removeAttribute('id');
                    } else {
                        element.id = id;
                    }
                },
                true,
            );
        } else {
            element.id = options.id;
        }
    }

    if (options.class != null) {
        setElementClasses(element, options.class);
    }

    if (options.reactiveClass != null) {
        for (const [className, classSignal] of Object.entries(options.reactiveClass)) {
            ctx.watch(
                [classSignal],
                ([isClassActive]) => {
                    element.classList.toggle(className, isClassActive === true);
                },
                true,
            );
        }
    }

    if (options.style != null) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe, Object.entries isn't typed well enough for this
        for (const [key, value] of Object.entries(options.style) as [CssKeys, OptionalStringSignal | undefined][]) {
            if (isSignal(value)) {
                ctx.watch(
                    [value],
                    ([styleValue]) => {
                        if (styleValue == null) {
                            element.style.removeProperty(key);
                        } else {
                            element.style[key] = styleValue;
                        }
                    },
                    true,
                );
            } else if (value != null) {
                element.style[key] = value;
            }
        }
    }

    if (options.styleCustomProperties != null) {
        for (const [key, value] of Object.entries(options.styleCustomProperties)) {
            if (isSignal(value)) {
                ctx.watch(
                    [value],
                    ([styleValue]) => {
                        if (styleValue == null) {
                            element.style.removeProperty(key);
                        } else {
                            element.style.setProperty(key, styleValue);
                        }
                    },
                    true,
                );
            } else {
                element.style.setProperty(key, value);
            }
        }
    }

    if (options.attributes != null) {
        for (const [key, value] of Object.entries(options.attributes)) {
            if (isSignal(value)) {
                ctx.watch(
                    [value],
                    ([attrValue]) => {
                        const coercedValue = coerceAttributeValue(attrValue);
                        if (coercedValue == null) {
                            element.removeAttribute(key);
                        } else {
                            element.setAttribute(key, coercedValue);
                        }
                    },
                    true,
                );
            } else {
                const coercedValue = coerceAttributeValue(value);
                if (coercedValue != null) {
                    element.setAttribute(key, coercedValue);
                }
            }
        }
    }

    if (options.events != null) {
        bindElementEvents(element, options.events);
    }

    if (childrenCreatorFn) {
        const childrenSignals = childrenCreatorFn.map((child) => (isSignal(child) ? child : signal(child)));
        ctx.watch(
            childrenSignals,
            (childrenValues) => {
                element.replaceChildren(...childrenValues.flat());
            },
            true,
        );
    }
}
