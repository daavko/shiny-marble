import { TemplateRegistry } from '../../core/template/registry';
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

        await TemplateRegistry.addTemplate({ name, image });
        dialog.close();
        showInfoAlert(`Template "${name}" added successfully`, 2000);
    });

    const { dialog, dialogContext } = createDialog('New Template', { size: 'large' }, [dropArea]);
    dialogContext.adopt(dropAreaContext);

    document.body.appendChild(dialog);
    dialog.showModal();
}
