import { Platform } from './platform/platform';
import { renderAlertsContainer, showErrorAlert } from './ui/alerts-container';
import { renderAppIcon } from './ui/app-icon';
import { debug } from './platform/debug';

async function init(): Promise<void> {
    debug('Initializing Shiny Marble');

    Platform.initialize();
    renderAlertsContainer();

    const { promise: mapLoadPromise, resolve: resolveMapLoaded } = Promise.withResolvers<void>();
    try {
        await Platform.addMapInstanceHook();
        const map = await Platform.waitForMapInstance();
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

    debug('Shiny Marble initialized successfully');
}

void init();
