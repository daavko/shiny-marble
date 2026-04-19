import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import { debug, debugDetailed } from '../core/debug';
import { type Signal, SignalImpl, type Subscriber } from '../core/signals';
import { showErrorAlert } from '../ui/components/alerts-container';
import { sameValueZero } from '../util/misc';

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

interface SettingInitializer<TValue> {
    readonly defaultValue: TValue;
    readonly valueUpdateCallbacks: Subscriber<TValue>[];
    readonly equalityFunction: SettingEqualityFunction<TValue>;
}

interface SettingInitializerLike {
    readonly defaultValue: unknown;
    readonly valueUpdateCallbacks: readonly Subscriber<never>[];
    readonly equalityFunction: SettingEqualityFunction<never>;
}

type SettingValue<TInitializer> = TInitializer extends SettingInitializer<infer TValue> ? TValue : never;

export interface Setting<TValue> extends Signal<TValue> {
    reset(): void;
}

interface SettingInternal<TValue> extends Setting<TValue> {
    disableInternalCallbacks(): void;
    enableInternalCallbacks(): void;
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
    valueUpdateCallbacks: NoInfer<Subscriber<TValue>>[] = [],
    equalityFunction: NoInfer<SettingEqualityFunction<TValue>> = sameValueZero,
): SettingInitializer<TValue> {
    return {
        defaultValue,
        valueUpdateCallbacks,
        equalityFunction: equalityFunction,
    };
}

class SettingSignal<TValue> extends SignalImpl<TValue> implements SettingInternal<TValue> {
    private internalCallbacksEnabled = true;
    private readonly internalCallbacks: Subscriber<TValue>[];
    private readonly defaultValue: TValue;

    constructor(
        defaultValue: TValue,
        equalityFunction: SettingEqualityFunction<TValue>,
        internalCallbacks: Subscriber<TValue>[],
        initialCallbacks: Subscriber<TValue>[],
    ) {
        super(defaultValue, equalityFunction);
        this.defaultValue = defaultValue;
        this.internalCallbacks = internalCallbacks;

        for (const callback of initialCallbacks) {
            this.subscribe(callback);
        }

        this.subscribe(() => {
            if (!this.internalCallbacksEnabled) {
                return;
            }

            for (const callback of this.internalCallbacks) {
                callback(this.value);
            }
        }, 'sync');
    }

    reset(): void {
        this.value = this.defaultValue;
    }

    disableInternalCallbacks(): void {
        this.internalCallbacksEnabled = false;
    }

    enableInternalCallbacks(): void {
        this.internalCallbacksEnabled = true;
    }
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

    const settingsKeys = new Set(Object.keys(settingsShape));
    const settingsImpl: Record<string, SettingInternal<unknown>> = {};
    for (const [key, initializer] of Object.entries(settingsShape as TSettings)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        const { defaultValue, valueUpdateCallbacks, equalityFunction } = initializer as SettingInitializer<unknown>;
        settingsImpl[key] = new SettingSignal(
            defaultValue,
            equalityFunction,
            [
                (newValue): void => {
                    void getStorageLayer().then(async (db) => {
                        await db.put('settings', { key, value: newValue });
                    });
                },
                (newValue): void => {
                    ChangesBroadcaster.postMessage({
                        type: 'settingChange',
                        settings: name,
                        key,
                        newValue,
                    } satisfies SettingChangeEventData);
                },
            ],
            valueUpdateCallbacks,
        );
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
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- safe because we know the key exists
            const savedSetting = (await store.get(existingKey))!;
            const setting = settingsImpl[existingKey];
            setting.disableInternalCallbacks();
            setting.value = savedSetting.value;
            setting.enableInternalCallbacks();
        }

        await tx.done;

        ChangesBroadcaster.addEventListener('message', (event: MessageEvent<SettingsEventData>) => {
            switch (event.data.type) {
                case 'settingChange':
                    if (event.data.settings === name) {
                        debugDetailed('Received settings change event', event.data);
                        const setting = settingsImpl[event.data.key];
                        setting.disableInternalCallbacks();
                        setting.value = event.data.newValue;
                        setting.enableInternalCallbacks();
                    }
                    break;
                case 'reset':
                    if (event.data.settings === name) {
                        debugDetailed('Received settings reset event', event.data);
                        for (const setting of Object.values(settingsImpl)) {
                            setting.disableInternalCallbacks();
                            setting.reset();
                            setting.enableInternalCallbacks();
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
