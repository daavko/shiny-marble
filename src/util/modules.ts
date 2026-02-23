export function gatherModuleHrefs(prefix: string): string[] {
    const moduleLinks = document.querySelectorAll('link[rel="modulepreload"]');
    return Array.from(moduleLinks)
        .map((link) => link.getAttribute('href'))
        .filter((href) => href != null)
        .filter((href) => href.startsWith(prefix));
}
