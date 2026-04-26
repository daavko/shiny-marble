import type { HTMLEventListenerFn, SVGEventListenerFn } from './dom/html';
import { computed, type MappedSignalValues, type ReadonlySignal, type UnsubscribeFn } from './signals';

export interface EffectContext {
    registerCleanup(unsubscribeFn: UnsubscribeFn): void;
    unregisterCleanup(unsubscribeFn: UnsubscribeFn): void;

    adopt(subcontext: EffectContext): void;
    unadopt(subcontext: EffectContext): void;

    createSubcontext(): EffectContext;

    destroy(): void;

    watch<const TInputs extends ReadonlySignal<unknown>[]>(
        inputSignals: readonly [...TInputs],
        effectFn: (inputValues: MappedSignalValues<TInputs>) => void | (() => void),
        immediate?: boolean,
    ): UnsubscribeFn;

    elementEventListener<K extends keyof SVGElementEventMap>(
        element: SVGElement,
        eventType: K,
        listener: SVGEventListenerFn<K>,
        options?: boolean | AddEventListenerOptions,
    ): void;
    elementEventListener<K extends keyof HTMLElementEventMap>(
        element: HTMLElement,
        eventType: K,
        listener: HTMLEventListenerFn<K>,
        options?: boolean | AddEventListenerOptions,
    ): void;
    elementEventListener(
        element: HTMLElement | SVGElement,
        eventType: string,
        listener: EventListener,
        options?: boolean | AddEventListenerOptions,
    ): void;
}

export function createEffectContext(): EffectContext {
    const effects = new Set<UnsubscribeFn>();
    const adoptedContexts = new Set<EffectContext>();

    const ctx: EffectContext = {
        registerCleanup(unsubscribeFn: UnsubscribeFn): void {
            effects.add(unsubscribeFn);
        },
        unregisterCleanup(unsubscribeFn: UnsubscribeFn): void {
            effects.delete(unsubscribeFn);
        },
        adopt(subcontext: EffectContext): void {
            adoptedContexts.add(subcontext);
        },
        unadopt(subcontext: EffectContext): void {
            adoptedContexts.delete(subcontext);
        },
        createSubcontext(): EffectContext {
            const subctx = createEffectContext();
            ctx.adopt(subctx);
            return subctx;
        },
        destroy(): void {
            for (const subcontext of adoptedContexts) {
                subcontext.destroy();
            }
            for (const unsubscribe of effects) {
                unsubscribe();
            }
            effects.clear();
        },
        watch<TInputs extends ReadonlySignal<unknown>[]>(
            inputSignals: readonly [...TInputs],
            effectFn: (inputValues: MappedSignalValues<TInputs>) => void | (() => void),
            immediate = false,
        ): UnsubscribeFn {
            let cleanupFn: void | (() => void);

            // this not only does the typing nicely for us, but it also coalesces all changes into a single microtask
            // since computed signals only notify subscribers in a microtask, even if multiple input signals change
            const inputValuesSignal = computed(inputSignals, (values) => values);

            function runEffect(): void {
                if (cleanupFn) {
                    cleanupFn();
                }
                cleanupFn = effectFn(inputValuesSignal.value);
            }

            const unsubscribe = inputValuesSignal.subscribe(runEffect);

            if (immediate) {
                runEffect();
            }

            const unsubscribeFn: UnsubscribeFn = () => {
                unsubscribe();
                if (cleanupFn) {
                    cleanupFn();
                }
                ctx.unregisterCleanup(unsubscribeFn);
            };

            ctx.registerCleanup(unsubscribeFn);

            return unsubscribeFn;
        },
        elementEventListener(
            element: HTMLElement | SVGElement,
            eventType: string,
            listener: EventListener,
            options?: boolean | AddEventListenerOptions,
        ): void {
            element.addEventListener(eventType, listener, options);
            ctx.registerCleanup(() => element.removeEventListener(eventType, listener, options));
        },
    };
    return ctx;
}
