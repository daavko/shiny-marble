import { TemplateRegistry } from '../../core/template/registry';
import { ImageTools } from '../../workers/image-tools-dispatcher';
import { createDialog } from '../builtin/dialog';
import { showInfoAlert } from '../components/alerts-container';
import { createTemplateImagePicker } from '../components/template-image-picker';
import { showTemplateNameDialog } from './template-name-dialog';

export function showNewTemplateDialog(): void {
    const { element: dropArea, context: dropAreaContext } = createTemplateImagePicker(async (image, file) => {
        const name = await showTemplateNameDialog(file.name.replace(/\.\w+$/, ''), true);

        if (name === '') {
            dialog.close();
            return;
        }

        const croppedImage = await ImageTools.cropToNonTransparentArea(image);

        await TemplateRegistry.addTemplate({ name, image: croppedImage });
        dialog.close();
        showInfoAlert(`Template "${name}" added successfully`, 2000);
    });

    const { dialog, dialogContext } = createDialog('New Template', { size: 'large' }, [dropArea]);
    dialogContext.adopt(dropAreaContext);

    document.body.appendChild(dialog);
    dialog.showModal();
}
