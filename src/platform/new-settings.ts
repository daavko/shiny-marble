import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import { debug, debugDetailed } from '../core/debug';
import { showErrorAlert } from '../ui/alerts-container';
import type { SettingUpdateCallback } from './settings';

const ChangesBroadcaster = new BroadcastChannel('sm-settings-changes');

interface SettingChangeEventData {
    type: 'settingChange';
    settings: string;
    key: string;
    newValue: unknown;
}

interface SettingsResetEventData {
    type: 'reset';
    settings: string;
}

type SettingsEventData = SettingChangeEventData | SettingsResetEventData;

type SettingEqualityFunction<TValue> = (value1: TValue, value2: TValue) => boolean;

interface NewSettingInitializer<TValue> {
    readonly defaultValue: TValue;
    readonly valueUpdateCallbacks: SettingUpdateCallback<TValue>[];
    readonly equalityFunction: SettingEqualityFunction<TValue>;
}

export interface NewSetting<TValue> {
    get value(): TValue;
    set value(value: TValue);
    reset(): void;
    addCallback(callback: SettingUpdateCallback<TValue>): void;
    removeCallback(callback: SettingUpdateCallback<TValue>): void;
}

interface NewSettingInternal<TValue> extends NewSetting<TValue> {
    setWithoutInternalCallbacks(value: TValue): void;
}

type SettingFromInitializer<TInit> = TInit extends NewSettingInitializer<infer TValue> ? NewSetting<TValue> : never;
type SettingInternalFromInitializer<TInit> =
    TInit extends NewSettingInitializer<infer TValue> ? NewSettingInternal<TValue> : never;

type NewSettings<TSettings extends Record<string, NewSettingInitializer<unknown>>> = {
    [K in keyof TSettings]: SettingFromInitializer<TSettings[K]>;
} & NewSettingsImpl;

type NewSettingsInternal<TSettings extends Record<string, NewSettingInitializer<unknown>>> = {
    [K in keyof TSettings]: SettingInternalFromInitializer<TSettings[K]>;
} & NewSettingsImpl;

interface NewSettingsImpl {
    initialized: Promise<void>;
    reset(): void;
}

type NewSettingsWithoutImplProperties = {
    [K in keyof NewSettingsImpl]: `Property name "${K}" is reserved and cannot be used in settings shape.`;
};

interface SavedNewSetting {
    key: string;
    value: unknown;
}

interface NewSettingsDBSchema extends DBSchema {
    settings: {
        key: string;
        value: SavedNewSetting;
        indexes: { key: string };
    };
}

export function createSetting<TValue>(
    defaultValue: TValue,
    valueUpdateCallbacks: NoInfer<SettingUpdateCallback<TValue>>[] = [],
    equalityFunction?: NoInfer<SettingEqualityFunction<TValue>>,
): NoInfer<NewSettingInitializer<TValue>> {
    return {
        defaultValue,
        valueUpdateCallbacks,
        equalityFunction: equalityFunction ?? ((a, b): boolean => a === b),
    };
}

function settingFromInitializer<TValue>(
    initializer: NewSettingInitializer<TValue>,
    internalCallbacks: SettingUpdateCallback<TValue>[],
): NoInfer<NewSettingInternal<TValue>> {
    const { defaultValue, valueUpdateCallbacks: initialCallbacks, equalityFunction } = initializer;

    let value = defaultValue;
    const valueUpdateCallbacks = new Set(initialCallbacks);

    return {
        get value(): TValue {
            return value;
        },
        set value(newValue: TValue) {
            if (equalityFunction(value, newValue)) {
                return;
            }
            const oldValue = value;
            value = newValue;
            for (const callback of internalCallbacks) {
                callback(oldValue, newValue);
            }
            for (const callback of valueUpdateCallbacks) {
                callback(oldValue, newValue);
            }
        },
        reset(): void {
            this.value = defaultValue;
        },
        addCallback(callback: SettingUpdateCallback<TValue>): void {
            valueUpdateCallbacks.add(callback);
        },
        removeCallback(callback: SettingUpdateCallback<TValue>): void {
            valueUpdateCallbacks.delete(callback);
        },

        setWithoutInternalCallbacks(newValue: TValue): void {
            if (equalityFunction(value, newValue)) {
                return;
            }
            const oldValue = value;
            value = newValue;
            for (const callback of valueUpdateCallbacks) {
                callback(oldValue, newValue);
            }
        },
    };
}

async function createSettingsStorage(name: string, versionNumber: number): Promise<IDBPDatabase<NewSettingsDBSchema>> {
    return openDB<NewSettingsDBSchema>(`sm-settings-${name}`, versionNumber, {
        upgrade: (db, oldVersion) => {
            debug(`Upgrading settings storage "${name}" from version ${oldVersion} to ${versionNumber}`);
            if (oldVersion < 1) {
                // never opened before, create object store
                const store = db.createObjectStore('settings', { keyPath: 'key' });
                store.createIndex('key', 'key', { unique: true });
            }
        },
        blocked: (currentVersion, blockedVersion, event) => {
            showErrorAlert(
                `Storage error: An older version of Shiny Marble is open in another tab, preventing access to settings storage "${name}". Please close other tabs running Shiny Marble and reload this page.`,
                { event, currentVersion, blockedVersion },
                30000,
            );
        },
        blocking: (currentVersion, blockedVersion, event) => {
            showErrorAlert(
                `Storage error: A new version of Shiny Marble is open in another tab, and this tab is preventing it from accessing settings storage "${name}". Please close this tab.`,
                { event, currentVersion, blockedVersion },
                30000,
            );
        },
        terminated: () => {
            showErrorAlert(
                `Storage error: Settings storage "${name}" was unexpectedly closed. Please reload the page. If the problem persists, please report it."`,
                undefined,
                30000,
            );
        },
    });
}

export function createSettings<TSettings extends Record<string, NewSettingInitializer<unknown>>>(
    name: string,
    versionNumber: number,
    settingsShape: TSettings & NewSettingsWithoutImplProperties,
): NewSettings<TSettings> {
    const storageLayer = createSettingsStorage(name, versionNumber);

    const { promise: initPromise, resolve: resolveInit, reject: rejectInit } = Promise.withResolvers<void>();

    const settingStorageCallback: SettingUpdateCallback<unknown> = (oldValue, newValue) => {};

    function createSettingStorageCallback(key: string): SettingUpdateCallback<unknown> {
        return (_oldValue, newValue) => {
            storageLayer.then(async (db) => {
                // todo: check that this is correct...
                await db.put('settings', { key, value: newValue });
            });
        };
    }

    function createSettingBroadcastCallback(key: string): SettingUpdateCallback<unknown> {
        return (_oldValue, newValue) => {
            ChangesBroadcaster.postMessage({
                type: 'settingChange',
                settings: name,
                key,
                newValue,
            } satisfies SettingChangeEventData);
        };
    }

    const settingsKeys = new Set(Object.keys(settingsShape));
    let settingsImpl: Partial<NewSettingsInternal<TSettings>> = {};
    for (const [key, initializer] of Object.entries(settingsShape as TSettings)) {
        const setting = settingFromInitializer(initializer, []);
        settingsImpl = {
            ...settingsImpl,
            [key]: setting,
        };
    }

    storageLayer
        .then(async (db) => {
            const tx = db.transaction('settings', 'readwrite');
            const store = tx.objectStore('settings');

            const allStoredSettings = new Set(await store.getAllKeys());

            const extraKeys = allStoredSettings.difference(settingsKeys);
            const missingKeys = settingsKeys.difference(allStoredSettings);
            const existingKeys = settingsKeys.intersection(allStoredSettings);

            debugDetailed(`Deleting extra keys from settings storage "${name}":`, extraKeys);
            for (const extraKey of extraKeys) {
                await store.delete(extraKey);
            }

            debugDetailed(`Adding missing keys to settings storage "${name}":`, missingKeys);
            for (const missingKey of missingKeys) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- we know it's there, we literally just mapped the keys from the settings shape
                const setting = settingsImpl[missingKey as keyof TSettings]!;
                await store.put({ key: missingKey, value: setting.value });
            }

            debugDetailed(`Loading existing keys from settings storage "${name}":`, existingKeys);
            for (const existingKey of existingKeys) {
                const savedSetting = await store.get(existingKey);
                settingsImpl[existingKey as keyof TSettings]?.setWithoutInternalCallbacks(savedSetting?.value);
            }
        })
        .catch((e: unknown) => {
            rejectInit(e);
        });

    initPromise.then(() => {
        ChangesBroadcaster.addEventListener('message', (event: MessageEvent<SettingsEventData>) => {
            switch (event.data.type) {
                case 'settingChange':
                // todo
                case 'reset':
                // todo
            }
        });
    });

    // todo

    return {
        ...settingsShape,
        initialized: initPromise,
        reset: (): void => {},
    };
}
