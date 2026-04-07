import { assertCanvasCtx } from '../../util/canvas';
import type { Point } from '../../util/geometry';
import { MAX_CANVAS_DIMENSION } from '../const';
import type { BaseTemplateParseResult } from './types';

export async function handleBlobFromParsedTemplate(
    imageBlob: Blob,
    name: string,
    position: Point,
    expectedWidth: number,
    expectedHeight: number,
): Promise<BaseTemplateParseResult> {
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(imageBlob);
    } catch (e) {
        return { success: false, errorCode: 'invalidImageData', cause: e };
    }

    if (bitmap.width !== expectedWidth || bitmap.height !== expectedHeight) {
        return { success: false, errorCode: 'noResizedImages' };
    }

    if (bitmap.width > MAX_CANVAS_DIMENSION || bitmap.height > MAX_CANVAS_DIMENSION) {
        return { success: false, errorCode: 'imageTooLarge' };
    }

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    assertCanvasCtx(ctx, 'Could not get 2D context from canvas');
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    bitmap.close();

    return {
        success: true,
        name,
        position,
        image: imageData,
    };
}
