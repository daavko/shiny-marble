import * as v from 'valibot';
import {
    type CityFeature,
    cityFeaturesResponse,
    type CitySearchResult,
    type ColorUsageRecord,
    colorUsageStatsResponse,
    type CountryFeature,
    countryFeaturesResponse,
    type GeographicFeature,
    geographicFeatureSearchResponse,
    type GeographicFeatureSearchResult,
    geographicFeaturesResponse,
    locationSearchResponseSchema,
} from './schemas';

const SUPABASE_URL = 'https://bocmfycjqgujxkhcnfck.supabase.co';
const SUPABASE_API_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvY21meWNqcWd1anhraGNuZmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNTQyNzUsImV4cCI6MjA3NDczMDI3NX0.XOMY3fYaLbR22u0nLQ-KwsqYHMUyHqa4aS4WkaPpS2c';

const supabaseTokenObjectSchema = v.object({
    access_token: v.string(),
    expires_at: v.number(),
});

function getSupabaseAccessToken(): string {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key != null && key.startsWith('sb-') && key.endsWith('-auth-token')) {
            const tokenObjectString = localStorage.getItem(key);
            if (tokenObjectString == null) {
                throw new Error(
                    `Expected to find a token object in localStorage at a known key but got null, this should never happen`,
                );
            }

            const tokenObject = JSON.parse(tokenObjectString) as unknown;
            const parsedTokenObject = v.safeParse(supabaseTokenObjectSchema, tokenObject);
            if (!parsedTokenObject.success) {
                throw new Error('Expected token object in localStorage to conform to schema', {
                    cause: parsedTokenObject.issues,
                });
            }

            const { access_token, expires_at } = parsedTokenObject.output;
            const currentTimeInSeconds = Math.floor(Date.now() / 1000);
            if (expires_at < currentTimeInSeconds) {
                throw new Error(`Supabase access token found in localStorage is expired`);
            }

            return access_token;
        }
    }

    throw new Error(`Failed to find a Supabase access token in localStorage`);
}

function buildSupabaseUrl(prefix: string, path: string, queryParams?: URLSearchParams): URL {
    const url = new URL(`/${prefix}/${path}`, SUPABASE_URL);
    if (queryParams) {
        url.search = queryParams.toString();
    }
    return url;
}

async function processSupabaseResponse<T>(response: Response, responseSchema: v.GenericSchema<unknown, T>): Promise<T> {
    if (!response.ok) {
        throw new Error(`Supabase request failed with status ${response.status}`);
    }

    const responseData: unknown = await response.json();
    const parsedResponse = v.safeParse(responseSchema, responseData);
    if (!parsedResponse.success) {
        throw new Error(`Failed to parse Supabase response: ${JSON.stringify(parsedResponse.issues)}`);
    }

    return parsedResponse.output;
}

async function doSupabaseRestRequest<T>(
    endpoint: string,
    queryParams: URLSearchParams,
    responseSchema: v.GenericSchema<unknown, T>,
): Promise<T> {
    const response = await fetch(buildSupabaseUrl('rest/v1', endpoint, queryParams), {
        method: 'GET',
        headers: {
            apikey: SUPABASE_API_KEY,
            Authorization: `Bearer ${getSupabaseAccessToken()}`,
        },
    });

    return processSupabaseResponse(response, responseSchema);
}

async function doSupabaseRpcRequest<T>(
    endpoint: string,
    body: unknown,
    responseSchema: v.GenericSchema<unknown, T>,
): Promise<T> {
    const response = await fetch(buildSupabaseUrl('rest/v1/rpc', endpoint), {
        method: 'POST',
        headers: {
            apikey: SUPABASE_API_KEY,
            Authorization: `Bearer ${getSupabaseAccessToken()}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    return processSupabaseResponse(response, responseSchema);
}

async function callSupabaseFunction<T>(
    functionName: string,
    queryParams: URLSearchParams,
    responseSchema: v.GenericSchema<unknown, T>,
): Promise<T> {
    const response = await fetch(buildSupabaseUrl('functions/v1', functionName, queryParams), {
        method: 'GET',
        headers: {
            apikey: SUPABASE_API_KEY,
            Authorization: `Bearer ${getSupabaseAccessToken()}`,
        },
    });

    return processSupabaseResponse(response, responseSchema);
}

export async function searchCities(name: string): Promise<CitySearchResult[]> {
    const response = await callSupabaseFunction(
        'search-location',
        new URLSearchParams({ q: name }),
        locationSearchResponseSchema,
    );

    return response.slice(0, 10);
}

export async function fetchCityFeatureByName(city: string): Promise<CityFeature | undefined> {
    const response = await doSupabaseRestRequest(
        'cities',
        new URLSearchParams({ name: `eq.${city}` }),
        cityFeaturesResponse,
    );
    return response.at(0);
}

export async function searchGeographicFeatures(name: string): Promise<GeographicFeatureSearchResult[]> {
    const response = await doSupabaseRpcRequest(
        'search_geographic_features',
        { search_query: name },
        geographicFeatureSearchResponse,
    );

    return response.slice(0, 10);
}

export async function fetchGeographicFeatureByName(name: string): Promise<GeographicFeature | undefined> {
    const response = await doSupabaseRestRequest(
        'geographic_features',
        new URLSearchParams({ name: `eq.${name}` }),
        geographicFeaturesResponse,
    );

    return response.at(0);
}

export async function fetchCountryByCode(code: string): Promise<CountryFeature | undefined> {
    const response = await doSupabaseRestRequest(
        'countries',
        new URLSearchParams({ iso_code: `eq.${code}` }),
        countryFeaturesResponse,
    );

    return response.at(0);
}

// async function fetchUserColorStats() {
//         const requestUrl = new URL(`${REST_API_BASE}/user_color_usage`);
//         requestUrl.searchParams.set('select', '...colors(name,palette_order,shade),usage_count');
//         requestUrl.searchParams.set('order', 'usage_count.desc,colors(palette_order).asc,colors(shade).asc');
//
//         const authToken = getAuthToken();
//         if (!authToken) {
//             throw new Error('Missing auth token.');
//         }
//
//         const response = await fetch(requestUrl.toString(), {
//             headers: {
//                 Authorization: `Bearer ${authToken}`,
//                 apikey: API_KEY,
//             },
//         });
//         if (!response.ok) {
//             throw new Error(`Failed to fetch color stats: ${response.statusText}`);
//         }
//
//         return await response.json();
//     }

export async function fetchUserColorStats(): Promise<ColorUsageRecord[]> {
    return doSupabaseRestRequest(
        'user_color_usage',
        new URLSearchParams({
            select: '...colors(name,palette_order,shade,hex_value),usage_count',
            order: 'usage_count.desc,colors(palette_order).asc,colors(shade).asc',
        }),
        colorUsageStatsResponse,
    );
}
