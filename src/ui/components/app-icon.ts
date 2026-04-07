import { mdiStarFourPointsCircleOutline } from '@mdi/js';
import { el } from '../../core/dom/html';
import { renderMdiIcon } from '../builtin/mdi-icon';
import { toggleAppView } from './app-view';

export { default as appIconStyle } from './app-icon.css';

export function renderAppIcon(): void {
    document.body.appendChild(
        el(
            'button',
            {
                class: 'sm-app-icon',
                events: { click: () => toggleAppView() },
            },
            [renderMdiIcon(mdiStarFourPointsCircleOutline, { class: ['sm-shine-icon', 'sm-app-icon__icon'] })],
        ),
    );
}
