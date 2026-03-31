import { type DBSchema, openDB } from 'idb';
import { showErrorAlert } from '../ui/alerts-container';
import type { SettingUpdateCallback } from './settings';
import { debug, debugDetailed } from '../core/debug';

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

export interface NewSetting<TValue> {
    readonly defaultValue: TValue;

    get(): TValue;
    set(value: TValue): void;
    reset(): void;
    addCallback(callback: SettingUpdateCallback<TValue>): void;
    removeCallback(callback: SettingUpdateCallback<TValue>): void;
}

export abstract class NewSettingBase<TValue> implements NewSetting<TValue> {
    protected readonly valueUpdateCallbacks: Set<SettingUpdateCallback<TValue>>;

    protected currentValue: TValue;

    protected constructor(
        readonly defaultValue: TValue,
        valueUpdateCallbacks?: SettingUpdateCallback<TValue>[],
    ) {
        this.currentValue = defaultValue;
        this.valueUpdateCallbacks = new Set(valueUpdateCallbacks);
    }

    addCallback(callback: SettingUpdateCallback<TValue>): void {
        this.valueUpdateCallbacks.add(callback);
    }

    removeCallback(callback: SettingUpdateCallback<TValue>): void {
        this.valueUpdateCallbacks.delete(callback);
    }

    get(): TValue {
        return this.currentValue;
    }

    set(value: TValue): void {
        const oldValue = this.currentValue;
        if (this.valuesEqual(oldValue, value)) {
            return;
        }
        this.currentValue = value;
        this.notifyCallbacks(oldValue, value);
    }

    reset(): void {
        this.set(this.defaultValue);
    }

    protected notifyCallbacks(oldValue: TValue, newValue: TValue): void {
        for (const callback of this.valueUpdateCallbacks) {
            callback(oldValue, newValue);
        }
    }

    protected valuesEqual(value1: TValue, value2: TValue): boolean {
        return value1 === value2;
    }
}

export class NewBooleanSetting extends NewSettingBase<boolean> {
    constructor(defaultValue: boolean, valueUpdateCallbacks?: SettingUpdateCallback<boolean>[]) {
        super(defaultValue, valueUpdateCallbacks);
    }
}

export class NewNumberSetting extends NewSettingBase<number> {
    constructor(defaultValue: number, valueUpdateCallbacks?: SettingUpdateCallback<number>[]) {
        super(defaultValue, valueUpdateCallbacks);
    }
}

export class NewStringSetting extends NewSettingBase<string> {
    constructor(defaultValue: string, valueUpdateCallbacks?: SettingUpdateCallback<string>[]) {
        super(defaultValue, valueUpdateCallbacks);
    }
}

type NewSettings<TSettings extends Record<string, NewSetting<unknown>>> = {
    [K in keyof TSettings]: TSettings[K];
} & NewSettingsImpl;

interface NewSettingsImpl {
    initialized: Promise<void>;
    reset(): void;
}

type NewSettingsWithoutImplProperties<TSettings extends Record<string, NewSetting<unknown>>> = {
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

export function createSettings<TSettings extends Record<string, NewSetting<unknown>>>(
    name: string,
    versionNumber: number,
    settingsShape: Readonly<TSettings> & NewSettingsWithoutImplProperties<TSettings>,
): NewSettings<TSettings> {
    const storageLayer = openDB<NewSettingsDBSchema>(`sm-settings-${name}`, versionNumber, {
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
                `Storage error: Settings storage "${name} was unexpectedly closed. Please reload the page. If the problem persists, please report it."`,
                undefined,
                30000,
            );
        },
    });

    const { promise: initPromise, resolve: resolveInit, reject: rejectInit } = Promise.withResolvers<void>();

    storageLayer
        .then(async (db) => {
            const tx = db.transaction('settings', 'readwrite');
            const store = tx.objectStore('settings');

            const allStoredSettings = new Set(await store.getAllKeys());
            const settingsKeys = new Set(Object.keys(settingsShape));
            const settingsMap = new Map(Object.entries(settingsShape as TSettings));

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
                const setting = settingsMap.get(missingKey)!;
                await store.put({ key: missingKey, value: setting.get() });
            }

            debugDetailed(`Loading existing keys from settings storage "${name}":`, existingKeys);
            for (const existingKey of existingKeys) {
                const savedSetting = await store.get(existingKey);
                const setting = settingsMap.get(existingKey);
                setting?.set(savedSetting?.value);
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
