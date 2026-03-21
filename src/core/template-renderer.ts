import type { CustomLayerInterface, CustomRenderMethodInput, Map } from 'maplibre-gl';

export class TemplateRenderer implements CustomLayerInterface {
    readonly id = 'sm-template';
    readonly type = 'custom';
    readonly renderingMode = '2d';

    onAdd(map: Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
        // todo
    }

    onRemove(map: Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
        // todo
    }

    prerender(gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
        // todo
    }

    render(gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
        // todo
    }
}
