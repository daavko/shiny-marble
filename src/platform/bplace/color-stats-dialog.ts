import { mdiClose } from '@mdi/js';
import { el } from '../../dom/html';
import { renderMdiIcon } from '../../ui/mdi-icon';
import { fetchUserColorStats } from './supabase';

export { default as bplaceColorStatsDialogStyle } from './color-stats-dialog.css';

export async function showColorStatsDialog(): Promise<void> {
    const statsList = el('div', { class: 'sm-dialog__content' }, ['Loading...']);
    const dialog = el('dialog', { class: ['sm-dialog', 'sm-color-stats-dialog'], attributes: { closedBy: 'any' } }, [
        el('header', { class: 'sm-dialog__header' }, [
            el('h1', ['Your Color Stats']),
            el(
                'button',
                {
                    class: 'sm-platform__icon-btn',
                    events: { click: () => dialog.close() },
                },
                [renderMdiIcon(mdiClose)],
            ),
        ]),
        statsList,
    ]);

    dialog.addEventListener('close', () => {
        dialog.remove();
    });

    document.body.appendChild(dialog);
    dialog.showModal();

    try {
        const stats = await fetchUserColorStats();

        statsList.textContent = '';

        if (stats.length === 0) {
            statsList.textContent = 'No color usage data found.';
            return;
        }

        const statsTableBody = el('tbody');
        for (const { name, usageCount, hexValue } of stats) {
            statsTableBody.append(
                el('tr', [
                    el('td', { class: 'sm-color-stats-dialog__table-name' }, [name]),
                    el('td', { class: 'sm-color-stats-dialog__swatch' }, [
                        el('div', { style: { backgroundColor: hexValue } }),
                    ]),
                    el('td', { class: 'sm-color-stats-dialog__table-count' }, [usageCount.toString()]),
                ]),
            );
        }
        const largestUsageCountCharacters = Math.max(...stats.map((s) => s.usageCount)).toString().length;
        statsList.append(
            el(
                'table',
                {
                    class: 'sm-color-stats-dialog__table',
                    styleCustomProperties: { '--sm-color-stats__count-width': `${largestUsageCountCharacters}ch` },
                },
                [statsTableBody],
            ),
        );
    } catch (e) {
        if (e instanceof Error) {
            statsList.textContent = `Error loading stats: ${e.message}`;
        } else {
            statsList.textContent = 'An unknown error occurred while loading stats.';
        }
        console.error('Error loading color stats:', e);
    }
}
