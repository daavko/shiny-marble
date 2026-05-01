import { BlobReader, BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { Platform } from '../platform';
import {
    TEMPLATE_ZIP_CURRENT_VERSION,
    TEMPLATE_ZIP_METADATA_FILENAME,
    type TemplateArchiveMetadata,
    type TemplateArchiveTemplateMetadata,
} from './common';
import type { LiveTemplate } from './registry';

export interface ExportableTemplate {
    template: LiveTemplate;
    image: Blob;
}

function createWritingInstances(): [BlobWriter, ZipWriter<Blob>] {
    const blobWriter = new BlobWriter();
    const zipWriter = new ZipWriter(blobWriter);
    return [blobWriter, zipWriter];
}

async function writeMarkerFile(writer: ZipWriter<Blob>): Promise<void> {
    const metadata: TemplateArchiveMetadata = {
        version: TEMPLATE_ZIP_CURRENT_VERSION,
        platform: Platform.id,
        paletteVersion: Platform.colorsVersion,
    };
    const contentReader = new TextReader(JSON.stringify(metadata, null, 2));
    await writer.add(TEMPLATE_ZIP_METADATA_FILENAME, contentReader);
}

async function writeSingleTemplate(writer: ZipWriter<Blob>, { template, image }: ExportableTemplate): Promise<void> {
    const metadata: TemplateArchiveTemplateMetadata = {
        id: template.id,
        name: template.name,
        coordinates: template.coordinates,
    };
    const metadataReader = new TextReader(JSON.stringify(metadata, null, 2));
    const imageReader = new BlobReader(image);
    await writer.add(`${template.id}.json`, metadataReader);
    await writer.add(`${template.id}.png`, imageReader);
}

export async function exportTemplate(template: ExportableTemplate): Promise<Blob> {
    return exportMultipleTemplates([template]);
}

export async function exportMultipleTemplates(templates: ExportableTemplate[]): Promise<Blob> {
    const [blobWriter, zipWriter] = createWritingInstances();

    await writeMarkerFile(zipWriter);

    for (const template of templates) {
        await writeSingleTemplate(zipWriter, template);
    }

    await zipWriter.close();
    return blobWriter.getData();
}
