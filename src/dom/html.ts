type StringProperties<T> = { [K in keyof T as T[K] extends string ? (K extends number ? never : K) : never]: T[K] };

type CssKeys = keyof StringProperties<CSSStyleDeclaration>;

type AttributesRecord = Record<string, string | number | boolean | null | undefined>;

export interface ElementOptions {
    class?: string | string[];
    id?: string;
    style?: Partial<Record<CssKeys, string>>;
    styleCustomProperties?: Record<string, string>;
    attributes?: AttributesRecord;
}

export interface HTMLElementOptions extends ElementOptions {
    events?: HTMLElementEventListenerMap;
}

export interface SVGElementOptions extends ElementOptions {
    events?: SVGElementEventListenerMap;
}

interface AnyElementOptions extends ElementOptions {
    events?: AnyEventListenerMap;
}

type HTMLEventListenerFn<K extends keyof HTMLElementEventMap> = (evt: HTMLElementEventMap[K]) => void;
type HTMLEventListenerWithOptions<K extends keyof HTMLElementEventMap> = [
    HTMLEventListenerFn<K>,
    AddEventListenerOptions,
];

type HTMLElementEventListenerMap = {
    [K in keyof HTMLElementEventMap]?:
        | HTMLEventListenerFn<K>
        | HTMLEventListenerWithOptions<K>
        | (HTMLEventListenerFn<K> | HTMLEventListenerWithOptions<K>)[];
};

type SVGEventListenerFn<K extends keyof SVGElementEventMap> = (evt: SVGElementEventMap[K]) => void;
type SVGEventListenerWithOptions<K extends keyof SVGElementEventMap> = [SVGEventListenerFn<K>, AddEventListenerOptions];

type SVGElementEventListenerMap = {
    [K in keyof SVGElementEventMap]?:
        | SVGEventListenerFn<K>
        | SVGEventListenerWithOptions<K>
        | (SVGEventListenerFn<K> | SVGEventListenerWithOptions<K>)[];
};

type AnyEventListenerFn = (evt: Event) => void;
type AnyEventListenerWithOptions = [AnyEventListenerFn, AddEventListenerOptions];

function isEventListenerWithOptions(
    listener: AnyEventListenerWithOptions | (AnyEventListenerFn | AnyEventListenerWithOptions)[],
): listener is AnyEventListenerWithOptions {
    return (
        listener.length === 2 &&
        typeof listener[0] === 'function' &&
        typeof listener[1] === 'object' &&
        !Array.isArray(listener[1])
    );
}

type AnyEventListenerMap = Record<
    string,
    AnyEventListenerFn | AnyEventListenerWithOptions | (AnyEventListenerFn | AnyEventListenerWithOptions)[]
>;

type HTMLElementChild = HTMLElement | SVGElementChild;
type SVGElementChild = SVGElement | string;

export function el<T extends keyof HTMLElementTagNameMap>(
    name: T,
    options: HTMLElementOptions,
    children?: HTMLElementChild[],
): HTMLElementTagNameMap[T];
export function el<T extends keyof HTMLElementTagNameMap>(
    name: T,
    children?: HTMLElementChild[],
): HTMLElementTagNameMap[T];
export function el<T extends keyof HTMLElementTagNameMap>(
    name: T,
    optionsOrChildren?: HTMLElementOptions | HTMLElementChild[],
    maybeChildren?: HTMLElementChild[],
): HTMLElementTagNameMap[T] {
    const options = Array.isArray(optionsOrChildren) ? undefined : optionsOrChildren;
    const children = Array.isArray(optionsOrChildren) ? optionsOrChildren : maybeChildren;

    const element = document.createElement(name);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    setCommonPropsAndChildren(element, options as AnyElementOptions, children);
    return element;
}

export function svgEl<T extends keyof SVGElementTagNameMap>(
    name: T,
    options: SVGElementOptions,
    children?: SVGElementChild[],
): SVGElementTagNameMap[T];
export function svgEl<T extends keyof SVGElementTagNameMap>(
    name: T,
    children?: SVGElementChild[],
): SVGElementTagNameMap[T];
export function svgEl<T extends keyof SVGElementTagNameMap>(
    name: T,
    optionsOrChildren?: SVGElementOptions | SVGElementChild[],
    maybeChildren?: SVGElementChild[],
): SVGElementTagNameMap[T] {
    const options = Array.isArray(optionsOrChildren) ? undefined : optionsOrChildren;
    const children = Array.isArray(optionsOrChildren) ? optionsOrChildren : maybeChildren;

    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    setCommonPropsAndChildren(element, options as AnyElementOptions, children);
    return element;
}

function setCommonPropsAndChildren(
    element: HTMLElement | SVGElement,
    options?: AnyElementOptions,
    children?: HTMLElementChild[],
): void {
    if (options?.id != null) {
        element.id = options.id;
    }
    if (options?.class != null) {
        if (Array.isArray(options.class)) {
            element.classList.add(...options.class);
        } else {
            element.classList.add(options.class);
        }
    }
    if (options?.style != null) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe, Object.entries isn't typed correctly
        for (const [key, value] of Object.entries(options.style) as [CssKeys, string | undefined][]) {
            if (value != null) {
                element.style[key] = value;
            }
        }
    }
    if (options?.styleCustomProperties) {
        for (const [key, value] of Object.entries(options.styleCustomProperties)) {
            element.style.setProperty(key, value);
        }
    }
    if (options?.attributes != null) {
        for (const [key, value] of Object.entries(options.attributes)) {
            if (typeof value === 'boolean' && value) {
                element.setAttribute(key, '');
            } else if (typeof value === 'string') {
                element.setAttribute(key, value);
            } else if (typeof value === 'number') {
                element.setAttribute(key, value.toString());
            }
        }
    }
    if (options?.events != null) {
        for (const [eventName, listenerOrListeners] of Object.entries(options.events)) {
            if (typeof listenerOrListeners === 'function') {
                element.addEventListener(eventName, listenerOrListeners);
            } else if (isEventListenerWithOptions(listenerOrListeners)) {
                element.addEventListener(eventName, listenerOrListeners[0], listenerOrListeners[1]);
            } else {
                for (const listener of listenerOrListeners) {
                    if (typeof listener === 'function') {
                        element.addEventListener(eventName, listener);
                    } else if (isEventListenerWithOptions(listener)) {
                        element.addEventListener(eventName, listener[0], listener[1]);
                    }
                }
            }
        }
    }
    if (children) {
        element.append(...children);
    }
}
