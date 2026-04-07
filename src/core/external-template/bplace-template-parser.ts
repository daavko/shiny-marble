import * as v from 'valibot';
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

type BplaceTemplateErrorCode = BaseParsedTemplateErrorCode | 'badScale' | 'badRotation' | 'imageTooLarge';
type BplaceTemplateParseResult = TemplateParseResult<BplaceTemplateErrorCode>;

export async function parseBplaceTemplateBlob(blob: Blob): Promise<BplaceTemplateParseResult> {
    try {
        const text = await blob.text();
        const json: unknown = JSON.parse(text);
        return parseBplaceTemplate(json);
    } catch (e: unknown) {
        return { success: false, errorCode: 'unknown', cause: e };
    }
}

export function parseBplaceTemplate(json: unknown): BplaceTemplateParseResult {
    const parseResult = v.safeParse(bplaceTemplateSchema, json);
    if (!parseResult.success) {
        return { success: false, errorCode: 'parseError', cause: parseResult.issues };
    }

    if (parseResult.output.template.scale !== 1) {
        return { success: false, errorCode: 'badScale' };
    }

    if (parseResult.output.template.rotation !== 0) {
        return { success: false, errorCode: 'badRotation' };
    }

    // todo
}
