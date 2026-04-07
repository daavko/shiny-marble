import * as v from 'valibot';

const wplaceTemplateSchema = v.object({
    name: v.string(),
    image: v.object({
        dataUrl: v.string(),
        width: v.number(),
        height: v.number(),
    }),
    bounds: v.object({
        north: v.number(),
        south: v.number(),
        east: v.number(),
        west: v.number(),
    }),
});
type WplaceTemplate = v.InferOutput<typeof wplaceTemplateSchema>;

export async function parseWplaceTemplateBlob(blob: Blob): Promise<WplaceTemplate> {
    const text = await blob.text();
    const json: unknown = JSON.parse(text);
    return parseWplaceTemplate(json);
}

export function parseWplaceTemplate(json: unknown): WplaceTemplate {
    // todo
}
