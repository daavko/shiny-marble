import { mdiClose } from '@mdi/js';
import { el } from '../../dom/html';
import { renderMdiIcon } from '../../ui/mdi-icon';
import { fetchUserColorStats } from './supabase';

export { default as bplaceColorStatsDialogStyle } from './color-stats-dialog.css';

export async function showColorStatsDialog(): Promise<void> {
    const statsList = el('div', { class: 'sm-color-stats-dialog__list' }, ['Loading...']);
    const dialog = el(
        'dialog',
        {
            class: 'sm-color-stats-dialog',
            attributes: {
                closedBy: 'any',
            },
        },
        [
            el(
                'button',
                {
                    class: 'sm-platform__sheet-close-btn',
                    events: {
                        click: () => {
                            dialog.close();
                        },
                    },
                },
                [renderMdiIcon(mdiClose)],
            ),
            el('h1', ['Your Color Stats']),
            statsList,
        ],
    );

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
            // statsList.append(
            //     el('div', {}, [
            //         el('span', [name]),
            //         el('div', {
            //             class: 'sm-color-stats-dialog__swatch',
            //             style: {
            //                 backgroundColor: hexValue,
            //             },
            //         }),
            //         el('span', [usageCount.toString()]),
            //     ]),
            // );
            statsTableBody.append(
                el('tr', [
                    el('td', [name]),
                    el('td', [
                        el('div', {
                            class: 'sm-color-stats-dialog__swatch',
                            style: {
                                backgroundColor: hexValue,
                            },
                        }),
                    ]),
                    el('td', [usageCount.toString()]),
                ]),
            );
        }
        statsList.append(el('table', { class: 'sm-color-stats-dialog__table' }, [statsTableBody]));
    } catch (e) {
        if (e instanceof Error) {
            statsList.textContent = `Error loading stats: ${e.message}`;
        } else {
            statsList.textContent = 'An unknown error occurred while loading stats.';
        }
        console.error('Error loading color stats:', e);
    }
}
