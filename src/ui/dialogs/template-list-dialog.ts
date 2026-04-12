import { mdiDotsVertical, mdiExport, mdiPencil, mdiTrashCanOutline } from '@mdi/js';
import { el } from '../../core/dom/html';
import { createEffectContext, type EffectContext } from '../../core/effects';
import { signal, type Signal } from '../../core/signals';
import {
    type LiveTemplate,
    TemplateAddedEvent,
    TemplateChangedEvent,
    TemplateDeletedEvent,
    TemplateRegistry,
    TemplateRegistryEvents,
} from '../../core/template/registry';
import { renderIconButton } from '../builtin/button';
import { createDialog } from '../builtin/dialog';
import { openPopoverMenu } from '../builtin/popover-menu';
import { bindTooltip } from '../builtin/tooltip';
import { showInfoAlert } from '../components/alerts-container';
import { showConfirmationDialog } from './confirmation-dialog';
import { showReplaceTemplateImageDialog } from './replace-template-image-dialog';
import { showTemplateNameDialog } from './template-name-dialog';

export { default as templateListDialogStyle } from './template-list-dialog.css';

interface TemplateListItemRef {
    element: HTMLElement;
    context: EffectContext;
}

function openTemplateMenu(template: Signal<LiveTemplate>, menuButton: HTMLElement, dialog: HTMLElement): void {
    const closePopoverMenu = openPopoverMenu(
        menuButton,
        [
            {
                label: 'Fly to template coordinates (soon (tm))',
                onClick: (): void => {
                    // todo
                },
            },
            {
                label: 'Pin statistics (soon (tm))',
                onClick: (): void => {
                    // todo
                },
            },
            {
                label: 'Move (soon (tm))',
                onClick: (): void => {
                    // todo
                },
            },
            {
                label: 'Replace image',
                onClick: (): void => {
                    closePopoverMenu();
                    showReplaceTemplateImageDialog(template.value.id);
                },
            },
        ],
        { vertical: 'bottom', horizontal: 'left', container: dialog },
    );
}

function renderTemplateListItem(template: Signal<LiveTemplate>, dialog: HTMLElement): TemplateListItemRef {
    const context = createEffectContext();

    const menuButton = renderIconButton(mdiDotsVertical, () => {
        openTemplateMenu(template, menuButton, dialog);
    });

    const thumbnail = el('img', {
        class: 'sm-templates-list-dialog__template-item__thumbnail',
    });

    const title = el('span', { class: 'sm-templates-list-dialog__template-item__title' });

    context.watch(
        [template],
        ([t]) => {
            thumbnail.setAttribute('src', t.thumbnailUrl);
            title.textContent = t.name;
        },
        true,
    );

    const renameButton = renderIconButton(mdiPencil, () => {
        const { id, name } = template.value;
        void showTemplateNameDialog(name, false).then(async (newName) => {
            if (newName === '' || newName === name) {
                return;
            }

            await TemplateRegistry.renameTemplate(id, newName);
        });
    });
    const exportButton = renderIconButton(mdiExport, () => {
        // todo
    });
    const deleteButton = renderIconButton(
        mdiTrashCanOutline,
        () => {
            const { id, name } = template.value;
            void showConfirmationDialog('Delete template?', `Are you sure you want to delete the "${name}" template?`, [
                { label: 'Delete', value: 'delete', buttonOptions: { variant: 'danger' } },
                { label: 'Cancel', value: 'cancel' },
            ]).then(async (result) => {
                if (result === 'delete') {
                    await TemplateRegistry.deleteTemplate(id);
                    showInfoAlert(`Deleted template "${name}"`, 2000);
                }
            });
        },
        { variant: 'danger' },
    );

    bindTooltip(renameButton, 'Rename template', { vertical: 'top', horizontal: 'center', container: dialog });
    bindTooltip(exportButton, 'Export template (soon (tm))', {
        vertical: 'top',
        horizontal: 'center',
        container: dialog,
    });
    bindTooltip(deleteButton, 'Delete template', { vertical: 'top', horizontal: 'center', container: dialog });

    const listItemElement = el('div', { class: 'sm-templates-list-dialog__template-item' }, [
        thumbnail,
        title,
        el('span', { class: 'sm-templates-list-dialog__template-item__statistics' }, ['12345678/12345678px (99.99%)']),
        // el('span', { class: 'sm-templates-list-dialog__template-item__statistics' }, ['statistics soom (tm)']),
        el('div', { class: 'sm-templates-list-dialog__template-item__menu-buttons' }, [
            renameButton,
            exportButton,
            deleteButton,
            menuButton,
        ]),
    ]);

    return { element: listItemElement, context };
}

function createNoTemplatesMessage(): HTMLElement {
    return el('p', { class: 'sm-templates-list-dialog__no-templates' }, ['No templates available.']);
}

interface RenderedTemplateListItem {
    signal: Signal<LiveTemplate>;
    ref: TemplateListItemRef;
}

export function showTemplateListDialog(): void {
    const templateListContainer = el('div', { class: 'sm-templates-list-dialog__templates-list' }, []);
    const { dialog, dialogContext } = createDialog(
        'Templates',
        { customClass: 'sm-templates-list-dialog', size: 'medium' },
        [templateListContainer],
    );

    const templateListItems = new Map<string, RenderedTemplateListItem>();
    for (const template of TemplateRegistry.availableTemplates) {
        const templateSignal = signal({ ...template });
        const listItemRef = renderTemplateListItem(templateSignal, dialog);
        dialogContext.adopt(listItemRef.context);
        templateListItems.set(template.id, { signal: templateSignal, ref: listItemRef });
    }

    if (templateListItems.size === 0) {
        templateListContainer.append(createNoTemplatesMessage());
    } else {
        for (const item of templateListItems.values()) {
            templateListContainer.appendChild(item.ref.element);
        }
    }

    const templateAddedListener = (event: TemplateAddedEvent): void => {
        const templateSignal = signal({ ...event.template });
        const listItemRef = renderTemplateListItem(templateSignal, dialog);
        dialogContext.adopt(listItemRef.context);
        templateListItems.set(event.template.id, { signal: templateSignal, ref: listItemRef });

        if (templateListItems.size === 1) {
            // first template added, remove "no templates" message
            templateListContainer.textContent = '';
        }
        templateListContainer.appendChild(listItemRef.element);
    };
    const templateChangedListener = (event: TemplateChangedEvent): void => {
        const listItem = templateListItems.get(event.template.id);
        // this should pretty much never happen but it makes typescript happy so...
        if (listItem) {
            listItem.signal.value = { ...event.template };
        }
    };
    const templateDeletedListener = (event: TemplateDeletedEvent): void => {
        const listItem = templateListItems.get(event.templateId);
        if (listItem) {
            dialogContext.unadopt(listItem.ref.context);
            listItem.ref.element.remove();
            listItem.ref.context.destroy();
            templateListItems.delete(event.templateId);
        }

        if (templateListItems.size === 0) {
            // last template deleted, show "no templates" message
            templateListContainer.append(createNoTemplatesMessage());
        }
    };

    TemplateRegistryEvents.addEventListener('templateadded', templateAddedListener);
    TemplateRegistryEvents.addEventListener('templatechanged', templateChangedListener);
    TemplateRegistryEvents.addEventListener('templatedeleted', templateDeletedListener);

    dialogContext.registerCleanup(() => {
        templateListItems.clear();
        TemplateRegistryEvents.removeEventListener('templateadded', templateAddedListener);
        TemplateRegistryEvents.removeEventListener('templatechanged', templateChangedListener);
        TemplateRegistryEvents.removeEventListener('templatedeleted', templateDeletedListener);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
}
