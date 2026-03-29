import { debugDetailed } from '../../core/debug';
import { el } from '../../core/dom/html';
import { createDialog } from '../dialog';
import { fetchUserColorStats } from './supabase';

export { default as bplaceColorStatsDialogStyle } from './color-stats-dialog.css';

function createColorUsageRecordRow(name: string, usageCount: number, hexValue: string): HTMLElement {
    return el('tr', [
        el('td', { class: 'sm-color-stats-dialog__table-name' }, [name]),
        el('td', { class: 'sm-color-stats-dialog__swatch' }, [el('div', { style: { backgroundColor: hexValue } })]),
        el('td', { class: 'sm-color-stats-dialog__table-count' }, [usageCount.toString()]),
    ]);
}

export async function showColorStatsDialog(): Promise<void> {
    const { dialog, dialogBody } = createDialog('Your Color Stats', { customClass: 'sm-color-stats-dialog' }, [
        'Loading...',
    ]);

    document.body.appendChild(dialog);
    dialog.showModal();

    try {
        const stats = await fetchUserColorStats();

        dialogBody.textContent = '';

        if (stats.length === 0) {
            dialogBody.textContent = 'No color usage data found.';
            return;
        }

        const statsTableBody = el('tbody');
        for (const { name, usageCount, hexValue } of stats) {
            statsTableBody.append(createColorUsageRecordRow(name, usageCount, hexValue));
        }
        const largestUsageCountCharacters = Math.max(...stats.map((s) => s.usageCount)).toString().length;
        dialogBody.append(
            el(
                'table',
                {
                    class: ['sm-color-stats-dialog__table', 'sm-table--evenodd'],
                    styleCustomProperties: { '--sm-color-stats__count-width': `${largestUsageCountCharacters}ch` },
                },
                [statsTableBody],
            ),
        );
    } catch (e) {
        if (e instanceof Error) {
            dialogBody.textContent = `Error loading stats: ${e.message}`;
        } else {
            dialogBody.textContent = 'An unknown error occurred while loading stats.';
        }
        debugDetailed('Error loading color stats', e);
    }
}
