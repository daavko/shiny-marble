import picomatch, { type Matcher } from 'picomatch/posix';
import { originalFetch } from './fetch';

interface SimpleMatcher {
    hostname: string;
    requestMethods: string[];
    paths: string[];
}

interface FetchInterceptorInput {
    pathMatch?: SimpleMatcher[];
    customPathMatchFn?: (url: URL) => boolean;
    onBeforeRequest?: (request: Request) => Promise<Request | undefined> | Request | undefined;
    onRequest?: (request: Request) => Promise<Response | undefined> | Response | undefined;
    onAfterResponse?: (response: Response) => Promise<Response | undefined> | Response | undefined;
}

interface XMLHttpRequestInterceptorInput {
    pathMatch?: SimpleMatcher[];
    customPathMatchFn?: (url: URL) => boolean;
}

interface SavedSimpleMatcher {
    picoMatchers: Matcher[];
    canMatch: (hostname: string, requestMethod: string) => boolean;
}

type MatchFn = (requestMethod: string, url: URL) => boolean;

interface FetchInterceptor {
    matchFn: (requestMethod: string, url: URL) => boolean;
    onBeforeRequest?: (request: Request) => Promise<Request | undefined> | Request | undefined;
    onRequest?: (request: Request) => Promise<Response | undefined> | Response | undefined;
    onAfterResponse?: (response: Response) => Promise<Response | undefined> | Response | undefined;
}

interface XMLHttpRequestInterceptor {
    matchFn: (requestMethod: string, url: URL) => boolean;
}

const activeFetchInterceptors = new Map<symbol, FetchInterceptor>();
const activeXMLHttpRequestInterceptors = new Map<symbol, XMLHttpRequestInterceptor>();

function findNonNullFns<T extends FetchInterceptor, K extends keyof FetchInterceptor>(
    interceptors: T[],
    fnKey: K,
): NonNullable<T[K]>[] {
    return interceptors.map((interceptor) => interceptor[fnKey]).filter((fn) => fn != null);
}

function createSimpleMatchers(simpleMatchers: SimpleMatcher[] | undefined): SavedSimpleMatcher[] | undefined {
    return simpleMatchers?.map(({ hostname, requestMethods, paths }) => {
        const methods = requestMethods.map((method) => method.toLowerCase());
        const picoMatchers = paths.map((path) => picomatch(path));

        if (methods.includes('*')) {
            return {
                canMatch: (host: string) => host === hostname,
                picoMatchers,
            };
        } else {
            return {
                canMatch: (host: string, requestMethod: string) => host === hostname && methods.includes(requestMethod),
                picoMatchers,
            };
        }
    });
}

function createMatchFn(
    simpleMatchers: SimpleMatcher[] | undefined,
    customPathMatchFn: ((url: URL) => boolean) | undefined,
): MatchFn {
    const compiledMatchers = createSimpleMatchers(simpleMatchers);
    return (requestMethod: string, url: URL): boolean => {
        return (
            compiledMatchers?.some(
                (match) =>
                    match.canMatch(url.hostname, requestMethod) &&
                    match.picoMatchers.some((picoMatcher) => picoMatcher(url.pathname)),
            ) ??
            customPathMatchFn?.(url) ??
            false
        );
    };
}

export const NetworkInterceptor = {
    init(): void {
        window.fetch = async (...args: Parameters<typeof originalFetch>): Promise<Response> => {
            let request = new Request(...args);
            const interceptors = Array.from(activeFetchInterceptors.values()).filter((interceptor) =>
                interceptor.matchFn(request.method.toLowerCase(), new URL(request.url)),
            );

            if (interceptors.length === 0) {
                return originalFetch(...args);
            } else {
                for (const beforeRequestFn of findNonNullFns(interceptors, 'onBeforeRequest')) {
                    request = (await beforeRequestFn(request)) ?? request;
                }

                let response: Response | undefined;
                for (const onRequestFn of findNonNullFns(interceptors, 'onRequest')) {
                    const maybeResponse = await onRequestFn(request);
                    if (maybeResponse) {
                        response = maybeResponse;
                        break;
                    }
                }

                response ??= await originalFetch(request);

                for (const onAfterResponseFn of findNonNullFns(interceptors, 'onAfterResponse')) {
                    response = (await onAfterResponseFn(response)) ?? response;
                }

                return response;
            }
        };

        const OriginalXMLHttpRequest = window.XMLHttpRequest;
        window.XMLHttpRequest = class extends OriginalXMLHttpRequest {
            #blocked = false;

            override open(method: string, url: string | URL): void;
            override open(
                method: string,
                url: string | URL,
                async: boolean,
                username?: string | null,
                password?: string | null,
            ): void;
            override open(
                method: string,
                url: string | URL,
                async = true,
                username: string | null = null,
                password: string | null = null,
            ): void {
                super.open(method, url, async, username, password);

                try {
                    const urlObj = new URL(url.toString(), window.location.origin);
                    this.#blocked = Array.from(activeXMLHttpRequestInterceptors.values()).some((interceptor) =>
                        interceptor.matchFn(method.toLowerCase(), urlObj),
                    );
                } catch {
                    // no-op
                }
            }

            override send(body?: Document | XMLHttpRequestBodyInit | null): void {
                if (this.#blocked) {
                    return;
                }
                super.send(body);
            }
        };
    },
    addFetchInterceptor(interceptor: FetchInterceptorInput): symbol {
        if (!interceptor.pathMatch && !interceptor.customPathMatchFn) {
            throw new Error('Either pathMatch or customPathMatchFn must be provided');
        }

        if (!interceptor.onRequest && !interceptor.onBeforeRequest && !interceptor.onAfterResponse) {
            throw new Error('At least one of onRequest or onResponse must be provided');
        }

        const sym = Symbol();
        activeFetchInterceptors.set(sym, {
            matchFn: createMatchFn(interceptor.pathMatch, interceptor.customPathMatchFn),
            onBeforeRequest: interceptor.onBeforeRequest,
            onRequest: interceptor.onRequest,
            onAfterResponse: interceptor.onAfterResponse,
        });
        return sym;
    },
    removeFetchInterceptor(sym: symbol): void {
        activeFetchInterceptors.delete(sym);
    },
    addXMLHttpRequestInterceptor(interceptor: XMLHttpRequestInterceptorInput): symbol {
        if (!interceptor.pathMatch && !interceptor.customPathMatchFn) {
            throw new Error('Either pathMatch or customPathMatchFn must be provided');
        }

        const sym = Symbol();
        activeXMLHttpRequestInterceptors.set(sym, {
            matchFn: createMatchFn(interceptor.pathMatch, interceptor.customPathMatchFn),
        });
        return sym;
    },
    removeXMLHttpRequestInterceptor(sym: symbol): void {
        activeXMLHttpRequestInterceptors.delete(sym);
    },
};
