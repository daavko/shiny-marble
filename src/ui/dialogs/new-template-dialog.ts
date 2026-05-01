import { TemplateRegistry } from '../../platform/template/registry';
import { ImageTools } from '../../workers/image-tools-dispatcher';
import { createDialog } from '../builtin/dialog';
import { showInfoAlert } from '../components/alerts-container';
import { createTemplateImagePicker } from '../components/template-image-picker';
import { showTemplateNameDialog } from './template-name-dialog';

export function showNewTemplateDialog(): void {
    const { dialog } = createDialog('New Template', { size: 'large' }, (ctx) => [
        createTemplateImagePicker(ctx, async (image, file) => {
            const name = await showTemplateNameDialog(file.name.replace(/\.\w+$/, ''), true);

            if (name === '') {
                dialog.close();
                return;
            }

            const croppedImage = await ImageTools.cropToNonTransparentArea(image, true);

            await TemplateRegistry.addTemplate({ name, image: croppedImage });
            dialog.close();
            showInfoAlert(`Template "${name}" added successfully`, 2000);
        }),
    ]);

    document.body.appendChild(dialog);
    dialog.showModal();
}
