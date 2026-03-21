import { el } from '../../core/dom/html';
import { createDialog } from '../../platform/dialog';
import { Platform } from '../../platform/platform';
import { createBooleanSetting } from '../settings-ui';

export { default as settingsDialogStyle } from './settings-dialog.css';

export function showSettingsDialog(): void {
    const { dialog, dialogBody, closePromise } = createDialog('Settings', { customClass: 'sm-settings-dialog' }, []);

    const platformSpecificSettings = Platform.renderPlatformSpecificSettingsContent(closePromise);

    if (platformSpecificSettings != null) {
        if (Array.isArray(platformSpecificSettings)) {
            dialogBody.append(...platformSpecificSettings);
        } else {
            dialogBody.append(platformSpecificSettings);
        }
    }

    dialogBody.append(
        // el('section', { class: 'sm-settings__section' }, [el('h2', ['Template settings']), el('p', ['TODO'])]),
        el('section', { class: 'sm-settings__section' }, [
            el('h2', ['Debug settings']),
            createBooleanSetting(Platform.settings.debug, 'Enable debug logging', closePromise),
        ]),
    );

    document.body.appendChild(dialog);
    dialog.showModal();
}
