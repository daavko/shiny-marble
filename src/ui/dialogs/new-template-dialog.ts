import { MAX_CANVAS_DIMENSION } from '../../core/const';
import { debug, debugDetailed } from '../../core/debug';
import { el } from '../../core/dom/html';
import { createDialog } from '../../platform/dialog';
import { Platform } from '../../platform/platform';
import { assertCanvasCtx } from '../../util/canvas';
import { ImageTools } from '../../workers/image-tools-dispatcher';
import { showImagePaletteDiffDialog } from './image-palette-diff-dialog';

export { default as newTemplateDialogStyle } from './new-template-dialog.css';

export function showNewTemplateDialog(): void {
    function handleFileChange(): void {
        const files = fileInput.files;
        if (files == null || files.length === 0) {
            return;
        }

        void handleFileSelected(files[0]);
    }

    function handleDrop(e: DragEvent): void {
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
    }

    function addError(message: string): void {
        const errorMessage = el('p', [message]);
        errorContainer.appendChild(errorMessage);
    }

    function clearErrors(): void {
        errorContainer.innerHTML = '';
    }

    async function handleFileSelected(file: File): Promise<void> {
        if (!file.type.startsWith('image/')) {
            return;
        }

        clearErrors();

        let imageBitmap: ImageBitmap;
        try {
            imageBitmap = await createImageBitmap(file);
        } catch (e) {
            addError('Failed to read the image file. Please make sure the file is a valid image and try again.');
            debugDetailed('Error creating ImageBitmap from file', e);
            return;
        }

        if (imageBitmap.width > MAX_CANVAS_DIMENSION || imageBitmap.height > MAX_CANVAS_DIMENSION) {
            addError(
                `The image is too large. Maximum allowed dimensions are ${MAX_CANVAS_DIMENSION}x${MAX_CANVAS_DIMENSION} pixels.`,
            );
            debug(`New template dimensions (${imageBitmap.width}x${imageBitmap.height}) exceed maximum allowed size`);
            imageBitmap.close();
            return;
        }

        const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        const ctx = canvas.getContext('2d');
        assertCanvasCtx(ctx, 'Could not create canvas context');
        ctx.drawImage(imageBitmap, 0, 0);
        imageBitmap.close();
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        try {
            const { matches, image } = await ImageTools.verifyImageMatchesPalette(imageData, Platform.colors);

            if (matches) {
                // todo: add template to active templates
            } else {
                const diff = await ImageTools.highlightNonMatchingPixels(image, Platform.colors, 0.75, 0xff0000ff);
                showImagePaletteDiffDialog(diff);
            }
        } catch (e) {
            addError('An error occurred while processing the image. If this persists, please report this error.');
            debugDetailed('Error processing new template image', e);
            return;
        }

        dialog.close();
    }

    const fileInput = el('input', {
        attributes: { type: 'file', accept: 'image/png, image/webp' },
        events: { change: () => handleFileChange() },
    });

    const errorContainer = el('div', { class: 'new-template__error-container' });

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
                drop: (e) => handleDrop(e),
            },
        },
        [
            el('p', ['Drop or paste your image file here.']),
            el('button', { class: 'sm-platform__block-btn', events: { click: () => fileInput.click() } }, [
                'Select a file',
            ]),
            el('p', [
                'Only image files are supported.',
                el('br'),
                'If you have a compatible template file, use the import dialog instead.',
            ]),
            errorContainer,
        ],
    );

    const { dialog } = createDialog('New Template', { customClass: 'sm-new-template-dialog', large: true }, [dropArea]);

    document.body.appendChild(dialog);
    dialog.showModal();

    dropArea.focus();
}
