import { el } from '../../core/dom/html';
import { createDialog } from '../../platform/dialog';
import { Platform } from '../../platform/platform';
import { ImageTools } from '../../workers/image-tools-dispatcher';

export { default as newTemplateDialogStyle } from './new-template-dialog.css';

export function showNewTemplateDialog(): void {
    const fileInput = el('input', {
        attributes: { type: 'file', accept: 'image/*' },
        events: {
            change: () => {
                const files = fileInput.files;
                if (files == null || files.length === 0) {
                    return;
                }

                void handleFileSelected(files[0]);
            },
        },
    });

    const dropArea = el(
        'section',
        {
            class: 'new-template__drop-area',
            attributes: {
                tabindex: -1,
            },
            events: {
                dragenter: () => dropArea.classList.add('drag-over'),
                dragleave: () => dropArea.classList.remove('drag-over'),
                dragend: () => dropArea.classList.remove('drag-over'),
                drop: (e) => {
                    const data = e.dataTransfer;
                    if (data == null) {
                        return;
                    }

                    const files = data.files;
                    if (files.length === 0) {
                        return;
                    }

                    e.preventDefault();
                    dropArea.classList.remove('drag-over');

                    void handleFileSelected(files[0]);
                },
            },
        },
        [
            el('p', ['Drop or paste your template file here.']),
            el('button', { class: 'sm-platform__block-btn' }, ['Select a file']),
        ],
    );

    const { dialog, close: closeDialog } = createDialog(
        'New Template',
        { customClass: 'sm-new-template-dialog', large: true },
        [dropArea],
    );

    document.body.appendChild(dialog);
    dialog.showModal();

    dropArea.focus();

    async function handleFileSelected(file: File): Promise<void> {
        if (!file.type.startsWith('image/')) {
            return;
        }

        try {
            const imageBitmap = await createImageBitmap(file);
            // todo: valudate dimensions?
            const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
            const ctx = canvas.getContext('2d');
            if (ctx == null) {
                // todo: maybe handle this a bit better than by throwing an immediately caught error
                throw new Error('Could not create canvas context');
            }
            ctx.drawImage(imageBitmap, 0, 0);
            imageBitmap.close();
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const { matches, image } = await ImageTools.verifyImageMatchesPalette(imageData, Platform.colors);

            if (matches) {
                // todo: add template to active templates
            } else {
                const diff = await ImageTools.highlightNonMatchingPixels(image, Platform.colors, 0.5, 0xffff0000);
                // todo: show diff
            }
        } catch (e) {
            // show error
        }

        closeDialog();
    }
}
