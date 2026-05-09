import { NetworkInterceptor } from '../../../core/network-interceptor';
import { BplaceSettings } from '../settings';

let notificationFilterInterceptorSymbol: symbol | null = null;

function enableBplaceNotificationFilter(): void {
    if (notificationFilterInterceptorSymbol) {
        return;
    }

    console.log('Enabling Bplace notification filter');

    notificationFilterInterceptorSymbol = NetworkInterceptor.addFetchInterceptor({
        pathMatch: [
            {
                hostname: 'bocmfycjqgujxkhcnfck.supabase.co',
                requestMethods: ['get'],
                paths: ['/rest/v1/notifications'],
            },
        ],
        onBeforeRequest: (request): Request | undefined => {
            const url = new URL(request.url);
            console.log('Intercepting notification request with URL:', url.toString());
            if (
                request.method.toLowerCase() === 'get' &&
                url.searchParams.has('user_id') &&
                url.searchParams.has('order') &&
                url.searchParams.has('limit')
            ) {
                const hiddenTypes: string[] = [];
                if (!BplaceSettings.showGuildPinContributorNotification.value) {
                    hiddenTypes.push('guild_pin_contribution');
                }
                if (!BplaceSettings.showPinPublishedNotification.value) {
                    hiddenTypes.push('pin_published');
                }
                if (!BplaceSettings.showPinCollabAcceptedNotification.value) {
                    hiddenTypes.push('pin_collab_accepted');
                }
                if (hiddenTypes.length === 0) {
                    return undefined;
                }
                console.log('Filtering out notification types:', hiddenTypes);
                url.searchParams.append('type', `not.in.(${hiddenTypes.map((v) => `"${v}"`).join(',')})`);
                return new Request(url, request);
            }
            return undefined;
        },
    });
}

function disableBplaceNotificationFilter(): void {
    if (!notificationFilterInterceptorSymbol) {
        return;
    }

    NetworkInterceptor.removeFetchInterceptor(notificationFilterInterceptorSymbol);
    notificationFilterInterceptorSymbol = null;
}

export function toggleBplaceNotificationFilter(enabled: boolean): void {
    if (enabled) {
        enableBplaceNotificationFilter();
    } else {
        disableBplaceNotificationFilter();
    }
}
