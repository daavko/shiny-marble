import * as v from 'valibot';
import { handleBlobFromParsedTemplate } from './common';
import type { BaseParsedTemplateErrorCode, TemplateParseResult } from './types';

const bplaceTemplateSchema = v.object({
    template: v.object({
        name: v.string(),
        imageData: v.string(), // data url for a png
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

type BplaceTemplateErrorCode = BaseParsedTemplateErrorCode | 'badScale' | 'badRotation';
type BplaceTemplateParseResult = TemplateParseResult<BplaceTemplateErrorCode>;

export async function parseBplaceTemplateBlob(blob: Blob): Promise<BplaceTemplateParseResult> {
    try {
        const text = await blob.text();
        const json: unknown = JSON.parse(text);
        return await parseBplaceTemplate(json);
    } catch (e: unknown) {
        return { success: false, errorCode: 'unknown', cause: e };
    }
}

export async function parseBplaceTemplate(json: unknown): Promise<BplaceTemplateParseResult> {
    const parseResult = v.safeParse(bplaceTemplateSchema, json);
    if (!parseResult.success) {
        return { success: false, errorCode: 'parseError', cause: parseResult.issues };
    }

    const { template } = parseResult.output;

    if (template.scale !== 1) {
        return { success: false, errorCode: 'badScale' };
    }

    if (template.rotation !== 0) {
        return { success: false, errorCode: 'badRotation' };
    }

    const imageBlob = await fetch(template.imageData).then((res) => res.blob());
    return handleBlobFromParsedTemplate(imageBlob, template.name, template.position, template.width, template.height);
}
