import { create } from 'zustand';
import type { Bucket } from '../types/api';
import { useConnectionStore } from './connection';

interface BucketsState {
	items: Bucket[];
	selected: Bucket | null;
	isLoading: boolean;
	error: string | null;
	load: () => Promise<void>;
	loadOne: (name: string) => Promise<void>;
	create: (name: string) => Promise<boolean>;
	remove: (name: string) => Promise<boolean>;
	empty: (name: string) => Promise<boolean>;
}

export const useBucketsStore = create<BucketsState>((set, get) => ({
	items: [],
	selected: null,
	isLoading: false,
	error: null,

	load: async () => {
		const client = useConnectionStore.getState().client;
		if (!client) return;

		set({ isLoading: true, error: null });

		try {
			const items = await client.listBuckets();
			set({ items, isLoading: false });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : 'Failed to load buckets',
				isLoading: false,
			});
		}
	},

	loadOne: async (name: string) => {
		const client = useConnectionStore.getState().client;
		if (!client) return;

		try {
			const selected = await client.getBucket(name);
			set({ selected });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : 'Failed to load bucket',
			});
		}
	},

	create: async (name: string) => {
		const client = useConnectionStore.getState().client;
		if (!client) return false;

		try {
			await client.createBucket(name);
			await get().load();
			return true;
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : 'Failed to create bucket',
			});
			return false;
		}
	},

	remove: async (name: string) => {
		const client = useConnectionStore.getState().client;
		if (!client) return false;

		try {
			await client.deleteBucket(name);
			set((state) => ({
				items: state.items.filter((b) => b.name !== name),
				selected: state.selected?.name === name ? null : state.selected,
			}));
			return true;
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : 'Failed to delete bucket',
			});
			return false;
		}
	},

	empty: async (name: string) => {
		const client = useConnectionStore.getState().client;
		if (!client) return false;

		try {
			await client.emptyBucket(name);
			set((state) => ({
				items: state.items.map((b) => (b.name === name ? { ...b, objectCount: 0, totalObjectBytes: 0 } : b)),
			}));
			return true;
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : 'Failed to empty bucket',
			});
			return false;
		}
	},
}));
