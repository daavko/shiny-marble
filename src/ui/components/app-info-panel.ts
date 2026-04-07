export { default as appInfoPanelStyle } from './app-info-panel.css';

interface AppInfoPanelState {
    close: () => void;
}

let renderedAppInfoPanel: AppInfoPanelState | null = null;

export function showAppInfoPanel(): void {
    if (renderedAppInfoPanel) {
        return;
    }

    // todo
}

export function closeAppInfoPanel(): void {
    renderedAppInfoPanel?.close();
    renderedAppInfoPanel = null;
}
