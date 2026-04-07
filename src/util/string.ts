export function randomHexString(length: number): string {
    const bytes = new Uint8Array(length / 2);
    crypto.getRandomValues(bytes);
    return bytes.toHex().slice(0, length);
}

export function createRandomElementId(): string {
    return `sm-${crypto.randomUUID()}`;
}
