import type { PixelColor } from '../platform/types';

interface BaseImageToolsTask<T extends string> {
    task: T;
    taskId: string;
}

type VerifyImageMachesPaletteTaskName = 'verifyImageMatchesPalette';
type HighlightNonMatchingPixelsTaskName = 'highlightNonMatchingPixels';

export interface VerifyImageMatchesPaletteTaskRequest extends BaseImageToolsTask<VerifyImageMachesPaletteTaskName> {
    pixelBuffer: ArrayBuffer;
    palette: readonly PixelColor[];
}

export interface HighlightNonMatchingPixelsTaskRequest extends BaseImageToolsTask<HighlightNonMatchingPixelsTaskName> {
    pixelBuffer: ArrayBuffer;
    palette: readonly PixelColor[];
    darkenPercentage: number;
    highlightColorRgba: number;
}

export type ImageToolsTaskRequest = VerifyImageMatchesPaletteTaskRequest | HighlightNonMatchingPixelsTaskRequest;

interface BaseImageToolsTaskResult<T extends string> {
    task: T;
    taskId: string;
}

export interface VerifyImageMatchesPaletteTaskSuccessResult extends BaseImageToolsTaskResult<VerifyImageMachesPaletteTaskName> {
    success: true;
    pixelBuffer: ArrayBuffer;
    matches: boolean;
}

export interface VerifyImageMatchesPaletteTaskErrorResult extends BaseImageToolsTaskResult<VerifyImageMachesPaletteTaskName> {
    success: false;
    error: unknown;
}

export type VerifyImageMatchesPaletteTaskResult =
    | VerifyImageMatchesPaletteTaskSuccessResult
    | VerifyImageMatchesPaletteTaskErrorResult;

export interface HighlightNonMatchingPixelsTaskSuccessResult extends BaseImageToolsTaskResult<HighlightNonMatchingPixelsTaskName> {
    success: true;
    pixelBuffer: ArrayBuffer;
}

export interface HighlightNonMatchingPixelsTaskErrorResult extends BaseImageToolsTaskResult<HighlightNonMatchingPixelsTaskName> {
    success: false;
    error: unknown;
}

export type HighlightNonMatchingPixelsTaskResult =
    | HighlightNonMatchingPixelsTaskSuccessResult
    | HighlightNonMatchingPixelsTaskErrorResult;

export type ImageToolsTaskResult = VerifyImageMatchesPaletteTaskResult | HighlightNonMatchingPixelsTaskResult;
