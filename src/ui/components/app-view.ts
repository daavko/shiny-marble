import { mdiClose, mdiCog, mdiStarFourPointsCircleOutline } from '@mdi/js';
import { el } from '../../core/dom/html';
import { Platform } from '../../platform/platform';
import { CanvasSnapshotTool } from '../../platform/tools/canvas-snapshot';
import { renderBlockButton, renderIconButton } from '../builtin/button';
import { renderMdiIcon } from '../builtin/mdi-icon';
import { showImportTemplateDialog } from '../dialogs/import-template-dialog';
import { showNewTemplateDialog } from '../dialogs/new-template-dialog';
import { showSettingsDialog } from '../dialogs/settings-dialog';
import { showTemplateListDialog } from '../dialogs/template-list-dialog';

export { default as appViewStyle } from './app-view.css';

interface AppViewState {
    close: () => void;
}

let renderedAppView: AppViewState | null = null;

export function renderAppView(): void {
    if (renderedAppView) {
        return;
    }

    const view = el('div', { class: 'sm-app-view__inner' }, [
        el('section', [
            el('h2', { class: 'sm-app-view__section-heading' }, ['Templates']),
            el('p', ['99 templates total, 5 enabled']),
            el('div', { class: ['sm-row', 'sm-row--center', 'sm-mt-12'] }, [
                renderBlockButton('New Template', () => showNewTemplateDialog(), { variant: 'primary' }),
                renderBlockButton('Manage', () => showTemplateListDialog()),
                renderBlockButton('Import (soon (tm))', () => showImportTemplateDialog()),
            ]),
        ]),
        el('hr'),
        el('section', [
            el('h2', { class: 'sm-app-view__section-heading' }, ['Utilities']),
            el('div', { class: ['sm-row', 'sm-row--center'] }, [
                renderBlockButton('Take 1:1 snapshot', () => {
                    const snapshotTool = new CanvasSnapshotTool();
                    void Platform.requestToolActivation(snapshotTool);
                    toggleAppView();
                }),
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

    document.body.appendChild(container);
    renderedAppView = {
        close: (): void => {
            container.remove();
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
