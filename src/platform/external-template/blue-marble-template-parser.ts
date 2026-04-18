import * as v from 'valibot';
import { MAX_TEMPLATE_CANVAS_DIMENSION } from '../../core/const';
import { assertCanvasCtx } from '../../util/canvas';
import {
    coordsWithNewOrigin,
    enlargeExtentToContainRectMut,
    extentSize,
    type PixelCoordinates,
    pixelExtent,
    tileCoordinates,
    tileToPixelCoordinates,
    worldWrapPixelCoordinates,
} from '../../util/geometry';
import { ImageTools } from '../../workers/image-tools-dispatcher';
import { Platform } from '../platform';
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
        const numbers = rawNumbers.map((s) => Number.parseInt(s, 10));
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
                    v.string(), // raw base64-encoded PNG
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
            thumbnail: v.optional(v.string()), // data url for a png, apparently the 1:1 image but gotta verify that
        }),
    ),
});

type BlueMarbleTemplateErrorCode =
    | BaseParsedTemplateErrorCode
    | 'missingTemplate'
    | 'tooManyTemplates'
    | 'noDisabledColors'
    | 'noEnhancedColors'
    | 'tileTooLarge'
    | 'tilesDontMatch';
export type BlueMarbleTemplateParseResult = TemplateParseResult<BlueMarbleTemplateErrorCode>;

function blueMarbleTileCoordsToPixelCoords(coords: BlueMarbleTileCoords): PixelCoordinates {
    const tilePixelCoords = tileToPixelCoordinates(
        tileCoordinates({ x: coords.tileX, y: coords.tileY }),
        Platform.tileDimensions,
    );
    tilePixelCoords.x += coords.x;
    tilePixelCoords.y += coords.y;
    return tilePixelCoords;
}

export async function parseBlueMarbleTemplateBlob(blob: Blob): Promise<BlueMarbleTemplateParseResult> {
    try {
        const text = await blob.text();
        const json: unknown = JSON.parse(text);
        return await parseBlueMarbleTemplate(json);
    } catch (e: unknown) {
        return { success: false, errorCode: 'unknown', cause: e };
    }
}

export async function parseBlueMarbleTemplate(json: unknown): Promise<BlueMarbleTemplateParseResult> {
    const parseResult = v.safeParse(blueMarbleTemplateSchema, json);
    if (!parseResult.success) {
        return { success: false, errorCode: 'parseError', cause: parseResult.issues };
    }

    const templateEntries = Object.entries(parseResult.output.templates);
    if (templateEntries.length === 0) {
        return { success: false, errorCode: 'missingTemplate' };
    } else if (templateEntries.length > 1) {
        return { success: false, errorCode: 'tooManyTemplates' };
    }

    const template = templateEntries[0][1];

    if (template.disabledColors.length > 0) {
        return { success: false, errorCode: 'noDisabledColors' };
    }

    if (template.enhancedColors.length > 0) {
        return { success: false, errorCode: 'noEnhancedColors' };
    }

    const templateCoords = blueMarbleTileCoordsToPixelCoords(template.coords);
    const tiles = template.tiles.map((tile) => {
        const byteArray = Uint8Array.fromBase64(tile.imageData);
        return {
            coords: blueMarbleTileCoordsToPixelCoords(tile.coords),
            blob: new Blob([byteArray], { type: 'image/png' }),
        };
    });

    const totalExtent = pixelExtent({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
    const detemplatizedTiles: {
        position: PixelCoordinates;
        tile: ImageData;
    }[] = [];
    for (const tile of tiles) {
        let bitmap: ImageBitmap;
        try {
            bitmap = await createImageBitmap(tile.blob);
        } catch (e) {
            return { success: false, errorCode: 'invalidImageData', cause: e };
        }

        if (bitmap.width / 3 > Platform.tileDimensions.width || bitmap.height / 3 > Platform.tileDimensions.height) {
            bitmap.close();
            return { success: false, errorCode: 'tileTooLarge' };
        }

        const tileCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const tileCtx = tileCanvas.getContext('2d');
        assertCanvasCtx(tileCtx);
        tileCtx.drawImage(bitmap, 0, 0);
        bitmap.close();
        const drawnImageData = tileCtx.getImageData(0, 0, tileCanvas.width, tileCanvas.height);
        const detemplatizedTile = await ImageTools.detemplatizeBlueMarbleTile(drawnImageData);

        const templateRelativeTileCoords = worldWrapPixelCoordinates(
            coordsWithNewOrigin(tile.coords, templateCoords),
            Platform.canvasPixelDimensions,
        );

        enlargeExtentToContainRectMut(totalExtent, {
            ...templateRelativeTileCoords,
            width: detemplatizedTile.width,
            height: detemplatizedTile.height,
        });

        const { width: totalWidth, height: totalHeight } = extentSize(totalExtent);

        if (totalWidth > MAX_TEMPLATE_CANVAS_DIMENSION || totalHeight > MAX_TEMPLATE_CANVAS_DIMENSION) {
            bitmap.close();
            return { success: false, errorCode: 'imageTooLarge' };
        }

        detemplatizedTiles.push({
            position: templateRelativeTileCoords,
            tile: detemplatizedTile,
        });
    }

    const { width: totalWidth, height: totalHeight } = extentSize(totalExtent);
    const canvas = new OffscreenCanvas(totalWidth, totalHeight);
    const ctx = canvas.getContext('2d');
    assertCanvasCtx(ctx);

    for (const tile of detemplatizedTiles) {
        ctx.putImageData(tile.tile, tile.position.x, tile.position.y);
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    return {
        success: true,
        name: template.name,
        position: templateCoords,
        image: imageData,
    };
}
