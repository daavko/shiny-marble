import { MAX_TEMPLATE_CANVAS_DIMENSION } from '../core/const';
import { debugDetailed } from '../core/debug';
import type { PixelColor } from '../platform/types';
import { assertCanvasCtx } from '../util/canvas';
import type { PixelExtent } from '../util/geometry';
import type { FindTransparentBorderResult, ImageToolsTaskRequest, ImageToolsTaskResult } from './image-tools-types';
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

async function doTaskInWorkerPool<T extends ImageToolsTaskResult['task']>(
    taskRequest: Extract<ImageToolsTaskRequest, { task: T }>,
): Promise<Extract<ImageToolsTaskResult, { task: T }>> {
    const taskId = taskRequest.taskId;

    debugDetailed(`Posting ${taskRequest.task} task to worker pool`, taskRequest);
    postTaskToWorkerPool(taskRequest);

    const { promise, resolve, reject } = Promise.withResolvers<Extract<ImageToolsTaskResult, { task: T }>>();

    const listener = (event: MessageEvent<ImageToolsTaskResult>): void => {
        if (event.data.taskId === taskId) {
            TaskResultEvents.removeEventListener('taskresult', listener);

            if (event.data.task === taskRequest.task) {
                debugDetailed(`Received result for ${taskRequest.task} task`, event.data);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
                resolve(event.data as Extract<ImageToolsTaskResult, { task: T }>);
            } else {
                const errorMessage = `Received result for unexpected task. Expected: ${taskRequest.task}, Received: ${event.data.task}`;
                debugDetailed(errorMessage, event.data);
                reject(new Error(errorMessage));
            }
        }
    };

    TaskResultEvents.addEventListener('taskresult', listener);

    return promise;
}

function assertTaskResultSuccess<T extends ImageToolsTaskResult['task']>(
    result: Extract<ImageToolsTaskResult, { task: T }>,
): asserts result is Extract<Extract<ImageToolsTaskResult, { task: T }>, { success: true }> {
    if (!result.success) {
        debugDetailed(`Task ${result.task} failed with error`, result.error);
        throw result.error;
    }
}

async function verifyImageMatchesPalette(image: ImageData, palette: readonly PixelColor[]): Promise<boolean> {
    const result = await doTaskInWorkerPool({
        taskId: crypto.randomUUID(),
        task: 'verifyImageMatchesPalette',
        image,
        palette,
    });
    assertTaskResultSuccess(result);
    return result.matches;
}

async function highlightNonMatchingPixels(
    image: ImageData,
    palette: readonly PixelColor[],
    darkenPercentage: number,
    highlightColorRgba: number,
): Promise<ImageData> {
    const result = await doTaskInWorkerPool({
        taskId: crypto.randomUUID(),
        task: 'highlightNonMatchingPixels',
        image,
        palette,
        darkenPercentage,
        highlightColorRgba,
    });
    assertTaskResultSuccess(result);
    return result.image;
}

async function upscalePixelArt(image: ImageData, scale: number): Promise<ImageData> {
    const { width: srcWidth, height: srcHeight } = image;
    const bitmap = await createImageBitmap(image);

    const canvasWidth = srcWidth * scale;
    const canvasHeight = srcHeight * scale;

    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    assertCanvasCtx(ctx);

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
    assertCanvasCtx(ctx);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const bitmap = await createImageBitmap(image);
    ctx.drawImage(bitmap, 0, 0, srcWidth, srcHeight, 0, 0, canvasWidth, canvasHeight);
    bitmap.close();

    debugDetailed('Created thumbnail of image', image, { srcWidth, srcHeight }, { canvasWidth, canvasHeight });

    return canvas.convertToBlob({ type: 'image/png' });
}

async function detectCanvasFingerprintingProtection(): Promise<boolean> {
    const result = await doTaskInWorkerPool({
        taskId: crypto.randomUUID(),
        task: 'detectCanvasFingerprintingProtection',
    });
    assertTaskResultSuccess(result);
    return result.protectionDetected;
}

async function imageToBlob(image: ImageData): Promise<Blob> {
    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    assertCanvasCtx(ctx);
    ctx.putImageData(image, 0, 0);
    return canvas.convertToBlob({ type: 'image/png' });
}

async function computeImageHash(image: ImageData): Promise<string> {
    const buffer = image.data.buffer;
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return new Uint8Array(hashBuffer).toHex();
}

async function detemplatizeBlueMarbleTile(tile: ImageData): Promise<ImageData> {
    const result = await doTaskInWorkerPool({
        taskId: crypto.randomUUID(),
        task: 'detemplatizeBlueMarbleTile',
        image: tile,
    });
    assertTaskResultSuccess(result);
    return result.image;
}

async function findTransparentBorder(image: ImageData): Promise<FindTransparentBorderResult> {
    const result = await doTaskInWorkerPool({
        taskId: crypto.randomUUID(),
        task: 'findTransparentBorder',
        image,
    });
    assertTaskResultSuccess(result);
    return result.border;
}

function cropToExtent(image: ImageData, area: PixelExtent): ImageData {
    const { minX, minY, maxX, maxY } = area;
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    assertCanvasCtx(ctx);
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

async function imageToPaletteIndexBuffer(image: ImageData, palette: readonly PixelColor[]): Promise<ArrayBuffer> {
    const result = await doTaskInWorkerPool({
        taskId: crypto.randomUUID(),
        task: 'imageToPaletteIndexBuffer',
        image,
        palette,
    });
    assertTaskResultSuccess(result);
    return result.buffer;
}

async function writeIndexedPngBuffer(image: ImageData, palette: readonly PixelColor[]): Promise<ArrayBuffer> {
    const result = await doTaskInWorkerPool({
        taskId: crypto.randomUUID(),
        task: 'writeIndexedPngBuffer',
        image,
        palette,
    });
    assertTaskResultSuccess(result);
    return result.buffer;
}

async function writeIndexedPngBlob(image: ImageData, palette: readonly PixelColor[]): Promise<Blob> {
    const result = await doTaskInWorkerPool({
        taskId: crypto.randomUUID(),
        task: 'writeIndexedPngBlob',
        image,
        palette,
    });
    assertTaskResultSuccess(result);
    return result.blob;
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
    cropToExtent,
    cropToNonTransparentArea,
    imageToPaletteIndexBuffer,
    writeIndexedPngBuffer,
    writeIndexedPngBlob,
};
