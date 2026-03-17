import type { PixelColor } from '../platform/types';
import type { VerifyImageMatchesPaletteTaskSuccessResult } from './image-tools-types';

let workerInstance: Worker | null = null;

function getWorker(): Worker {
    workerInstance ??= new Worker(new URL('./image-tools.worker.ts', import.meta.url));
    return workerInstance;
}

export async function verifyImageMatchesPalette(
    image: ImageData,
    palette: PixelColor[],
): Promise<Omit<VerifyImageMatchesPaletteTaskSuccessResult, 'success'>> {
    // todo: send task to worker (using move semantics for the image so we don't consume memory for no reason), wait for response
}
