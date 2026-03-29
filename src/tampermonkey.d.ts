// Tampermonkey types, shamelessly copied from https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/tampermonkey/index.d.ts

declare namespace Tampermonkey {
    interface ScriptMetadataOverrides {
        merge_connects: boolean;
        merge_excludes: boolean;
        merge_includes: boolean;
        merge_matches: boolean;
        orig_connects: string[];
        orig_excludes: string[];
        orig_includes: string[];
        orig_matches: string[];
        orig_noframes: string | null;
        orig_run_at: string | null;
        use_blockers: string[];
        use_connects: string[];
        use_excludes: string[];
        use_includes: string[];
        use_matches: string[];
    }

    interface ScriptSettings {
        check_for_updates: boolean;
        comment: string | null;
        compat_foreach: boolean;
        compat_metadata: boolean;
        compat_powerful_this: boolean | null;
        compat_prototypes: boolean;
        compat_wrappedjsobject: boolean;
        compatopts_for_requires: boolean;
        noframes: boolean | null;
        run_at: string;
        sandbox: string | null;
        tab_types: string | null;
        unwrap: boolean | null;

        override: ScriptMetadataOverrides;
    }

    interface ScriptResource {
        name: string;
        url?: string;
        content?: string;
        meta?: string;
        error?: string;
    }

    interface WebRequestRule {
        selector:
            | {
                  include?: string | string[];
                  match?: string | string[];
                  exclude?: string | string[];
              }
            | string;
        action:
            | string
            | {
                  cancel?: boolean;
                  redirect?:
                      | {
                            url: string;
                            from?: string;
                            to?: string;
                        }
                      | string;
              };
    }

    interface ScriptMetadata {
        antifeatures: Record<string, Record<string, string>>;
        author: string | null;

        blockers: string[];

        copyright: string | null;
        deleted?: number;
        description: string | null;
        description_i18n: Record<string, string> | null;
        downloadURL: string | null;
        enabled?: boolean;
        evilness: number;
        excludes: string[];
        fileURL?: string | null;
        grant: string[];
        header: string;
        homepage: string | null;
        icon: string | null;
        icon64: string | null;
        includes: string[];
        lastModified: number;
        matches: string[];
        name: string;
        name_i18n: Record<string, string> | null;
        namespace: string | null;
        options: ScriptSettings;

        position: number;
        resources: ScriptResource[];

        /**
         * Never null, defaults to document-idle
         */
        'run-at': string;

        supportURL: string | null;
        sync?: {
            imported?: number;
        };
        system?: boolean;
        unwrap: boolean;
        updateURL: string | null;
        uuid: string;
        version: string;
        webRequest: WebRequestRule[] | null;
    }

    interface ScriptInfo {
        downloadMode: 'native' | 'browser' | 'disabled';
        isFirstPartyIsolation?: boolean;
        isIncognito: boolean;
        script: ScriptMetadata;
        sandboxMode: 'js' | 'raw' | 'dom';

        scriptHandler: string;

        scriptMetaStr: string | null;
        scriptSource: string;
        scriptUpdateURL: string | null;
        scriptWillUpdate: boolean;

        /** This refers to tampermonkey's version */
        version?: string;
    }
}

declare const GM_info: Tampermonkey.ScriptInfo;
