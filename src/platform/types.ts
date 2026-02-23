import type { Map as MapLibreInstance } from 'maplibre-gl';

export interface PixelColor {
    name: string;
    hex: string;
    rgba: number;
}

export interface CanvasPlatform {
    insertPlatformStyles(): void;
    addMapInstanceHook(resolveMapInstance: (mapInstance: MapLibreInstance) => void): Promise<void>;
    getAvailableColors(): Promise<PixelColor[]>;
    getCurrentColor(colors: PixelColor[]): PixelColor | null;
}
