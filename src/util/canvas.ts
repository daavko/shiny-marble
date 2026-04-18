import { debug } from '../core/debug';

export function assertCanvasCtx<T extends RenderingContext | OffscreenRenderingContext | null>(
    ctx: T,
): asserts ctx is NonNullable<NoInfer<T>> {
    if (!ctx) {
        const msg = 'Failed to get canvas context';
        debug(msg);
        throw new Error(msg);
    }
}
