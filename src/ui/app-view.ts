import { addStyle } from '../dom/styles';
import appViewStyle from './app-view.css';

let appViewVisible = false;

export function renderAppView(): void {
    addStyle(appViewStyle);
}

function removeAppView(): void {}

export function toggleAppView(): void {
    if (appViewVisible) {
        removeAppView();
    } else {
        renderAppView();
    }
}
