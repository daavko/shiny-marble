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

interface PendingTileRequest extends RenderTileCompositingRequest {
    resolve: (result: RenderTileCompositingResult) => void;
}

const pendingTileRequests = new Map<string, PendingTileRequest>();
const postedTileRequests = new Map<string, PendingTileRequest>();

function init(): void {
    if (idleWorkers.size + busyWorkers.size > 0) {
        return;
    }

    for (let i = 0; i < maxWorkerConcurrency; i++) {
        const worker = createWorker(tileCompositorWorkerCode);
        idleWorkers.add(worker);
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

export async function requestTileCompositing(tileId: TileId, templatesOnTile: TemplateTile[]): Promise<void> {
    const request: RenderTileCompositingRequest = {
        id: crypto.randomUUID(),
        tileId,
        dimensions: Platform.renderTilePixelDimensions,
        templateTiles: templatesOnTile,
        transparentColorIndex: Platform.colors.findIndex((v) => v.alpha === 0),
    };
}
