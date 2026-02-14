import { mountComponent } from './dom/component';
import { AppIcon } from './components/app-icon'; // addMapInstanceHook()

// addMapInstanceHook()
//     .then(async () => waitForMapInstance())
//     .then((instance) => {
//         console.log('map instance is ready', instance);
//     })
//     .catch((error: unknown) => {
//         console.error('error waiting for map instance', error);
//     });

mountComponent(document.body, AppIcon);
