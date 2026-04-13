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

export interface Extent {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

// todo: consider using a library like @flatten-js/core for geometry constructs (downside: can't be stored in IndexedDB)
