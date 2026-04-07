import * as v from 'valibot';
import type { BaseParsedTemplateErrorCode, TemplateParseResult } from './types';

const wplaceTemplateSchema = v.object({
    name: v.string(),
    image: v.object({
        dataUrl: v.string(), // data url for a png
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

type WplaceTemplateErrorCode = BaseParsedTemplateErrorCode | 'badBounds' | 'imageTooLarge';
type WplaceTemplateParseResult = TemplateParseResult<WplaceTemplateErrorCode>;

export async function parseWplaceTemplateBlob(blob: Blob): Promise<WplaceTemplateParseResult> {
    try {
        const text = await blob.text();
        const json: unknown = JSON.parse(text);
        return parseWplaceTemplate(json);
    } catch (e: unknown) {
        return { success: false, errorCode: 'unknown', cause: e };
    }
}

export function parseWplaceTemplate(json: unknown): WplaceTemplateParseResult {
    // todo
}
