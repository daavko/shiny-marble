import { Platform } from '../../platform/platform';
import type { PixelColor } from '../../platform/types';
import {
    pixelCoordinates,
    type PixelCoordinates,
    pixelDimensions,
    type PixelDimensions,
    type PixelVector,
    type TileCoordinates,
} from '../../util/geometry';
import { ImageTools } from '../../workers/image-tools-dispatcher';
import { debug, debugDetailed, debugTime } from '../debug';
import { encodeIndexedPngBlob } from '../png/indexed-png-writer';
import { type StoredTemplate, TemplateStorage } from './storage';

export type TileId = `${number}_${number}`;

export interface LiveTemplate {
    id: string;
    name: string;
    coordinates: PixelCoordinates;
    dimensions: PixelDimensions;
    hash: string;
    thumbnail: Blob;
    thumbnailUrl: string;

    /**
     * Set of `${x}_${y}` strings representing tiles where this template has at least one visible pixel.
     */
    occupiedTileIds: Set<TileId>;

    /**
     * Map of tile IDs to maps of pixel colors to the number of pixels of that color in that tile.
     */
    filledColorStats: Map<TileId, Map<PixelColor, number>>;
}

export class TemplateAddedEvent extends Event {
    constructor(readonly template: LiveTemplate) {
        super('templateadded');
    }
}

export class TemplateChangedEvent extends Event {
    constructor(readonly template: LiveTemplate) {
        super('templatechanged');
    }
}

export class TemplateDeletedEvent extends Event {
    constructor(readonly templateId: string) {
        super('templatedeleted');
    }
}

interface TemplateRegistryEventMap {
    templateadded: TemplateAddedEvent;
    templatechanged: TemplateChangedEvent;
    templatedeleted: TemplateDeletedEvent;
}

interface TemplateRegistryEventTarget extends EventTarget {
    addEventListener<K extends keyof TemplateRegistryEventMap>(
        type: K,
        listener: (this: TemplateRegistryEventTarget, ev: TemplateRegistryEventMap[K]) => void,
        options?: boolean | AddEventListenerOptions,
    ): void;
    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
    ): void;
    removeEventListener<K extends keyof TemplateRegistryEventMap>(
        type: K,
        listener: (this: TemplateRegistryEventTarget, ev: TemplateRegistryEventMap[K]) => void,
        options?: boolean | EventListenerOptions,
    ): void;
    removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions,
    ): void;
    dispatchEvent(event: Event): boolean;
}

export const TemplateRegistryEvents: TemplateRegistryEventTarget = new EventTarget();

const availableTemplates = new Map<string, LiveTemplate>();
const knownTemplateHashes = new Set<string>();

interface TemplateInit {
    name: string;
    image: ImageData;
}

function storedTemplateToLiveTemplate(template: StoredTemplate): LiveTemplate {
    return {
        id: template.id,
        name: template.name,
        coordinates: template.coordinates,
        dimensions: template.dimensions,
        hash: template.hash,
        thumbnail: template.thumbnail,
        thumbnailUrl: URL.createObjectURL(template.thumbnail),
        occupiedTileIds: new Set(),
        filledColorStats: new Map(),
    };
}

function liveTemplateToStoredTemplate(template: LiveTemplate): StoredTemplate {
    return {
        id: template.id,
        name: template.name,
        coordinates: template.coordinates,
        dimensions: template.dimensions,
        hash: template.hash,
        thumbnail: template.thumbnail,
    };
}

function addTemplateInternal(template: LiveTemplate): void {
    availableTemplates.set(template.id, template);
    knownTemplateHashes.add(template.hash);
}

function deleteTemplateInternal(templateId: string): void {
    const template = availableTemplates.get(templateId);
    if (template) {
        availableTemplates.delete(templateId);
        knownTemplateHashes.delete(template.hash);
        URL.revokeObjectURL(template.thumbnailUrl);
    }
}

export const TemplateRegistry = {
    get availableTemplates(): readonly LiveTemplate[] {
        return Array.from(availableTemplates.values());
    },

    async initialize(): Promise<void> {
        const templates = await TemplateStorage.getAllTemplates();
        debugDetailed('Initializing template registry with templates', templates);
        for (const template of templates) {
            addTemplateInternal(storedTemplateToLiveTemplate(template));
        }

        await TemplateStorage.cleanupUnusedTemplateImages(knownTemplateHashes);
    },

    async hasTemplate(template: ImageData): Promise<boolean> {
        const hash = await ImageTools.computeImageHash(template);
        return knownTemplateHashes.has(hash);
    },

    async addTemplate(template: TemplateInit): Promise<void> {
        const id = crypto.randomUUID();
        const thumbnail = await ImageTools.createThumbnail(template.image, 100, 100);
        const hash = await ImageTools.computeImageHash(template.image);
        const viewportCenter = Platform.getViewportCenterPixel();
        const { width, height } = template.image;
        const pngEncodeDebugTimer = debugTime(`Encoding template image to indexed PNG`);
        const imageBlob = await encodeIndexedPngBlob(template.image, Platform.colors);
        pngEncodeDebugTimer?.stop();

        const newTemplate: LiveTemplate = {
            id,
            name: template.name,
            coordinates: pixelCoordinates({
                x: viewportCenter.x - template.image.width / 2,
                y: viewportCenter.y - template.image.height / 2,
            }),
            dimensions: pixelDimensions({ width, height }),
            hash,
            thumbnail,
            thumbnailUrl: URL.createObjectURL(thumbnail),
            occupiedTileIds: new Set(),
            filledColorStats: new Map(),
        };
        await TemplateStorage.saveTemplate(liveTemplateToStoredTemplate(newTemplate));
        await TemplateStorage.saveTemplateImage({ hash, image: imageBlob });
        addTemplateInternal(newTemplate);
        TemplateRegistryEvents.dispatchEvent(new TemplateAddedEvent(newTemplate));
        debugDetailed('Added new template', newTemplate);
        // todo: compute occupied tiles
        // todo: compute filled color stats
    },

    async moveTemplate(id: string, amount: PixelVector): Promise<void> {
        // todo
    },

    async renameTemplate(id: string, newName: string): Promise<void> {
        const template = availableTemplates.get(id);
        if (!template) {
            debug(`Cannot rename template with id ${id} - template not found`);
            return;
        }

        const oldName = template.name;
        template.name = newName;
        await TemplateStorage.saveTemplate(liveTemplateToStoredTemplate(template));
        TemplateRegistryEvents.dispatchEvent(new TemplateChangedEvent(template));
        debug(`Renamed template with id ${id} from "${oldName}" to "${newName}"`);
    },

    async replaceTemplateImage(id: string, newImage: ImageData): Promise<boolean> {
        const template = availableTemplates.get(id);
        if (!template) {
            debug(`Cannot replace image of template with id ${id} - template not found`);
            return false;
        }

        const newHash = await ImageTools.computeImageHash(newImage);
        if (newHash === template.hash) {
            debug(`New image for template with id ${id} has the same hash as the old image, skipping replacement`);
            return false;
        }

        const newThumbnail = await ImageTools.createThumbnail(newImage, 100, 100);
        const pngEncodeDebugTimer = debugTime(`Encoding new template image to indexed PNG`);
        const newImageBlob = await encodeIndexedPngBlob(newImage, Platform.colors);
        pngEncodeDebugTimer?.stop();

        // Update template with new image info
        knownTemplateHashes.delete(template.hash);
        template.hash = newHash;
        template.dimensions = pixelDimensions({ width: newImage.width, height: newImage.height });
        URL.revokeObjectURL(template.thumbnailUrl);
        template.thumbnail = newThumbnail;
        template.thumbnailUrl = URL.createObjectURL(newThumbnail);
        knownTemplateHashes.add(newHash);

        await TemplateStorage.saveTemplate(liveTemplateToStoredTemplate(template));
        await TemplateStorage.saveTemplateImage({ hash: newHash, image: newImageBlob });
        await TemplateStorage.cleanupUnusedTemplateImages(knownTemplateHashes);
        TemplateRegistryEvents.dispatchEvent(new TemplateChangedEvent(template));
        debug(`Replaced image of template with id ${id}`);
        return true;
    },

    async deleteTemplate(id: string): Promise<void> {
        await TemplateStorage.deleteTemplate(id);
        deleteTemplateInternal(id);
        await TemplateStorage.cleanupUnusedTemplateImages(knownTemplateHashes);
        TemplateRegistryEvents.dispatchEvent(new TemplateDeletedEvent(id));
        debug('Deleted template with id', id);
    },

    async handleTileUpdate(tilePosition: TileCoordinates, tileImage: ImageData): Promise<void> {
        // todo
    },

    async handlePixelsPlaced(/* todo: args */): Promise<void> {
        // todo
    },
};
