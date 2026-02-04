import { addMapInstanceHook, waitForMapInstance } from './wplace/hooks';

addMapInstanceHook()
    .then(async () => waitForMapInstance())
    .then((instance) => {
        console.log('map instance is ready', instance);
    })
    .catch((error: unknown) => {
        console.error('error waiting for map instance', error);
    });
