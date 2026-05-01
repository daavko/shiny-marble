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
} from '../../core/dom/html';
import { arrayEqualityFn } from '../../util/equality';
import type { EffectContext } from './effects';
import {
    computed,
    type EqualityFn,
    flatComputed,
    isSignal,
    type MappedSignalValues,
    type ReadonlySignal,
    signal,
} from './signals';

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

const CONTEXT_MAP = new WeakMap<Element, EffectContext>();

export type ReactiveHTMLElementChildOutput = HTMLElementChild | HTMLElementChild[] | null | undefined;
export type ReactiveSVGElementChildOutput = SVGElementChild | SVGElementChild[] | null | undefined;

export type ReactiveHTMLElementChild = HTMLElementChild | ReadonlySignal<ReactiveHTMLElementChildOutput>;
export type ReactiveSVGElementChild = SVGElementChild | ReadonlySignal<ReactiveSVGElementChildOutput>;

export const reactiveChildrenEqualityFn: EqualityFn<ReactiveHTMLElementChildOutput> = (a, b) => {
    if (Array.isArray(a) && Array.isArray(b)) {
        return arrayEqualityFn(a, b);
    } else if (Array.isArray(a) || Array.isArray(b)) {
        return false;
    } else if (a == null || b == null) {
        return a == b;
    } else {
        return a === b;
    }
};

export function el$<T extends keyof HTMLElementTagNameMap>(
    name: T,
    options: ReactiveHTMLElementOptions,
    children?: ReactiveHTMLElementChild[],
): HTMLElementTagNameMap[T] {
    const element = el(name);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    setReactiveCommonPropsAndChildren(element, options as ReactiveAnyElementOptions, children);
    return element;
}

export function svgEl$<T extends keyof SVGElementTagNameMap>(
    name: T,
    options: ReactiveSVGElementOptions,
    children?: ReactiveSVGElementChild[],
): SVGElementTagNameMap[T] {
    const element = svgEl(name);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    setReactiveCommonPropsAndChildren(element, options as ReactiveAnyElementOptions, children);
    return element;
}

function reactiveChildrenArrayToSignal(
    children: ReactiveHTMLElementChild[],
): ReadonlySignal<ReactiveHTMLElementChildOutput> {
    const childSignals = children.map((child) => (isSignal(child) ? child : signal(child)));
    return flatComputed(
        childSignals,
        (childValues) => childValues.flat().filter((child) => child != null),
        reactiveChildrenEqualityFn,
    );
}

function reactiveHTMLElementChildrenToOutput(
    content: ReactiveHTMLElementChild | ReactiveHTMLElementChild[] | null | undefined,
): ReactiveHTMLElementChild | null {
    if (content == null) {
        return null;
    } else if (isSignal(content) || !Array.isArray(content)) {
        return content;
    } else {
        return reactiveChildrenArrayToSignal(content);
    }
}

export function if$(
    conditionSignal: ReadonlySignal<boolean>,
    trueContent: ReactiveHTMLElementChild | ReactiveHTMLElementChild[],
    falseContent?: ReactiveHTMLElementChild | ReactiveHTMLElementChild[],
): ReadonlySignal<ReactiveHTMLElementChildOutput> {
    return flatComputed(
        [conditionSignal],
        ([condition]) => {
            const content = condition ? trueContent : falseContent;
            return reactiveHTMLElementChildrenToOutput(content);
        },
        reactiveChildrenEqualityFn,
    );
}

export function ifNot$(
    conditionSignal: ReadonlySignal<boolean>,
    falseContent: ReactiveHTMLElementChild | ReactiveHTMLElementChild[],
    trueContent?: ReactiveHTMLElementChild | ReactiveHTMLElementChild[],
): ReadonlySignal<ReactiveHTMLElementChildOutput> {
    return flatComputed(
        [conditionSignal],
        ([condition]) => {
            const content = !condition ? falseContent : trueContent;
            return reactiveHTMLElementChildrenToOutput(content);
        },
        reactiveChildrenEqualityFn,
    );
}
export function cond$<T, S extends T>(
    conditionSignal: ReadonlySignal<T>,
    conditionFn: (value: T) => value is S,
    trueContent: ReactiveHTMLElementChild | ReactiveHTMLElementChild[] | ((value: S) => ReactiveHTMLElementChild),
    falseContent?:
        | ReactiveHTMLElementChild
        | ReactiveHTMLElementChild[]
        | ((value: Exclude<T, S>) => ReactiveHTMLElementChild),
): ReadonlySignal<ReactiveHTMLElementChildOutput>;
export function cond$<T>(
    conditionSignal: ReadonlySignal<T>,
    conditionFn: (value: NoInfer<T>) => boolean,
    trueContent:
        | ReactiveHTMLElementChild
        | ReactiveHTMLElementChild[]
        | ((value: NoInfer<T>) => ReactiveHTMLElementChild),
    falseContent?:
        | ReactiveHTMLElementChild
        | ReactiveHTMLElementChild[]
        | ((value: NoInfer<T>) => ReactiveHTMLElementChild),
): ReadonlySignal<ReactiveHTMLElementChildOutput>;
export function cond$<T, S extends T>(
    conditionSignal: ReadonlySignal<T>,
    conditionFn: ((value: T) => value is S) | ((value: T) => boolean),
    trueContent: ReactiveHTMLElementChild | ReactiveHTMLElementChild[] | ((value: S) => ReactiveHTMLElementChild),
    falseContent?:
        | ReactiveHTMLElementChild
        | ReactiveHTMLElementChild[]
        | ((value: Exclude<T, S>) => ReactiveHTMLElementChild),
): ReadonlySignal<ReactiveHTMLElementChildOutput> {
    return flatComputed(
        [conditionSignal],
        ([condition]) => {
            let content: ReactiveHTMLElementChild | ReactiveHTMLElementChild[] | null = null;
            if (conditionFn(condition)) {
                if (typeof trueContent === 'function') {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
                    content = trueContent(condition as S);
                } else {
                    content = trueContent;
                }
            } else {
                if (falseContent != null) {
                    if (typeof falseContent === 'function') {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
                        content = falseContent(condition as Exclude<T, S>);
                    } else {
                        content = falseContent;
                    }
                }
            }

            return reactiveHTMLElementChildrenToOutput(content);
        },
        reactiveChildrenEqualityFn,
    );
}

export function switch$<T>(
    valueSignal: ReadonlySignal<T>,
    cases: [caseValue: T, content: ReactiveHTMLElementChild | ReactiveHTMLElementChild[]][],
    defaultContent?: () => ReactiveHTMLElementChildOutput,
): ReadonlySignal<ReactiveHTMLElementChildOutput> {
    return flatComputed(
        [valueSignal],
        ([value]) => {
            for (const [caseValue, content] of cases) {
                if (caseValue === value) {
                    return reactiveHTMLElementChildrenToOutput(content);
                }
            }
            return defaultContent ? defaultContent() : null;
        },
        reactiveChildrenEqualityFn,
    );
}

export function multiCond$<const TInputs extends ReadonlySignal<unknown>[]>(
    inputSignals: readonly [...TInputs],
    ...cases: [
        caseFn: (inputValues: MappedSignalValues<TInputs>) => boolean,
        content: ReactiveHTMLElementChild | ReactiveHTMLElementChild[],
    ][]
): ReadonlySignal<ReactiveHTMLElementChildOutput> {
    return flatComputed(
        inputSignals,
        (inputValues) => {
            for (const [caseFn, content] of cases) {
                if (caseFn(inputValues)) {
                    return reactiveHTMLElementChildrenToOutput(content);
                }
            }
            return null;
        },
        reactiveChildrenEqualityFn,
    );
}

function childrenArrayAsSet(children: (HTMLElementChild | HTMLElementChild[])[]): Set<HTMLElement | SVGElement> {
    const childSet = new Set<HTMLElement | SVGElement>();
    for (const child of children.flat()) {
        if (typeof child === 'string') {
            continue;
        }

        childSet.add(child);
        const walker = document.createTreeWalker(child, NodeFilter.SHOW_ELEMENT);
        let node = walker.nextNode();
        while (node) {
            if (node instanceof HTMLElement || node instanceof SVGElement) {
                childSet.add(node);
            }
            node = walker.nextNode();
        }
    }
    return childSet;
}

function existingChildrenAsSet(parent: Element): Set<HTMLElement | SVGElement> {
    const childSet = new Set<HTMLElement | SVGElement>();
    const walker = document.createTreeWalker(parent, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
        if (node instanceof HTMLElement || node instanceof SVGElement) {
            childSet.add(node);
        }
        node = walker.nextNode();
    }
    return childSet;
}

function bindAttributeSignal<T>(
    ctx: EffectContext,
    attributeSignal: ReadonlySignal<T>,
    setFn: (value: NonNullable<T>) => void,
    deleteFn: () => void,
): void {
    ctx.watch(
        [attributeSignal],
        ([value]) => {
            if (value == null) {
                deleteFn();
            } else {
                setFn(value);
            }
        },
        true,
    );
}

export function setReactiveCommonPropsAndChildren(
    element: HTMLElement | SVGElement,
    options: ReactiveAnyElementOptions,
    children?: ReactiveHTMLElementChild[],
): void {
    const ctx = options.effectContext.createSubcontext();
    CONTEXT_MAP.set(element, ctx);

    if (options.id != null) {
        if (isSignal(options.id)) {
            bindAttributeSignal(
                ctx,
                options.id,
                (id) => element.setAttribute('id', id),
                () => element.removeAttribute('id'),
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
                bindAttributeSignal(
                    ctx,
                    value,
                    (styleValue) => element.style.setProperty(key, styleValue),
                    () => element.style.removeProperty(key),
                );
            } else if (value != null) {
                element.style[key] = value;
            }
        }
    }

    if (options.styleCustomProperties != null) {
        for (const [key, value] of Object.entries(options.styleCustomProperties)) {
            if (isSignal(value)) {
                bindAttributeSignal(
                    ctx,
                    value,
                    (styleValue) => element.style.setProperty(key, styleValue),
                    () => element.style.removeProperty(key),
                );
            } else {
                element.style.setProperty(key, value);
            }
        }
    }

    if (options.attributes != null) {
        for (const [key, value] of Object.entries(options.attributes)) {
            if (isSignal(value)) {
                const coercedValueSignal = computed([value], ([attrValue]) => coerceAttributeValue(attrValue));
                bindAttributeSignal(
                    ctx,
                    coercedValueSignal,
                    (coercedValue) => element.setAttribute(key, coercedValue),
                    () => element.removeAttribute(key),
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

    if (children) {
        const childrenSignals = children.map((child) => (isSignal(child) ? child : signal(child)));
        ctx.watch(
            childrenSignals,
            (childrenValues) => {
                const nonNullChildren = childrenValues.filter((child) => child != null);
                const existingChildren = existingChildrenAsSet(element);
                const newChildren = childrenArrayAsSet(nonNullChildren);
                const childrenToRemove = existingChildren.difference(newChildren);
                for (const child of childrenToRemove) {
                    const childCtx = CONTEXT_MAP.get(child);
                    if (childCtx) {
                        childCtx.destroy();
                        CONTEXT_MAP.delete(child);
                    }
                }
                element.replaceChildren(...nonNullChildren.flat());
            },
            true,
        );
    }
}
