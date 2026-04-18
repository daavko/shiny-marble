import { PNG_CHUNK_NAME_DECODER, PNG_SIGNATURE } from './common';

export async function isPngFile(file: Blob): Promise<boolean> {
    if (file.size < 67) {
        return false;
    }

    const fileStart = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const dataView = new DataView(fileStart.buffer);
    const fileHeader = fileStart.slice(0, 8);
    const headerChunkLength = dataView.getUint32(8);
    const headerChunkType = PNG_CHUNK_NAME_DECODER.decode(fileStart.slice(12, 16));
    return (
        fileHeader.every((byte, index) => byte === PNG_SIGNATURE[index]) &&
        headerChunkLength === 13 &&
        headerChunkType === 'IHDR'
    );
}

export async function getPngImageSize(file: Blob): Promise<{ width: number; height: number }> {
    const ihdrChunk = new Uint8Array(await file.slice(16, 24).arrayBuffer());
    const dataView = new DataView(ihdrChunk.buffer);

    const width = dataView.getUint32(0);
    const height = dataView.getUint32(4);

    return { width, height };
}
