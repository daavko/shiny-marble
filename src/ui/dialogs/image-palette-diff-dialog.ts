import { mdiChevronLeft } from '@mdi/js';
import { el } from '../../core/dom/html';
import { createDialog } from '../../platform/dialog';
import { downloadBlob } from '../../util/file';
import { renderBlockButtonWithIcon } from '../button';
import { showNewTemplateDialog } from './new-template-dialog';

export { default as imagePaletteDiffDialogStyle } from './image-palette-diff-dialog.css';

export function showImagePaletteDiffDialog(image: ImageData): void {
    const canvas = el('canvas', {
        class: 'sm-image-palette-diff-dialog__canvas',
        attributes: { width: image.width, height: image.height },
    });
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get 2D context for image palette diff dialog');
    }
    ctx.putImageData(image, 0, 0);

    function handleSaveClick(): void {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    downloadBlob(blob, 'image-palette-diff.png');
                } else {
                    alert('Failed to generate image blob');
                }
            },
            'image/png',
            1,
        );
    }

    const { dialog } = createDialog(
        'Image Palette Diff',
        { customClass: 'sm-image-palette-diff-dialog', large: true },
        [
            el('p', [
                'Your image has colors that are not in the canvas palette. In the following image, colors that are not in the palette are highlighted in red.',
            ]),
            el('p', ['To use this image as a template, you will need to edit it to match the palette.']),
            canvas,
            el('div', { class: 'sm-image-palette-diff-dialog__buttons' }, [
                renderBlockButtonWithIcon('Back to New Template dialog', mdiChevronLeft, 'left', () => {
                    dialog.close();
                    showNewTemplateDialog();
                }),
                // el(
                //     'button',
                //     {
                //         class: 'sm-platform__block-btn',
                //         events: {
                //             click: () => {
                //                 dialog.close();
                //                 showNewTemplateDialog();
                //             },
                //         },
                //     },
                //     [renderMdiIcon(mdiChevronLeft), 'Back to New Template dialog'],
                // ),
                el(
                    'button',
                    {
                        class: 'sm-platform__block-btn',
                        events: { click: () => handleSaveClick() },
                    },
                    ['Save highlighted image'],
                ),
            ]),
        ],
    );

    document.body.appendChild(dialog);
    dialog.showModal();
}
