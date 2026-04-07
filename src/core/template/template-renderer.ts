import type { CustomLayerInterface, CustomRenderMethodInput, Map } from 'maplibre-gl';

export class TemplateRenderer implements CustomLayerInterface {
    readonly id = 'shinymarble-template';
    readonly type = 'custom';
    readonly renderingMode = '2d';

    private map: Map | null = null;

    onAdd(map: Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
        this.map = map;
    }

    onRemove(map: Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
        this.map = null;
    }

    prerender(gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
        // todo
    }

    render(gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
        // todo
    }
}
