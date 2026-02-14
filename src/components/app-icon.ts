import { el } from '../dom/html';
import { addStyle } from '../dom/styles';
import appIconStyle from './app-icon.css';
import { toggleAppView } from './app-view';

function renderAppIcon(): void {
    addStyle(appIconStyle);
    document.body.appendChild(
        el('button', {
            class: 'sm-app-icon',
            events: {
                click: () => {
                    toggleAppView();
                },
            },
        }),
    );
}
