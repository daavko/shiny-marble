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
