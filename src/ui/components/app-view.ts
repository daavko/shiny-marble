import { mdiClose, mdiCog, mdiDotsVertical, mdiStarFourPointsCircleOutline } from '@mdi/js';
import { el } from '../../core/dom/html';
import {
    type LiveTemplate,
    TemplateAddedEvent,
    TemplateChangedEvent,
    TemplateDeletedEvent,
    TemplateRegistry,
    TemplateRegistryEvents,
} from '../../core/template/template-registry';
import { Platform } from '../../platform/platform';
import { renderBlockButton, renderIconButton } from '../builtin/button';
import { renderMdiIcon } from '../builtin/mdi-icon';
import { openPopoverMenu } from '../builtin/popover-menu';
import { showConfirmationDialog } from '../dialogs/confirmation-dialog';
import { showNewTemplateDialog } from '../dialogs/new-template-dialog';
import { showSettingsDialog } from '../dialogs/settings-dialog';
import { showTemplateNameDialog } from '../dialogs/template-name-dialog';
import { showInfoAlert } from './alerts-container';

export { default as appViewStyle } from './app-view.css';

interface AppViewState {
    close: () => void;
}

let renderedAppView: AppViewState | null = null;

function openTemplateMenu(template: LiveTemplate, menuButton: HTMLElement): void {
    const closePopoverMenu = openPopoverMenu(
        menuButton,
        [
            {
                label: 'Pin statistics (soon (tm))',
                onClick: (): void => {
                    // todo
                },
            },
            {
                label: 'Rename',
                onClick: (): void => {
                    closePopoverMenu();
                    void showTemplateNameDialog(template.name, false).then(async (newName) => {
                        if (newName === '' || newName === template.name) {
                            return;
                        }

                        await TemplateRegistry.renameTemplate(template.id, newName);
                    });
                },
            },
            {
                label: 'Export (soon (tm))',
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
                label: 'Delete',
                onClick: (): void => {
                    closePopoverMenu();
                    void showConfirmationDialog(
                        'Delete template?',
                        `Are you sure you want to delete the "${template.name}" template?`,
                        [
                            { label: 'Delete', value: 'delete' },
                            { label: 'Cancel', value: 'cancel' },
                        ],
                    ).then(async (result) => {
                        if (result === 'delete') {
                            await TemplateRegistry.deleteTemplate(template.id);
                            showInfoAlert(`Deleted template "${template.name}"`, 2000);
                        }
                    });
                },
            },
        ],
        { vertical: 'bottom', horizontal: 'left' },
    );
}

function createTemplateElement(template: LiveTemplate): HTMLElement {
    const menuButton = renderIconButton(
        mdiDotsVertical,
        () => {
            openTemplateMenu(template, menuButton);
        },
        undefined,
        { class: 'sm-app-view__template-item__menu-button' },
    );

    return el('div', { class: 'sm-app-view__template-item' }, [
        el('img', {
            class: 'sm-app-view__template-item__thumbnail',
            attributes: { src: template.thumbnailUrl },
        }),
        el('span', { class: 'sm-app-view__template-item__title' }, [template.name]),
        // el('span', { class: 'sm-app-view__template-item__statistics' }, ['12345678/12345678px (99.99%)']),
        el('span', { class: 'sm-app-view__template-item__statistics' }, ['statistics soom (tm)']),
        menuButton,
    ]);
}

function createNoTemplatesMessage(): HTMLElement {
    return el('p', { class: 'sm-app-view__no-templates' }, ['No templates available.']);
}

export function renderAppView(): void {
    if (renderedAppView) {
        return;
    }

    const templateElements = new Map<string, HTMLElement>();
    for (const template of TemplateRegistry.availableTemplates) {
        const templateElement = createTemplateElement(template);
        templateElements.set(template.id, templateElement);
    }

    const templateListContainer = el('div', { class: 'sm-app-view__templates-list' }, []);
    if (templateElements.size === 0) {
        templateListContainer.append(createNoTemplatesMessage());
    } else {
        templateListContainer.append(...templateElements.values());
    }

    const view = el('div', { class: 'sm-app-view__inner' }, [
        el('section', [
            el('h2', { class: 'sm-app-view__section-heading' }, ['Templates']),
            el('div', { class: 'sm-app-view__templates' }, [
                templateListContainer,
                el('div', { class: 'sm-app-view__templates-buttons' }, [
                    renderBlockButton('Create', () => showNewTemplateDialog()),
                    renderBlockButton('Import', () => {
                        // todo: open template import dialog
                    }),
                ]),
            ]),
        ]),
        el('hr'),
        el('section', [
            el('h2', { class: 'sm-app-view__section-heading' }, ['Utilities']),
            el('div', { class: 'sm-app-view__utilities' }, [
                renderBlockButton('Snapshot', () => {
                    // todo
                }),
                // renderBlockButton('Snapshot with map', () => {}),
            ]),
        ]),
    ]);
    const container = el('div', { class: 'sm-app-view' }, [
        el('header', { class: 'sm-app-view__header' }, [
            el('h1', { class: 'sm-app-view__title' }, [
                renderMdiIcon(mdiStarFourPointsCircleOutline, {
                    class: ['sm-mdi-icon--large', 'sm-shine-icon', 'sm-app-view__title-icon'],
                }),
                'Shiny Marble',
            ]),
            el('div', { class: 'sm-app-view__header-buttons' }, [
                renderIconButton(mdiCog, () => showSettingsDialog()),
                renderIconButton(mdiClose, () => toggleAppView()),
            ]),
        ]),
        view,
    ]);

    const platformSpecificContent = Platform.renderPlatformSpecificAppViewContent();
    if (platformSpecificContent != null) {
        view.append(el('hr'));
        if (Array.isArray(platformSpecificContent)) {
            view.append(...platformSpecificContent);
        } else {
            view.append(platformSpecificContent);
        }
    }

    view.append(
        el('hr'),
        el('footer', { class: 'sm-app-view__footer' }, [
            el('p', [`Shiny Marble v${GM_info.script.version} - made by ${GM_info.script.author}`]),
        ]),
    );

    const templateAddedListener = (event: TemplateAddedEvent): void => {
        const templateElement = createTemplateElement(event.template);
        templateElements.set(event.template.id, templateElement);

        if (templateElements.size === 1) {
            // first template added, remove "no templates" message
            templateListContainer.textContent = '';
        }
        templateListContainer.appendChild(templateElement);
    };
    const templateChangedListener = (event: TemplateChangedEvent): void => {
        const templateElement = templateElements.get(event.template.id);
        console.log('Template changed', event.template, templateElement);
        if (templateElement) {
            const newTemplateElement = createTemplateElement(event.template);
            console.log('Replacing template element', templateElement, 'with', newTemplateElement);
            templateListContainer.replaceChild(newTemplateElement, templateElement);
            templateElements.set(event.template.id, newTemplateElement);
        }
    };
    const templateDeletedListener = (event: TemplateDeletedEvent): void => {
        const templateElement = templateElements.get(event.templateId);
        if (templateElement) {
            templateElement.remove();
            templateElements.delete(event.templateId);
        }

        if (templateElements.size === 0) {
            // last template deleted, show "no templates" message
            templateListContainer.append(createNoTemplatesMessage());
        }
    };

    TemplateRegistryEvents.addEventListener('templateadded', templateAddedListener);
    TemplateRegistryEvents.addEventListener('templatechanged', templateChangedListener);
    TemplateRegistryEvents.addEventListener('templatedeleted', templateDeletedListener);

    document.body.appendChild(container);
    renderedAppView = {
        close: (): void => {
            container.remove();
            templateElements.clear();
            TemplateRegistryEvents.removeEventListener('templateadded', templateAddedListener);
            TemplateRegistryEvents.removeEventListener('templatechanged', templateChangedListener);
            TemplateRegistryEvents.removeEventListener('templatedeleted', templateDeletedListener);
        },
    };
}

function removeAppView(): void {
    renderedAppView?.close();
    renderedAppView = null;
}

export function toggleAppView(): void {
    if (renderedAppView) {
        removeAppView();
    } else {
        renderAppView();
    }
}
