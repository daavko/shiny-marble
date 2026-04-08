export interface BplaceBinaryTile {}

export function parseBinaryTileBlob(blob: ArrayBuffer): BplaceBinaryTile {
    if (blob.byteLength < 2) {
        throw new Error('Invalid tile blob: too small');
    }

    const headerView = new DataView(blob, 0, 2);
    const header = headerView.getUint16(0, true);
    if (header === 0x8b1f) {
        const compressedData = new Uint8Array(blob);
        const decompressedData = decompressTileData(compressedData);
        return parseTileData(decompressedData);
    } else {
        return parseTileData(blob);
    }
}

async function decompressTileData(compressedData: ArrayBuffer): Promise<ArrayBuffer> {
    const blob = new Blob([compressedData], { type: 'application/gzip' });
    const stream = new DecompressionStream('gzip');
    const decompressedStream = blob.stream().pipeThrough(stream);
    return new Response(decompressedStream).arrayBuffer();
}

function parseTileData(tileData: ArrayBuffer): BplaceBinaryTile {
    // todo
}
