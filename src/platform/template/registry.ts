import type { PixelColor } from '../../core/types';
import {
    type MapTileCoordinates,
    type PixelCoordinates,
    pixelCoordinates,
    type PixelDimensions,
    pixelDimensions,
    type PixelRect,
    type RenderTileCoordinates,
} from '../../util/geometry';
import { computeImageDataHash, imageBitmapToImageData } from '../../util/image';
import { ImageTools } from '../../workers/image-tools';
import { debug, debugDetailed } from '../debug';
import { getCoveredRenderTiles } from '../geometry';
import { Platform } from '../platform';
import type { TileId } from './common';
import { type OptimizedTemplateTile, optimizeTemplate } from './optimizer';
import { type StoredOptimizedTemplateTile, type StoredTemplate, TemplateStorage } from './storage';

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
const tileIdTemplateMap = new Map<TileId, Set<string>>();

interface TemplateInit {
    name: string;
    image: ImageData;
}

function tileId(tilePosition: RenderTileCoordinates): TileId {
    return `${tilePosition.x}_${tilePosition.y}`;
}

function getCoveringTileIds(templateRect: PixelRect): TileId[] {
    return getCoveredRenderTiles(templateRect).map((tileCoord) => tileId(tileCoord));
}

function getEmptyColorStats(templateRect: PixelRect): Map<TileId, Map<PixelColor, number>> {
    const tileIds = getCoveringTileIds(templateRect);
    return new Map(tileIds.map((id) => [id, new Map<PixelColor, number>()]));
}

function tilePositionsToEmptyColorStats(tilePositions: RenderTileCoordinates[]): Map<TileId, Map<PixelColor, number>> {
    return new Map(tilePositions.map((tilePosition) => [tileId(tilePosition), new Map<PixelColor, number>()]));
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
        filledColorStats: getEmptyColorStats({ ...template.coordinates, ...template.dimensions }),
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
        tileSize: Platform.renderTilePixelDimensions,
        paletteVersion: Platform.colorsVersion,
    };
}

function optimizedTemplateTileToStoredOptimizedTemplateTile(
    templateId: string,
    tile: OptimizedTemplateTile,
): StoredOptimizedTemplateTile {
    return {
        templateId,
        tilePosition: tile.tilePosition,
        imageRect: tile.imageRect,
        compressedData: tile.data,
    };
}

function addTemplateInternal(template: LiveTemplate): void {
    availableTemplates.set(template.id, template);
    addTemplateTilesToMap(template.id, template.filledColorStats);
}

function deleteTemplateInternal(templateId: string): void {
    const template = availableTemplates.get(templateId);
    if (template) {
        availableTemplates.delete(templateId);
        removeTemplateTilesFromMap(template.id, template.filledColorStats);
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
            if (template.paletteVersion !== Platform.colorsVersion) {
                debug(
                    `Template ${template.id} was saved with palette v${template.paletteVersion}, current is v${Platform.colorsVersion}, deleting optimized tiles...`,
                );
                await TemplateStorage.deleteOptimizedTemplateTiles(template.id);
            } else if (
                template.tileSize.width !== Platform.renderTilePixelDimensions.width ||
                template.tileSize.height !== Platform.renderTilePixelDimensions.height
            ) {
                debug(
                    `Template ${template.id} was saved with tile size ${template.tileSize.width}x${template.tileSize.height}, current is ${Platform.renderTilePixelDimensions.width}x${Platform.renderTilePixelDimensions.height}, deleting optimized tiles...`,
                );
                await TemplateStorage.deleteOptimizedTemplateTiles(template.id);
            }

            addTemplateInternal(storedTemplateToLiveTemplate(template));
        }

        await TemplateStorage.cleanupUnusedTemplateImages();
    },

    async addTemplate(template: TemplateInit): Promise<void> {
        const id = crypto.randomUUID();
        const thumbnail = await ImageTools.createThumbnail(template.image, 100, 100);
        const hash = await computeImageDataHash(template.image);
        const viewportCenter = Platform.getViewportCenterPixel();
        const { width, height } = template.image;
        const imageBlob = await ImageTools.writeIndexedPngBlob(template.image, Platform.colors, true);

        const coordinates = pixelCoordinates({
            x: viewportCenter.x - width / 2,
            y: viewportCenter.y - height / 2,
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
            filledColorStats: getEmptyColorStats({ ...coordinates, ...dimensions }),
        };
        await TemplateStorage.addTemplate(liveTemplateToStoredTemplate(newTemplate), { hash, image: imageBlob });
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
        const imageData = imageBitmapToImageData(imageBitmap, true);
        const optimizedTiles = await optimizeTemplate(imageData, template.coordinates);
        await TemplateStorage.saveOptimizedTemplateTiles(
            optimizedTiles.map((tile) => optimizedTemplateTileToStoredOptimizedTemplateTile(template.id, tile)),
        );
        template.filledColorStats = tilePositionsToEmptyColorStats(optimizedTiles.map((tile) => tile.tilePosition));
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

        removeTemplateTilesFromMap(template.id, template.filledColorStats);
        template.filledColorStats = getEmptyColorStats({ ...template.coordinates, ...template.dimensions });
        await TemplateStorage.deleteOptimizedTemplateTiles(template.id);
        TemplateRegistryEvents.dispatchEvent(new TemplateDeoptimizedEvent(template));
        debug(`Deoptimized template with id ${id}`);
    },

    async moveTemplate(id: string, newCoords: PixelCoordinates): Promise<void> {
        const template = availableTemplates.get(id);
        if (!template) {
            debug(`Cannot move template with id ${id} - template not found`);
            return;
        }

        template.coordinates = newCoords;
        await TemplateStorage.saveTemplate(liveTemplateToStoredTemplate(template));
        TemplateRegistryEvents.dispatchEvent(new TemplateChangedEvent(template));
        debug(`Moved template with id ${id} to (${newCoords.x}, ${newCoords.y})`);
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

        const newHash = await computeImageDataHash(newImage);
        if (newHash === template.hash) {
            debug(`New image for template with id ${id} has the same hash as the old image, skipping replacement`);
            return false;
        }

        const newThumbnail = await ImageTools.createThumbnail(newImage, 100, 100);
        const { width, height } = newImage;
        const newImageBlob = await ImageTools.writeIndexedPngBlob(newImage, Platform.colors, true);

        // Update template with new image info
        const oldHash = template.hash;
        template.hash = newHash;
        template.dimensions = pixelDimensions({ width, height });
        URL.revokeObjectURL(template.thumbnailUrl);
        template.thumbnail = newThumbnail;
        template.thumbnailUrl = URL.createObjectURL(newThumbnail);

        await TemplateStorage.replaceTemplateImage(liveTemplateToStoredTemplate(template), oldHash, {
            hash: newHash,
            image: newImageBlob,
        });
        await TemplateRegistry.deoptimizeTemplate(id);
        TemplateRegistryEvents.dispatchEvent(new TemplateChangedEvent(template));
        debug(`Replaced image of template with id ${id}`);
        return true;
    },

    async deleteTemplate(id: string): Promise<void> {
        await TemplateStorage.deleteTemplate(id);
        deleteTemplateInternal(id);
        TemplateRegistryEvents.dispatchEvent(new TemplateDeletedEvent(id));
        debug('Deleted template with id', id);
    },

    async handleTileUpdate(tilePosition: MapTileCoordinates, tileImage: ImageData): Promise<void> {
        // todo
    },

    async handlePixelsPlaced(/* todo: args */): Promise<void> {
        // todo
    },
};
