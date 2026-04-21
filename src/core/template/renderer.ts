import type { CustomLayerInterface, CustomRenderMethodInput, Map } from 'maplibre-gl';

export class TemplateRenderer implements CustomLayerInterface {
    readonly id = 'shinymarble-template';
    readonly type = 'custom';
    readonly renderingMode = '2d';

    private map: Map | null = null;

    onAdd(map: Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
        this.map = map;
        // todo add event listeners to load template tiles when map moves, keep a cache of last N template tiles in memory
    }

    onRemove(map: Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
        this.map = null;
        // todo remove events
    }

    prerender(gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
        // todo quite possibly remove, we might not need a pre-render pass
    }

    render(gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
        // todo render tiles that are in the viewport
    }
}
