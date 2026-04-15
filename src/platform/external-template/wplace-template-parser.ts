import * as v from 'valibot';
import { coordsWithNewOrigin, worldWrapPixelCoordinates } from '../../util/geometry';
import { Platform } from '../platform';
import { handleBlobFromParsedTemplate } from './common';
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

type WplaceTemplateErrorCode = BaseParsedTemplateErrorCode | 'badBounds';
type WplaceTemplateParseResult = TemplateParseResult<WplaceTemplateErrorCode>;

export async function parseWplaceTemplateBlob(blob: Blob): Promise<WplaceTemplateParseResult> {
    try {
        const text = await blob.text();
        const json: unknown = JSON.parse(text);
        return await parseWplaceTemplate(json);
    } catch (e: unknown) {
        return { success: false, errorCode: 'unknown', cause: e };
    }
}

export async function parseWplaceTemplate(json: unknown): Promise<WplaceTemplateParseResult> {
    const parseResult = v.safeParse(wplaceTemplateSchema, json);
    if (!parseResult.success) {
        return { success: false, errorCode: 'parseError', cause: parseResult.issues };
    }

    const { name, image, bounds } = parseResult.output;

    // todo: verify that this actually works correctly and that bounds will result in correct pixel coords
    const topLeftPixel = Platform.latLonToPixel({ lat: bounds.north, lon: bounds.west }, 'floor');
    const bottomRightPixel = worldWrapPixelCoordinates(
        coordsWithNewOrigin(Platform.latLonToPixel({ lat: bounds.south, lon: bounds.east }, 'floor'), topLeftPixel),
        Platform.canvasPixelDimensions,
    );

    const expectedWidth = bottomRightPixel.x;
    const expectedHeight = bottomRightPixel.y;

    const imageBlob = await fetch(image.dataUrl).then((res) => res.blob());
    return handleBlobFromParsedTemplate(imageBlob, name, topLeftPixel, expectedWidth, expectedHeight);
}
