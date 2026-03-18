import type { PixelColor } from '../platform/types';
import type { ImageToolsTaskRequest, ImageToolsTaskResult } from './image-tools-types';

function verifyImageMatchesPalette(pixelBuffer: ArrayBuffer, palette: readonly PixelColor[]): boolean {
    const uint32View = new Uint32Array(pixelBuffer);
    for (const pixelValue of uint32View) {
        if ((pixelValue & 0xff000000) === 0) {
            // transparent pixels ignored
            continue;
        }

        if (!palette.some((color) => color.rgba === pixelValue)) {
            return false;
        }
    }

    return true;
}

function highlightNonMatchingPixels(
    pixelBuffer: ArrayBuffer,
    palette: readonly PixelColor[],
    darkenPercentage: number,
    highlightColorRgba: number,
): ArrayBuffer {
    const uint32View = new Uint32Array(pixelBuffer);
    const resultBuffer = new ArrayBuffer(pixelBuffer.byteLength);
    const resultView = new Uint32Array(resultBuffer);

    for (let i = 0; i < uint32View.length; i++) {
        const pixelValue = uint32View[i];
        if ((pixelValue & 0xff000000) === 0) {
            // transparent pixels ignored
            resultView[i] = pixelValue;
            continue;
        }

        if (palette.some((color) => color.rgba === pixelValue)) {
            const r = Math.round(((pixelValue >> 0) & 0xff) * (1 - darkenPercentage));
            const g = Math.round(((pixelValue >> 8) & 0xff) * (1 - darkenPercentage));
            const b = Math.round(((pixelValue >> 16) & 0xff) * (1 - darkenPercentage));
            resultView[i] = (pixelValue & 0xff000000) | (b << 16) | (g << 8) | r;
        } else {
            resultView[i] = highlightColorRgba;
        }
    }

    return resultBuffer;
}

function postTaskResult(data: ImageToolsTaskResult, transfer?: Transferable[]): void {
    globalThis.postMessage(data, { transfer });
}

function handleTaskRequest(request: ImageToolsTaskRequest): void {
    switch (request.task) {
        case 'verifyImageMatchesPalette': {
            const { taskId, pixelBuffer, palette } = request;
            let matches: boolean;
            try {
                matches = verifyImageMatchesPalette(pixelBuffer, palette);
            } catch (error) {
                postTaskResult({ task: 'verifyImageMatchesPalette', taskId, success: false, error });
                return;
            }

            postTaskResult({ task: 'verifyImageMatchesPalette', taskId, success: true, pixelBuffer, matches }, [
                pixelBuffer,
            ]);
            break;
        }
        case 'highlightNonMatchingPixels': {
            const { taskId, pixelBuffer, palette, darkenPercentage, highlightColorRgba } = request;
            let resultBuffer: ArrayBuffer;
            try {
                resultBuffer = highlightNonMatchingPixels(pixelBuffer, palette, darkenPercentage, highlightColorRgba);
            } catch (error) {
                postTaskResult({ task: 'highlightNonMatchingPixels', taskId, success: false, error });
                return;
            }

            postTaskResult({ task: 'highlightNonMatchingPixels', taskId, success: true, pixelBuffer: resultBuffer }, [
                resultBuffer,
            ]);
        }
    }
}

globalThis.addEventListener('message', (event: MessageEvent<ImageToolsTaskRequest>) => handleTaskRequest(event.data));
