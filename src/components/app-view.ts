import { Component, type ComponentHandle, mountComponent, unmountComponent } from '../dom/component';
import appViewStyle from './app-view.css';

let appViewVisible = false;

export function renderAppView(): void {}

function removeAppView(): void {}

let appViewHandle: ComponentHandle | null = null;

class AppView extends Component {
    static override readonly style = appViewStyle;

    render(): Element | Element[] {
        return [];
    }
}

export function toggleAppView(): void {
    if (appViewHandle == null) {
        mountComponent(document.body, AppView);
    } else {
        unmountComponent(appViewHandle);
    }
}
