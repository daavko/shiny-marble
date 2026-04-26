import { decompressData } from '../../util/compression';
import { BplacePlatform } from './platform';

export interface BplaceBinaryTile {
    image: ImageData;
    playerShortIds: Uint32Array;
}

export async function parseBinaryTileBlob(blob: ArrayBuffer): Promise<BplaceBinaryTile> {
    if (blob.byteLength < 2) {
        throw new Error('Invalid tile blob: too small');
    }

    const headerView = new DataView(blob, 0, 2);
    const header = headerView.getUint16(0, true);
    if (header === 0x8b1f) {
        const decompressedData = await decompressData(blob, 'gzip');
        return parseTileData(decompressedData);
    } else {
        return parseTileData(blob);
    }
}

function parseTileData(tileData: ArrayBuffer): BplaceBinaryTile {
    const pixelsPerTile = BplacePlatform.tilePixelDimensions.width * BplacePlatform.tilePixelDimensions.height;
    let dataView: DataView;
    let bytesPerPixel: number;
    if (tileData.byteLength === pixelsPerTile * 5) {
        dataView = new DataView(tileData);
        bytesPerPixel = 5;
    } else if (tileData.byteLength === pixelsPerTile * 9) {
        dataView = new DataView(tileData);
        bytesPerPixel = 9;
    } else if (tileData.byteLength > pixelsPerTile * 10) {
        const fullDataView = new DataView(tileData);
        const jsonLength = fullDataView.getUint32(0, true);
        dataView = new DataView(tileData, jsonLength + 4);
        bytesPerPixel = 10;
    } else {
        throw new Error("Can't determine version of binary tile");
    }

    // transparent gets sorted as the first color, most likely for best compression
    const sortedColors = BplacePlatform.colors.toSorted((a, b) => {
        if (a.rgba === 0) {
            return -1;
        } else if (b.rgba === 0) {
            return 1;
        } else {
            return 0;
        }
    });
    const colorBuffer = new Uint32Array(pixelsPerTile);
    const playerShortIds = new Uint32Array(pixelsPerTile);
    for (let i = 0; i < pixelsPerTile; i++) {
        const colorIndex = dataView.getUint8(i * bytesPerPixel);
        const playerShortId = dataView.getUint32(i * bytesPerPixel + 1, true);
        const color = sortedColors.at(colorIndex);
        if (!color) {
            throw new Error(`Invalid color index ${colorIndex} at pixel ${i}`);
        }
        colorBuffer[i] = color.rgba;
        playerShortIds[i] = playerShortId;
    }

    const imageBuffer = new Uint8ClampedArray(colorBuffer.buffer);
    const image = new ImageData(
        imageBuffer,
        BplacePlatform.tilePixelDimensions.width,
        BplacePlatform.tilePixelDimensions.height,
    );

    return { image, playerShortIds };
}
