import { randomHexString } from '../util/string';
import { addStyle } from './styles';
import { Subject } from 'rxjs';

export abstract class Component {
    static readonly style: string = '';
    requiresRerender = false;
    private readonly destroySubject = new Subject<void>();
    // eslint-disable-next-line @typescript-eslint/member-ordering -- ignore here
    protected readonly destroy$ = this.destroySubject.asObservable();
    beforeMount(): void {
        // no-op
    }
    beforeUnmount(): void {
        // no-op
    }
    protected requestRerender(): void {
        this.requiresRerender = true;
        triggerRenderRequest();
    }
    abstract render(): Element | Element[];
}

export interface ComponentType<T extends Component, CtorArgs extends unknown[]> {
    readonly style: string;
    new (...args: CtorArgs): T;
}

export type ComponentHandle = symbol;

interface MountedComponent {
    parent: Element;
    instance: Component;
    elementId: string;
    finalizer: () => void;
}
const mountedComponents = new Map<ComponentHandle, MountedComponent>();

const elementIdAttributeName = `sm-${randomHexString(8)}`;

let rerenderRequestId: number | null = null;

function rerenderComponentTree(): void {
    mountedComponents.forEach((mounted) => {
        if (mounted.instance.requiresRerender) {
            renderComponent(mounted);
            mounted.instance.requiresRerender = false;
        }
    });
}

function triggerRenderRequest(): void {
    if (rerenderRequestId != null) {
        return;
    }
    rerenderRequestId = requestAnimationFrame(() => {
        rerenderComponentTree();
        rerenderRequestId = null;
    });
}

function renderComponent(mounted: MountedComponent): void {
    const newElements = mounted.instance.render();
    const existingElements = getRenderedElements(mounted.parent, mounted.elementId);

    const newElementsArray = Array.isArray(newElements) ? newElements : [newElements];

    for (const el of newElementsArray) {
        el.setAttribute(elementIdAttributeName, mounted.elementId);
    }

    if (existingElements.length === 0) {
        mounted.parent.append(...newElementsArray);
    } else {
        // prepend new elements before the first existing element, then remove old elements
        const firstExistingElement = existingElements[0];
        const fragment = document.createDocumentFragment();
        fragment.append(...newElementsArray);
        mounted.parent.insertBefore(fragment, firstExistingElement);
        existingElements.forEach((el) => {
            el.remove();
        });
    }
}

function getRenderedElements(parent: Element, elementId: string): NodeListOf<Element> {
    return parent.querySelectorAll(`[${elementIdAttributeName}="${elementId}"]`);
}

const mutationObserver = new MutationObserver((mutations) => {
    let connectednessMaybeChanged = false;
    for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
            connectednessMaybeChanged = true;
            break;
        }
    }

    if (connectednessMaybeChanged) {
        mountedComponents.forEach((mounted, handle) => {
            if (!mounted.parent.isConnected) {
                unmountComponent(handle);
            }
        });
    }
});
let observingMutations = false;

function observeDocumentMutations(): void {
    if (observingMutations) {
        return;
    }
    mutationObserver.observe(document, { childList: true, subtree: true });
    observingMutations = true;
}
function unobserveDocumentMutations(): void {
    mutationObserver.disconnect();
    observingMutations = false;
}

export function mountComponent<T extends Component, CtorArgs extends unknown[]>(
    mountPoint: string | Element,
    componentType: ComponentType<T, CtorArgs>,
    ...componentCtorArgs: CtorArgs
): ComponentHandle {
    let mountElement: Element | null = null;
    if (typeof mountPoint === 'string') {
        mountElement = document.querySelector(mountPoint);
    } else {
        mountElement = mountPoint;
    }
    if (mountElement == null) {
        throw new Error('Mount point not found');
    }
    const handle = Symbol();
    const component = new componentType(...componentCtorArgs);
    const elementId = crypto.randomUUID();
    const mounted: MountedComponent = {
        parent: mountElement,
        instance: component,
        elementId,
        finalizer: () => {
            const renderedElements = getRenderedElements(mountElement, elementId);
            renderedElements.forEach((el) => {
                el.remove();
            });
        },
    };
    mountedComponents.set(handle, mounted);
    addStyle(componentType.style);
    component.beforeMount();
    renderComponent(mounted);
    observeDocumentMutations();
    return handle;
}

export function unmountComponent(handle: ComponentHandle): void {
    const mounted = mountedComponents.get(handle);
    if (mounted == null) {
        console.warn('Tried to unmount a component for an unknown handle');
        return;
    }

    mounted.instance.beforeUnmount();
    mounted.finalizer();
    mountedComponents.delete(handle);
    if (mountedComponents.size === 0) {
        unobserveDocumentMutations();
    }
}
