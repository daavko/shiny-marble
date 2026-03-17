import type { PixelColor } from '../platform/types';
import type {
    HighlightNonMatchingPixelsTaskRequest,
    ImageToolsTaskResult,
    VerifyImageMatchesPaletteTaskRequest,
} from './image-tools-types';

let workerInstance: Worker | null = null;

function getWorker(): Worker {
    workerInstance ??= new Worker(new URL('./image-tools.worker.ts', import.meta.url));
    return workerInstance;
}

export interface ImageMatchesPaletteResult {
    image: ImageData;
    matches: boolean;
}

export async function verifyImageMatchesPalette(
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

export async function highlightNonMatchingPixels(
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
