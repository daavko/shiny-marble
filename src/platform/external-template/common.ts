import { MAX_TEMPLATE_CANVAS_DIMENSION } from '../../core/const';
import type { BaseTemplateParseResult } from './types';
import { imageBitmapToImageData } from '../../util/image';
import type { PixelCoordinates } from '../../util/geometry-basic';

export async function handleBlobFromParsedTemplate(
    imageBlob: Blob,
    name: string,
    position: PixelCoordinates,
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

    if (bitmap.width > MAX_TEMPLATE_CANVAS_DIMENSION || bitmap.height > MAX_TEMPLATE_CANVAS_DIMENSION) {
        return { success: false, errorCode: 'imageTooLarge' };
    }

    const imageData = imageBitmapToImageData(bitmap, true);

    return {
        success: true,
        name,
        position,
        image: imageData,
    };
}
