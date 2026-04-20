import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import { showErrorAlert } from '../../ui/components/alerts-container';
import type { PixelCoordinates, PixelDimensions, PixelRect, TileCoordinates } from '../../util/geometry';
import { waitForDataAndTransaction } from '../../util/idb';
import { debug } from '../debug';
import type { TileId } from './common';
import type { OptimizedTemplateData } from './optimizer';

export interface StoredTemplate {
    id: string;
    name: string;
    coordinates: PixelCoordinates;
    dimensions: PixelDimensions;
    hash: string;
    /**
     * image/png Blob
     */
    thumbnail: Blob;
}

export interface StoredTemplateImage {
    hash: string;
    /**
     * image/png Blob
     */
    image: Blob;
}

export interface StoredOptimizedTemplateTile {
    /**
     * id of the template
     */
    templateId: string;

    /**
     * tile position
     */
    tilePosition: TileCoordinates;

    /**
     * position and dimensions within the tile
     */
    imageRect: PixelRect;

    /**
     * compressed binary data containing color indexes
     *
     * uses gzip compression
     */
    compressedData: ArrayBuffer;
}

export interface StoredOptimizedTemplateMetadata {
    /**
     * id of the template, used as a key
     */
    id: string;

    /**
     * version of the palette this was optimized with, used to determine whether the template needs to be re-optimized
     * and re-saved
     */
    paletteVersion: number;

    /**
     * position of the original template image, if the template moves then this can be used to determine whether it
     * needs to be re-optimized and re-saved
     */
    position: PixelCoordinates;

    /**
     * tile size this was stored with, in case the canvas changes tile sizes for some reason...
     *
     * bplace has done this once already so it's better to be safe here, worst case this just causes the template to be
     * re-optimized and re-saved with new tile size
     */
    tileSize: PixelDimensions;

    /**
     * list of tiles this template occupies, used for fast lookup
     */
    tiles: TileId[];
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
    optimizedTemplateMetadata: {
        key: string;
        value: StoredOptimizedTemplateMetadata;
    };
    optimizedTemplateTiles: {
        key: [string, string, string]; // [templateId, tilePosition.x, tilePosition.y]
        value: StoredOptimizedTemplateTile;
    };
}

type TemplateStorageDB = IDBPDatabase<TemplateStorageDBSchema>;

let indexedDbInstance: TemplateStorageDB | null = null;

const CURRENT_DB_VERSION = 2;

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
        upgrade: (db, oldVersion, newVersion) => {
            debug(`Upgrading template storage from version ${oldVersion} to ${newVersion}`);
            if (oldVersion < 1) {
                // never opened before, create object store
                db.createObjectStore('templates', { keyPath: 'id' });
                db.createObjectStore('templateImages', { keyPath: 'hash' });
            }
            if (oldVersion < 2) {
                // v2 adds optimized template images store
                db.createObjectStore('optimizedTemplateMetadata', { keyPath: 'id' });
                db.createObjectStore('optimizedTemplateTiles', {
                    keyPath: ['templateId', 'tilePosition.x', 'tilePosition.y'],
                });
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
        const results = await waitForDataAndTransaction(
            ids.map((id) => store.get(id)),
            tx,
        );
        return new Map<string, StoredTemplate>(results.filter((t) => t != null).map((t) => [t.id, t]));
    },
    async getAllTemplates(): Promise<StoredTemplate[]> {
        const db = await getStorage();
        return await db.getAll('templates');
    },
    async deleteTemplate(id: string): Promise<void> {
        const db = await getStorage();
        await db.delete('templates', id);
        await TemplateStorage.deleteOptimizedTemplateData(id);
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
        const results = await waitForDataAndTransaction(
            hashes.map((hash) => store.get(hash)),
            tx,
        );
        return new Map<string, StoredTemplateImage>(results.filter((t) => t != null).map((t) => [t.hash, t]));
    },
    async deleteTemplateImage(hash: string): Promise<void> {
        const db = await getStorage();
        await db.delete('templateImages', hash);
    },
    async cleanupUnusedTemplateImages(usedHashes: Set<string>): Promise<void> {
        const db = await getStorage();
        const tx = db.transaction('templateImages', 'readwrite');
        const store = tx.objectStore('templateImages');
        const allImageHashes = new Set(await store.getAllKeys());
        const hashesToDelete = Array.from(allImageHashes.difference(usedHashes));
        if (hashesToDelete.length > 0) {
            await waitForDataAndTransaction(
                hashesToDelete.map((hash) => store.delete(hash)),
                tx,
            );
        }
    },

    async saveOptimizedTemplateData(image: OptimizedTemplateData): Promise<void> {
        const db = await getStorage();
        await db.put('optimizedTemplateData', image);
    },
    async getOptimizedTemplateData(id: string): Promise<OptimizedTemplateData | undefined> {
        const db = await getStorage();
        return await db.get('optimizedTemplateData', id);
    },
    async deleteOptimizedTemplateData(id: string): Promise<void> {
        const db = await getStorage();
        await db.delete('optimizedTemplateData', id);
    },
};
