import { mdiClose } from '@mdi/js';
import { el } from '../../dom/html';
import { Platform } from '../../platform/platform';
import { renderMdiIcon } from '../mdi-icon';

export { default as settingsDialogStyle } from './settings-dialog.css';

export function showSettingsDialog(): void {
    const { promise: closePromise, resolve: closeResolve } = Promise.withResolvers<void>();

    const dialogContent = el('div', { class: 'sm-dialog__content' });
    const platformSpecificSettings = Platform.renderPlatformSpecificSettingsContent(closePromise);

    if (platformSpecificSettings != null) {
        if (Array.isArray(platformSpecificSettings)) {
            dialogContent.append(...platformSpecificSettings);
        } else {
            dialogContent.append(platformSpecificSettings);
        }
    }

    dialogContent.append(
        el('section', { class: 'sm-settings__section' }, [el('h2', ['Template settings']), el('p', ['TODO'])]),
        el('section', { class: 'sm-settings__section' }, [el('h2', ['Debug settings']), el('p', ['TODO'])]),
    );

    const dialog = el(
        'dialog',
        {
            class: ['sm-dialog', 'sm-settings-dialog'],
            attributes: { closedBy: 'any' },
            events: {
                close: () => {
                    closeResolve();
                    dialog.remove();
                },
            },
        },
        [
            el('header', { class: 'sm-dialog__header' }, [
                el('h1', ['Settings']),
                el(
                    'button',
                    {
                        class: 'sm-platform__icon-btn',
                        events: { click: () => dialog.close() },
                    },
                    [renderMdiIcon(mdiClose)],
                ),
            ]),
            dialogContent,
        ],
    );

    document.body.appendChild(dialog);
    dialog.showModal();
}
