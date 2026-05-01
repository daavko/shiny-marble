import { sameValueZero } from '../../util/equality';
import { debug } from '../debug';

export type EqualityFn<T> = (a: T, b: T) => boolean;
export type Subscriber<T> = (newValue: T) => void;
export type SimpleSubscriber = () => void;
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
    internalSubscribe(callback: Subscriber<T>, type: SignalSubscriptionType): void;
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
            signalCallbackMicrotaskScheduled = false;
            flushScheduledSignalCallbacks();
        });
    }
}

function flushScheduledSignalCallbacks(): void {
    const signalsWithValues = Array.from(scheduledSignalCallbacks).map((s) => [s, s.value] as const);
    scheduledSignalCallbacks.clear();
    for (const [sig, value] of signalsWithValues) {
        for (const callback of sig.subscribers) {
            try {
                callback(value);
            } catch (error) {
                debug('Error in signal subscriber callback', error);
            }
        }
    }
}

abstract class SignalImplBase<T> implements ReadonlyInternalSignal<T> {
    readonly [signalBrand] = true as const;
    readonly subscribers = new Set<Subscriber<T>>();

    protected currentValue: T;
    protected readonly syncSubscribers = new Set<Subscriber<T>>();
    protected readonly internalSubscribers = new Set<Subscriber<T>>();

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
                    // this.syncSubscribers.delete(callback);
                    this.unsubscribeSync(callback);
                };
            case 'microtask':
                this.subscribers.add(callback);
                return () => {
                    // this.subscribers.delete(callback);
                    this.unsubscribe(callback);
                };
        }
    }

    internalSubscribe(callback: Subscriber<T>): void {
        this.internalSubscribers.add(callback);
    }

    protected unsubscribeSync(callback: Subscriber<T>): void {
        this.syncSubscribers.delete(callback);
    }

    protected unsubscribe(callback: Subscriber<T>): void {
        this.subscribers.delete(callback);
    }

    protected updateValue(newValue: T): void {
        if (this.equalityFn(this.currentValue, newValue)) {
            return;
        }

        this.currentValue = newValue;
        for (const callback of this.internalSubscribers) {
            try {
                callback(newValue);
            } catch (error) {
                debug('Error in internal sync signal subscriber callback', error);
            }
        }
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
    const inputValues = inputSignals.map((s) => {
        if (s instanceof ComputedSignalImplBase) {
            // a top-level forced recompute needs to propagate to all nested computed signals
            s.recomputeIfNecessary();
        }
        return s.value;
    }) as MappedSignalValues<TInputs>;
    return computeValue(inputValues);
}

abstract class ComputedSignalImplBase<T, TInputs extends ReadonlySignal<unknown>[]>
    extends SignalImplBase<T>
    implements ReadonlyInternalSignal<T>
{
    protected needsRecompute = false;

    protected readonly needsRecomputeSubscribers = new Set<SimpleSubscriber>();

    protected constructor(
        protected readonly inputSignals: readonly [...TInputs],
        initialValue: T,
        equalityFn: EqualityFn<T> = sameValueZero,
    ) {
        super(initialValue, equalityFn);
    }

    override get value(): T {
        if (this.needsRecompute) {
            this.recomputeValue();
        }
        return super.value;
    }

    override subscribe(callback: Subscriber<T>, type: SignalSubscriptionType = 'microtask'): UnsubscribeFn {
        if (this.needsRecompute) {
            this.recomputeValue();
        }
        return super.subscribe(callback, type);
    }

    override internalSubscribe(callback: Subscriber<T>): void {
        super.internalSubscribe(callback);
    }

    needsRecomputeSubscribe(callback: SimpleSubscriber): void {
        this.needsRecomputeSubscribers.add(callback);
    }

    recomputeIfNecessary(): void {
        if (this.needsRecompute) {
            this.recomputeValue();
        }
    }

    protected setupInputSubscriptions(): void {
        for (const sig of this.inputSignals) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
            (sig as InternalSignal<unknown>).internalSubscribe(() => {
                if (this.subscribers.size === 0 && this.syncSubscribers.size === 0) {
                    this.notifyNeedsRecompute();
                } else {
                    this.recomputeValue();
                }
            }, 'sync');

            if (sig instanceof ComputedSignalImplBase) {
                sig.needsRecomputeSubscribe(() => {
                    if (this.subscribers.size === 0 && this.syncSubscribers.size === 0) {
                        this.notifyNeedsRecompute();
                    } else {
                        this.recomputeValue();
                    }
                });
            }
        }
    }

    protected notifyNeedsRecompute(): void {
        this.needsRecompute = true;
        for (const callback of this.needsRecomputeSubscribers) {
            try {
                callback();
            } catch (error) {
                debug('Error in needsRecompute subscriber callback', error);
            }
        }
    }

    protected abstract recomputeValue(): void;
}

export class ComputedSignalImpl<T, TInputs extends ReadonlySignal<unknown>[]> extends ComputedSignalImplBase<
    T,
    TInputs
> {
    constructor(
        inputSignals: readonly [...TInputs],
        protected readonly computeValue: (inputValues: MappedSignalValues<TInputs>) => T,
        equalityFn: EqualityFn<T> = sameValueZero,
    ) {
        const initialValue = computeCurrentValue(inputSignals, computeValue);
        super(inputSignals, initialValue, equalityFn);

        this.setupInputSubscriptions();
    }

    protected recomputeValue(): void {
        this.needsRecompute = false;
        const newValue = computeCurrentValue(this.inputSignals, this.computeValue);
        this.updateValue(newValue);
    }
}

export function computed<const TInputs extends ReadonlySignal<unknown>[], T>(
    inputSignals: readonly [...TInputs],
    computeValue: (inputValues: MappedSignalValues<TInputs>) => T,
    equalityFn: EqualityFn<T> = sameValueZero,
): ReadonlySignal<T> {
    return new ComputedSignalImpl(inputSignals, computeValue, equalityFn);
}

class FlatComputedSignalImpl<T, TInputs extends ReadonlySignal<unknown>[]>
    extends ComputedSignalImplBase<T, TInputs>
    implements ReadonlyInternalSignal<T>
{
    private unsubscribeFromInnerSignalFn?: UnsubscribeFn;

    constructor(
        inputSignals: readonly [...TInputs],
        protected readonly computeValue: (inputValues: MappedSignalValues<TInputs>) => T | ReadonlySignal<T>,
        equalityFn: EqualityFn<T> = sameValueZero,
    ) {
        const initialValueOrSignal = computeCurrentValue(inputSignals, computeValue);
        super(inputSignals, toValue(initialValueOrSignal), equalityFn);

        if (isSignal(initialValueOrSignal)) {
            this.subscribeToInnerSignal(initialValueOrSignal);
        }

        this.setupInputSubscriptions();
    }

    protected override unsubscribe(callback: Subscriber<T>): void {
        super.unsubscribe(callback);
        if (this.subscribers.size === 0 && this.syncSubscribers.size === 0) {
            this.unsubscribeFromInnerSignal();
            this.notifyNeedsRecompute();
        }
    }

    protected override unsubscribeSync(callback: Subscriber<T>): void {
        super.unsubscribeSync(callback);
        if (this.subscribers.size === 0 && this.syncSubscribers.size === 0) {
            this.unsubscribeFromInnerSignal();
            this.notifyNeedsRecompute();
        }
    }

    protected recomputeValue(): void {
        this.needsRecompute = false;
        this.unsubscribeFromInnerSignal();

        const newValueOrSignal = computeCurrentValue(this.inputSignals, this.computeValue);
        this.updateValue(toValue(newValueOrSignal));
        if (isSignal(newValueOrSignal)) {
            this.subscribeToInnerSignal(newValueOrSignal);
        }
    }

    protected subscribeToInnerSignal(innerSignal: ReadonlySignal<T>): void {
        this.unsubscribeFromInnerSignalFn = innerSignal.subscribe((newValue) => {
            this.updateValue(newValue);
        }, 'sync');
    }

    protected unsubscribeFromInnerSignal(): void {
        this.unsubscribeFromInnerSignalFn?.();
        this.unsubscribeFromInnerSignalFn = undefined;
    }
}

export function flatComputed<const TInputs extends ReadonlySignal<unknown>[], T>(
    inputSignals: readonly [...TInputs],
    computeValue: (inputValues: MappedSignalValues<TInputs>) => T | ReadonlySignal<T>,
    equalityFn: EqualityFn<T> = sameValueZero,
): ReadonlySignal<T> {
    return new FlatComputedSignalImpl(inputSignals, computeValue, equalityFn);
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
