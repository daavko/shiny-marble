import { debugDetailed } from '../../core/debug';
import { el } from '../../core/dom/html';
import { cond$, el$, switch$ } from '../../core/dom/reactive-html';
import { computed, signal } from '../../core/signals';
import { createDialog } from '../../ui/builtin/dialog';
import { arrayEqualityFn } from '../../util/misc';
import type { ColorUsageRecord } from './schemas';
import { fetchUserColorStats } from './supabase';

export { default as bplaceColorStatsDialogStyle } from './color-stats-dialog.css';

function createColorUsageRows(stats: ColorUsageRecord[]): HTMLElement[] {
    return stats.map(({ name, usageCount, hexValue }) =>
        el('tr', [
            el('td', { class: 'sm-color-stats-dialog__table-name' }, [name]),
            el('td', { class: 'sm-color-stats-dialog__swatch' }, [el('div', { style: { backgroundColor: hexValue } })]),
            el('td', { class: 'sm-color-stats-dialog__table-count' }, [usageCount.toString()]),
        ]),
    );
}

export async function showColorStatsDialog(): Promise<void> {
    const loadingStatus = signal<'loading' | 'loaded' | 'error'>('loading');
    const colorStats = signal<ColorUsageRecord[]>([], arrayEqualityFn);
    const statsCountWidth = computed([colorStats], ([stats]) => {
        if (stats.length === 0) {
            return null;
        }
        const maxCount = Math.max(...stats.map((s) => s.usageCount));
        return `${maxCount.toString().length}ch`;
    });

    const { dialog } = createDialog(
        'Your Color Stats',
        { customClass: 'sm-color-stats-dialog', size: 'small' },
        (ctx) => [
            switch$(loadingStatus, [
                ['loading', 'Loading...'],
                ['error', 'An error occurred while loading stats.'],
                [
                    'loaded',
                    cond$(
                        colorStats,
                        (stats) => stats.length === 0,
                        'No color usage data found.',
                        (stats: ColorUsageRecord[]) =>
                            el$(
                                'table',
                                {
                                    effectContext: ctx,
                                    class: ['sm-color-stats-dialog__table', 'sm-table--evenodd'],
                                    styleCustomProperties: { '--sm-color-stats__count-width': statsCountWidth },
                                },
                                [el('tbody', createColorUsageRows(stats))],
                            ),
                    ),
                ],
            ]),
        ],
    );

    document.body.appendChild(dialog);
    dialog.showModal();

    try {
        colorStats.value = await fetchUserColorStats();
        loadingStatus.value = 'loaded';
    } catch (e) {
        loadingStatus.value = 'error';
        debugDetailed('Error loading color stats', e);
    }
}
