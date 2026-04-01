import type { PixelColor } from '../../platform/types';
import type { Dimensions, Point, Vector } from '../../util/geometry';
import { TemplateStorage } from './template-storage';

export interface LiveTemplate {
    id: string;
    name: string;
    position: Point;
    imageSize: Dimensions;
    hash: string;
    thumbnail: ImageData;

    /**
     * Set of `${x}_${y}` strings representing tiles where this template has at least one visible pixel.
     */
    occupiedTileIds: Set<string>;

    /**
     * Map of tile IDs to maps of pixel colors to the number of pixels of that color in that tile.
     */
    filledColorStats: Map<string, Map<PixelColor, number>>;
}

const AvailableTemplates: LiveTemplate[] = [];

interface TemplateInit {
    name: string;
    image: ImageData;
}

export const TemplateRegistry = {
    get availableTemplates(): readonly LiveTemplate[] {
        return AvailableTemplates;
    },

    async initialize(): Promise<void> {
        const templates = await TemplateStorage.getAllTemplates();
        AvailableTemplates.push(...templates);
    },

    async addTemplate(template: TemplateInit): Promise<void> {
        // todo
    },

    async moveTemplate(amount: Vector): Promise<void> {
        // todo
    },

    async deleteTemplate(id: string): Promise<void> {
        // todo
    },

    async handleTileUpdate(tilePosition: Point, tileImage: ImageData): Promise<void> {
        // todo
    },

    async handlePixelsPlaced(/* todo: args */): Promise<void> {
        // todo
    },
};
