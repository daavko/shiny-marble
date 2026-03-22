import { el } from '../../core/dom/html';
import { createDialog } from '../../platform/dialog';

export { default as imagePaletteDiffDialogStyle } from './image-palette-diff-dialog.css';

export function showImagePaletteDiffDialog(image: ImageData): void {
    const canvas = el('canvas', { attributes: { width: image.width, height: image.height } });
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get 2D context for image palette diff dialog');
    }
    ctx.putImageData(image, 0, 0);

    const { dialog } = createDialog(
        'Image Palette Diff',
        { customClass: 'sm-image-palette-diff-dialog', large: true },
        [
            el('p', [
                'Your image has colors that are not in the palette. In the following image, the colors that are not in the palette are highlighted.',
            ]),
            el('p', ['To use this image as a template, you will need to edit it to match the palette.']),
            canvas,
        ],
    );

    document.body.appendChild(dialog);
    dialog.showModal();
}
