import * as v from 'valibot';
import { originalFetch } from '../../../core/fetch';
import type { MapTileCoordinates } from '../../../util/geometry';
import { type BplaceBinaryTile, parseBinaryTileBlob } from './tile-parser';

const bplaceTileNotFoundResponse = v.object({
    statusCode: v.literal('404'),
});

async function resolveNotOkResponse(response: Response): Promise<null> {
    if (response.status === 400) {
        try {
            const errorData: unknown = await response.json();
            const parseResult = v.safeParse(bplaceTileNotFoundResponse, errorData);
            if (parseResult.success) {
                return null;
            }
        } catch {
            throw new Error(`Failed to parse error response for tile image: ${response.status} ${response.statusText}`);
        }
    }
    throw new Error(`Failed to fetch tile image: ${response.status} ${response.statusText}`);
}

export async function fetchSingleTileImage(
    tileCoords: MapTileCoordinates,
    lastRenderedAt: Date,
): Promise<ImageBitmap | null> {
    // https://tiles.bplace.art/tile-images/X_Y.png?v=RENDER_DATE
    // returns a 400 with a json error if the tile doesn't exist
    const url = new URL(`https://tiles.bplace.art/tile-images/${tileCoords.x}_${tileCoords.y}.png`);
    url.searchParams.set('render_date', lastRenderedAt.toISOString().replace('Z', '+00:00'));
    const response = await originalFetch(url);
    if (!response.ok) {
        return await resolveNotOkResponse(response);
    }

    const blob = await response.blob();
    return await createImageBitmap(blob);
}

export async function fetchSingleTileBin(
    tileCoords: MapTileCoordinates,
    lastRenderedAt: Date,
): Promise<BplaceBinaryTile | null> {
    // https://tiles.bplace.art/tile-data/X_Y.bin?v=RENDER_DATE
    // returns a 400 with a json error if the tile doesn't exist
    const url = new URL(`https://tiles.bplace.art/tile-data/${tileCoords.x}_${tileCoords.y}.bin`);
    url.searchParams.set('render_date', lastRenderedAt.toISOString().replace('Z', '+00:00'));
    const response = await originalFetch(url);
    if (!response.ok) {
        return await resolveNotOkResponse(response);
    }

    const arrayBuffer = await response.arrayBuffer();
    return parseBinaryTileBlob(arrayBuffer);
}
