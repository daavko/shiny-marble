import * as v from 'valibot';

const coordinatePairSchema = v.tuple([v.number(), v.number()]);

const cityFeature = v.pipe(
    v.object({
        name: v.string(),
        country_code: v.string(),
        population: v.number(),
        coordinates: coordinatePairSchema,
    }),
    v.transform(({ name, country_code, population, coordinates }) => ({
        name,
        countryCode: country_code,
        population,
        coordinates,
    })),
);
export type CityFeature = v.InferOutput<typeof cityFeature>;
export const cityFeaturesResponse = v.array(cityFeature);

const geographicFeature = v.pipe(
    v.object({
        name: v.string(),
        feature_type: v.string(),
        coordinates: v.array(v.array(v.array(coordinatePairSchema))),
    }),
    v.transform(({ name, feature_type, coordinates }) => ({
        name,
        featureType: feature_type,
        coordinates,
    })),
);
export type GeographicFeature = v.InferOutput<typeof geographicFeature>;
export const geographicFeaturesResponse = v.array(geographicFeature);

const countryFeature = v.pipe(
    v.object({
        name: v.string(),
        iso_code: v.string(),
        coordinates: v.array(v.array(v.array(coordinatePairSchema))),
    }),
    v.transform(({ name, iso_code, coordinates }) => ({
        name,
        isoCode: iso_code,
        coordinates,
    })),
);
export type CountryFeature = v.InferOutput<typeof countryFeature>;
export const countryFeaturesResponse = v.array(countryFeature);

const citySearchResult = v.pipe(
    v.object({
        properties: v.object({
            city: v.string(),
            country: v.string(),
        }),
    }),
    v.transform(({ properties: { city, country } }) => ({ city, country })),
);
export type CitySearchResult = v.InferOutput<typeof citySearchResult>;
export const locationSearchResponseSchema = v.pipe(
    v.object({
        features: v.array(citySearchResult),
    }),
    v.transform((data) => data.features.map((feature) => feature)),
);

const geographicFeatureSearchResult = v.pipe(
    v.object({
        properties: v.object({
            name: v.string(),
            feature_type: v.string(),
        }),
    }),
    v.transform(({ properties: { name, feature_type } }) => ({ name, featureType: feature_type })),
);
export type GeographicFeatureSearchResult = v.InferOutput<typeof geographicFeatureSearchResult>;
export const geographicFeatureSearchResponse = v.array(geographicFeatureSearchResult);

const colorUsageRecord = v.pipe(
    v.object({
        name: v.string(),
        usage_count: v.number(),
        hex_value: v.string(),
    }),
    v.transform(({ name, usage_count, hex_value }) => ({ name, usageCount: usage_count, hexValue: hex_value })),
);
export type ColorUsageRecord = v.InferOutput<typeof colorUsageRecord>;
export const colorUsageStatsResponse = v.array(colorUsageRecord);

const tileInfo = v.object({
    tile_x: v.number(),
    tile_y: v.number(),
    is_dirty: v.boolean(),
    last_rendered_at: v.pipe(
        v.string(),
        v.isoDateTime(),
        v.transform((str) => new Date(str)),
    ),
});
export type TileInfo = v.InferOutput<typeof tileInfo>;
export const tilesInfoResponse = v.array(tileInfo);
