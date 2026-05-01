import { TemplateRegistry } from '../../platform/template/registry';
import { createDialog } from '../builtin/dialog';
import { showInfoAlert } from '../components/alerts-container';
import { createTemplateImagePicker } from '../components/template-image-picker';

export function showReplaceTemplateImageDialog(templateId: string): void {
    const { dialog } = createDialog('Replace Template Image', { size: 'large' }, (ctx) => [
        createTemplateImagePicker(ctx, async (image) => {
            await TemplateRegistry.replaceTemplateImage(templateId, image);
            dialog.close();
            showInfoAlert(`Template image replaced successfully`, 2000);
        }),
    ]);

    document.body.appendChild(dialog);
    dialog.showModal();
}
