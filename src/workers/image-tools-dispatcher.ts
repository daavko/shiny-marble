import { MAX_TEMPLATE_CANVAS_DIMENSION } from '../core/const';
import { debug, debugDetailed } from '../core/debug';
import type { PixelColor } from '../platform/types';
import { assertCanvasCtx } from '../util/canvas';
import type { PixelExtent } from '../util/geometry';
import {
    assertTaskResultType,
    type FindTransparentBorderResult,
    type ImageToolsTaskRequest,
    type ImageToolsTaskResult,
} from './image-tools-types';
import imageToolsWorkerCode from './image-tools.worker';
import { createWorker } from './worker';

const maxWorkerConcurrency = Math.floor(navigator.hardwareConcurrency / 2);
const activeWorkers = new Set<Worker>();

const pendingTasks: ImageToolsTaskRequest[] = [];
const postedTasks: ImageToolsTaskRequest[] = [];

interface ImageToolsEventMap {
    taskresult: MessageEvent<ImageToolsTaskResult>;
}

interface ImageToolsEventTarget extends EventTarget {
    addEventListener<K extends keyof ImageToolsEventMap>(
        type: K,
        listener: (this: ImageToolsEventTarget, ev: ImageToolsEventMap[K]) => void,
        options?: boolean | AddEventListenerOptions,
    ): void;
    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
    ): void;
    removeEventListener<K extends keyof ImageToolsEventMap>(
        type: K,
        listener: (this: ImageToolsEventTarget, ev: ImageToolsEventMap[K]) => void,
        options?: boolean | EventListenerOptions,
    ): void;
    removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions,
    ): void;
    dispatchEvent(event: Event): boolean;
}

const TaskResultEvents: ImageToolsEventTarget = new EventTarget();

function postTaskToWorkerPool(task: ImageToolsTaskRequest): void {
    if (activeWorkers.size >= maxWorkerConcurrency) {
        pendingTasks.push(task);
    } else {
        const worker = createWorker(imageToolsWorkerCode);
        activeWorkers.add(worker);

        const listener = (event: MessageEvent<ImageToolsTaskResult>): void => {
            TaskResultEvents.dispatchEvent(new MessageEvent('taskresult', { data: event.data }));
            const nextTask = pendingTasks.shift();
            if (nextTask) {
                postedTasks.push(nextTask);
                worker.postMessage(nextTask);
            } else {
                activeWorkers.delete(worker);
                worker.terminate();
            }
        };

        worker.addEventListener('message', listener);

        postedTasks.push(task);
        worker.postMessage(task);
    }
}

async function waitForTaskResult(taskId: string): Promise<ImageToolsTaskResult> {
    const { promise, resolve } = Promise.withResolvers<ImageToolsTaskResult>();

    const listener = (event: MessageEvent<ImageToolsTaskResult>): void => {
        if (event.data.taskId === taskId) {
            TaskResultEvents.removeEventListener('taskresult', listener);
            resolve(event.data);
        }
    };

    TaskResultEvents.addEventListener('taskresult', listener);

    return promise;
}

async function verifyImageMatchesPalette(image: ImageData, palette: readonly PixelColor[]): Promise<boolean> {
    const taskId = crypto.randomUUID();

    console.time(`verifyImageMatchesPalette-${taskId}`);
    debugDetailed('Posting verifyImageMatchesPalette task', image, palette);
    postTaskToWorkerPool({ taskId, task: 'verifyImageMatchesPalette', image, palette });

    const result = await waitForTaskResult(taskId);
    assertTaskResultType(result, 'verifyImageMatchesPalette');
    console.timeEnd(`verifyImageMatchesPalette-${taskId}`);

    if (result.success) {
        debugDetailed('Received result from verifyImageMatchesPalette task', result.matches);
        return result.matches;
    } else {
        debugDetailed('Error in verifyImageMatchesPalette task', result.error);
        throw result.error;
    }
}

async function highlightNonMatchingPixels(
    image: ImageData,
    palette: readonly PixelColor[],
    darkenPercentage: number,
    highlightColorRgba: number,
): Promise<ImageData> {
    const taskId = crypto.randomUUID();

    debugDetailed('Posting highlightNonMatchingPixels task', image, palette, darkenPercentage, highlightColorRgba);
    postTaskToWorkerPool({
        taskId,
        task: 'highlightNonMatchingPixels',
        image,
        palette,
        darkenPercentage,
        highlightColorRgba,
    });

    const result = await waitForTaskResult(taskId);
    assertTaskResultType(result, 'highlightNonMatchingPixels');

    if (result.success) {
        debugDetailed('Received result from highlightNonMatchingPixels task', result.image);
        return result.image;
    } else {
        debugDetailed('Error in highlightNonMatchingPixels task', result.error);
        throw result.error;
    }
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

    maxWidth = Math.min(maxWidth, MAX_TEMPLATE_CANVAS_DIMENSION);
    maxHeight = Math.min(maxHeight, MAX_TEMPLATE_CANVAS_DIMENSION);

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
    const taskId = crypto.randomUUID();

    debug('Posting detectCanvasFingerprintingProtection task');
    postTaskToWorkerPool({ taskId, task: 'detectCanvasFingerprintingProtection' });

    const result = await waitForTaskResult(taskId);
    assertTaskResultType(result, 'detectCanvasFingerprintingProtection');

    if (result.success) {
        debug('Received result from detectCanvasFingerprintingProtection task', result.protectionDetected);
        return result.protectionDetected;
    } else {
        debugDetailed('Error in detectCanvasFingerprintingProtection task', result.error);
        throw result.error;
    }
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
    const taskId = crypto.randomUUID();

    debugDetailed('Posting detemplatizeBlueMarbleTile task', tile);
    postTaskToWorkerPool({ taskId, task: 'detemplatizeBlueMarbleTile', image: tile });

    const result = await waitForTaskResult(taskId);
    assertTaskResultType(result, 'detemplatizeBlueMarbleTile');

    if (result.success) {
        debugDetailed('Received result from detemplatizeBlueMarbleTile task', result.image);
        return result.image;
    } else {
        debugDetailed('Error in detemplatizeBlueMarbleTile task', result.error);
        throw result.error;
    }
}

async function findTransparentBorder(image: ImageData): Promise<FindTransparentBorderResult> {
    const taskId = crypto.randomUUID();

    debugDetailed('Posting findTransparentBorder task', image);
    postTaskToWorkerPool({ taskId, task: 'findTransparentBorder', image });

    const result = await waitForTaskResult(taskId);
    assertTaskResultType(result, 'findTransparentBorder');

    if (result.success) {
        debugDetailed('Received result from findTransparentBorder task', result.border);
        return result.border;
    } else {
        debugDetailed('Error in findTransparentBorder task', result.error);
        throw result.error;
    }
}

function cropToExtent(image: ImageData, area: PixelExtent): ImageData {
    const { minX, minY, maxX, maxY } = area;
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    assertCanvasCtx(ctx, 'Failed to obtain 2D context for OffscreenCanvas in cropToArea');
    ctx.putImageData(image, -minX, -minY, minX, minY, width, height);

    return ctx.getImageData(0, 0, width, height);
}

async function cropToNonTransparentArea(image: ImageData): Promise<ImageData> {
    const border = await findTransparentBorder(image);

    if (border === 'fullyTransparent' || border === 'noTransparentBorder') {
        return image;
    } else {
        return cropToExtent(image, border);
    }
}

async function imageToPaletteIndexBuffer(
    image: ImageData,
    palette: readonly PixelColor[],
): Promise<Uint8Array<ArrayBuffer>> {
    const taskId = crypto.randomUUID();

    debugDetailed('Posting imageToPaletteIndexBuffer task', image, palette);
    postTaskToWorkerPool({ taskId, task: 'imageToPaletteIndexBuffer', image, palette });

    const result = await waitForTaskResult(taskId);
    assertTaskResultType(result, 'imageToPaletteIndexBuffer');

    if (result.success) {
        debugDetailed('Received result from imageToPaletteIndexBuffer task', result.buffer);
        return result.buffer;
    } else {
        debugDetailed('Error in imageToPaletteIndexBuffer task', result.error);
        throw result.error;
    }
}

export const ImageTools = {
    verifyImageMatchesPalette,
    highlightNonMatchingPixels,
    createThumbnail,
    detectCanvasFingerprintingProtection,
    computeImageHash,
    imageToBlob,
    detemplatizeBlueMarbleTile,
    findTransparentBorder,
    cropToArea: cropToExtent,
    cropToNonTransparentArea,
    imageToPaletteIndexBuffer,
};
