import { MAX_TEMPLATE_CANVAS_DIMENSION } from '../core/const';
import { debugDetailed } from '../core/debug';
import type { PixelColor } from '../platform/types';
import { assertCanvasCtx } from '../util/canvas';
import type { PixelExtent } from '../util/geometry';
import type { FindTransparentBorderResult, ImageToolsTaskRequest, ImageToolsTaskResult } from './image-tools-types';
import imageToolsWorkerCode from './image-tools.worker';
import { createWorker } from './worker';

const maxWorkerConcurrency = Math.max(1, Math.floor(navigator.hardwareConcurrency / 2));
const activeWorkers = new Set<Worker>();

interface PendingTask {
    task: ImageToolsTaskRequest;
    transfer?: Transferable[];
}

const pendingTasks: PendingTask[] = [];
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

function postTaskToWorkerPool(task: ImageToolsTaskRequest, transfer?: Transferable[]): void {
    if (activeWorkers.size >= maxWorkerConcurrency) {
        pendingTasks.push({ task, transfer });
    } else {
        const worker = createWorker(imageToolsWorkerCode);
        activeWorkers.add(worker);

        const listener = (event: MessageEvent<ImageToolsTaskResult>): void => {
            TaskResultEvents.dispatchEvent(new MessageEvent('taskresult', { data: event.data }));
            const nextTask = pendingTasks.shift();
            if (nextTask) {
                postedTasks.push(nextTask.task);
                worker.postMessage(nextTask.task, { transfer: nextTask.transfer });
            } else {
                activeWorkers.delete(worker);
                worker.terminate();
            }
        };

        worker.addEventListener('message', listener);

        postedTasks.push(task);
        worker.postMessage(task, { transfer });
    }
}

async function doTaskInWorkerPool<T extends ImageToolsTaskResult['task']>(
    taskRequest: Extract<ImageToolsTaskRequest, { task: T }>,
    transfer?: Transferable[],
): Promise<Extract<ImageToolsTaskResult, { task: T }>> {
    const taskId = taskRequest.taskId;

    debugDetailed(`Posting ${taskRequest.task} task to worker pool`, taskRequest);
    postTaskToWorkerPool(taskRequest, transfer);

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

async function detemplatizeBlueMarbleTile(tile: ImageBitmap): Promise<ImageData> {
    const result = await doTaskInWorkerPool(
        {
            taskId: crypto.randomUUID(),
            task: 'detemplatizeBlueMarbleTile',
            bitmap: tile,
        },
        [tile],
    );
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

async function cropToExtent(image: ImageData, extent: PixelExtent, consume = false): Promise<ImageData> {
    const result = await doTaskInWorkerPool(
        {
            taskId: crypto.randomUUID(),
            task: 'cropToExtent',
            image,
            extent,
        },
        consume ? [image.data.buffer] : undefined,
    );
    assertTaskResultSuccess(result);
    return result.image;
}

async function cropToNonTransparentArea(image: ImageData, consume = false): Promise<ImageData> {
    const result = await doTaskInWorkerPool(
        {
            taskId: crypto.randomUUID(),
            task: 'cropToNonTransparentArea',
            image,
        },
        consume ? [image.data.buffer] : undefined,
    );
    assertTaskResultSuccess(result);
    return result.image;
}

async function imageToPaletteIndexBuffer(
    image: ImageData,
    palette: readonly PixelColor[],
    consume = false,
): Promise<ArrayBuffer> {
    const result = await doTaskInWorkerPool(
        {
            taskId: crypto.randomUUID(),
            task: 'imageToPaletteIndexBuffer',
            image,
            palette,
        },
        consume ? [image.data.buffer] : undefined,
    );
    assertTaskResultSuccess(result);
    return result.buffer;
}

async function writeIndexedPngBuffer(
    image: ImageData,
    palette: readonly PixelColor[],
    consume = false,
): Promise<ArrayBuffer> {
    const result = await doTaskInWorkerPool(
        {
            taskId: crypto.randomUUID(),
            task: 'writeIndexedPngBuffer',
            image,
            palette,
        },
        consume ? [image.data.buffer] : undefined,
    );
    assertTaskResultSuccess(result);
    return result.buffer;
}

async function writeIndexedPngBlob(image: ImageData, palette: readonly PixelColor[], consume = false): Promise<Blob> {
    const result = await doTaskInWorkerPool(
        {
            taskId: crypto.randomUUID(),
            task: 'writeIndexedPngBlob',
            image,
            palette,
        },
        consume ? [image.data.buffer] : undefined,
    );
    assertTaskResultSuccess(result);
    return result.blob;
}

async function loadIndexedImage(
    bitmap: ImageBitmap,
    palette: readonly PixelColor[],
): Promise<{ success: true; image: ImageData } | { success: false }> {
    const result = await doTaskInWorkerPool(
        {
            taskId: crypto.randomUUID(),
            task: 'loadIndexedImage',
            bitmap,
            palette,
        },
        [bitmap],
    );
    assertTaskResultSuccess(result);
    if (result.image) {
        return { success: true, image: result.image };
    } else {
        return { success: false };
    }
}

async function loadIndexedImageWithDiff(
    bitmap: ImageBitmap,
    palette: readonly PixelColor[],
    darkenPercentage: number,
    highlightColorRgba: number,
): Promise<{ success: true; image: ImageData } | { success: false; diff: ImageData }> {
    const result = await doTaskInWorkerPool(
        {
            taskId: crypto.randomUUID(),
            task: 'loadIndexedImageWithDiff',
            bitmap,
            palette,
            darkenPercentage,
            highlightColorRgba,
        },
        [bitmap],
    );
    assertTaskResultSuccess(result);
    if (result.matches) {
        return { success: true, image: result.image };
    } else {
        return { success: false, diff: result.image };
    }
}

// todo
// async function calculateTileColorStats(tileImage: ImageData): Promise<void> {}

export const ImageTools = {
    createThumbnail,
    detectCanvasFingerprintingProtection,
    detemplatizeBlueMarbleTile,
    findTransparentBorder,
    cropToExtent,
    cropToNonTransparentArea,
    imageToPaletteIndexBuffer,
    writeIndexedPngBuffer,
    writeIndexedPngBlob,
    loadIndexedImage,
    loadIndexedImageWithDiff,
};
