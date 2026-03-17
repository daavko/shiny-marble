import { el } from '../../dom/html';
import { createDialog } from '../../platform/dialog';

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

                handleFileSelected(files[0]);
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

                    handleFileSelected(files[0]);
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

    function handleFileSelected(file: File): void {
        if (!file.type.startsWith('image/')) {
            return;
        }

        // todo:
        // - validate image matches palette (show error modal if not, with highlighted spots where the pixels don't match the palette)
        // - add image to active templates via the standard way (since there's some GL context setup and such, and we do the same for stored template anyway we can just have a single fn)
        // - if image is larger than 4096x4096, show a warning and ask the user to confirm that they want to show it
        //      - alternatively maybe determine this by maximum allowable texture size instead? with 4096x4096 as a reasonable minimum fallback in case the device can do larger textures

        closeDialog();
    }
}
