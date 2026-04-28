import type { PixelColor } from '../platform/types';
import type { PixelExtent } from '../util/geometry';

interface BaseImageToolsTask<T extends string> {
    task: T;
    taskId: string;
}

type DetectCanvasFingerprintingProtectionTaskName = 'detectCanvasFingerprintingProtection';
type DetemplatizeBlueMarbleTileTaskName = 'detemplatizeBlueMarbleTile';
type FindTransparentBorderTaskName = 'findTransparentBorder';
type ImageToPaletteIndexBufferTaskName = 'imageToPaletteIndexBuffer';
type WriteIndexedPngBufferTaskName = 'writeIndexedPngBuffer';
type WriteIndexedPngBlobTaskName = 'writeIndexedPngBlob';
type CropToExtentTaskName = 'cropToExtent';
type LoadIndexedImageTaskName = 'loadIndexedImage';
type LoadIndexedImageWithDiffTaskName = 'loadIndexedImageWithDiff';

export type DetectCanvasFingerprintingProtectionTaskRequest =
    BaseImageToolsTask<DetectCanvasFingerprintingProtectionTaskName>;

export interface DetemplatizeBlueMarbleTileTaskRequest extends BaseImageToolsTask<DetemplatizeBlueMarbleTileTaskName> {
    bitmap: ImageBitmap;
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

export type LoadIndexedImageTaskRequest = BaseImageToolsTask<LoadIndexedImageTaskName> & {
    bitmap: ImageBitmap;
    palette: readonly PixelColor[];
};

export type LoadIndexedImageWithDiffTaskRequest = BaseImageToolsTask<LoadIndexedImageWithDiffTaskName> & {
    bitmap: ImageBitmap;
    palette: readonly PixelColor[];
    darkenPercentage: number;
    highlightColorRgba: number;
};

export type ImageToolsTaskRequest =
    | DetectCanvasFingerprintingProtectionTaskRequest
    | DetemplatizeBlueMarbleTileTaskRequest
    | FindTransparentBorderTaskRequest
    | ImageToPaletteIndexBufferTaskRequest
    | WriteIndexedPngBufferTaskRequest
    | WriteIndexedPngBlobTaskRequest
    | CropToExtentTaskRequest
    | CropToNonTransparentAreaTaskRequest
    | LoadIndexedImageTaskRequest
    | LoadIndexedImageWithDiffTaskRequest;

interface BaseImageToolsTaskResult<T extends string> {
    task: T;
    taskId: string;
}

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

export interface LoadIndexedImageTaskSuccessResult extends BaseImageToolsTaskResult<LoadIndexedImageTaskName> {
    success: true;
    image: ImageData | null;
}

export interface LoadIndexedImageTaskErrorResult extends BaseImageToolsTaskResult<LoadIndexedImageTaskName> {
    success: false;
    error: unknown;
}

export type LoadIndexedImageTaskResult = LoadIndexedImageTaskSuccessResult | LoadIndexedImageTaskErrorResult;

export interface LoadIndexedImageWithDiffTaskSuccessResult extends BaseImageToolsTaskResult<LoadIndexedImageWithDiffTaskName> {
    success: true;
    matches: boolean;
    image: ImageData;
}

export interface LoadIndexedImageWithDiffTaskErrorResult extends BaseImageToolsTaskResult<LoadIndexedImageWithDiffTaskName> {
    success: false;
    error: unknown;
}

export type LoadIndexedImageWithDiffTaskResult =
    | LoadIndexedImageWithDiffTaskSuccessResult
    | LoadIndexedImageWithDiffTaskErrorResult;

export type ImageToolsTaskResult =
    | DetectCanvasFingerprintingProtectionTaskResult
    | DetemplatizeBlueMarbleTileTaskResult
    | FindTransparentBorderTaskResult
    | ImageToPaletteIndexBufferTaskResult
    | WriteIndexedPngBufferTaskResult
    | WriteIndexedPngBlobTaskResult
    | CropToExtentTaskResult
    | CropToNonTransparentAreaTaskResult
    | LoadIndexedImageTaskResult
    | LoadIndexedImageWithDiffTaskResult;
