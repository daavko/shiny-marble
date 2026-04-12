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
    const pixelsPerTile = BplacePlatform.tileDimensions.width * BplacePlatform.tileDimensions.height;
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

    const colorBuffer = new Uint32Array(pixelsPerTile);
    const playerShortIds = new Uint32Array(pixelsPerTile);
    for (let i = 0; i < pixelsPerTile; i++) {
        const colorIndex = dataView.getUint8(i * bytesPerPixel);
        const playerShortId = dataView.getUint32(i * bytesPerPixel + 1, true);
        const color = BplacePlatform.colors.at(colorIndex);
        if (!color) {
            throw new Error(`Invalid color index ${colorIndex} at pixel ${i}`);
        }
        colorBuffer[i] = color.rgba;
        playerShortIds[i] = playerShortId;
    }

    const imageBuffer = new Uint8ClampedArray(colorBuffer.buffer);
    const image = new ImageData(imageBuffer, BplacePlatform.tileDimensions.width, BplacePlatform.tileDimensions.height);

    return { image, playerShortIds };
}
