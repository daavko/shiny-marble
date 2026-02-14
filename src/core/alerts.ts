import { BehaviorSubject } from 'rxjs';

interface AlertBase {
    prefix?: string;
    message: string;
}

export interface InfoAlert extends AlertBase {
    type: 'info';
    prefix?: string;
    message: string;
}

export interface ErrorAlert extends AlertBase {
    type: 'error';
}

export type Alert = InfoAlert | ErrorAlert;

interface AlertWithId {
    id: string;
    inner: Alert;
}

const displayedAlerts = new BehaviorSubject<AlertWithId[]>([]);
export const displayedAlerts$ = displayedAlerts.asObservable();

const DEFAULT_INFO_MESSAGE_DURATION = 3000;
const DEFAULT_ERROR_MESSAGE_DURATION = 5000;

function formatMessage(message: string, prefix?: string): string {
    if (prefix == null) {
        return message;
    } else {
        return `[${prefix}] ${message}`;
    }
}

function showAlert(alert: Alert, duration: number): void {
    const id = crypto.randomUUID();
    displayedAlerts.next([...displayedAlerts.value, { id, inner: alert }]);
    setTimeout(() => {
        displayedAlerts.next(displayedAlerts.value.filter((a) => a.id !== id));
    }, duration);
}

export function showInfoAlert(message: string, prefix?: string, duration = DEFAULT_INFO_MESSAGE_DURATION): void {
    showAlert({ type: 'info', message: formatMessage(message, prefix) }, duration);
}

export function showErrorAlert(
    message: string,
    prefix?: string,
    context?: Error,
    duration = DEFAULT_ERROR_MESSAGE_DURATION,
): void {
    const formattedMessage = formatMessage(message, prefix);
    console.error(formattedMessage, context);
    showAlert({ type: 'error', message: formattedMessage }, duration);
}
