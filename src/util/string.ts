export function randomHexString(length: number): string {
    const bytes = new Uint8Array(length / 2);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, length);
}

export function createRandomElementId(): string {
    return `dpus-${crypto.randomUUID()}`;
}
