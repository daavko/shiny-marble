import { debug } from './core/debug';
import { Platform } from './platform/platform';
import { renderAlertsContainer, showErrorAlert } from './ui/alerts-container';
import { renderAppIcon } from './ui/app-icon';
import { waitWithTimeout } from './util/promise';
import { ImageTools } from './workers/image-tools-dispatcher';

function formatCanvasFingerprintingError(browser: string): string {
    return `${browser} with canvas fingerprinting protections detected. Shiny Marble will not be able to function properly with these protections enabled, since canvas fingerprinting protections mess with pixel values.`;
}

async function init(): Promise<void> {
    debug('Initializing Shiny Marble');

    Platform.initPlatform();
    renderAlertsContainer();

    const { promise: mapLoadPromise, resolve: resolveMapLoaded } = Promise.withResolvers<void>();
    try {
        await Platform.addMapInstanceHook();

        const maybeMap = await waitWithTimeout(Platform.waitForMapInstance(), 10000);

        if (!maybeMap) {
            showErrorAlert(
                "Could not find map within 10 seconds. Shiny Marble will continue to wait for the map to load. If it doesn't load within a reasonable time, try reloading. If that doesn't help, please report this error.",
                undefined,
                10000,
            );
        }

        const map = maybeMap ?? (await Platform.waitForMapInstance());
        Reflect.set(globalThis, '__shinyMarbleMapInstance', map);

        // const cityCenter = [-67.35400168661789, 9.90099895844917];
        // const circleGeoJson = turf.circle(cityCenter, 5000, { steps: 64, units: 'meters' });

        map.on('load', function () {
            resolveMapLoaded();
            // setTimeout(() => {
            //     map.addSource('shiny-marble-circle', {
            //         type: 'geojson',
            //         data: {
            //             type: 'Feature',
            //             geometry: geoJson,
            //             properties: {},
            //         },
            //     });
            //
            //     map.addLayer({
            //         id: 'shiny-marble-circle-layer',
            //         type: 'fill',
            //         source: 'shiny-marble-circle',
            //         paint: {
            //             'fill-color': '#ff0000',
            //             'fill-opacity': 0.2,
            //         },
            //     });
            //     map.addLayer({
            //         id: 'shiny-marble-circle-outline-layer',
            //         type: 'line',
            //         source: 'shiny-marble-circle',
            //         paint: {
            //             'line-color': '#ff0000',
            //             'line-width': 2,
            //         },
            //     });
            // }, 2000);
        });
    } catch (e: unknown) {
        showErrorAlert('Failed to load Map instance. Shiny Marble will not be functional.', e, 10000);
        return;
    }

    await mapLoadPromise;

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
