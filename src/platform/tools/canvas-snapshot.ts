import { featureCollection, lineString, polygon } from '@turf/turf';
import { DateTime } from 'luxon';
import { GeoJSONSource, MapMouseEvent, MercatorCoordinate } from 'maplibre-gl';
import { el } from '../../core/dom/html';
import { renderBlockButton } from '../../ui/builtin/button';
import type { ActiveToolPanelRef } from '../../ui/components/active-tool-panel';
import { assertCanvasCtx } from '../../util/canvas';
import { coordsEqualityFn, rectsEqualityFn } from '../../util/equality';
import { downloadBlob } from '../../util/file';
import {
    coordsWithNewOrigin,
    cornersToRectInclusive,
    extentSize,
    type MapTileExtent,
    type PixelCoordinates,
    pixelCoordinates,
    type PixelRect,
    rectToAllCorners,
} from '../../util/geometry';
import { sleep } from '../../util/promise';
import { debugDetailed, debugTime } from '../debug';
import { getCoveredMapTilesExtent, mapTileToPixelCoordinates, splitWorldWrappingPixelRect } from '../geometry';
import { Platform } from '../platform';
import { createEffectContext } from '../reactivity/effects';
import { cond$, el$, if$, ifNot$, switch$ } from '../reactivity/reactive-html';
import { computed, signal } from '../reactivity/signals';
import type { ActiveTool } from '../types';

export { default as canvasSnapshotToolStyle } from './canvas-snapshot.css';

const MAX_SNAPSHOT_CANVAS_DIMENSION = 8192;

const SNAPSHOT_MAP_RECT_SOURCE_ID = 'sm-canvas-snapshot-rectangle';
const SNAPSHOT_MAP_RECT_LAYER_ID = `${SNAPSHOT_MAP_RECT_SOURCE_ID}-layer`;
const SNAPSHOT_MAP_RECT_BORDER_LAYER_ID = `${SNAPSHOT_MAP_RECT_SOURCE_ID}-border-layer`;
const SNAPSHOT_MAP_CROSSHAIR_LINES_SOURCE_ID = 'sm-canvas-snapshot-crosshair-lines';
const SNAPSHOT_MAP_CROSSHAIR_LINES_LAYER_ID = `${SNAPSHOT_MAP_CROSSHAIR_LINES_SOURCE_ID}-layer`;

type SnapshotGenerationProgress = 'choosingCoords' | 'generatingSnapshot' | 'error' | 'finished';

export class CanvasSnapshotTool implements ActiveTool {
    readonly id = 'canvas-snapshot';

    private readonly effectContext = createEffectContext();

    private mousedown = false;

    private readonly corner1 = signal<PixelCoordinates | null>(null, coordsEqualityFn);
    private readonly corner2 = signal<PixelCoordinates | null>(null, coordsEqualityFn);
    private readonly cornersRect = computed(
        [this.corner1, this.corner2],
        ([corner1, corner2]) => {
            if (corner1 && corner2) {
                return cornersToRectInclusive(corner1, corner2, Platform.canvasPixelDimensions);
            } else {
                return null;
            }
        },
        rectsEqualityFn,
    );
    private readonly extentTooLarge = computed([this.cornersRect], ([extentRect]) => {
        if (extentRect) {
            return (
                extentRect.width > MAX_SNAPSHOT_CANVAS_DIMENSION || extentRect.height > MAX_SNAPSHOT_CANVAS_DIMENSION
            );
        } else {
            return false;
        }
    });
    private readonly confirmedCorner2 = signal(false);
    private readonly mousePosition = signal<PixelCoordinates | null>(null, coordsEqualityFn);
    private readonly generationProgress = signal<SnapshotGenerationProgress>('choosingCoords');
    private readonly tileCount = signal(0);
    private readonly tileCountFinished = signal(0);

    private readonly rectangleVisibility = computed([this.cornersRect], ([rect]) => (rect ? 'visible' : 'none'));
    private readonly crosshairLinesVisibility = computed(
        [this.mousePosition, this.confirmedCorner2],
        ([mousePosition, confirmedCorner2]) => (mousePosition && !confirmedCorner2 ? 'visible' : 'none'),
    );
    private readonly rectangleGeojson = computed([this.cornersRect], ([rect]) => {
        if (rect) {
            const [topLeft, topRight, bottomLeft, bottomRight] = rectToAllCorners(rect).map((corner) =>
                Platform.pixelToLatLon(corner, false).toArray(),
            );
            return polygon([[topLeft, topRight, bottomRight, bottomLeft, topLeft]]);
        } else {
            return polygon([
                [
                    [0, 0],
                    [0, 0],
                    [0, 0],
                    [0, 0],
                ],
            ]);
        }
    });
    private readonly crosshairLinesGeojson = computed([this.mousePosition], ([mousePosition]) => {
        if (mousePosition) {
            const mercatorCoord = Platform.pixelToMercator(
                pixelCoordinates({ x: mousePosition.x + 0.5, y: mousePosition.y + 0.5 }),
            );
            const verticalLineNorth = new MercatorCoordinate(mercatorCoord.x, 0);
            const verticalLineSouth = new MercatorCoordinate(mercatorCoord.x, 1);
            const horizontalLineWest = new MercatorCoordinate(0, mercatorCoord.y);
            const horizontalLineEast = new MercatorCoordinate(1, mercatorCoord.y);
            return featureCollection([
                lineString([verticalLineNorth.toLngLat().toArray(), verticalLineSouth.toLngLat().toArray()]),
                lineString([horizontalLineWest.toLngLat().toArray(), horizontalLineEast.toLngLat().toArray()]),
            ]);
        } else {
            return featureCollection([
                lineString([
                    [0, 0],
                    [0, 0],
                ]),
                lineString([
                    [0, 0],
                    [0, 0],
                ]),
            ]);
        }
    });

    private readonly map = Platform.getCurrentMapInstance();
    private toolPanel?: ActiveToolPanelRef;

    constructor() {
        this.effectContext.watch([this.rectangleGeojson], ([rectangleGeojson]) => {
            this.map.getSource<GeoJSONSource>(SNAPSHOT_MAP_RECT_SOURCE_ID)?.setData(rectangleGeojson);
        });
        this.effectContext.watch([this.crosshairLinesGeojson], ([crosshairLinesGeojson]) => {
            this.map.getSource<GeoJSONSource>(SNAPSHOT_MAP_CROSSHAIR_LINES_SOURCE_ID)?.setData(crosshairLinesGeojson);
        });

        this.effectContext.watch([this.rectangleVisibility], ([rectangleVisibility]) => {
            this.map.setLayoutProperty(SNAPSHOT_MAP_RECT_LAYER_ID, 'visibility', rectangleVisibility);
            this.map.setLayoutProperty(SNAPSHOT_MAP_RECT_BORDER_LAYER_ID, 'visibility', rectangleVisibility);
        });
        this.effectContext.watch([this.crosshairLinesVisibility], ([crosshairLinesVisibility]) => {
            this.map.setLayoutProperty(SNAPSHOT_MAP_CROSSHAIR_LINES_LAYER_ID, 'visibility', crosshairLinesVisibility);
        });

        this.effectContext.watch([this.confirmedCorner2], ([confirmedCorner2]) => {
            if (confirmedCorner2) {
                this.map.setPaintProperty(SNAPSHOT_MAP_RECT_LAYER_ID, 'fill-color', '#6d44e5');
                this.map.setPaintProperty(SNAPSHOT_MAP_RECT_BORDER_LAYER_ID, 'line-color', '#2d0691');
            } else {
                this.map.setPaintProperty(SNAPSHOT_MAP_RECT_LAYER_ID, 'fill-color', '#f59332');
                this.map.setPaintProperty(SNAPSHOT_MAP_RECT_BORDER_LAYER_ID, 'line-color', '#8d4900');
            }
        });

        this.effectContext.registerCleanup(() => {
            this.toolPanel?.effectContext.unadopt(this.effectContext);
            this.toolPanel = undefined;

            this.map.off('mousemove', this.handleMouseMove);
            this.map.off('mousedown', this.handleMouseDown);
            this.map.off('mouseup', this.handleMouseUp);
            this.map.off('dragstart', this.handleDragStart);
            this.map.removeLayer(SNAPSHOT_MAP_RECT_LAYER_ID);
            this.map.removeLayer(SNAPSHOT_MAP_RECT_BORDER_LAYER_ID);
            this.map.removeSource(SNAPSHOT_MAP_RECT_SOURCE_ID);
            this.map.removeLayer(SNAPSHOT_MAP_CROSSHAIR_LINES_LAYER_ID);
            this.map.removeSource(SNAPSHOT_MAP_CROSSHAIR_LINES_SOURCE_ID);
        });
    }

    activate(toolPanel: ActiveToolPanelRef): void {
        this.toolPanel = toolPanel;
        this.toolPanel.effectContext.adopt(this.effectContext);

        this.render(this.toolPanel.panelContentElement);

        this.map.addSource(SNAPSHOT_MAP_RECT_SOURCE_ID, {
            type: 'geojson',
            data: this.rectangleGeojson.value,
        });
        this.map.addLayer({
            id: SNAPSHOT_MAP_RECT_LAYER_ID,
            type: 'fill',
            source: SNAPSHOT_MAP_RECT_SOURCE_ID,
            paint: { 'fill-color': '#f59332', 'fill-color-transition': { duration: 0 }, 'fill-opacity': 0.5 },
            layout: { visibility: 'none' },
        });
        this.map.addLayer({
            id: SNAPSHOT_MAP_RECT_BORDER_LAYER_ID,
            type: 'line',
            source: SNAPSHOT_MAP_RECT_SOURCE_ID,
            paint: { 'line-color': '#8d4900', 'line-color-transition': { duration: 0 }, 'line-width': 2 },
            layout: { visibility: 'none' },
        });

        this.map.addSource(SNAPSHOT_MAP_CROSSHAIR_LINES_SOURCE_ID, {
            type: 'geojson',
            data: this.crosshairLinesGeojson.value,
        });
        this.map.addLayer({
            id: SNAPSHOT_MAP_CROSSHAIR_LINES_LAYER_ID,
            type: 'line',
            source: SNAPSHOT_MAP_CROSSHAIR_LINES_SOURCE_ID,
            paint: { 'line-color': '#000000', 'line-width': 2 },
            layout: { visibility: 'none' },
        });

        this.map.on('mousemove', this.handleMouseMove);
        this.map.on('mousedown', this.handleMouseDown);
        this.map.on('mouseup', this.handleMouseUp);
        this.map.on('dragstart', this.handleDragStart);
        this.effectContext.elementEventListener(
            this.map._container,
            'click',
            (event) => {
                if (this.mousedown) {
                    event.stopImmediatePropagation();
                }
            },
            { capture: true },
        );
    }

    close(): void {
        this.effectContext.destroy();
    }

    private render(container: HTMLElement): void {
        const closeBtn = renderBlockButton('Close', () => this.toolPanel?.close());
        const resetBtn = renderBlockButton(
            'Reset',
            () => {
                this.corner1.value = null;
                this.corner2.value = null;
                this.confirmedCorner2.value = false;
                this.generationProgress.value = 'choosingCoords';
            },
            { variant: 'danger' },
        );
        const takeSnapshotBtn = renderBlockButton(
            'Take Snapshot',
            () => {
                if (this.cornersRect.value) {
                    this.generateSnapshot(this.cornersRect.value).catch((error: unknown) => {
                        debugDetailed('Error generating snapshot', error);
                        this.generationProgress.value = 'error';
                    });
                }
            },
            { variant: 'primary' },
        );

        const content = el$('div', { effectContext: this.effectContext, class: 'sm-canvas-snapshot-tool-container' }, [
            switch$(this.generationProgress, [
                [
                    'choosingCoords',
                    cond$(
                        this.corner1,
                        (corner1) => !corner1,
                        el('p', [
                            'Please click on the map to select the first corner of the snapshot area.',
                            el('br'),
                            'You can drag around to move the map.',
                        ]),
                        el$('p', { effectContext: this.effectContext }, [
                            ifNot$(
                                this.confirmedCorner2,
                                [
                                    if$(
                                        this.extentTooLarge,
                                        el('span', { style: { color: 'var(--sm-error-foreground-color)' } }, [
                                            `This area is too large. Please select an area that's at most ${MAX_SNAPSHOT_CANVAS_DIMENSION}x${MAX_SNAPSHOT_CANVAS_DIMENSION}px.`,
                                        ]),
                                        [
                                            'Please click on the map to select the opposite corner of the snapshot area.',
                                            el('br'),
                                            'You can drag around to move the map. ',
                                        ],
                                    ),
                                    computed([this.cornersRect], ([rect]) =>
                                        rect ? `Highlighted area: ${rect.width}x${rect.height}px` : null,
                                    ),
                                ],
                                [
                                    if$(this.extentTooLarge, [
                                        el('span', { style: { color: 'var(--sm-error-foreground-color)' } }, [
                                            `This area is too large. Please select an area that's at most ${MAX_SNAPSHOT_CANVAS_DIMENSION}x${MAX_SNAPSHOT_CANVAS_DIMENSION}px.`,
                                        ]),
                                        el('br'),
                                    ]),
                                    computed([this.cornersRect], ([rect]) =>
                                        rect ? `Snapshot area selected: ${rect.width}x${rect.height}px` : null,
                                    ),
                                ],
                            ),
                        ]),
                    ),
                ],
                [
                    'generatingSnapshot',
                    el$('p', { effectContext: this.effectContext }, [
                        'Generating snapshot... ',
                        computed(
                            [this.tileCount, this.tileCountFinished],
                            ([tileCount, tileCountFinished]) => `(tile ${tileCountFinished} of ${tileCount})`,
                        ),
                        el('br'),
                        'If you chose a large area, this may take a while. Please be patient.',
                    ]),
                ],
                [
                    'finished',
                    el('p', ['Snapshot generated and downloaded! This tool will close itself in a few seconds.']),
                ],
                ['error', el('p', ['An error occurred while generating the snapshot.'])],
            ]),
            el$('div', { effectContext: this.effectContext, class: 'sm-canvas-snapshot-tool__buttons' }, [
                switch$(this.generationProgress, [
                    [
                        'choosingCoords',
                        [
                            if$(this.confirmedCorner2, [resetBtn, ifNot$(this.extentTooLarge, takeSnapshotBtn)]),
                            closeBtn,
                        ],
                    ],
                    ['error', closeBtn],
                ]),
            ]),
        ]);

        container.append(content);
    }

    private readonly handleMouseMove = (event: MapMouseEvent): void => {
        const pixelCoords = Platform.latLonToPixel(event.lngLat, 'floor');
        this.mousePosition.value = pixelCoords;

        if (this.corner1.value && !this.confirmedCorner2.value) {
            this.corner2.value = pixelCoords;
        }
    };

    private readonly handleMouseDown = (): void => {
        this.mousedown = true;
    };

    private readonly handleMouseUp = (event: MapMouseEvent): void => {
        if (this.mousedown) {
            const pixelCoords = Platform.latLonToPixel(event.lngLat, 'floor');
            this.mousePosition.value = pixelCoords;
            if (!this.corner1.value) {
                this.corner1.value = pixelCoords;
                this.corner2.value = pixelCoords;
            } else if (!this.confirmedCorner2.value) {
                this.corner2.value = pixelCoords;
                this.confirmedCorner2.value = true;
            }
        }
    };

    private readonly handleDragStart = (): void => {
        if (this.mousedown) {
            this.mousedown = false;
        }
    };

    private async fetchAndDrawTileExtent(
        ctx: OffscreenCanvasRenderingContext2D,
        extent: MapTileExtent,
        origin: PixelCoordinates,
    ): Promise<void> {
        for await (const { tileCoords, tileBitmap } of Platform.createTilesRegionGenerator(extent)) {
            this.tileCountFinished.value += 1;
            if (!tileBitmap) {
                // no image data at this position, skip
                continue;
            }

            const tilePixelCoords = mapTileToPixelCoordinates(tileCoords);
            const originRelativeTilePixelCoords = coordsWithNewOrigin(tilePixelCoords, origin);

            ctx.drawImage(tileBitmap, originRelativeTilePixelCoords.x, originRelativeTilePixelCoords.y);
        }
    }

    private async generateSnapshot(rect: PixelRect): Promise<void> {
        debugDetailed('Generating snapshot for rect', rect);

        const debugTimer = debugTime('Snapshot generation');

        this.generationProgress.value = 'generatingSnapshot';

        // due to how stupid bplace tiling is, we have to pre-split the *pixel* rect and then calculate the map tiles
        const [leftRect, rightRect] = splitWorldWrappingPixelRect(rect);

        const leftTileExtent = getCoveredMapTilesExtent(leftRect);
        const rightTileExtent = rightRect ? getCoveredMapTilesExtent(rightRect) : null;

        const leftAreaSize = extentSize(leftTileExtent);
        const rightAreaSize = rightTileExtent ? extentSize(rightTileExtent) : null;
        this.tileCount.value =
            leftAreaSize.width * leftAreaSize.height + (rightAreaSize ? rightAreaSize.width * rightAreaSize.height : 0);
        debugDetailed('Covered tiles', leftTileExtent, rightTileExtent);

        const canvas = new OffscreenCanvas(rect.width, rect.height);
        const ctx = canvas.getContext('2d');
        assertCanvasCtx(ctx);

        await this.fetchAndDrawTileExtent(ctx, leftTileExtent, pixelCoordinates({ x: leftRect.x, y: leftRect.y }));
        if (rightTileExtent) {
            await this.fetchAndDrawTileExtent(
                ctx,
                rightTileExtent,
                pixelCoordinates({ x: -leftRect.width, y: leftRect.y }),
            );
        }

        const blob = await canvas.convertToBlob({ type: 'image/png' });
        const timestamp = DateTime.now().toFormat('yyyy-MM-dd_HH:mm:ss');
        downloadBlob(blob, `${Platform.id}-snapshot-${timestamp}.png`);

        debugTimer?.stop();
        this.generationProgress.value = 'finished';

        await sleep(5000);
        this.toolPanel?.close();
    }
}
