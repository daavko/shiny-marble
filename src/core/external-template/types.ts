import type { Point } from '../../util/geometry';

export interface TemplateParseSuccess {
    success: true;
    name: string;
    position: Point;
    image: ImageData;
}

export interface TemplateParseError<T extends string> {
    success: false;
    errorCode: T;
    cause?: unknown;
}

export type TemplateParseResult<T extends string> = TemplateParseSuccess | TemplateParseError<T>;

export type BaseParsedTemplateErrorCode = 'unknown' | 'parseError';
