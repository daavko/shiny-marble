import { mdiClose } from '@mdi/js';
import { el } from '../dom/html';
import { addStyle } from '../dom/styles';
import { Platform } from '../platform/platform';
import appViewStyle from './app-view.css';
import { renderMdiIcon } from './mdi-icon';

let renderedAppView: Element | null = null;

export function initializeAppViewStyles(): void {
    addStyle(appViewStyle);
}

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
                            class: ['sm-app-view__block-button'],
                            events: { click: () => {} },
                        },
                        ['Create'],
                    ),
                    el(
                        'button',
                        {
                            class: ['sm-app-view__block-button'],
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
                class: 'sm-app-view__close',
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
