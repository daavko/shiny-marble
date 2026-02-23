import { renderAlertsContainer } from './ui/alerts-container';
import { renderAppIcon } from './ui/app-icon';

// addMapInstanceHook()
//     .then(async () => waitForMapInstance())
//     .then((instance) => {
//         console.log('map instance is ready', instance);
//     })
//     .catch((error: unknown) => {
//         console.error('error waiting for map instance', error);
//     });

renderAppIcon();
renderAlertsContainer();
