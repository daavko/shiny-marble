import { debug } from './platform/debug';
import { Platform } from './platform/platform';
import { renderAlertsContainer, showErrorAlert } from './ui/components/alerts-container';
import { renderAppIcon } from './ui/components/app-icon';
import { waitWithTimeout } from './util/promise';
import { ImageTools } from './workers/image-tools';

function formatCanvasFingerprintingError(browser: string): string {
    return `${browser} with canvas fingerprinting protections detected. Shiny Marble will not be able to function properly with these protections enabled, since canvas fingerprinting protections mess with pixel values.`;
}

async function init(): Promise<void> {
    debug('Initializing Shiny Marble');

    renderAlertsContainer();

    // this must always be first, as it `import()`s the relevant web app module and patches it to detect the map instance
    // if this is not first, it runs late and misses the instance
    try {
        await Platform.addMapInstanceHook();
    } catch (e: unknown) {
        showErrorAlert('Failed to add map instance hook. Shiny Marble will not be functional.', e, 10000);
        return;
    }

    await Platform.initPlatform();

    const { promise: mapLoadPromise, resolve: resolveMapLoaded } = Promise.withResolvers<true>();
    const maybeMap = await waitWithTimeout(Platform.waitForMapInstance(), 10000);

    if (!maybeMap) {
        showErrorAlert(
            "Could not find map within 10 seconds. Shiny Marble will continue to wait for the map. If it doesn't load within a reasonable time, try reloading. If that doesn't help, please report this error.",
            undefined,
            10000,
        );
    }

    const map = maybeMap ?? (await Platform.waitForMapInstance());
    // todo: remove this global when ready
    Reflect.set(globalThis, '__shinyMarbleMapInstance', map);

    if (map._loaded) {
        debug('Map already loaded on initialization');
        resolveMapLoaded(true);
    } else {
        debug('Map not loaded on initialization, waiting for load event');
        map.on('load', function (e) {
            debug('Map load event fired', e);
            resolveMapLoaded(true);
        });
    }

    const maybeMapLoaded = await waitWithTimeout(mapLoadPromise, 10000);
    if (maybeMapLoaded == null) {
        showErrorAlert(
            "Map did not load within 10 seconds. Shiny Marble will continue to wait for the map to load. If it doesn't load within a reasonable time, try reloading. If that doesn't help, please report this error.",
            undefined,
            10000,
        );
        await mapLoadPromise;
    }

    try {
        await Platform.initTemplateFunctionality();
    } catch (e: unknown) {
        showErrorAlert('Failed to initialize template functionality. Shiny Marble will not be functional.', e, 10000);
    }

    renderAppIcon();

    try {
        if (await ImageTools.detectCanvasFingerprintingProtection()) {
            if (Reflect.has(navigator, 'brave')) {
                showErrorAlert(formatCanvasFingerprintingError('Brave Browser'), undefined, 30000);
            } else if (/Firefox\/\d+\.\d+$/i.exec(navigator.userAgent)) {
                showErrorAlert(formatCanvasFingerprintingError('Firefox'), undefined, 30000);
            } else {
                showErrorAlert(formatCanvasFingerprintingError('Unknown browser'), undefined, 30000);
            }
        }
    } catch (e: unknown) {
        showErrorAlert(
            'An error occurred while checking for canvas fingerprinting protections. Shiny Marble may not function properly if you have canvas fingerprinting protections enabled.',
            e,
            10000,
        );
    }
}

void init();
