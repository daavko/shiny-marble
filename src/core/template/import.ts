import { BlobReader, BlobWriter, ZipReader } from '@zip.js/zip.js';
import type { SafeParseResult } from 'valibot';
import * as v from 'valibot';
import { Platform } from '../../platform/platform';
import { pixelCoordinates } from '../../util/geometry';
import { ImageTools } from '../../workers/image-tools-dispatcher';
import { MAX_INPUT_TEMPLATE_FILE_SIZE, MAX_TEMPLATE_CANVAS_DIMENSION } from '../const';
import { debug } from '../debug';
import {
    TEMPLATE_ZIP_IMPORT_MAX_SIZE,
    TEMPLATE_ZIP_IMPORT_MAX_TEMPLATE_COUNT,
    TEMPLATE_ZIP_METADATA_FILENAME,
    type TemplateArchiveMetadata,
    type TemplateArchiveTemplateMetadata,
} from './common';

const metadataBaseSchema = v.object({
    version: v.number(),
});

const metadataV1Schema = v.pipe(
    v.object({
        version: v.literal(1),
        platform: v.string(),
        paletteVersion: v.number(),
    }),
    v.transform((data): TemplateArchiveMetadata => data),
);

const templateV1MetadataSchema = v.pipe(
    v.object({
        id: v.string(),
        name: v.string(),
        coordinates: v.object({
            x: v.number(),
            y: v.number(),
        }),
    }),
    v.transform(
        (data): TemplateArchiveTemplateMetadata => ({
            ...data,
            coordinates: pixelCoordinates(data.coordinates),
        }),
    ),
);

const templateMetadataFilenameRegex = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.json$/i;
const templateImageFilenameRegex = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.png$/i;

async function readV1Metadata(file: Blob): Promise<SafeParseResult<typeof metadataV1Schema>> {
    return v.safeParse(metadataV1Schema, JSON.parse(await file.text()));
}

async function readV1TemplateMetadata(file: Blob): Promise<SafeParseResult<typeof templateV1MetadataSchema>> {
    return v.safeParse(templateV1MetadataSchema, JSON.parse(await file.text()));
}

async function readTemplateImage(file: Blob): Promise<ArrayBuffer | null> {
    try {
        const bitmap = await createImageBitmap(file);

        if (bitmap.width > MAX_TEMPLATE_CANVAS_DIMENSION || bitmap.height > MAX_TEMPLATE_CANVAS_DIMENSION) {
            return null;
        }

        const indexedImageResult = await ImageTools.loadIndexedImage(bitmap, Platform.colors);
        if (!indexedImageResult.success) {
            return null;
        }

        return await ImageTools.writeIndexedPngBuffer(indexedImageResult.image, Platform.colors, true);
    } catch (e) {
        debug('error reading template image from zip file', e);
        return null;
    }
}

async function parseFormatVersion(markerFile: Blob): Promise<number | null> {
    const parseResult = v.safeParse(metadataBaseSchema, JSON.parse(await markerFile.text()));
    if (parseResult.success) {
        return parseResult.output.version;
    } else {
        return null;
    }
}

export interface TemplateImportEntrySuccess {
    success: true;
    metadata: TemplateArchiveTemplateMetadata;
    image: ArrayBuffer;
}

export interface TemplateImportEntryError {
    success: false;
    error: 'invalidMetadata' | 'invalidImage';
}

export type TemplateImportEntry = TemplateImportEntrySuccess | TemplateImportEntryError;

export async function* createTemplatesGenerator(
    zipFile: Blob,
    expectedTemplateCollection: TemplateCollectionImportInfoSuccess,
): AsyncGenerator<TemplateImportEntry, void> {
    const zipReader = new ZipReader(new BlobReader(zipFile));
    for await (const entry of zipReader.getEntriesGenerator()) {
        if (entry.directory) {
            continue;
        }

        const imageFilenameMatch = templateImageFilenameRegex.exec(entry.filename);
        if (!imageFilenameMatch) {
            continue;
        }

        const templateId = imageFilenameMatch[1];
        const metadataBlob = expectedTemplateCollection.templates.get(templateId);
        if (!metadataBlob) {
            continue;
        }

        let metadata: TemplateArchiveTemplateMetadata;

        switch (expectedTemplateCollection.metadata.version) {
            case 1: {
                const metadataParseResult = await readV1TemplateMetadata(metadataBlob);

                if (metadataParseResult.success) {
                    metadata = metadataParseResult.output;
                    break;
                } else {
                    yield { success: false, error: 'invalidMetadata' };
                    continue;
                }
            }

            default:
                throw new Error('This should never happen');
        }

        const imageData = await entry.getData(new BlobWriter());
        const imageResult = await readTemplateImage(imageData);
        if (!imageResult) {
            yield { success: false, error: 'invalidImage' };
            continue;
        }

        expectedTemplateCollection.templates.delete(templateId);

        yield {
            success: true,
            metadata,
            image: imageResult,
        };
    }
}

type TemplateCollectionImportInfoErrorType =
    | 'zipTooLarge'
    | 'missingMarkerFile'
    | 'invalidMarkerFile'
    | 'unsupportedVersion'
    | 'tooManyTemplates';

export interface TemplateCollectionImportInfoError {
    success: false;
    error: TemplateCollectionImportInfoErrorType;
}

export interface TemplateCollectionImportInfoSuccess {
    success: true;
    metadata: TemplateArchiveMetadata;
    templateCount: number;
    templates: Map<string, Blob>;
}

export type TemplateCollectionImportInfoResult =
    | TemplateCollectionImportInfoSuccess
    | TemplateCollectionImportInfoError;

export async function collectTemplatesInfo(zipFile: Blob): Promise<TemplateCollectionImportInfoResult> {
    if (zipFile.size > TEMPLATE_ZIP_IMPORT_MAX_SIZE) {
        return { success: false, error: 'zipTooLarge' };
    }

    const zipReader = new ZipReader(new BlobReader(zipFile));
    let metadataFile: Blob | null = null;
    const foundTemplateMetadata = new Map<string, Blob>();
    const foundTemplateImageIds = new Set<string>();
    for await (const entry of zipReader.getEntriesGenerator()) {
        if (entry.directory) {
            continue;
        }

        if (entry.filename === TEMPLATE_ZIP_METADATA_FILENAME) {
            metadataFile = await entry.getData(new BlobWriter());
            continue;
        }

        if (entry.uncompressedSize > MAX_INPUT_TEMPLATE_FILE_SIZE) {
            debug(
                `skipping file ${entry.filename} in template import zip because it's too large (${entry.uncompressedSize} bytes, max size ${MAX_INPUT_TEMPLATE_FILE_SIZE} bytes)`,
            );
            continue;
        }

        const metadataMatch = templateMetadataFilenameRegex.exec(entry.filename);
        if (metadataMatch) {
            foundTemplateMetadata.set(metadataMatch[1], await entry.getData(new BlobWriter()));
            continue;
        }

        const imageMatch = templateImageFilenameRegex.exec(entry.filename);
        if (imageMatch) {
            foundTemplateImageIds.add(imageMatch[1]);
            continue;
        }

        if (
            foundTemplateMetadata.size > TEMPLATE_ZIP_IMPORT_MAX_TEMPLATE_COUNT ||
            foundTemplateImageIds.size > TEMPLATE_ZIP_IMPORT_MAX_TEMPLATE_COUNT
        ) {
            return { success: false, error: 'tooManyTemplates' };
        }
    }

    if (!metadataFile) {
        return { success: false, error: 'missingMarkerFile' };
    }

    const formatVersion = await parseFormatVersion(metadataFile);
    if (formatVersion === null) {
        return { success: false, error: 'invalidMarkerFile' };
    }

    let metadata: TemplateArchiveMetadata;
    switch (formatVersion) {
        case 1: {
            const parseResult = await readV1Metadata(metadataFile);
            if (parseResult.success) {
                metadata = parseResult.output;
            } else {
                return { success: false, error: 'invalidMarkerFile' };
            }
            break;
        }
        default:
            return { success: false, error: 'unsupportedVersion' };
    }

    const foundTemplateMetadataIds = new Set(foundTemplateMetadata.keys());
    const templateIds = foundTemplateMetadataIds.intersection(foundTemplateImageIds);

    for (const key of foundTemplateMetadata.keys()) {
        if (!templateIds.has(key)) {
            foundTemplateMetadata.delete(key);
        }
    }

    return {
        success: true,
        metadata,
        templateCount: templateIds.size,
        templates: foundTemplateMetadata,
    };
}
