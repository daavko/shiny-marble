import { Platform } from './platform';

export function debugEnabled(): boolean {
    return Platform.settings.debug.get();
}

export function debug(message: string, ...data: unknown[]): void {
    if (debugEnabled()) {
        console.debug('[SM]', message, ...data);
    }
}

export interface DebugTimer {
    stop(): void;
    mark(message: string): void;
}

export function debugTime(timerName: string): DebugTimer | null {
    const timerNameWithId = `${timerName} (${window.crypto.randomUUID()})`;
    const fullTimingName = `[SM] ${timerNameWithId}`;
    if (debugEnabled()) {
        debug(`${timerNameWithId} timer started`);
        console.time(fullTimingName);
        return {
            stop: (): void => {
                console.timeEnd(fullTimingName);
            },
            mark: (msg): void => {
                console.timeLog(fullTimingName, msg);
            },
        };
    } else {
        return null;
    }
}
