import type { PixelCoordinates } from '../../util/geometry-basic';

export type TileId = `${number}_${number}`;

/*
Shiny Marble export format, v1:

contains the following:
- a .smtemplate.json file containing the following metadata:
    - a version number of the format
    - platform identifier (cross-platform compatibility is not a thing)
    - palette version (in case the platform palette changes in some way)
- an arbitrary number of pairs of files, each pair representing a template:
    - a json file named {templateId}.json containing the template metadata:
        - id
        - name
        - coordinates in pixel space
    - a png file named {templateId}.png containing the template image

this format is reasonably simple to read and write programatically and since it's just a zip file, users can easily
open it and inspect/extract/modify the contents if they want
 */

export const TEMPLATE_ZIP_METADATA_FILENAME = '.smtemplate.json';
export const TEMPLATE_ZIP_CURRENT_VERSION = 1;

export const TEMPLATE_ZIP_IMPORT_MAX_SIZE = 100 * 1024 * 1024; // 100MiB
export const TEMPLATE_ZIP_IMPORT_WARN_TEMPLATE_COUNT = 10;
export const TEMPLATE_ZIP_IMPORT_MAX_TEMPLATE_COUNT = 1000;

export interface TemplateArchiveMetadata {
    version: number;
    platform: string;
    paletteVersion: number;
}

export interface TemplateArchiveTemplateMetadata {
    id: string;
    name: string;
    coordinates: PixelCoordinates;
}
