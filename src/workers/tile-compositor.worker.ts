import type { PixelDimensions } from '../util/geometry';
import type { RenderTileCompositingRequest, RenderTileCompositingResult, TemplateTile } from './tile-compositor-types';

function composeTile(
    { width, height }: PixelDimensions,
    templateTiles: TemplateTile[],
    transparentColorIndex: number,
): ArrayBuffer {
    const tileData = new Uint8Array(width * height);
    tileData.fill(transparentColorIndex);

    for (const { rect, data } of templateTiles) {
        const view = new Uint8Array(data);
        for (let y = 0; y < rect.height; y++) {
            const destY = rect.y + y;
            if (destY >= height) {
                continue;
            }

            for (let x = 0; x < rect.width; x++) {
                const destX = rect.x + x;
                if (destX >= width) {
                    continue;
                }

                const destIndex = destY * width + destX;
                const srcIndex = y * rect.width + x;
                tileData[destIndex] = view[srcIndex];
            }
        }
    }

    return tileData.buffer;
}

globalThis.addEventListener('message', ({ data: request }: MessageEvent<RenderTileCompositingRequest>) => {
    const { id, tileId, dimensions, templateTiles, transparentColorIndex } = request;
    try {
        const composedTileData = composeTile(dimensions, templateTiles, transparentColorIndex);
        globalThis.postMessage(
            { success: true, id, tileId, data: composedTileData } satisfies RenderTileCompositingResult,
            {
                transfer: [composedTileData],
            },
        );
    } catch (error) {
        globalThis.postMessage({ id, tileId, success: false, error } satisfies RenderTileCompositingResult);
    }
});

export default WORKER_FAKE_EXPORT;
