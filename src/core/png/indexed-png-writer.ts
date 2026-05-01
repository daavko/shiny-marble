import { createPixelColorIndexLut, simpleNamedColorToPixelColor } from '../../util/color';
import { compressData } from '../../util/compression';
import { PNG_CHUNK_NAME_ENCODER, PNG_SIGNATURE } from './common';
import type { PixelColor } from '../types';

let CRC_TABLE: Uint32Array | null = null;

function makeCRCTable(): Uint32Array {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            if ((c & 1) !== 0) {
                c = 0xedb88320 ^ (c >>> 1);
            } else {
                c = c >>> 1;
            }
        }
        table[n] = c;
    }
    return table;
}

function getCRCTable(): Uint32Array {
    CRC_TABLE ??= makeCRCTable();
    return CRC_TABLE;
}

function computeChunkCrc(chunkType: Uint8Array, chunkData: Uint8Array): number {
    const table = getCRCTable();
    let crc = 0xffffffff;
    for (const byte of chunkType) {
        crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
    }
    for (const byte of chunkData) {
        crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
    }
    return ~crc >>> 0;
}

function ensureTransparentColorInPalette(palette: readonly PixelColor[]): readonly PixelColor[] {
    const transparentIndex = palette.findIndex(({ rgba }) => rgba === 0);
    if (transparentIndex === -1) {
        // ensure the palette has a fully transparent color *somewhere* in it
        const transparentColor = simpleNamedColorToPixelColor('', 0);
        return [transparentColor, ...palette];
    }
    return palette;
}

function chunkNameToBytes(name: string): Uint8Array {
    return PNG_CHUNK_NAME_ENCODER.encode(name);
}

interface PngChunk {
    length: number;
    type: string;
    data: Uint8Array;
}

function createHeaderChunk(width: number, height: number): PngChunk {
    const data = new Uint8Array(13);
    const view = new DataView(data.buffer);
    view.setUint32(0, width);
    view.setUint32(4, height);
    view.setUint8(8, 8); // bit depth
    view.setUint8(9, 3); // color type (indexed color)
    view.setUint8(10, 0); // compression method
    view.setUint8(11, 0); // filter method
    view.setUint8(12, 0); // interlace method

    return { length: data.length, type: 'IHDR', data };
}

function createPaletteChunk(palette: readonly PixelColor[]): PngChunk {
    const data = new Uint8Array(palette.flatMap(({ red, green, blue }) => [red, green, blue]));
    return { length: data.length, type: 'PLTE', data };
}

function createTransparencyChunk(palette: readonly PixelColor[]): PngChunk | null {
    const colorsWithAlpha = palette.filter(({ alpha }) => alpha < 255);

    if (colorsWithAlpha.length === 0) {
        return null;
    }

    const data = new Uint8Array(colorsWithAlpha.map(({ alpha }) => alpha));
    return { length: data.length, type: 'tRNS', data };
}

function createSrgbChunk(): PngChunk {
    const data = new Uint8Array([1]); // rendering intent: relative colorimetric
    return { length: data.length, type: 'sRGB', data };
}

function createGammaChunk(): PngChunk {
    const data = new Uint8Array(4);
    const view = new DataView(data.buffer);
    // value from https://www.w3.org/TR/png/#sRGB-gAMA-cHRM
    view.setUint32(0, 45455); // sRGB gamma
    return { length: data.length, type: 'gAMA', data };
}

function createChromaChunk(): PngChunk {
    const data = new Uint8Array(32);
    const view = new DataView(data.buffer);
    // values from https://www.w3.org/TR/png/#sRGB-gAMA-cHRM
    view.setUint32(0, 31270); // white point x
    view.setUint32(4, 32900); // white point y
    view.setUint32(8, 64000); // red x
    view.setUint32(12, 33000); // red y
    view.setUint32(16, 30000); // green x
    view.setUint32(20, 60000); // green y
    view.setUint32(24, 15000); // blue x
    view.setUint32(28, 6000); // blue y
    return { length: data.length, type: 'cHRM', data };
}

async function createImageDataChunk(
    imageData: ImageData,
    palette: readonly PixelColor[],
): Promise<{ chunk: PngChunk; usedColors: readonly PixelColor[] }> {
    const colorUseCounts = palette.map(() => 0);
    const imageUint32 = new Uint32Array(imageData.data.buffer);
    const allColorsLut: Record<number, number | undefined> = createPixelColorIndexLut(palette);

    for (const rgba of imageUint32) {
        const colorIndex = allColorsLut[rgba];
        if (colorIndex == null) {
            throw new Error(`Color ${rgba.toString(16)} not found in palette`);
        }
        colorUseCounts[colorIndex]++;
    }

    // colors ordered by alpha so colors with alpha < 255 are at the start, allowing us to omit a large part of the palette in the tRNS chunk
    const usedColors: PixelColor[] = palette
        .filter((_, index) => colorUseCounts[index] > 0)
        .sort((a, b) => a.alpha - b.alpha);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    const usedColorsLut = createPixelColorIndexLut(usedColors) as Record<number, number>;
    const scanlinesBuffer = new Uint8Array((imageData.width + 1) * imageData.height);
    for (let y = 0; y < imageData.height; y++) {
        const scanlineOffset = y * (imageData.width + 1);
        scanlinesBuffer[scanlineOffset] = 0; // no filter
        for (let x = 0; x < imageData.width; x++) {
            const rgba = imageUint32[y * imageData.width + x];
            scanlinesBuffer[scanlineOffset + 1 + x] = usedColorsLut[rgba];
        }
    }

    const compressedData = await compressData(scanlinesBuffer.buffer, 'deflate');
    return {
        chunk: { length: compressedData.byteLength, type: 'IDAT', data: new Uint8Array(compressedData) },
        usedColors,
    };
}

function createEndChunk(): PngChunk {
    return { length: 0, type: 'IEND', data: new Uint8Array() };
}

function calculateFileSize(chunks: PngChunk[]): number {
    return PNG_SIGNATURE.length + chunks.reduce((size, chunk) => size + 12 + chunk.length, 0);
}

function writeChunk(imageBuffer: Uint8Array, imageBufferView: DataView, offset: number, chunk: PngChunk): number {
    const chunkTypeBytes = chunkNameToBytes(chunk.type);
    const crc = computeChunkCrc(chunkTypeBytes, chunk.data);
    imageBufferView.setUint32(offset, chunk.length);
    offset += 4;
    imageBuffer.set(chunkTypeBytes, offset);
    offset += 4;
    imageBuffer.set(chunk.data, offset);
    offset += chunk.length;
    imageBufferView.setUint32(offset, crc);
    offset += 4;
    return offset;
}

export async function encodeIndexedPngData(imageData: ImageData, palette: readonly PixelColor[]): Promise<ArrayBuffer> {
    palette = ensureTransparentColorInPalette(palette);

    const { chunk: imageDataChunk, usedColors } = await createImageDataChunk(imageData, palette);

    const chunks = [
        createHeaderChunk(imageData.width, imageData.height),
        createSrgbChunk(),
        createGammaChunk(),
        createChromaChunk(),
        createPaletteChunk(usedColors),
        createTransparencyChunk(usedColors),
        imageDataChunk,
        createEndChunk(),
    ].filter((chunk) => chunk !== null);

    const fileSize = calculateFileSize(chunks);
    const buffer = new ArrayBuffer(fileSize);
    const bufferArray = new Uint8Array(buffer);
    const view = new DataView(bufferArray.buffer);

    bufferArray.set(PNG_SIGNATURE, 0);
    let offset = PNG_SIGNATURE.length;
    for (const chunk of chunks) {
        offset = writeChunk(bufferArray, view, offset, chunk);
    }

    return buffer;
}

export async function encodeIndexedPngBlob(imageData: ImageData, palette: readonly PixelColor[]): Promise<Blob> {
    const pngData = await encodeIndexedPngData(imageData, palette);
    return new Blob([pngData], { type: 'image/png' });
}
