import { el, type HTMLElementChild } from '../../core/dom/html';
import { downloadDebugLog } from '../../platform/debug';
import { Platform, PlatformSettings } from '../../platform/platform';
import { renderBlockButton } from '../builtin/button';
import { createDialog } from '../builtin/dialog';
import { createBooleanSetting, createNumberSetting } from '../builtin/settings-ui';

export { default as settingsDialogStyle } from './settings-dialog.css';

export function showSettingsDialog(): void {
    const { dialog } = createDialog('Settings', { customClass: 'sm-settings-dialog', size: 'small' }, (ctx) => {
        const children: HTMLElementChild[] = [];
        const platformSpecificSettings = Platform.renderPlatformSpecificSettingsContent(ctx);
        if (platformSpecificSettings != null) {
            if (Array.isArray(platformSpecificSettings)) {
                children.push(...platformSpecificSettings);
            } else {
                children.push(platformSpecificSettings);
            }
        }

        children.push(
            // el('section', { class: 'sm-settings__section' }, [el('h2', ['Template settings']), el('p', ['TODO'])]),
            el('section', { class: 'sm-settings__section' }, [
                el('h2', ['Debug settings']),
                createBooleanSetting(PlatformSettings.debug, 'Enable debug logging', ctx),
                createNumberSetting(PlatformSettings.debugLogSize, 'Debug log size', ctx, {
                    min: 0,
                }),
                renderBlockButton('Download debug log', () => downloadDebugLog()),
            ]),
        );
        return children;
    });

    document.body.appendChild(dialog);
    dialog.showModal();
}
