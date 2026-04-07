import * as v from 'valibot';

const bplaceTemplateSchema = v.object({
    template: v.object({
        name: v.string(),
        imageData: v.string(),
        position: v.object({
            x: v.number(),
            y: v.number(),
        }),
        scale: v.number(),
        rotation: v.number(),
        width: v.number(),
        height: v.number(),
    }),
});
type BplaceTemplate = v.InferOutput<typeof bplaceTemplateSchema>;

export async function parseBplaceTemplateBlob(blob: Blob): Promise<BplaceTemplate> {
    const text = await blob.text();
    const json: unknown = JSON.parse(text);
    return parseBplaceTemplate(json);
}

export function parseBplaceTemplate(json: unknown): BplaceTemplate {
    const parseResult = v.safeParse(bplaceTemplateSchema, json);
    if (!parseResult.success) {
        throw new Error('Failed to parse Bplace template', { cause: parseResult.issues });
    }

    if (parseResult.output.template.scale != 1) {
        throw new Error('Bplace template scale is not 1, which is not supported');
    }
}
