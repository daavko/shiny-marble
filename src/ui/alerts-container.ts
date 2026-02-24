import { el } from '../dom/html';
import { addStyle } from '../dom/styles';
import alertsContainerStyle from './alerts-container.css';

export type AlertType = 'info' | 'error';

const DEFAULT_INFO_MESSAGE_DURATION = 3000;
const DEFAULT_ERROR_MESSAGE_DURATION = 5000;

const ALERTS_CONTAINER = el('div');

export function renderAlertsContainer(): void {
    addStyle(alertsContainerStyle);
    document.body.appendChild(ALERTS_CONTAINER);
}

function createAlertElement(message: string, duration: number): Element {
    return el('div');
}

export function showInfoAlert(message: string, duration = DEFAULT_INFO_MESSAGE_DURATION): void {}

export function showErrorAlert(message: string, context?: Error, duration = DEFAULT_ERROR_MESSAGE_DURATION): void {}

// todo: implement alerts
