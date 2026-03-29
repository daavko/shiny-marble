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
            const r = Math.round((pixelValue & 0xff) * (1 - darkenPercentage));
            const g = Math.round(((pixelValue >> 8) & 0xff) * (1 - darkenPercentage));
            const b = Math.round(((pixelValue >> 16) & 0xff) * (1 - darkenPercentage));
            resultView[i] = (pixelValue & 0xff000000) | (b << 16) | (g << 8) | r;
        } else {
            resultView[i] = highlightColorRgba;
        }
    }

    return resultBuffer;
}

const FINGERPRINT_CANVAS_SIZE = 1000;

function detectCanvasFingerprintingProtection(): boolean {
    const canvas = new OffscreenCanvas(FINGERPRINT_CANVAS_SIZE, FINGERPRINT_CANVAS_SIZE);
    const ctx = canvas.getContext('2d');
    if (ctx == null) {
        throw new Error('Failed to obtain 2D context for OffscreenCanvas');
    }

    const writtenImage = new ImageData(FINGERPRINT_CANVAS_SIZE, FINGERPRINT_CANVAS_SIZE);
    const writtenImageInt32View = new Uint32Array(writtenImage.data.buffer);
    for (let i = 0; i < writtenImageInt32View.length; i++) {
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        writtenImageInt32View[i] = (255 << 24) | (b << 16) | (g << 8) | r;
    }
    ctx.putImageData(writtenImage, 0, 0);
    const readImage = ctx.getImageData(0, 0, FINGERPRINT_CANVAS_SIZE, FINGERPRINT_CANVAS_SIZE);

    for (let i = 0; i < readImage.data.length; i++) {
        if (readImage.data[i] !== writtenImage.data[i]) {
            return true;
        }
    }

    return false;
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
            break;
        }
        case 'detectCanvasFingerprintingProtection': {
            const { taskId } = request;
            let protectionDetected: boolean;
            try {
                protectionDetected = detectCanvasFingerprintingProtection();
            } catch (error) {
                postTaskResult({ task: 'detectCanvasFingerprintingProtection', taskId, success: false, error });
                return;
            }

            postTaskResult({ task: 'detectCanvasFingerprintingProtection', taskId, success: true, protectionDetected });
            break;
        }
    }
}

globalThis.addEventListener('message', (event: MessageEvent<ImageToolsTaskRequest>) => handleTaskRequest(event.data));

export default WORKER_FAKE_EXPORT;
