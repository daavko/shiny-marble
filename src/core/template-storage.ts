import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

interface StoredTemplate {
    id: string;
    image: ImageData;
    thumbnail: ImageData;
}

interface TemplateStorageDBSchema extends DBSchema {
    templates: {
        key: string;
        value: StoredTemplate;
    };
}

type TemplateStorageDB = IDBPDatabase<TemplateStorageDBSchema>;

let indexedDbInstance: TemplateStorageDB | null = null;

async function getStorage(): Promise<TemplateStorageDB> {
    indexedDbInstance ??= await openDB<TemplateStorageDBSchema>('shinymarble', 1, {
        upgrade: () => {
            // todo
        },
    });
    return indexedDbInstance;
}

export const TemplateStorage = {};
