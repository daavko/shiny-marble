import { mdiClose } from '@mdi/js';
import { el } from '../../dom/html';
import { renderMdiIcon } from '../mdi-icon';

export { default as settingsDialogStyle } from './settings-dialog.css';

export function showSettingsDialog(): void {
    const dialog = el('dialog', { class: ['sm-dialog', 'sm-settings-dialog'], attributes: { closedBy: 'any' } }, [
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
        el('div', { class: 'sm-dialog__content' }, ['Settings content goes here...']),
    ]);

    dialog.addEventListener('close', () => {
        dialog.remove();
    });
}
