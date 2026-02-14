import { Component } from '../dom/component';
import alertsContainerStyle from './alerts-container.css';
import { type Alert, displayedAlerts$ } from '../core/alerts';

export class AlertsContainer extends Component {
    static override readonly style = alertsContainerStyle;

    private alertsToRender: Alert[] = [];

    override beforeMount(): void {
        displayedAlerts$.subscribe(() => {});
    }

    render(): Element | Element[] {
        return [];
    }
}
