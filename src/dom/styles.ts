const INSERTED_STYLES = new Map<symbol, CSSStyleSheet>();

export function addStyles(...cssArray: readonly string[]): void {
    for (const css of cssArray) {
        addStyle(css);
    }
}

export function addStyle(css: string): void {
    const symbol = Symbol.for(css);
    if (INSERTED_STYLES.has(symbol)) {
        return;
    }

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets.push(sheet);
    INSERTED_STYLES.set(symbol, sheet);
}

export function removeStyles(...cssArray: readonly string[]): void {
    for (const css of cssArray) {
        removeStyle(css);
    }
}

export function removeStyle(css: string): void {
    const symbol = Symbol.for(css);
    const sheet = INSERTED_STYLES.get(symbol);
    if (sheet == null) {
        return;
    }

    const adoptedSheets = document.adoptedStyleSheets;
    document.adoptedStyleSheets = adoptedSheets.filter((s) => s !== sheet);
    INSERTED_STYLES.delete(symbol);
}
