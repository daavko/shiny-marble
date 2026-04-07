import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import { debug, debugDetailed } from '../core/debug';
import { showErrorAlert } from '../ui/components/alerts-container';

const ChangesBroadcaster = new BroadcastChannel('sm-settings-changes');

export type SettingUpdateCallback<TValue> = (oldValue: TValue, newValue: TValue) => void;

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

interface SettingInitializer<TValue> {
    readonly defaultValue: TValue;
    readonly valueUpdateCallbacks: SettingUpdateCallback<TValue>[];
    readonly equalityFunction: SettingEqualityFunction<TValue>;
}

interface SettingInitializerLike {
    readonly defaultValue: unknown;
    readonly valueUpdateCallbacks: readonly SettingUpdateCallback<never>[];
    readonly equalityFunction: SettingEqualityFunction<never>;
}

type SettingValue<TInitializer> = TInitializer extends SettingInitializer<infer TValue> ? TValue : never;

export interface Setting<TValue> {
    get value(): TValue;
    set value(value: TValue);
    reset(): void;
    addCallback(callback: SettingUpdateCallback<TValue>): void;
    removeCallback(callback: SettingUpdateCallback<TValue>): void;
}

interface SettingInternal<TValue> extends Setting<TValue> {
    setWithoutInternalCallbacks(value: TValue): void;
    resetWithoutInternalCallbacks(): void;
}

type SettingsProps<TSettings extends Record<string, SettingInitializerLike>> = {
    [K in keyof TSettings]: Setting<SettingValue<TSettings[K]>>;
};

export interface SettingsImpl {
    init(): Promise<void>;
    reset(): void;
}

type Settings<TSettings extends Record<string, SettingInitializerLike>> = SettingsProps<TSettings> & SettingsImpl;

type SettingsWithoutImplProperties<TSettings extends Record<string, SettingInitializerLike>> = {
    [K in keyof SettingsImpl &
        keyof TSettings]: `Property name "${K}" is reserved and cannot be used in settings shape.`;
};

interface SavedSetting {
    key: string;
    value: unknown;
}

interface SettingsDBSchema extends DBSchema {
    settings: {
        key: string;
        value: SavedSetting;
        indexes: { key: string };
    };
}

export function createSetting<TValue>(
    defaultValue: TValue,
    valueUpdateCallbacks: NoInfer<SettingUpdateCallback<TValue>>[] = [],
    equalityFunction?: NoInfer<SettingEqualityFunction<TValue>>,
): SettingInitializer<TValue> {
    return {
        defaultValue,
        valueUpdateCallbacks,
        equalityFunction: equalityFunction ?? ((a, b): boolean => a === b),
    };
}

function settingFromInitializer(
    initializer: SettingInitializer<unknown>,
    internalCallbacks: SettingUpdateCallback<unknown>[],
): NoInfer<SettingInternal<unknown>> {
    const { defaultValue, valueUpdateCallbacks: initialCallbacks, equalityFunction } = initializer;

    let value = defaultValue;
    const valueUpdateCallbacks = new Set(initialCallbacks);

    return {
        get value(): unknown {
            return value;
        },
        set value(newValue: unknown) {
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
        addCallback(callback: SettingUpdateCallback<unknown>): void {
            valueUpdateCallbacks.add(callback);
        },
        removeCallback(callback: SettingUpdateCallback<unknown>): void {
            valueUpdateCallbacks.delete(callback);
        },

        setWithoutInternalCallbacks(newValue: unknown): void {
            if (equalityFunction(value, newValue)) {
                return;
            }
            const oldValue = value;
            value = newValue;
            for (const callback of valueUpdateCallbacks) {
                callback(oldValue, newValue);
            }
        },
        resetWithoutInternalCallbacks(): void {
            this.setWithoutInternalCallbacks(defaultValue);
        },
    };
}

async function createSettingsStorage(name: string, versionNumber: number): Promise<IDBPDatabase<SettingsDBSchema>> {
    return openDB<SettingsDBSchema>(`sm-settings-${name}`, versionNumber, {
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

export function createSettings<const TSettings extends Record<string, SettingInitializerLike>>(
    name: string,
    versionNumber: number,
    settingsShape: TSettings & SettingsWithoutImplProperties<TSettings>,
): Settings<TSettings> {
    let storageLayer: IDBPDatabase<SettingsDBSchema> | null = null;
    async function getStorageLayer(): Promise<IDBPDatabase<SettingsDBSchema>> {
        storageLayer ??= await createSettingsStorage(name, versionNumber);
        return storageLayer;
    }

    function createSettingStorageCallback(key: string): SettingUpdateCallback<unknown> {
        return (_oldValue, newValue) => {
            void getStorageLayer().then(async (db) => {
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
    const settingsImpl: Record<string, SettingInternal<unknown>> = {};
    for (const [key, initializer] of Object.entries(settingsShape as TSettings)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        settingsImpl[key] = settingFromInitializer(initializer as SettingInitializer<unknown>, [
            createSettingStorageCallback(key),
            createSettingBroadcastCallback(key),
        ]);
    }

    async function init(): Promise<void> {
        const db = await getStorageLayer();

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
            const setting = settingsImpl[missingKey];
            await store.put({ key: missingKey, value: setting.value });
        }

        debugDetailed(`Loading existing keys from settings storage "${name}":`, existingKeys);
        for (const existingKey of existingKeys) {
            const savedSetting = await store.get(existingKey);
            settingsImpl[existingKey].setWithoutInternalCallbacks(savedSetting?.value);
        }

        await tx.done;

        ChangesBroadcaster.addEventListener('message', (event: MessageEvent<SettingsEventData>) => {
            debugDetailed('Received settings change event', event.data);
            switch (event.data.type) {
                case 'settingChange':
                    if (event.data.settings === name) {
                        settingsImpl[event.data.key].setWithoutInternalCallbacks(event.data.newValue);
                    }
                    break;
                case 'reset':
                    if (event.data.settings === name) {
                        for (const setting of Object.values(settingsImpl)) {
                            setting.resetWithoutInternalCallbacks();
                        }
                    }
            }
        });
    }

    return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe, impossible to type
        ...(settingsImpl as SettingsProps<TSettings>),
        init,
        reset: (): void => {
            for (const setting of Object.values(settingsImpl)) {
                setting.reset();
            }
        },
    };
}
