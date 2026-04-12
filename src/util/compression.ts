export type CompressionType = 'gzip' | 'deflate';

export async function compressData(data: ArrayBuffer, compressionType: CompressionType): Promise<ArrayBuffer> {
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const compressionStream = new CompressionStream(compressionType);
    const compressedStream = blob.stream().pipeThrough(compressionStream);
    return new Response(compressedStream).arrayBuffer();
}

export async function decompressData(
    compressedData: ArrayBuffer,
    compressionType: CompressionType,
): Promise<ArrayBuffer> {
    const blob = new Blob([compressedData], { type: 'application/octet-stream' });
    const decompressionStream = new DecompressionStream(compressionType);
    const decompressedStream = blob.stream().pipeThrough(decompressionStream);
    return new Response(decompressedStream).arrayBuffer();
}
