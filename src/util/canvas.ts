export function assertCanvasCtx<T extends RenderingContext | OffscreenRenderingContext | null>(
    ctx: T,
): asserts ctx is NonNullable<NoInfer<T>> {
    if (!ctx) {
        const msg = 'Failed to get canvas context';
        throw new Error(msg);
    }
}
