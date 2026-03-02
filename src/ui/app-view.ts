import { mdiClose } from '@mdi/js';
import { el } from '../dom/html';
import { Platform } from '../platform/platform';
import { renderMdiIcon } from './mdi-icon';

export { default as appViewStyle } from './app-view.css';

let renderedAppView: Element | null = null;

export function renderAppView(): void {
    if (renderedAppView) {
        return;
    }

    const view = el('div', { class: 'sm-app-view__inner' }, [
        el('section', [
            el('h2', { class: 'sm-app-view__section-heading' }, ['Templates']),
            el('div', { class: 'sm-app-view__templates' }, [
                'Templates soon(tm)',
                el('div', { class: 'sm-app-view__buttons' }, [
                    el(
                        'button',
                        {
                            class: 'sm-platform__block-btn',
                            events: { click: () => {} },
                        },
                        ['Create'],
                    ),
                    el(
                        'button',
                        {
                            class: 'sm-platform__block-btn',
                            events: { click: () => {} },
                        },
                        ['Import'],
                    ),
                ]),
            ]),
        ]),
    ]);
    const container = el('div', { class: 'sm-app-view' }, [
        el(
            'button',
            {
                class: 'sm-platform__sheet-close-btn',
                events: {
                    click: () => toggleAppView(),
                },
            },
            [renderMdiIcon(mdiClose)],
        ),
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

    document.body.appendChild(container);
    renderedAppView = container;
}

function removeAppView(): void {
    renderedAppView?.remove();
    renderedAppView = null;
}

export function toggleAppView(): void {
    if (renderedAppView) {
        removeAppView();
    } else {
        renderAppView();
    }
}
