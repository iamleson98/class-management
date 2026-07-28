export type StorageItem<T = any> = {
    timestamp: Date;
    value: T;
};

export type StorageInitialized = boolean;

export type StorageState = {
    initialized: StorageInitialized;
    storage: Record<string, StorageItem>;
};
