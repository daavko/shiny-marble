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
import type { TileId } from './common';
import { type OptimizedTemplateData, optimizeTemplate } from './optimizer';
import { type StoredTemplate, TemplateStorage } from './storage';

export interface LiveTemplate {
    id: string;
    name: string;
    coordinates: PixelCoordinates;
    dimensions: PixelDimensions;
    hash: string;
    thumbnail: Blob;
    thumbnailUrl: string;

    /**
     * Map of tile IDs to maps of pixel colors to the number of pixels of that color in that tile.
     *
     * Tile IDs are a set of `${x}_${y}` strings representing tiles where this template has at least one visible pixel.
     * Must be properly world-wrapped.
     *
     * Only present for optimized templates, since this is only used for templates that can be visible on the canvas
     * and only optimized templates can ever be shown (since that's how the renderer works)
     */
    filledColorStats?: Map<TileId, Map<PixelColor, number>>;
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

export class TemplateOptimizedEvent extends Event {
    constructor(readonly template: LiveTemplate) {
        super('templateoptimized');
    }
}

export class TemplateDeoptimizedEvent extends Event {
    constructor(readonly template: LiveTemplate) {
        super('templatedeoptimized');
    }
}

interface TemplateRegistryEventMap {
    templateadded: TemplateAddedEvent;
    templatechanged: TemplateChangedEvent;
    templatedeleted: TemplateDeletedEvent;
    templateoptimized: TemplateOptimizedEvent;
    templatedeoptimized: TemplateDeoptimizedEvent;
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
const tileIdTemplateMap = new Map<TileId, Set<string>>();

interface TemplateInit {
    name: string;
    image: ImageData;
}

function tileId(tilePosition: TileCoordinates): TileId {
    return `${tilePosition.x}_${tilePosition.y}`;
}

function optimizedTemplateDataToFilledColorStats(
    optimizedData: OptimizedTemplateData,
): Map<TileId, Map<PixelColor, number>> {
    return new Map(optimizedData.tiles.map((tile) => [tileId(tile.tilePosition), new Map<PixelColor, number>()]));
}

function storedTemplateToLiveTemplate(
    template: StoredTemplate,
    optimizedTemplateData?: OptimizedTemplateData,
): LiveTemplate {
    return {
        id: template.id,
        name: template.name,
        coordinates: template.coordinates,
        dimensions: template.dimensions,
        hash: template.hash,
        thumbnail: template.thumbnail,
        thumbnailUrl: URL.createObjectURL(template.thumbnail),
        filledColorStats: optimizedTemplateData
            ? optimizedTemplateDataToFilledColorStats(optimizedTemplateData)
            : undefined,
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
    if (template.filledColorStats) {
        addTemplateTilesToMap(template.id, template.filledColorStats);
    }
}

function deleteTemplateInternal(templateId: string): void {
    const template = availableTemplates.get(templateId);
    if (template) {
        availableTemplates.delete(templateId);
        knownTemplateHashes.delete(template.hash);
        if (template.filledColorStats) {
            removeTemplateTilesFromMap(template.id, template.filledColorStats);
        }
        URL.revokeObjectURL(template.thumbnailUrl);
    }
}

function addTemplateTilesToMap(templateId: string, filledColorStats: Map<TileId, Map<PixelColor, number>>): void {
    for (const tile of filledColorStats.keys()) {
        tileIdTemplateMap.getOrInsertComputed(tile, () => new Set<string>()).add(templateId);
    }
}

function removeTemplateTilesFromMap(templateId: string, filledColorStats: Map<TileId, Map<PixelColor, number>>): void {
    for (const tile of filledColorStats.keys()) {
        const templatesForTile = tileIdTemplateMap.get(tile);
        if (templatesForTile) {
            templatesForTile.delete(templateId);
            if (templatesForTile.size === 0) {
                tileIdTemplateMap.delete(tile);
            }
        }
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
            let optimizedTemplateData = await TemplateStorage.getOptimizedTemplateData(template.id);
            if (optimizedTemplateData && optimizedTemplateData.paletteVersion !== Platform.colorsVersion) {
                debug(
                    `Template ${template.id} was optimized with palette v${optimizedTemplateData.paletteVersion}, current is v${Platform.colorsVersion}, deoptimizing...`,
                );
                await TemplateStorage.deleteOptimizedTemplateData(template.id);
                optimizedTemplateData = undefined;
            }
            addTemplateInternal(storedTemplateToLiveTemplate(template, optimizedTemplateData));
        }

        await TemplateStorage.cleanupUnusedTemplateImages(knownTemplateHashes);
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

        const coordinates = pixelCoordinates({
            x: viewportCenter.x - template.image.width / 2,
            y: viewportCenter.y - template.image.height / 2,
        });
        const dimensions = pixelDimensions({ width, height });
        const newTemplate: LiveTemplate = {
            id,
            name: template.name,
            coordinates,
            dimensions,
            hash,
            thumbnail,
            thumbnailUrl: URL.createObjectURL(thumbnail),
            filledColorStats: undefined,
        };
        await TemplateStorage.saveTemplate(liveTemplateToStoredTemplate(newTemplate));
        await TemplateStorage.saveTemplateImage({ hash, image: imageBlob });
        addTemplateInternal(newTemplate);
        TemplateRegistryEvents.dispatchEvent(new TemplateAddedEvent(newTemplate));
        debugDetailed('Added new template', newTemplate);
    },

    async optimizeTemplate(id: string): Promise<void> {
        const template = availableTemplates.get(id);
        if (!template) {
            debug(`Cannot optimize template with id ${id} - template not found`);
            return;
        }

        const storedTemplateImage = await TemplateStorage.getTemplateImage(template.hash);
        if (!storedTemplateImage) {
            debug(`Cannot optimize template with id ${id} - template image not found in storage`);
            return;
        }

        const imageBitmap = await createImageBitmap(storedTemplateImage.image);
        const imageData = ImageTools.imageBitmapToImageData(imageBitmap);
        const optimizedData = await optimizeTemplate(id, imageData, template.coordinates);
        await TemplateStorage.saveOptimizedTemplateData(optimizedData);
        template.filledColorStats = optimizedTemplateDataToFilledColorStats(optimizedData);
        addTemplateTilesToMap(template.id, template.filledColorStats);
        TemplateRegistryEvents.dispatchEvent(new TemplateOptimizedEvent(template));
        debug(`Optimized template with id ${id}`);
    },

    async deoptimizeTemplate(id: string): Promise<void> {
        const template = availableTemplates.get(id);
        if (!template) {
            debug(`Cannot deoptimize template with id ${id} - template not found`);
            return;
        }

        if (template.filledColorStats) {
            removeTemplateTilesFromMap(template.id, template.filledColorStats);
        }
        template.filledColorStats = undefined;
        await TemplateStorage.deleteOptimizedTemplateData(template.hash);
        TemplateRegistryEvents.dispatchEvent(new TemplateDeoptimizedEvent(template));
        debug(`Deoptimized template with id ${id}`);
    },

    async moveTemplate(id: string, amount: PixelVector): Promise<void> {
        const template = availableTemplates.get(id);
        if (!template) {
            debug(`Cannot move template with id ${id} - template not found`);
            return;
        }

        template.coordinates = pixelCoordinates({
            x: template.coordinates.x + amount.x,
            y: template.coordinates.y + amount.y,
        });
        await TemplateStorage.saveTemplate(liveTemplateToStoredTemplate(template));
        TemplateRegistryEvents.dispatchEvent(new TemplateChangedEvent(template));
        debug(`Moved template with id ${id} by (${amount.x}, ${amount.y})`);
        await TemplateRegistry.deoptimizeTemplate(id);
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
        await TemplateRegistry.deoptimizeTemplate(id);
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
