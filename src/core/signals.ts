import { sameValueZero } from '../util/misc';
import { debug } from './debug';

export type EqualityFn<T> = (a: T, b: T) => boolean;
export type Subscriber<T> = (newValue: T) => void;
export type UnsubscribeFn = () => void;

const signalBrand = Symbol('Signal');

export type SignalSubscriptionType = 'sync' | 'microtask';

export interface ReadonlySignal<T> {
    readonly [signalBrand]: true;
    get value(): T;
    subscribe(callback: Subscriber<T>, type?: SignalSubscriptionType): UnsubscribeFn;
}

interface InternalSignalProps<T> {
    readonly subscribers: Set<Subscriber<T>>;
}

interface ReadonlyInternalSignal<T> extends ReadonlySignal<T>, InternalSignalProps<T> {}

export interface Signal<T> extends ReadonlySignal<T> {
    set value(newValue: T);
}

interface InternalSignal<T> extends Signal<T>, InternalSignalProps<T> {}

export type SignalValue<T> = T extends ReadonlySignal<infer U> ? U : never;
export type MappedSignalValues<T extends ReadonlySignal<unknown>[]> = {
    [K in keyof T]: SignalValue<T[K]>;
};

let signalCallbackMicrotaskScheduled = false;
const scheduledSignalCallbacks = new Set<InternalSignal<unknown>>();

function scheduleSignalCallbacks(sig: ReadonlyInternalSignal<unknown>): void {
    scheduledSignalCallbacks.add(sig);
    if (!signalCallbackMicrotaskScheduled) {
        signalCallbackMicrotaskScheduled = true;
        queueMicrotask(() => {
            flushScheduledSignalCallbacks();
            signalCallbackMicrotaskScheduled = false;
        });
    }
}

function flushScheduledSignalCallbacks(): void {
    const signalsWithValues = Array.from(scheduledSignalCallbacks).map((s) => [s, s.value] as const);
    for (const [sig, value] of signalsWithValues) {
        for (const callback of sig.subscribers) {
            try {
                callback(value);
            } catch (error) {
                debug('Error in signal subscriber callback', error);
            }
        }
    }

    scheduledSignalCallbacks.clear();
}

abstract class SignalImplBase<T> implements ReadonlyInternalSignal<T> {
    readonly [signalBrand] = true as const;
    readonly subscribers = new Set<Subscriber<T>>();

    protected currentValue: T;
    protected readonly syncSubscribers = new Set<Subscriber<T>>();

    protected constructor(
        initialValue: T,
        protected readonly equalityFn: EqualityFn<T> = sameValueZero,
    ) {
        this.currentValue = initialValue;
    }

    get value(): T {
        return this.currentValue;
    }

    subscribe(callback: Subscriber<T>, type: SignalSubscriptionType = 'microtask'): UnsubscribeFn {
        switch (type) {
            case 'sync':
                this.syncSubscribers.add(callback);
                return () => {
                    this.syncSubscribers.delete(callback);
                };
            case 'microtask':
                this.subscribers.add(callback);
                return () => {
                    this.subscribers.delete(callback);
                };
        }
    }

    protected updateValue(newValue: T): void {
        if (this.equalityFn(this.currentValue, newValue)) {
            return;
        }

        this.currentValue = newValue;
        for (const callback of this.syncSubscribers) {
            try {
                callback(newValue);
            } catch (error) {
                debug('Error in sync signal subscriber callback', error);
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        scheduleSignalCallbacks(this as InternalSignal<unknown>);
    }
}

export class SignalImpl<T> extends SignalImplBase<T> implements InternalSignal<T> {
    constructor(initialValue: T, equalityFn: EqualityFn<T> = sameValueZero) {
        super(initialValue, equalityFn);
    }

    override get value(): T {
        return super.value;
    }

    override set value(newValue: T) {
        this.updateValue(newValue);
    }
}

export function signal<T>(initialValue: T, equalityFn: EqualityFn<T> = sameValueZero): Signal<T> {
    return new SignalImpl(initialValue, equalityFn);
}

function computeCurrentValue<T, TInputs extends ReadonlySignal<unknown>[]>(
    inputSignals: readonly [...TInputs],
    computeValue: (inputValues: MappedSignalValues<TInputs>) => T,
): T {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    const inputValues = inputSignals.map((s) => s.value) as MappedSignalValues<TInputs>;
    return computeValue(inputValues);
}

export class ComputedSignalImpl<T, TInputs extends ReadonlySignal<unknown>[]>
    extends SignalImplBase<T>
    implements ReadonlyInternalSignal<T>
{
    constructor(
        private readonly inputSignals: readonly [...TInputs],
        private readonly computeValue: (inputValues: MappedSignalValues<TInputs>) => T,
        equalityFn: EqualityFn<T> = sameValueZero,
    ) {
        const initialValue = computeCurrentValue(inputSignals, computeValue);
        super(initialValue, equalityFn);

        for (const sig of inputSignals) {
            sig.subscribe(() => {
                const newValue = computeCurrentValue(this.inputSignals, this.computeValue);
                this.updateValue(newValue);
            }, 'sync');
        }
    }
}

export function computed<const TInputs extends ReadonlySignal<unknown>[], T>(
    inputSignals: readonly [...TInputs],
    computeValue: (inputValues: MappedSignalValues<TInputs>) => T,
    equalityFn: EqualityFn<T> = sameValueZero,
): ReadonlySignal<T> {
    return new ComputedSignalImpl(inputSignals, computeValue, equalityFn);
}

export function isSignal(value: unknown): value is ReadonlySignal<unknown> {
    return typeof value === 'object' && value !== null && signalBrand in value;
}

export function toValue<T>(signalOrValue: T | ReadonlySignal<T>): T {
    if (isSignal(signalOrValue)) {
        return signalOrValue.value;
    }
    return signalOrValue;
}
