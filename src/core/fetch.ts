// unfortunately some extensions and userscript are stupidly written (like SkirkMarble) and clobber window.fetch
// in ways that break things (like SkirkMarble upscaling literally any image 3x instead of checking that it's a damn
// tile request initiated by the tile renderer), so we just store our own damn instance that bypasses their bullshit
export const originalFetch = window.fetch;
