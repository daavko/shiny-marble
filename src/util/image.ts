import { assertCanvasCtx } from './canvas';

export function imageBitmapToImageData(bitmap: ImageBitmap, consume = false): ImageData {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    assertCanvasCtx(ctx);
    ctx.drawImage(bitmap, 0, 0);
    if (consume) {
        bitmap.close();
    }
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

export async function imageToBlob(image: ImageData): Promise<Blob> {
    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    assertCanvasCtx(ctx);
    ctx.putImageData(image, 0, 0);
    return canvas.convertToBlob({ type: 'image/png' });
}

export async function computeImageDataHash(image: ImageData): Promise<string> {
    const buffer = image.data.buffer;
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return new Uint8Array(hashBuffer).toHex();
}
