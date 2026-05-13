import type { TileId } from './common';

export const DEFAULT_TILE_CACHE_CAPACITY = 128 * 1024 * 1024;

let cacheCapacity = DEFAULT_TILE_CACHE_CAPACITY;

interface CacheEntry {
    tileId: TileId;
    data: ArrayBuffer;
    accessTime: number;
}

const cache = new Map<TileId, CacheEntry>();
let usedCapacity = 0;
const cacheAccessTimes: CacheEntry[] = [];

function resizeToFitCapacity(): void {
    if (usedCapacity <= cacheCapacity) {
        return;
    }

    let leastUsedEntriesToRemove = 0;
    let capacityToRemove = 0;
    for (let i = cacheAccessTimes.length - 1; i >= 0; i--) {
        const entry = cacheAccessTimes[i];
        capacityToRemove += entry.data.byteLength;
        leastUsedEntriesToRemove++;

        if (usedCapacity - capacityToRemove <= cacheCapacity) {
            break;
        }
    }

    const entriesToRemove = cacheAccessTimes.splice(-leastUsedEntriesToRemove, leastUsedEntriesToRemove);
    for (const entry of entriesToRemove) {
        cache.delete(entry.tileId);
    }
    usedCapacity -= capacityToRemove;
}

function sortAccessTimes(): void {
    cacheAccessTimes.sort((a, b) => b.accessTime - a.accessTime);
}

function updateAccessTime(tileId: TileId): void {
    const now = Date.now();
    const accessTimeIndex = cacheAccessTimes.findIndex((entry) => entry.tileId === tileId);
    cacheAccessTimes[accessTimeIndex].accessTime = now;

    sortAccessTimes();
}

export const TileCache = {
    setCapacity(capacity: number): void {
        cacheCapacity = capacity;
        resizeToFitCapacity();
    },
    has(tileId: TileId): boolean {
        return cache.has(tileId);
    },
    get(tileId: TileId): ArrayBuffer | undefined {
        const data = cache.get(tileId);
        if (data) {
            updateAccessTime(tileId);
        }

        return data?.data;
    },
    set(tileId: TileId, data: ArrayBuffer): void {
        const entry = { tileId, data, accessTime: performance.now() };

        cache.set(tileId, entry);
        usedCapacity += data.byteLength;

        cacheAccessTimes.push(entry);
        sortAccessTimes();
        resizeToFitCapacity();
    },
    delete(tileId: TileId): void {
        const tileData = cache.get(tileId);
        if (tileData) {
            usedCapacity -= tileData.data.byteLength;
            cache.delete(tileId);
        }
        const accessTimeIndex = cacheAccessTimes.findIndex((entry) => entry.tileId === tileId);
        if (accessTimeIndex !== -1) {
            cacheAccessTimes.splice(accessTimeIndex, 1);
        }
    },
};
