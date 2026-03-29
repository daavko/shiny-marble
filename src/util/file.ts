import { el } from '../core/dom/html';

export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = el('a', { attributes: { href: url, download: filename } });
    a.click();
    URL.revokeObjectURL(url);
}
