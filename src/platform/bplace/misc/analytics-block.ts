import { NetworkInterceptor } from '../../../core/network-interceptor';

let blockerInterceptorSymbol: symbol | null = null;

function enableBplaceAnalyticsBlocker(): void {
    if (blockerInterceptorSymbol) {
        return;
    }

    NetworkInterceptor.addXMLHttpRequestInterceptor({
        pathMatch: [
            {
                hostname: 'bplace.art',
                requestMethods: ['*'],
                paths: ['/~api/analytics'],
            },
        ],
    });
}

function disableBplaceAnalyticsBlocker(): void {
    if (!blockerInterceptorSymbol) {
        return;
    }

    NetworkInterceptor.removeXMLHttpRequestInterceptor(blockerInterceptorSymbol);
    blockerInterceptorSymbol = null;
}

export function toggleBplaceAnalyticsBlocker(enabled: boolean): void {
    if (enabled) {
        enableBplaceAnalyticsBlocker();
    } else {
        disableBplaceAnalyticsBlocker();
    }
}
