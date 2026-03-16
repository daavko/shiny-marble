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
        closeDialog();
    }
}
