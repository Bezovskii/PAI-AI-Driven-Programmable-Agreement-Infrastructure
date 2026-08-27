import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Storage } from '@reown/appkit-react-native';

function parseStoredValue<T>(value: string): T {
    try {
        return JSON.parse(value) as T;
    } catch {
        return value as T;
    }
}

export const appKitStorage: Storage = {
    getKeys: async (): Promise<string[]> => {
        const keys = await AsyncStorage.getAllKeys();
        return [...keys];
    },

    getEntries: async <T = unknown>(): Promise<[string, T][]> => {
        const keys = await AsyncStorage.getAllKeys();

        const entries = await Promise.all(
            keys.map(async (key): Promise<[string, T]> => {
                const value = await AsyncStorage.getItem(key);

                if (value === null) {
                    return [key, undefined as T];
                }

                return [key, parseStoredValue<T>(value)];
            }),
        );

        return entries;
    },

    getItem: async <T = unknown>(key: string): Promise<T | undefined> => {
        const value = await AsyncStorage.getItem(key);

        if (value === null) {
            return undefined;
        }

        return parseStoredValue<T>(value);
    },

    setItem: async <T = unknown>(key: string, value: T): Promise<void> => {
        const serialized = JSON.stringify(value);

        if (serialized === undefined) {
            await AsyncStorage.removeItem(key);
            return;
        }

        await AsyncStorage.setItem(key, serialized);
    },

    removeItem: async (key: string): Promise<void> => {
        await AsyncStorage.removeItem(key);
    },
};