import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import { showErrorAlert } from '../../ui/components/alerts-container';
import type {
    MapTileCoordinates,
    PixelCoordinates,
    PixelDimensions,
    PixelRect,
    RenderTileCoordinates,
} from '../../util/geometry';
import { waitForDataAndTransaction } from '../../util/idb';
import { debug } from '../debug';

export interface StoredTemplate {
    id: string;
    name: string;
    coordinates: PixelCoordinates;
    dimensions: PixelDimensions;

    /**
     * hash of the ImageData of the template image
     */
    hash: string;

    /**
     * version of the palette this was optimized with, used to determine whether the template needs to be re-optimized
     * and re-saved
     */
    paletteVersion: number;

    /**
     * tile size this was stored with, in case the canvas changes tile sizes for some reason...
     *
     * bplace has done this once already so it's better to be safe here, worst case this just causes the template to be
     * re-optimized and re-saved with new tile size
     */
    tileSize: PixelDimensions;

    /**
     * image/png Blob
     */
    thumbnail: Blob;
}

export interface StoredTemplateImage {
    /**
     * hash of the ImageData of the template image, used as a key
     */
    hash: string;

    /**
     * image/png Blob
     */
    image: Blob;
}

export interface StoredOptimizedTemplateTile {
    templateId: string;
    tilePosition: RenderTileCoordinates;

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

interface TemplateStorageDBSchema extends DBSchema {
    templates: {
        key: string;
        value: StoredTemplate;
    };
    templateImages: {
        key: string;
        value: StoredTemplateImage;
    };
    optimizedTemplateTiles: {
        key: [string, number, number]; // [templateId, tilePosition.x, tilePosition.y]
        value: StoredOptimizedTemplateTile;
        indexes: {
            templateId: string;
            tilePosition: [number, number]; // [tilePosition.x, tilePosition.y]
        };
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
                const tilesObjectStore = db.createObjectStore('optimizedTemplateTiles', {
                    keyPath: ['templateId', 'tilePosition.x', 'tilePosition.y'],
                });
                tilesObjectStore.createIndex('templateId', 'templateId');
                tilesObjectStore.createIndex('tilePosition', ['tilePosition.x', 'tilePosition.y']);
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
    async addTemplate(template: StoredTemplate, image: StoredTemplateImage): Promise<void> {
        const db = await getStorage();
        const tx = db.transaction(['templates', 'templateImages'], 'readwrite');
        const templatesStore = tx.objectStore('templates');
        const imagesStore = tx.objectStore('templateImages');
        await Promise.all([templatesStore.put(template), imagesStore.put(image), tx.done]);
    },
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
    async replaceTemplateImage(
        template: StoredTemplate,
        oldImageHash: string,
        newImage: StoredTemplateImage,
    ): Promise<void> {
        const db = await getStorage();
        const tx = db.transaction(['templates', 'templateImages'], 'readwrite');
        const templatesStore = tx.objectStore('templates');
        const imagesStore = tx.objectStore('templateImages');

        await Promise.all([
            templatesStore.put(template),
            imagesStore.put(newImage),
            imagesStore.delete(oldImageHash),
            tx.done,
        ]);
    },
    async deleteTemplate(id: string): Promise<void> {
        const db = await getStorage();
        const tx = db.transaction(['templates', 'optimizedTemplateTiles'], 'readwrite');
        const store = tx.objectStore('templates');
        const tilesStore = tx.objectStore('optimizedTemplateTiles');
        const index = tilesStore.index('templateId');

        const tileKeys = await index.getAllKeys(id);

        await Promise.all([store.delete(id), ...tileKeys.map((key) => tilesStore.delete(key)), tx.done]);
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
    async cleanupUnusedTemplateImages(): Promise<void> {
        const db = await getStorage();
        const tx = db.transaction(['templates', 'templateImages'], 'readwrite');
        const templatesStore = tx.objectStore('templates');
        const templates = await templatesStore.getAll();
        const usedHashes = new Set(templates.map((t) => t.hash));
        const imagesStore = tx.objectStore('templateImages');
        const allImageHashes = new Set(await imagesStore.getAllKeys());
        const hashesToDelete = Array.from(allImageHashes.difference(usedHashes));
        if (hashesToDelete.length > 0) {
            await Promise.all([...hashesToDelete.map((hash) => imagesStore.delete(hash)), tx.done]);
        }
    },
    async saveOptimizedTemplateTiles(tiles: StoredOptimizedTemplateTile[]): Promise<void> {
        const db = await getStorage();
        const tx = db.transaction('optimizedTemplateTiles', 'readwrite');
        const store = tx.objectStore('optimizedTemplateTiles');
        const putPromises = tiles.map((tile) => store.put(tile));
        await Promise.all([...putPromises, tx.done]);
    },
    async getOptimizedTemplateTiles(templateId: string): Promise<StoredOptimizedTemplateTile[]> {
        const db = await getStorage();
        return await db.getAllFromIndex('optimizedTemplateTiles', 'templateId', templateId);
    },
    async getTemplatesCoveringTile(tilePosition: MapTileCoordinates): Promise<string[]> {
        const db = await getStorage();
        const tiles = await db.getAllKeysFromIndex('optimizedTemplateTiles', 'tilePosition', [
            tilePosition.x,
            tilePosition.y,
        ]);
        const templateIds = tiles.map((key) => key[0]);
        return Array.from(new Set(templateIds));
    },
    async deleteOptimizedTemplateTiles(templateId: string): Promise<void> {
        const db = await getStorage();
        const tx = db.transaction('optimizedTemplateTiles', 'readwrite');
        const store = tx.objectStore('optimizedTemplateTiles');
        const index = store.index('templateId');
        const tileKeys = await index.getAllKeys(templateId);
        await Promise.all([...tileKeys.map((key) => store.delete(key)), tx.done]);
    },
};
