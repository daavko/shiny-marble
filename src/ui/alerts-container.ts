import { mdiClose } from '@mdi/js';
import { el } from '../dom/html';
import { addStyle } from '../dom/styles';
import alertsContainerStyle from './alerts-container.css';
import { renderMdiIcon } from './mdi-icon';

const DEFAULT_INFO_MESSAGE_DURATION = 3000;
const DEFAULT_ERROR_MESSAGE_DURATION = 5000;

const ALERTS_CONTAINER = el('div', { class: 'sm-alerts-container' });

export function renderAlertsContainer(): void {
    addStyle(alertsContainerStyle);
    document.body.appendChild(ALERTS_CONTAINER);
}

function removeAlert(alertElement: Element): void {
    alertElement.remove();
}

function createAlertElement(message: string, duration: number, alertTypeClass: string): Element {
    const alertElement = el('div', { class: ['sm-alert', alertTypeClass] }, [
        el('span', [message]),
        el(
            'button',
            {
                class: 'sm-alert__close-btn',
                events: {
                    click: () => removeAlert(alertElement),
                },
            },
            [renderMdiIcon(mdiClose)],
        ),
    ]);
    setTimeout(() => removeAlert(alertElement), duration);
    return alertElement;
}

export function showInfoAlert(message: string, duration = DEFAULT_INFO_MESSAGE_DURATION): void {
    const alertElement = createAlertElement(message, duration, 'sm-alert--info');
    ALERTS_CONTAINER.appendChild(alertElement);
}

export function showErrorAlert(message: string, context?: unknown, duration = DEFAULT_ERROR_MESSAGE_DURATION): void {
    console.error(message, context);
    const alertElement = createAlertElement(message, duration, 'sm-alert--error');
    ALERTS_CONTAINER.appendChild(alertElement);
}
