import { NetworkInterceptor } from '../../../core/network-interceptor';

let fakeBetaInterceptorSymbol: symbol | null = null;

function enableBplaceFakeBeta(): void {
    if (fakeBetaInterceptorSymbol) {
        return;
    }

    NetworkInterceptor.addFetchInterceptor({
        pathMatch: [
            {
                hostname: 'bocmfycjqgujxkhcnfck.supabase.co',
                requestMethods: ['get'],
                paths: ['/rest/v1/beta_testers'],
            },
        ],
        onAfterResponse: (response: Response): Response | undefined => {
            if (response.status === 200) {
                return new Response(JSON.stringify([{ id: '1', user_id: '1' }]), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                });
            } else {
                return undefined;
            }
        },
    });
}

function disableBplaceFakeBeta(): void {
    if (!fakeBetaInterceptorSymbol) {
        return;
    }

    NetworkInterceptor.removeFetchInterceptor(fakeBetaInterceptorSymbol);
    fakeBetaInterceptorSymbol = null;
}

export function toggleBplaceFakeBeta(enabled: boolean): void {
    if (enabled) {
        enableBplaceFakeBeta();
    } else {
        disableBplaceFakeBeta();
    }
}
