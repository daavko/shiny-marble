import { debug } from '../core/debug';

export function assertCanvasCtx<T extends RenderingContext | OffscreenRenderingContext | null>(
    ctx: T,
    errorMessage: string,
): asserts ctx is NonNullable<NoInfer<T>> {
    if (!ctx) {
        debug('Failed to get canvas context');
        throw new Error(errorMessage);
    }
}
