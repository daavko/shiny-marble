import type { PixelCoordinates } from '../../util/geometry-basic';

export interface TemplateParseSuccess {
    success: true;
    name: string;
    position: PixelCoordinates;
    image: ImageData;
}

export interface TemplateParseError<T extends string> {
    success: false;
    errorCode: T;
    cause?: unknown;
}

export type TemplateParseResult<T extends string> = TemplateParseSuccess | TemplateParseError<T>;

export type BaseParsedTemplateErrorCode =
    | 'unknown'
    | 'parseError'
    | 'invalidImageData'
    | 'noResizedImages'
    | 'imageTooLarge';

export type BaseTemplateParseResult = TemplateParseResult<BaseParsedTemplateErrorCode>;
