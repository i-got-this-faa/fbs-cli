import { create } from 'zustand';
import type { AccessKey, CreateKeyRequest, CreateKeyResponse, UpdateKeyRequest } from '../types/api';
import { useConnectionStore } from './connection';

interface KeysState {
	items: AccessKey[];
	lastCreatedSecret: CreateKeyResponse | null;
	isLoading: boolean;
	error: string | null;
	load: () => Promise<void>;
	create: (data: CreateKeyRequest) => Promise<boolean>;
	update: (id: string, data: UpdateKeyRequest) => Promise<boolean>;
	toggleActive: (id: string, isActive: boolean) => Promise<boolean>;
	rename: (id: string, displayName: string) => Promise<boolean>;
	remove: (id: string) => Promise<boolean>;
	dismissSecret: () => void;
	activeCount: number;
}

export const useKeysStore = create<KeysState>((set, get) => ({
	items: [],
	lastCreatedSecret: null,
	isLoading: false,
	error: null,

	load: async () => {
		const client = useConnectionStore.getState().client;
		if (!client) return;

		set({ isLoading: true, error: null });

		try {
			const items = await client.listKeys();
			set({ items, isLoading: false });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : 'Failed to load access keys',
				isLoading: false,
			});
		}
	},

	create: async (data: CreateKeyRequest) => {
		const client = useConnectionStore.getState().client;
		if (!client) return false;

		try {
			const result = await client.createKey(data);
			set({ lastCreatedSecret: result });
			await get().load();
			return true;
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : 'Failed to create key',
			});
			return false;
		}
	},

	toggleActive: async (id: string, isActive: boolean) => {
		return get().update(id, { isActive });
	},

	rename: async (id: string, displayName: string) => {
		return get().update(id, { displayName });
	},

	update: async (id: string, data: UpdateKeyRequest) => {
		const client = useConnectionStore.getState().client;
		if (!client) return false;

		try {
			const updated = await client.updateKey(id, data);
			set((state) => ({
				items: state.items.map((k) => (k.id === id ? updated : k)),
			}));
			return true;
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : 'Failed to update key',
			});
			return false;
		}
	},

	remove: async (id: string) => {
		const client = useConnectionStore.getState().client;
		if (!client) return false;

		try {
			await client.deleteKey(id);
			set((state) => ({
				items: state.items.filter((k) => k.id !== id),
			}));
			return true;
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : 'Failed to delete key',
			});
			return false;
		}
	},

	dismissSecret: () => {
		set({ lastCreatedSecret: null });
	},

	get activeCount() {
		return get().items.filter((k) => k.isActive).length;
	},
}));
