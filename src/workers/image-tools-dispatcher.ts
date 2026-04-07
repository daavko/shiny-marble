import { MAX_CANVAS_DIMENSION } from '../core/const';
import { debug, debugDetailed } from '../core/debug';
import type { PixelColor } from '../platform/types';
import { assertCanvasCtx } from '../util/canvas';
import type {
    DetemplatizeBlueMarbleTileTaskRequest,
    HighlightNonMatchingPixelsTaskRequest,
    ImageToolsTaskResult,
    VerifyImageMatchesPaletteTaskRequest,
} from './image-tools-types';
import imageToolsWorkerCode from './image-tools.worker';
import { createWorker } from './worker';

let workerInstance: Worker | null = null;

function getWorker(): Worker {
    workerInstance = createWorker(imageToolsWorkerCode);
    return workerInstance;
}

export interface ImageMatchesPaletteResult {
    image: ImageData;
    matches: boolean;
}

async function verifyImageMatchesPalette(
    image: ImageData,
    palette: readonly PixelColor[],
): Promise<ImageMatchesPaletteResult> {
    const { promise, resolve, reject } = Promise.withResolvers<ImageMatchesPaletteResult>();
    const { width, height } = image;
    const worker = getWorker();

    const taskId = crypto.randomUUID();

    const listener = (event: MessageEvent<ImageToolsTaskResult>): void => {
        if (event.data.taskId !== taskId || event.data.task !== 'verifyImageMatchesPalette') {
            return;
        }

        if (event.data.success) {
            const imageData = new ImageData(new Uint8ClampedArray(event.data.pixelBuffer), width, height);
            debugDetailed('Received result from verifyImageMatchesPalette task', imageData, event.data.matches);
            resolve({
                image: imageData,
                matches: event.data.matches,
            });
        } else {
            debugDetailed('Error in verifyImageMatchesPalette task', event.data.error);
            reject(event.data.error);
        }
        worker.removeEventListener('message', listener);
    };
    worker.addEventListener('message', listener);

    debugDetailed('Posting verifyImageMatchesPalette task', image, palette);
    const pixelBuffer = image.data.buffer;
    worker.postMessage(
        {
            taskId,
            task: 'verifyImageMatchesPalette',
            pixelBuffer,
            palette,
        } satisfies VerifyImageMatchesPaletteTaskRequest,
        [pixelBuffer],
    );

    return promise;
}

async function highlightNonMatchingPixels(
    image: ImageData,
    palette: readonly PixelColor[],
    darkenPercentage: number,
    highlightColorRgba: number,
): Promise<ImageData> {
    const { promise, resolve, reject } = Promise.withResolvers<ImageData>();
    const { width, height } = image;
    const worker = getWorker();

    const taskId = crypto.randomUUID();

    const listener = (event: MessageEvent<ImageToolsTaskResult>): void => {
        if (event.data.taskId !== taskId || event.data.task !== 'highlightNonMatchingPixels') {
            return;
        }

        if (event.data.success) {
            const imageData = new ImageData(new Uint8ClampedArray(event.data.pixelBuffer), width, height);
            debugDetailed('Received result from highlightNonMatchingPixels task', imageData);
            resolve(imageData);
        } else {
            debugDetailed('Error in highlightNonMatchingPixels task', event.data.error);
            reject(event.data.error);
        }
        worker.removeEventListener('message', listener);
    };
    worker.addEventListener('message', listener);

    debugDetailed('Posting highlightNonMatchingPixels task', image, palette, darkenPercentage, highlightColorRgba);
    const pixelBuffer = image.data.buffer;
    worker.postMessage(
        {
            taskId,
            task: 'highlightNonMatchingPixels',
            pixelBuffer,
            palette,
            darkenPercentage,
            highlightColorRgba,
        } satisfies HighlightNonMatchingPixelsTaskRequest,
        [pixelBuffer],
    );

    return promise;
}

async function upscalePixelArt(image: ImageData, scale: number): Promise<ImageData> {
    const { width: srcWidth, height: srcHeight } = image;
    const bitmap = await createImageBitmap(image);

    const canvasWidth = srcWidth * scale;
    const canvasHeight = srcHeight * scale;

    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    assertCanvasCtx(ctx, 'Failed to obtain 2D context for destination OffscreenCanvas');

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0, srcWidth, srcHeight, 0, 0, canvasWidth, canvasHeight);
    bitmap.close();

    debugDetailed('Upscaled pixel art image', image, { srcWidth, srcHeight }, { canvasWidth, canvasHeight });

    return ctx.getImageData(0, 0, canvasWidth, canvasHeight);
}

async function createThumbnail(image: ImageData, maxWidth: number, maxHeight: number): Promise<Blob> {
    let { width: srcWidth, height: srcHeight } = image;

    if (srcWidth === 0 || srcHeight === 0 || maxWidth <= 0 || maxHeight <= 0) {
        throw new Error('Invalid dimensions for createThumbnail');
    }

    maxWidth = Math.min(maxWidth, MAX_CANVAS_DIMENSION);
    maxHeight = Math.min(maxHeight, MAX_CANVAS_DIMENSION);

    if (srcWidth < maxWidth && srcHeight < maxWidth) {
        const scale = Math.ceil(Math.max(maxWidth / srcWidth, maxHeight / srcHeight));
        const upscaledImage = await upscalePixelArt(image, scale);
        srcWidth = upscaledImage.width;
        srcHeight = upscaledImage.height;
        image = upscaledImage;
    }

    const widthScaledToMaxHeight = Math.floor((maxHeight / srcHeight) * srcWidth);
    const heightScaledToMaxWidth = Math.floor((maxWidth / srcWidth) * srcHeight);

    let canvasWidth: number;
    let canvasHeight: number;

    if (widthScaledToMaxHeight >= maxWidth) {
        canvasWidth = maxWidth;
        canvasHeight = heightScaledToMaxWidth;
    } else {
        canvasWidth = widthScaledToMaxHeight;
        canvasHeight = maxHeight;
    }

    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    assertCanvasCtx(ctx, 'Failed to obtain 2D context for destination OffscreenCanvas');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const bitmap = await createImageBitmap(image);
    ctx.drawImage(bitmap, 0, 0, srcWidth, srcHeight, 0, 0, canvasWidth, canvasHeight);
    bitmap.close();

    debugDetailed('Created thumbnail of image', image, { srcWidth, srcHeight }, { canvasWidth, canvasHeight });

    return canvas.convertToBlob({ type: 'image/png' });
}

async function detectCanvasFingerprintingProtection(): Promise<boolean> {
    const { promise, resolve, reject } = Promise.withResolvers<boolean>();
    const worker = getWorker();

    const taskId = crypto.randomUUID();

    const listener = (event: MessageEvent<ImageToolsTaskResult>): void => {
        if (event.data.taskId !== taskId || event.data.task !== 'detectCanvasFingerprintingProtection') {
            return;
        }

        if (event.data.success) {
            debug('Received result from detectCanvasFingerprintingProtection task', event.data.protectionDetected);
            resolve(event.data.protectionDetected);
        } else {
            debugDetailed('Error in detectCanvasFingerprintingProtection task', event.data.error);
            reject(event.data.error);
        }
        worker.removeEventListener('message', listener);
    };
    worker.addEventListener('message', listener);

    debug('Posting detectCanvasFingerprintingProtection task');
    worker.postMessage({
        taskId,
        task: 'detectCanvasFingerprintingProtection',
    });

    return promise;
}

async function imageToBlob(image: ImageData): Promise<Blob> {
    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    assertCanvasCtx(ctx, 'Failed to obtain 2D context for OffscreenCanvas in imageToBlob');
    ctx.putImageData(image, 0, 0);
    return canvas.convertToBlob({ type: 'image/png' });
}

async function computeImageHash(image: ImageData): Promise<string> {
    const buffer = image.data.buffer;
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return new Uint8Array(hashBuffer).toHex();
}

async function detemplatizeBlueMarbleTile(tile: ImageData): Promise<ImageData> {
    const { promise, resolve, reject } = Promise.withResolvers<ImageData>();
    const worker = getWorker();

    const taskId = crypto.randomUUID();

    const listener = (event: MessageEvent<ImageToolsTaskResult>): void => {
        if (event.data.taskId !== taskId || event.data.task !== 'detemplatizeBlueMarbleTile') {
            return;
        }

        if (event.data.success) {
            const imageData = new ImageData(
                new Uint8ClampedArray(event.data.pixelBuffer),
                event.data.width,
                event.data.height,
            );
            debugDetailed('Received result from detemplatizeBlueMarbleTile task', imageData);
            resolve(imageData);
        } else {
            debugDetailed('Error in detemplatizeBlueMarbleTile task', event.data.error);
            reject(event.data.error);
        }
        worker.removeEventListener('message', listener);
    };
    worker.addEventListener('message', listener);

    debugDetailed('Posting detemplatizeBlueMarbleTile task', tile);
    const pixelBuffer = tile.data.buffer;
    worker.postMessage(
        {
            taskId,
            task: 'detemplatizeBlueMarbleTile',
            pixelBuffer,
            width: tile.width,
            height: tile.height,
        } satisfies DetemplatizeBlueMarbleTileTaskRequest,
        [pixelBuffer],
    );

    return promise;
}

export const ImageTools = {
    verifyImageMatchesPalette,
    highlightNonMatchingPixels,
    createThumbnail,
    detectCanvasFingerprintingProtection,
    computeImageHash,
    imageToBlob,
};
