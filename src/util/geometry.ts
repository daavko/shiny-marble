export interface Point {
    x: number;
    y: number;
}

export interface Vector {
    x: number;
    y: number;
}

export interface Dimensions {
    width: number;
    height: number;
}

export interface Rect extends Point, Dimensions {}

export interface Extent {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export function intersectRects(rect1: Rect, rect2: Rect): Rect | null {
    const minX = Math.max(rect1.x, rect2.x);
    const minY = Math.max(rect1.y, rect2.y);
    const maxX = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
    const maxY = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);

    const intersectionWidth = maxX - minX;
    const intersectionHeight = maxY - minY;

    if (intersectionWidth <= 0 || intersectionHeight <= 0) {
        return null;
    } else {
        return { x: minX, y: minY, width: intersectionWidth, height: intersectionHeight };
    }
}

// todo: consider using a library like @flatten-js/core for geometry constructs (downside: can't be stored in IndexedDB)
