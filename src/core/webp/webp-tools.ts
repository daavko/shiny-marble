import { WEBP_CHUNK_NAME_DECODER } from './common';

export async function isLosslessWebpFile(file: Blob): Promise<boolean> {
    if (file.size < 30) {
        return false;
    }

    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const riffHeader = WEBP_CHUNK_NAME_DECODER.decode(header.slice(0, 4));
    const webpHeader = WEBP_CHUNK_NAME_DECODER.decode(header.slice(8, 12));
    const vp8lHeader = WEBP_CHUNK_NAME_DECODER.decode(header.slice(12, 16));
    return riffHeader === 'RIFF' && webpHeader === 'WEBP' && vp8lHeader === 'VP8L';
}

export async function getLosslessWebpImageSize(file: Blob): Promise<{ width: number; height: number }> {
    const vp8lChunkBitstream = new Uint8Array(await file.slice(21, 25).arrayBuffer());
    const dataView = new DataView(vp8lChunkBitstream.buffer);

    const bitstream = dataView.getUint32(0, true);
    const width = (bitstream & 0x3fff) + 1;
    const height = ((bitstream >> 14) & 0x3fff) + 1;

    return { width, height };
}
