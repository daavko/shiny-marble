import type { TileId } from '../platform/template/common';
import type { RenderTileCompositingRequest } from './tile-compositor-types';

// todo: tweak numbers as needed, currently 4 threads seems like a good sweet spot...
const maxWorkerConcurrency = Math.min(4, Math.max(1, navigator.hardwareConcurrency - 1));

const idleWorkers: Worker[] = [];
const busyWorkers: Worker[] = [];

const pendingTileRequests = new Map<TileId, RenderTileCompositingRequest>();
const postedTileRequests = new Map<TileId, RenderTileCompositingRequest>();
