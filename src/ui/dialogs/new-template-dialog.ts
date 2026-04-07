import { MAX_CANVAS_DIMENSION } from '../../core/const';
import { debug, debugDetailed } from '../../core/debug';
import { el } from '../../core/dom/html';
import { TemplateRegistry } from '../../core/template/template-registry';
import { Platform } from '../../platform/platform';
import { assertCanvasCtx } from '../../util/canvas';
import { ImageTools } from '../../workers/image-tools-dispatcher';
import { renderBlockButton } from '../builtin/button';
import { createDialog } from '../builtin/dialog';
import { showInfoAlert } from '../components/alerts-container';
import { showImagePaletteDiffDialog } from './image-palette-diff-dialog';
import { showTemplateNameDialog } from './template-name-dialog';

export { default as newTemplateDialogStyle } from './new-template-dialog.css';

export function showNewTemplateDialog(): void {
    function handleFileChange(): void {
        const files = fileInput.files;
        if (files == null || files.length === 0) {
            return;
        }

        handleFileSelected(files[0]).catch((e: unknown) => {
            addError(
                'An unexpected error occurred while processing the file. Please try again. If the problem persists, report this error.',
            );
            debugDetailed('Error handling file selection in new template dialog', e);
        });
    }

    function handleDrop(event: DragEvent): void {
        const data = event.dataTransfer;
        if (data == null) {
            return;
        }

        const files = data.files;
        if (files.length === 0) {
            return;
        }

        event.preventDefault();
        dropArea.classList.remove('drag-over');

        handleFileSelected(files[0]).catch((e: unknown) => {
            addError(
                'An unexpected error occurred while processing the file. Please try again. If the problem persists, report this error.',
            );
            debugDetailed('Error handling file drop in new template dialog', e);
        });
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
            addError('Unsupported file type. Please select an image file.');
            debug(`Unsupported file type selected: ${file.type}`);
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

        const { matches, image } = await ImageTools.verifyImageMatchesPalette(imageData, Platform.colors);

        if (!matches) {
            const diff = await ImageTools.highlightNonMatchingPixels(image, Platform.colors, 0.75, 0xff0000ff);
            showImagePaletteDiffDialog(diff);
            dialog.close();
            return;
        }

        if (await TemplateRegistry.hasTemplate(image)) {
            addError('A template with the same image already exists.');
            debug('Template image already exists in registry');
            return;
        }

        const name = await showTemplateNameDialog(file.name.replace(/\.\w+$/, ''), true);

        if (name === '') {
            addError('Template creation cancelled.');
            debug('Template creation cancelled by user');
            return;
        }

        await TemplateRegistry.addTemplate({ name, image });
        dialog.close();
        showInfoAlert(`Template "${name}" added successfully`, 2000);
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
            renderBlockButton('Select a file', () => fileInput.click()),
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
