import { el } from '../../core/dom/html';
import { createEffectContext, type EffectContext } from '../../platform/reactivity/effects';

export { default as activeToolPanelStyle } from './active-tool-panel.css';

let activeToolPanel: ActiveToolPanelRef | null = null;

export interface ActiveToolPanelRef {
    effectContext: EffectContext;
    panelContentElement: HTMLElement;
    close(): void;
}

function renderActiveToolPanel(): ActiveToolPanelRef {
    const panelContent = el('div', { class: 'sm-active-tool-panel' });
    const panel = el('div', { class: 'sm-active-tool-panel-container' }, [panelContent]);
    document.body.append(panel);
    const effectContext = createEffectContext();
    return {
        effectContext,
        panelContentElement: panelContent,
        close(): void {
            effectContext.destroy();
            panel.remove();
            activeToolPanel = null;
        },
    };
}

export function openActiveToolPanel(): ActiveToolPanelRef {
    closeActiveToolPanel();
    activeToolPanel = renderActiveToolPanel();
    return activeToolPanel;
}

export function closeActiveToolPanel(): void {
    activeToolPanel?.close();
}
