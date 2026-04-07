import type { PixelColor } from '../platform/types';

interface BaseImageToolsTask<T extends string> {
    task: T;
    taskId: string;
}

type VerifyImageMachesPaletteTaskName = 'verifyImageMatchesPalette';
type HighlightNonMatchingPixelsTaskName = 'highlightNonMatchingPixels';
type DetectCanvasFingerprintingProtectionTaskName = 'detectCanvasFingerprintingProtection';

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

export type DetectCanvasFingerprintingProtectionTaskRequest =
    BaseImageToolsTask<DetectCanvasFingerprintingProtectionTaskName>;

export interface DetemplatizeBlueMarbleTileTaskRequest extends BaseImageToolsTask<'detemplatizeBlueMarbleTile'> {
    pixelBuffer: ArrayBuffer;
    width: number;
    height: number;
}

export type ImageToolsTaskRequest =
    | VerifyImageMatchesPaletteTaskRequest
    | HighlightNonMatchingPixelsTaskRequest
    | DetectCanvasFingerprintingProtectionTaskRequest
    | DetemplatizeBlueMarbleTileTaskRequest;

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

export interface DetectCanvasFingerprintingProtectionTaskSuccessResult extends BaseImageToolsTaskResult<DetectCanvasFingerprintingProtectionTaskName> {
    success: true;
    protectionDetected: boolean;
}

export interface DetectCanvasFingerprintingProtectionTaskErrorResult extends BaseImageToolsTaskResult<DetectCanvasFingerprintingProtectionTaskName> {
    success: false;
    error: unknown;
}

export type DetectCanvasFingerprintingProtectionTaskResult =
    | DetectCanvasFingerprintingProtectionTaskSuccessResult
    | DetectCanvasFingerprintingProtectionTaskErrorResult;

export interface DetemplatizeBlueMarbleTileTaskSuccessResult extends BaseImageToolsTaskResult<'detemplatizeBlueMarbleTile'> {
    success: true;
    pixelBuffer: ArrayBuffer;
    width: number;
    height: number;
}

export interface DetemplatizeBlueMarbleTileTaskErrorResult extends BaseImageToolsTaskResult<'detemplatizeBlueMarbleTile'> {
    success: false;
    error: unknown;
}

export type DetemplatizeBlueMarbleTileTaskResult =
    | DetemplatizeBlueMarbleTileTaskSuccessResult
    | DetemplatizeBlueMarbleTileTaskErrorResult;

export type ImageToolsTaskResult =
    | VerifyImageMatchesPaletteTaskResult
    | HighlightNonMatchingPixelsTaskResult
    | DetectCanvasFingerprintingProtectionTaskResult
    | DetemplatizeBlueMarbleTileTaskResult;
