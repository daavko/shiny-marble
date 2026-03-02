import { mdiStarFourPointsCircleOutline } from '@mdi/js';
import { el } from '../dom/html';
import { addStyle } from '../dom/styles';
import appIconStyle from './app-icon.css';
import { toggleAppView } from './app-view';
import { renderMdiIcon } from './mdi-icon';

export function initializeAppIconStyles(): void {
    addStyle(appIconStyle);
}

export function renderAppIcon(): void {
    document.body.appendChild(
        el(
            'button',
            {
                class: 'sm-app-icon',
                events: {
                    click: () => toggleAppView(),
                },
            },
            [renderMdiIcon(mdiStarFourPointsCircleOutline, { class: 'sm-app-icon__icon' })],
        ),
    );
}
