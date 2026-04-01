import type { DBSchema, IDBPTransaction, StoreNames } from 'idb';

export async function waitForDataAndTransaction<
    T,
    TDBSchema extends DBSchema,
    TStoreNames extends ArrayLike<StoreNames<TDBSchema>>,
>(
    dataPromise: Promise<T>,
    transaction: IDBPTransaction<TDBSchema, TStoreNames, IDBTransactionMode>,
): Promise<Awaited<T>>;
export async function waitForDataAndTransaction<
    T,
    TDBSchema extends DBSchema,
    TStoreNames extends ArrayLike<StoreNames<TDBSchema>>,
>(
    dataPromise: Promise<T>[],
    transaction: IDBPTransaction<TDBSchema, TStoreNames, IDBTransactionMode>,
): Promise<Awaited<T>[]>;
export async function waitForDataAndTransaction<
    T,
    TDBSchema extends DBSchema,
    TStoreNames extends ArrayLike<StoreNames<TDBSchema>>,
>(
    dataPromise: Promise<T> | Promise<T>[],
    transaction: IDBPTransaction<TDBSchema, TStoreNames, IDBTransactionMode>,
): Promise<Awaited<T> | Awaited<T>[]> {
    if (Array.isArray(dataPromise)) {
        const [, ...data] = await Promise.all([transaction.done, ...dataPromise]);
        return data;
    } else {
        const [data] = await Promise.all([dataPromise, transaction.done]);
        return data;
    }
}
