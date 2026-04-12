import prettyBytes from 'pretty-bytes';
import { MAX_INPUT_TEMPLATE_FILE_SIZE, MAX_TEMPLATE_CANVAS_DIMENSION } from '../../core/const';
import { debug, debugDetailed } from '../../core/debug';
import { el } from '../../core/dom/html';
import { createEffectContext, type EffectContext } from '../../core/effects';
import { signal } from '../../core/signals';
import { TemplateRegistry } from '../../core/template/registry';
import { Platform } from '../../platform/platform';
import { assertCanvasCtx } from '../../util/canvas';
import { downloadBlob } from '../../util/file';
import { ImageTools } from '../../workers/image-tools-dispatcher';
import { renderBlockButton } from '../builtin/button';

export { default as templateImagePickerStyle } from './template-image-picker.css';

export interface TemplateImagePickerRef {
    element: HTMLElement;
    context: EffectContext;
}

export function createTemplateImagePicker(
    imagePickedCallback: (image: ImageData, imageFile: File) => void | Promise<void>,
): TemplateImagePickerRef {
    const imagePicker = el('div', { class: 'sm-template-image-picker' });
    const fileInput = el('input', {
        attributes: { type: 'file', accept: 'image/png, image/webp' },
        events: { change: () => handleFileChange() },
    });
    const errorContainer = el('div', { class: 'sm-template-image-picker__error-container' });

    const context = createEffectContext();

    const processing = signal(false);
    const imageDiff = signal<ImageData | null>(null);
    const errorMessage = signal<string | null>(null);

    function handleFileChange(): void {
        const files = fileInput.files;
        if (files == null || files.length === 0) {
            return;
        }

        handleFileSelected(files[0])
            .catch((e: unknown) => {
                errorMessage.value =
                    'An unexpected error occurred while processing the file. Please try again. If the problem persists, report this error.';
                debugDetailed('Error handling file selection in new template dialog', e);
            })
            .finally(() => {
                processing.value = false;
            });
    }

    function handleDrop(dropArea: HTMLElement, event: DragEvent): void {
        const data = event.dataTransfer;
        if (data == null) {
            return;
        }

        const files = data.files;
        if (files.length === 0) {
            return;
        }

        event.preventDefault();
        dropArea.classList.remove('sm-template-image-picker__drop-area--drag-over');

        handleFileSelected(files[0])
            .catch((e: unknown) => {
                errorMessage.value =
                    'An unexpected error occurred while processing the file. Please try again. If the problem persists, report this error.';
                debugDetailed('Error handling file drop in new template dialog', e);
            })
            .finally(() => {
                processing.value = false;
            });
    }

    async function handleFileSelected(file: File): Promise<void> {
        if (!file.type.startsWith('image/')) {
            errorMessage.value = 'Unsupported file type. Please select an image file.';
            debug(`Unsupported file type selected: ${file.type}`);
            return;
        }

        if (file.size > MAX_INPUT_TEMPLATE_FILE_SIZE) {
            errorMessage.value = `The selected file is too large. Maximum allowed file size is ${prettyBytes(MAX_INPUT_TEMPLATE_FILE_SIZE, { binary: true })}.`;
            debug(`Selected file size (${file.size} bytes) exceeds maximum allowed size`);
            return;
        }

        errorMessage.value = null;
        processing.value = true;

        let imageBitmap: ImageBitmap;
        try {
            imageBitmap = await createImageBitmap(file);
        } catch (e) {
            errorMessage.value =
                'Failed to read the image file. Please make sure the file is a valid image and try again.';
            debugDetailed('Error creating ImageBitmap from file', e);
            return;
        }

        if (imageBitmap.width > MAX_TEMPLATE_CANVAS_DIMENSION || imageBitmap.height > MAX_TEMPLATE_CANVAS_DIMENSION) {
            errorMessage.value = `The image is too large. Maximum allowed dimensions are ${MAX_TEMPLATE_CANVAS_DIMENSION}x${MAX_TEMPLATE_CANVAS_DIMENSION} pixels.`;
            debug(`New template dimensions (${imageBitmap.width}x${imageBitmap.height}) exceed maximum allowed size`);
            imageBitmap.close();
            return;
        }

        const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        const ctx = canvas.getContext('2d');
        assertCanvasCtx(ctx, 'Could not create canvas context');
        ctx.drawImage(imageBitmap, 0, 0);
        imageBitmap.close();
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const matches = await ImageTools.verifyImageMatchesPalette(image, Platform.colors);

        if (!matches) {
            imageDiff.value = await ImageTools.highlightNonMatchingPixels(image, Platform.colors, 0.75, 0xff0000ff);
            return;
        }

        if (await TemplateRegistry.hasTemplate(image)) {
            errorMessage.value = 'A template with the same image already exists.';
            debug('Template image already exists in registry');
            return;
        }

        await imagePickedCallback(image, file);
    }

    function renderRegularDropArea(): HTMLElement {
        const dropArea = el(
            'section',
            {
                class: 'sm-template-image-picker__drop-area',
                attributes: {
                    tabindex: -1,
                },
                events: {
                    dragenter: () => dropArea.classList.add('sm-template-image-picker__drop-area--drag-over'),
                    dragleave: () => dropArea.classList.remove('sm-template-image-picker__drop-area--drag-over'),
                    dragend: () => dropArea.classList.remove('sm-template-image-picker__drop-area--drag-over'),
                    drop: (e) => {
                        handleDrop(dropArea, e);
                    },
                },
            },
            [
                el('p', ['Drop or paste your image file here.']),
                renderBlockButton('Select a file', () => fileInput.click()),
                errorContainer,
            ],
        );
        return dropArea;
    }

    function renderLoadingState(): HTMLElement {
        return el('div', { class: 'sm-template-image-picker__loading' }, [el('p', ['Processing image...'])]);
    }

    function renderPaletteDiffContainer(diffImage: ImageData): HTMLElement {
        const canvas = el('canvas', {
            class: 'sm-template-image-picker__palette-diff__canvas',
            attributes: { width: diffImage.width, height: diffImage.height },
        });
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D context for image palette diff dialog');
        }
        ctx.putImageData(diffImage, 0, 0);

        function handleSaveClick(): void {
            canvas.toBlob((blob) => {
                if (blob) {
                    downloadBlob(blob, 'image-palette-diff.png');
                }
            }, 'image/png');
        }

        return el('div', { class: 'sm-template-image-picker__palette-diff' }, [
            el('p', [
                'Your image has colors that are not in the canvas palette. In the following image, colors that are not in the palette are highlighted in red.',
            ]),
            el('p', ['To use this image as a template, you will need to edit it to match the palette.']),
            canvas,
            el('div', { class: 'sm-template-image-picker__palette-diff__buttons' }, [
                renderBlockButton('Back to image selection', () => {
                    imageDiff.value = null;
                }),
                renderBlockButton('Save highlighted image', () => handleSaveClick()),
            ]),
        ]);
    }

    context.watch(
        [processing, imageDiff],
        ([processingValue, imageDiffData]) => {
            if (processingValue) {
                imagePicker.replaceChildren(renderLoadingState());
            } else {
                if (imageDiffData) {
                    imagePicker.replaceChildren(renderPaletteDiffContainer(imageDiffData));
                } else {
                    const dropArea = renderRegularDropArea();
                    imagePicker.replaceChildren(dropArea);
                    dropArea.focus();
                }
            }
        },
        true,
    );

    context.watch([errorMessage], ([message]) => {
        errorContainer.textContent = '';
        if (message != null) {
            errorContainer.appendChild(el('p', [message]));
        }
    });

    return {
        element: imagePicker,
        context,
    };
}
