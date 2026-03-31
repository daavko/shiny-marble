import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import { showErrorAlert } from '../../ui/alerts-container';
import type { Point } from '../../util/geometry';

interface StoredTemplate {
    id: string;
    name: string;
    position: Point;
    hash: string;
    thumbnail: ImageData;
}

interface StoredTemplateImage {
    hash: string;
    image: ImageData;
}

interface TemplateStorageDBSchema extends DBSchema {
    templates: {
        key: string;
        value: StoredTemplate;
    };
    templateImages: {
        key: string;
        value: StoredTemplateImage;
    };
}

type TemplateStorageDB = IDBPDatabase<TemplateStorageDBSchema>;

let indexedDbInstance: TemplateStorageDB | null = null;

const CURRENT_DB_VERSION = 1;

interface TemplateStorageEventMap {
    storageterminated: Event;
}

interface TemplateStorageEventTarget extends EventTarget {
    addEventListener<K extends keyof TemplateStorageEventMap>(
        type: K,
        listener: (this: TemplateStorageEventTarget, ev: TemplateStorageEventMap[K]) => void,
        options?: boolean | AddEventListenerOptions,
    ): void;
    removeEventListener<K extends keyof TemplateStorageEventMap>(
        type: K,
        listener: (this: TemplateStorageEventTarget, ev: TemplateStorageEventMap[K]) => void,
        options?: boolean | EventListenerOptions,
    ): void;
    dispatchEvent(event: Event): boolean;
}

export const TemplateStorageEvents: TemplateStorageEventTarget = new EventTarget();

async function getStorage(): Promise<TemplateStorageDB> {
    indexedDbInstance ??= await openDB<TemplateStorageDBSchema>('shinymarble', CURRENT_DB_VERSION, {
        upgrade: (db, oldVersion) => {
            if (oldVersion < 1) {
                // never opened before, create object store
                db.createObjectStore('templates', { keyPath: 'id' });
                db.createObjectStore('templateImages', { keyPath: 'hash' });
            }
        },
        blocked: (currentVersion, blockedVersion, event) => {
            showErrorAlert(
                'Storage error: An older version of Shiny Marble is open in another tab, preventing access to template storage. Please close other tabs running Shiny Marble and reload this page.',
                { event, currentVersion, blockedVersion },
                30000,
            );
        },
        blocking: (currentVersion, blockedVersion, event) => {
            showErrorAlert(
                'Storage warning: A newer version of Shiny Marble is open in another tab, and this tab is preventing it from accessing template storage. Please close this tab.',
                { event, currentVersion, blockedVersion },
                30000,
            );
        },
        terminated: () => {
            showErrorAlert(
                'Storage error: Template storage was unexpectedly closed. Please reload the page. If the problem persists, please report it.',
                undefined,
                30000,
            );
            TemplateStorageEvents.dispatchEvent(new Event('storageterminated'));
        },
    });
    return indexedDbInstance;
}

export const TemplateStorage = {
    async saveTemplate(template: StoredTemplate): Promise<void> {
        const db = await getStorage();
        await db.put('templates', template);
    },
    async getTemplate(id: string): Promise<StoredTemplate | undefined> {
        const db = await getStorage();
        return await db.get('templates', id);
    },
    async getTemplates(ids: string[]): Promise<Map<string, StoredTemplate>> {
        const db = await getStorage();
        const tx = db.transaction('templates', 'readonly');
        const store = tx.objectStore('templates');
        const results = await Promise.all(ids.map((id) => store.get(id)));
        await tx.done;
        return new Map<string, StoredTemplate>(results.filter((t) => t != null).map((t) => [t.id, t]));
    },
    async getAllTemplates(): Promise<StoredTemplate[]> {
        const db = await getStorage();
        return await db.getAll('templates');
    },
    async deleteTemplate(id: string): Promise<void> {
        const db = await getStorage();
        await db.delete('templates', id);
    },
    async saveTemplateImage(image: StoredTemplateImage): Promise<void> {
        const db = await getStorage();
        await db.put('templateImages', image);
    },
    async getTemplateImage(hash: string): Promise<StoredTemplateImage | undefined> {
        const db = await getStorage();
        return await db.get('templateImages', hash);
    },
    async getTemplateImages(hashes: string[]): Promise<Map<string, StoredTemplateImage>> {
        const db = await getStorage();
        const tx = db.transaction('templateImages', 'readonly');
        const store = tx.objectStore('templateImages');
        const results = await Promise.all(hashes.map((hash) => store.get(hash)));
        await tx.done;
        return new Map<string, StoredTemplateImage>(results.filter((t) => t != null).map((t) => [t.hash, t]));
    },
    async deleteTemplateImage(hash: string): Promise<void> {
        const db = await getStorage();
        await db.delete('templateImages', hash);
    },
};
