import { Platform } from '../../platform/platform';
import type { PixelColor } from '../../platform/types';
import type { Dimensions, Point, Vector } from '../../util/geometry';
import { ImageTools } from '../../workers/image-tools-dispatcher';
import { debug, debugDetailed } from '../debug';
import { type StoredTemplate, TemplateStorage } from './template-storage';

export type TileId = `${number}_${number}`;

export interface LiveTemplate {
    id: string;
    name: string;
    position: Point;
    imageSize: Dimensions;
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
    imageBlob?: Blob;
}

function storedTemplateToLiveTemplate(template: StoredTemplate): LiveTemplate {
    return {
        id: template.id,
        name: template.name,
        position: template.position,
        imageSize: template.imageSize,
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
        position: template.position,
        imageSize: template.imageSize,
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
        const imageBlob = template.imageBlob ?? (await ImageTools.imageToBlob(template.image));

        const newTemplate: LiveTemplate = {
            id,
            name: template.name,
            position: {
                x: viewportCenter.x - template.image.width / 2,
                y: viewportCenter.y - template.image.height / 2,
            },
            imageSize: { width, height },
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

    async moveTemplate(id: string, amount: Vector): Promise<void> {
        // todo
    },

    async renameTemplate(id: string, newName: string): Promise<void> {
        const template = availableTemplates.get(id);
        if (!template) {
            debug(`Cannot rename template with id ${id} - template not found`);
            return;
        }

        template.name = newName;
        await TemplateStorage.saveTemplate(liveTemplateToStoredTemplate(template));
        TemplateRegistryEvents.dispatchEvent(new TemplateChangedEvent(template));
        debug(`Renamed template with id ${id} to "${newName}"`);
    },

    async deleteTemplate(id: string): Promise<void> {
        await TemplateStorage.deleteTemplate(id);
        deleteTemplateInternal(id);
        await TemplateStorage.cleanupUnusedTemplateImages(knownTemplateHashes);
        TemplateRegistryEvents.dispatchEvent(new TemplateDeletedEvent(id));
        debug('Deleted template with id', id);
    },

    async handleTileUpdate(tilePosition: Point, tileImage: ImageData): Promise<void> {
        // todo
    },

    async handlePixelsPlaced(/* todo: args */): Promise<void> {
        // todo
    },
};
