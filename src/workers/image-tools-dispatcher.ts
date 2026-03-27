import type { PixelColor } from '../platform/types';
import type {
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
            resolve({
                image: new ImageData(new Uint8ClampedArray(event.data.pixelBuffer), width, height),
                matches: event.data.matches,
            });
        } else {
            reject(event.data.error);
        }
        worker.removeEventListener('message', listener);
    };
    worker.addEventListener('message', listener);

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
            resolve(new ImageData(new Uint8ClampedArray(event.data.pixelBuffer), width, height));
        } else {
            reject(event.data.error);
        }
        worker.removeEventListener('message', listener);
    };
    worker.addEventListener('message', listener);

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
    if (!ctx) {
        throw new Error('Failed to obtain 2D context for destination OffscreenCanvas');
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0, srcWidth, srcHeight, 0, 0, canvasWidth, canvasHeight);
    bitmap.close();

    return ctx.getImageData(0, 0, canvasWidth, canvasHeight);
}

async function createThumbnail(image: ImageData, maxWidth: number, maxHeight: number): Promise<ImageData> {
    let { width: srcWidth, height: srcHeight } = image;

    if (srcWidth === 0 || srcHeight === 0 || maxWidth <= 0 || maxHeight <= 0) {
        return new ImageData(0, 0);
    }

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

    if (!ctx) {
        throw new Error('Failed to obtain 2D context for destination OffscreenCanvas');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const bitmap = await createImageBitmap(image);
    ctx.drawImage(bitmap, 0, 0, srcWidth, srcHeight, 0, 0, canvasWidth, canvasHeight);
    bitmap.close();

    return ctx.getImageData(0, 0, canvasWidth, canvasHeight);
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
            resolve(event.data.protectionDetected);
        } else {
            reject(event.data.error);
        }
        worker.removeEventListener('message', listener);
    };
    worker.addEventListener('message', listener);

    worker.postMessage({
        taskId,
        task: 'detectCanvasFingerprintingProtection',
    });

    return promise;
}

export const ImageTools = {
    verifyImageMatchesPalette,
    highlightNonMatchingPixels,
    createThumbnail,
    detectCanvasFingerprintingProtection,
};
