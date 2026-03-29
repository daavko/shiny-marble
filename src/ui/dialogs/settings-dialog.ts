import { downloadDebugLog } from '../../core/debug';
import { el } from '../../core/dom/html';
import { createDialog } from '../../platform/dialog';
import { Platform, PlatformSettings } from '../../platform/platform';
import { createBooleanSetting, createNumberSetting } from '../settings-ui';

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
            createBooleanSetting(PlatformSettings.debug, 'Enable debug logging', closePromise),
            createNumberSetting(PlatformSettings.debugLogSize, 'Debug log size', closePromise, {
                min: 0,
            }),
            el(
                'button',
                {
                    class: 'sm-platform__block-btn',
                    events: { click: () => downloadDebugLog() },
                },
                ['Download debug log'],
            ),
        ]),
    );

    document.body.appendChild(dialog);
    dialog.showModal();
}
