import * as v from 'valibot';
import type { BaseParsedTemplateErrorCode, TemplateParseResult } from './types';

interface BlueMarbleTileCoords {
    tileX: number;
    tileY: number;
    x: number;
    y: number;
}

interface BlueMarbleTemplateTile {
    coords: BlueMarbleTileCoords;
    imageData: string; // base64-encoded PNG
}

const coordsStringSchema = v.pipe(
    v.string(),
    v.rawTransform(({ dataset, addIssue, NEVER }) => {
        const rawNumbers = dataset.value.split(',').map((s) => s.trim());
        if (rawNumbers.length !== 4) {
            addIssue({
                message: `Expected 4 numbers separated by commas, got ${rawNumbers.length}`,
            });
            return NEVER;
        }
        const numbers = rawNumbers.map((s) => Number(s));
        if (numbers.some((n) => isNaN(n))) {
            addIssue({
                message: `Expected all values to be valid numbers, got ${rawNumbers.join(', ')}`,
            });
            return NEVER;
        }
        return {
            tileX: numbers[0],
            tileY: numbers[1],
            x: numbers[2],
            y: numbers[3],
        } satisfies BlueMarbleTileCoords;
    }),
);

const blueMarbleTemplateSchema = v.object({
    whoami: v.literal('BlueMarble'),
    templates: v.record(
        v.string(),
        v.object({
            name: v.string(),
            coords: coordsStringSchema, // e.g. "295, 1254, 153, 769"
            disabledColors: v.array(v.unknown()), // we want this empty
            enhancedColors: v.array(v.unknown()), // we want this empty
            tiles: v.pipe(
                v.record(
                    v.string(), // e.g. "0295,1254,153,769" (no, don't ask why it's without spaces)
                    v.string(), // base64-encoded PNG
                ),
                v.rawTransform(({ dataset, addIssue, NEVER }) => {
                    const result: BlueMarbleTemplateTile[] = [];
                    for (const [coordsString, imageData] of Object.entries(dataset.value)) {
                        const coordsParseResult = v.safeParse(coordsStringSchema, coordsString);
                        if (!coordsParseResult.success) {
                            for (const error of coordsParseResult.issues) {
                                addIssue({
                                    message: error.message,
                                });
                            }
                            return NEVER;
                        }
                        result.push({ coords: coordsParseResult.output, imageData });
                    }
                    return result;
                }),
            ),
        }),
    ),
});

type BlueMarbleTemplateErrorCode =
    | BaseParsedTemplateErrorCode
    | 'noDisabledColors'
    | 'noEnhancedColors'
    | 'tilesDontMatch';
export type BlueMarbleTemplateParseResult = TemplateParseResult<BlueMarbleTemplateErrorCode>;

export async function parseBlueMarbleTemplateBlob(blob: Blob): Promise<BlueMarbleTemplateParseResult> {
    try {
        const text = await blob.text();
        const json: unknown = JSON.parse(text);
        return parseBlueMarbleTemplate(json);
    } catch (e: unknown) {
        return { success: false, errorCode: 'unknown', cause: e };
    }
}

export function parseBlueMarbleTemplate(json: unknown): BlueMarbleTemplateParseResult {
    const parseResult = v.safeParse(blueMarbleTemplateSchema, json);
    if (parseResult.success) {
        // todo
    } else {
        return { success: false, errorCode: 'parseError', cause: parseResult.issues };
    }
}
