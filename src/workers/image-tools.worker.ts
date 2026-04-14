import type { PixelColor } from '../platform/types';
import type { FindTransparentBorderResult, ImageToolsTaskRequest, ImageToolsTaskResult } from './image-tools-types';
import { pixelExtent } from '../util/geometry';

function verifyImageMatchesPalette(image: ImageData, palette: readonly PixelColor[]): boolean {
    const uint32View = new Uint32Array(image.data.buffer);
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
    image: ImageData,
    palette: readonly PixelColor[],
    darkenPercentage: number,
    highlightColorRgba: number,
): ImageData {
    const uint32View = new Uint32Array(image.data.buffer);
    const result = new ImageData(image.width, image.height);
    const resultView = new Uint32Array(result.data.buffer);

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

    return result;
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

function detemplatizeBlueMarbleTile(image: ImageData): ImageData {
    const { width, height } = image;
    if (width % 3 !== 0 || height % 3 !== 0) {
        throw new Error('Input dimensions must be multiples of 3 for detemplatizeBlueMarbleTile');
    }

    const srcView = new Uint32Array(image.data.buffer);
    const destWidth = width / 3;
    const destHeight = height / 3;
    const dest = new ImageData(destWidth, destHeight);
    const destView = new Uint32Array(dest.data.buffer);

    for (let y = 0; y < destHeight; y++) {
        const srcRowStart = (y * 3 + 1) * width;
        const destRowStart = y * destWidth;
        for (let x = 0; x < destWidth; x++) {
            const srcIndex = srcRowStart + (x * 3 + 1);
            const destIndex = destRowStart + x;
            destView[destIndex] = srcView[srcIndex];
        }
    }

    return dest;
}

function findTransparentBorder(image: ImageData): FindTransparentBorderResult {
    const { width, height } = image;
    const uint32View = new Uint32Array(image.data.buffer);

    // optimized for the case where either there's no border or there is a thin border
    // fully transparent image will be worst case but still with a single pass, which is fine

    let minY = 0;
    outerLoop: while (minY < height) {
        const rowStart = minY * width;
        for (let x = 0; x < width; x++) {
            const pixelValue = uint32View[rowStart + x];
            if (pixelValue > 0) {
                break outerLoop;
            }
        }

        minY++;
    }

    if (minY === height) {
        return 'fullyTransparent';
    }

    let maxY = height - 1;
    outerLoop: while (maxY >= 0) {
        const rowStart = maxY * width;
        for (let x = 0; x < width; x++) {
            const pixelValue = uint32View[rowStart + x];
            if (pixelValue > 0) {
                break outerLoop;
            }
        }

        maxY--;
    }

    let minX = 0;
    outerLoop: while (minX < width) {
        for (let y = minY; y <= maxY; y++) {
            const pixelValue = uint32View[y * width + minX];
            if (pixelValue > 0) {
                break outerLoop;
            }
        }

        minX++;
    }

    let maxX = width - 1;
    outerLoop: while (maxX >= 0) {
        for (let y = minY; y <= maxY; y++) {
            const pixelValue = uint32View[y * width + maxX];
            if (pixelValue > 0) {
                break outerLoop;
            }
        }

        maxX--;
    }

    if (minX === 0 && maxX === width - 1 && minY === 0 && maxY === height - 1) {
        return 'noTransparentBorder';
    }

    return pixelExtent({ minX, minY, maxX, maxY });
}

function imageToPaletteIndexBuffer(image: ImageData, palette: readonly PixelColor[]): Uint8Array<ArrayBuffer> {
    const uint32View = new Uint32Array(image.data.buffer);
    const buffer = new Uint8Array(image.width * image.height);

    for (let i = 0; i < uint32View.length; i++) {
        const pixelValue = uint32View[i];

        const paletteIndex = palette.findIndex((color) => color.rgba === pixelValue);
        if (paletteIndex === -1) {
            throw new Error(`Pixel value ${pixelValue} at index ${i} not found in palette`);
        }

        buffer[i] = paletteIndex;
    }

    return buffer;
}

function postTaskResult(data: ImageToolsTaskResult, transfer?: Transferable[]): void {
    globalThis.postMessage(data, { transfer });
}

function handleTaskRequest(request: ImageToolsTaskRequest): void {
    switch (request.task) {
        case 'verifyImageMatchesPalette': {
            const { taskId, image, palette } = request;
            try {
                const matches = verifyImageMatchesPalette(image, palette);
                postTaskResult({ task: 'verifyImageMatchesPalette', taskId, success: true, matches });
            } catch (error) {
                postTaskResult({ task: 'verifyImageMatchesPalette', taskId, success: false, error });
                return;
            }

            break;
        }
        case 'highlightNonMatchingPixels': {
            const { taskId, image, palette, darkenPercentage, highlightColorRgba } = request;
            try {
                const resultImage = highlightNonMatchingPixels(image, palette, darkenPercentage, highlightColorRgba);
                postTaskResult({ task: 'highlightNonMatchingPixels', taskId, success: true, image: resultImage }, [
                    resultImage.data.buffer,
                ]);
            } catch (error) {
                postTaskResult({ task: 'highlightNonMatchingPixels', taskId, success: false, error });
                return;
            }

            break;
        }
        case 'detectCanvasFingerprintingProtection': {
            const { taskId } = request;
            try {
                const protectionDetected = detectCanvasFingerprintingProtection();
                postTaskResult({
                    task: 'detectCanvasFingerprintingProtection',
                    taskId,
                    success: true,
                    protectionDetected,
                });
            } catch (error) {
                postTaskResult({ task: 'detectCanvasFingerprintingProtection', taskId, success: false, error });
                return;
            }

            break;
        }
        case 'detemplatizeBlueMarbleTile': {
            const { taskId, image } = request;
            try {
                const resultImage = detemplatizeBlueMarbleTile(image);
                postTaskResult(
                    {
                        task: 'detemplatizeBlueMarbleTile',
                        taskId,
                        success: true,
                        image: resultImage,
                    },
                    [resultImage.data.buffer],
                );
            } catch (error) {
                postTaskResult({ task: 'detemplatizeBlueMarbleTile', taskId, success: false, error });
                return;
            }

            break;
        }
        case 'findTransparentBorder': {
            const { taskId, image } = request;
            try {
                const border = findTransparentBorder(image);
                postTaskResult({
                    task: 'findTransparentBorder',
                    taskId,
                    success: true,
                    border,
                });
            } catch (error) {
                postTaskResult({ task: 'findTransparentBorder', taskId, success: false, error });
                return;
            }

            break;
        }
        case 'imageToPaletteIndexBuffer': {
            const { taskId, image, palette } = request;
            try {
                const buffer = imageToPaletteIndexBuffer(image, palette);
                postTaskResult(
                    {
                        task: 'imageToPaletteIndexBuffer',
                        taskId,
                        success: true,
                        buffer,
                    },
                    [buffer.buffer],
                );
            } catch (error) {
                postTaskResult({ task: 'imageToPaletteIndexBuffer', taskId, success: false, error });
                return;
            }

            break;
        }
    }
}

globalThis.addEventListener('message', (event: MessageEvent<ImageToolsTaskRequest>) => handleTaskRequest(event.data));

export default WORKER_FAKE_EXPORT;
