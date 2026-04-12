import { downloadDebugLog } from '../../core/debug';
import { el } from '../../core/dom/html';
import { Platform, PlatformSettings } from '../../platform/platform';
import { renderBlockButton } from '../builtin/button';
import { createDialog } from '../builtin/dialog';
import { createBooleanSetting, createNumberSetting } from '../builtin/settings-ui';

export { default as settingsDialogStyle } from './settings-dialog.css';

export function showSettingsDialog(): void {
    const { dialog, dialogBody, dialogContext } = createDialog(
        'Settings',
        { customClass: 'sm-settings-dialog', size: 'small' },
        [],
    );

    const platformSpecificSettings = Platform.renderPlatformSpecificSettingsContent(dialogContext);

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
            createBooleanSetting(PlatformSettings.debug, 'Enable debug logging', dialogContext),
            createNumberSetting(PlatformSettings.debugLogSize, 'Debug log size', dialogContext, {
                min: 0,
            }),
            renderBlockButton('Download debug log', () => downloadDebugLog()),
        ]),
    );

    document.body.appendChild(dialog);
    dialog.showModal();
}
