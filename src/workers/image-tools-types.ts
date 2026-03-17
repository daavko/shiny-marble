import type { PixelColor } from '../platform/types';

export interface VerifyImageMatchesPaletteTask {
    imageData: ImageData;
    palette: PixelColor[];
}

export interface VerifyImageMatchesPaletteTaskSuccessResult {
    success: true;
    imageData: ImageData;
    matches: boolean;
}

export interface VerifyImageMatchesPaletteTaskErrorResult {
    success: false;
    error: unknown;
}

export type VerifyImageMatchesPaletteTaskResult =
    | VerifyImageMatchesPaletteTaskSuccessResult
    | VerifyImageMatchesPaletteTaskErrorResult;
