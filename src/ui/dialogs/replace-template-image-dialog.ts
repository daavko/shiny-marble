import { TemplateRegistry } from '../../core/template/registry';
import { createDialog } from '../builtin/dialog';
import { showInfoAlert } from '../components/alerts-container';
import { createTemplateImagePicker } from '../components/template-image-picker';

export function showReplaceTemplateImageDialog(templateId: string): void {
    const { element: dropArea, context: dropAreaContext } = createTemplateImagePicker(async (image, file) => {
        await TemplateRegistry.replaceTemplateImage(templateId, image, file);
        dialog.close();
        showInfoAlert(`Template image replaced successfully`, 2000);
    });

    const { dialog, dialogContext } = createDialog('Replace Template Image', { size: 'large' }, [dropArea]);
    dialogContext.adopt(dropAreaContext);

    document.body.appendChild(dialog);
    dialog.showModal();
}
