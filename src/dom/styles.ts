const INSERTED_STYLES = new Map<symbol, CSSStyleSheet>();

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
