import { createWorker } from '../core/worker';
import { debugDetailed } from '../platform/debug';
import { Platform } from '../platform/platform';
import type { TileId } from '../platform/template/common';
import type { RenderTileCompositingRequest, RenderTileCompositingResult, TemplateTile } from './tile-compositor-types';
import tileCompositorWorkerCode from './tile-compositor.worker';

// todo: tweak numbers as needed, currently 4 threads seems like a good sweet spot...
const maxWorkerConcurrency = Math.min(4, Math.max(1, navigator.hardwareConcurrency - 1));

const idleWorkers = new Set<Worker>();
const busyWorkers = new Set<Worker>();

interface PendingTileRequest {
    resolve: (result: RenderTileCompositingResult) => void;
    renderTileRequest: RenderTileCompositingRequest;
}

interface PostedTileRequest {
    id: string;
    tileId: TileId;
    resolve: (result: RenderTileCompositingResult) => void;
}

const pendingTileRequests = new Map<TileId, PendingTileRequest>();
const postedTileRequests = new Map<TileId, PostedTileRequest>();

function sendCompositingRequestToWorker(worker: Worker, request: RenderTileCompositingRequest): void {
    worker.postMessage(request, { transfer: request.templateTiles.map((t) => t.data) });
}

export function initTileCompositorWorkers(): void {
    if (idleWorkers.size + busyWorkers.size > 0) {
        return;
    }

    for (let i = 0; i < maxWorkerConcurrency; i++) {
        const worker = createWorker(tileCompositorWorkerCode);
        idleWorkers.add(worker);

        worker.addEventListener('message', (event: MessageEvent<RenderTileCompositingResult>) => {
            const postedRequest = postedTileRequests.get(event.data.tileId);
            if (postedRequest?.id !== event.data.id) {
                // likely a response for a request that was abandoned
                return;
            }

            postedTileRequests.delete(event.data.tileId);
            pendingTileRequests.delete(event.data.tileId);

            postedRequest.resolve(event.data);

            const nextPendingRequest = pendingTileRequests.values().next().value;
            if (nextPendingRequest) {
                const { resolve, renderTileRequest } = nextPendingRequest;
                const { id, tileId } = renderTileRequest;
                pendingTileRequests.delete(tileId);
                postedTileRequests.set(tileId, { id, tileId, resolve });
                sendCompositingRequestToWorker(worker, renderTileRequest);
            } else {
                busyWorkers.delete(worker);
                idleWorkers.add(worker);
            }
        });
    }
}

function assertCompositingSuccess(
    result: RenderTileCompositingResult,
): asserts result is Extract<RenderTileCompositingResult, { success: true }> {
    if (!result.success) {
        debugDetailed('Tile compositing failed with error:', result.error);
        throw result.error;
    }
}

export async function requestTileCompositing(tileId: TileId, templatesOnTile: TemplateTile[]): Promise<ArrayBuffer> {
    const id = crypto.randomUUID();
    const renderTileRequest: RenderTileCompositingRequest = {
        id,
        tileId,
        dimensions: Platform.renderTilePixelDimensions,
        templateTiles: templatesOnTile,
        transparentColorIndex: Platform.colors.findIndex((v) => v.alpha === 0),
    };

    const { promise, resolve } = Promise.withResolvers<RenderTileCompositingResult>();

    // previous requests are always overwritten by new ones
    postedTileRequests.delete(tileId);
    pendingTileRequests.delete(tileId);

    const idleWorker = idleWorkers.values().next().value;
    if (idleWorker) {
        idleWorkers.delete(idleWorker);
        busyWorkers.add(idleWorker);
        postedTileRequests.set(tileId, { id, tileId, resolve });
        sendCompositingRequestToWorker(idleWorker, renderTileRequest);
    } else {
        pendingTileRequests.set(tileId, { resolve, renderTileRequest });
    }

    const result = await promise;
    assertCompositingSuccess(result);
    return result.data;
}
