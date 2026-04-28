import type { PixelColor } from '../platform/types';
import type { PixelExtent } from '../util/geometry';

interface BaseImageToolsTask<T extends string> {
    task: T;
    taskId: string;
}

type VerifyImageMachesPaletteTaskName = 'verifyImageMatchesPalette';
type HighlightNonMatchingPixelsTaskName = 'highlightNonMatchingPixels';
type DetectCanvasFingerprintingProtectionTaskName = 'detectCanvasFingerprintingProtection';
type DetemplatizeBlueMarbleTileTaskName = 'detemplatizeBlueMarbleTile';
type FindTransparentBorderTaskName = 'findTransparentBorder';
type ImageToPaletteIndexBufferTaskName = 'imageToPaletteIndexBuffer';
type WriteIndexedPngBufferTaskName = 'writeIndexedPngBuffer';
type WriteIndexedPngBlobTaskName = 'writeIndexedPngBlob';
type CropToExtentTaskName = 'cropToExtent';

export interface VerifyImageMatchesPaletteTaskRequest extends BaseImageToolsTask<VerifyImageMachesPaletteTaskName> {
    image: ImageData;
    palette: readonly PixelColor[];
}

export interface HighlightNonMatchingPixelsTaskRequest extends BaseImageToolsTask<HighlightNonMatchingPixelsTaskName> {
    image: ImageData;
    palette: readonly PixelColor[];
    darkenPercentage: number;
    highlightColorRgba: number;
}

export type DetectCanvasFingerprintingProtectionTaskRequest =
    BaseImageToolsTask<DetectCanvasFingerprintingProtectionTaskName>;

export interface DetemplatizeBlueMarbleTileTaskRequest extends BaseImageToolsTask<DetemplatizeBlueMarbleTileTaskName> {
    image: ImageData;
}

export interface FindTransparentBorderTaskRequest extends BaseImageToolsTask<FindTransparentBorderTaskName> {
    image: ImageData;
}

export interface ImageToPaletteIndexBufferTaskRequest extends BaseImageToolsTask<ImageToPaletteIndexBufferTaskName> {
    image: ImageData;
    palette: readonly PixelColor[];
}

export interface WriteIndexedPngBufferTaskRequest extends BaseImageToolsTask<WriteIndexedPngBufferTaskName> {
    image: ImageData;
    palette: readonly PixelColor[];
}

export interface WriteIndexedPngBlobTaskRequest extends BaseImageToolsTask<WriteIndexedPngBlobTaskName> {
    image: ImageData;
    palette: readonly PixelColor[];
}

export type CropToExtentTaskRequest = BaseImageToolsTask<CropToExtentTaskName> & {
    image: ImageData;
    extent: PixelExtent;
};

export type CropToNonTransparentAreaTaskRequest = BaseImageToolsTask<'cropToNonTransparentArea'> & {
    image: ImageData;
};

export type ImageToolsTaskRequest =
    | VerifyImageMatchesPaletteTaskRequest
    | HighlightNonMatchingPixelsTaskRequest
    | DetectCanvasFingerprintingProtectionTaskRequest
    | DetemplatizeBlueMarbleTileTaskRequest
    | FindTransparentBorderTaskRequest
    | ImageToPaletteIndexBufferTaskRequest
    | WriteIndexedPngBufferTaskRequest
    | WriteIndexedPngBlobTaskRequest
    | CropToExtentTaskRequest
    | CropToNonTransparentAreaTaskRequest;

interface BaseImageToolsTaskResult<T extends string> {
    task: T;
    taskId: string;
}

export interface VerifyImageMatchesPaletteTaskSuccessResult extends BaseImageToolsTaskResult<VerifyImageMachesPaletteTaskName> {
    success: true;
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
    image: ImageData;
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

export interface DetemplatizeBlueMarbleTileTaskSuccessResult extends BaseImageToolsTaskResult<DetemplatizeBlueMarbleTileTaskName> {
    success: true;
    image: ImageData;
}

export interface DetemplatizeBlueMarbleTileTaskErrorResult extends BaseImageToolsTaskResult<DetemplatizeBlueMarbleTileTaskName> {
    success: false;
    error: unknown;
}

export type DetemplatizeBlueMarbleTileTaskResult =
    | DetemplatizeBlueMarbleTileTaskSuccessResult
    | DetemplatizeBlueMarbleTileTaskErrorResult;

export type FindTransparentBorderResult = PixelExtent | 'fullyTransparent' | 'noTransparentBorder';

export interface FindTransparentBorderTaskSuccessResult extends BaseImageToolsTaskResult<FindTransparentBorderTaskName> {
    success: true;
    border: FindTransparentBorderResult;
}

export interface FindTransparentBorderTaskErrorResult extends BaseImageToolsTaskResult<FindTransparentBorderTaskName> {
    success: false;
    error: unknown;
}

export type FindTransparentBorderTaskResult =
    | FindTransparentBorderTaskSuccessResult
    | FindTransparentBorderTaskErrorResult;

export interface ImageToPaletteIndexBufferTaskSuccessResult extends BaseImageToolsTaskResult<ImageToPaletteIndexBufferTaskName> {
    success: true;
    buffer: ArrayBuffer;
}

export interface ImageToPaletteIndexBufferTaskErrorResult extends BaseImageToolsTaskResult<ImageToPaletteIndexBufferTaskName> {
    success: false;
    error: unknown;
}

export type ImageToPaletteIndexBufferTaskResult =
    | ImageToPaletteIndexBufferTaskSuccessResult
    | ImageToPaletteIndexBufferTaskErrorResult;

export interface WriteIndexedPngBufferTaskSuccessResult extends BaseImageToolsTaskResult<WriteIndexedPngBufferTaskName> {
    success: true;
    buffer: ArrayBuffer;
}

export interface WriteIndexedPngBufferTaskErrorResult extends BaseImageToolsTaskResult<WriteIndexedPngBufferTaskName> {
    success: false;
    error: unknown;
}

export type WriteIndexedPngBufferTaskResult =
    | WriteIndexedPngBufferTaskSuccessResult
    | WriteIndexedPngBufferTaskErrorResult;

export interface WriteIndexedPngBlobTaskSuccessResult extends BaseImageToolsTaskResult<WriteIndexedPngBlobTaskName> {
    success: true;
    blob: Blob;
}

export interface WriteIndexedPngBlobTaskErrorResult extends BaseImageToolsTaskResult<WriteIndexedPngBlobTaskName> {
    success: false;
    error: unknown;
}

export type WriteIndexedPngBlobTaskResult = WriteIndexedPngBlobTaskSuccessResult | WriteIndexedPngBlobTaskErrorResult;

export interface CropToExtentTaskSuccessResult extends BaseImageToolsTaskResult<CropToExtentTaskName> {
    success: true;
    image: ImageData;
}

export interface CropToExtentTaskErrorResult extends BaseImageToolsTaskResult<CropToExtentTaskName> {
    success: false;
    error: unknown;
}

export type CropToExtentTaskResult = CropToExtentTaskSuccessResult | CropToExtentTaskErrorResult;

export interface CropToNonTransparentAreaTaskSuccessResult extends BaseImageToolsTaskResult<'cropToNonTransparentArea'> {
    success: true;
    image: ImageData;
}

export interface CropToNonTransparentAreaTaskErrorResult extends BaseImageToolsTaskResult<'cropToNonTransparentArea'> {
    success: false;
    error: unknown;
}

export type CropToNonTransparentAreaTaskResult =
    | CropToNonTransparentAreaTaskSuccessResult
    | CropToNonTransparentAreaTaskErrorResult;

export type ImageToolsTaskResult =
    | VerifyImageMatchesPaletteTaskResult
    | HighlightNonMatchingPixelsTaskResult
    | DetectCanvasFingerprintingProtectionTaskResult
    | DetemplatizeBlueMarbleTileTaskResult
    | FindTransparentBorderTaskResult
    | ImageToPaletteIndexBufferTaskResult
    | WriteIndexedPngBufferTaskResult
    | WriteIndexedPngBlobTaskResult
    | CropToExtentTaskResult
    | CropToNonTransparentAreaTaskResult;
