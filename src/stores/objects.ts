import { create } from 'zustand';
import type { ListObjectsOptions, ObjectListing, StorageObject } from '../types/api';
import { useConnectionStore } from './connection';

interface ObjectsState {
	items: StorageObject[];
	commonPrefixes: string[];
	isTruncated: boolean;
	isLoading: boolean;
	isLoadingMore: boolean;
	error: string | null;
	nextStartAfter: string | null;
	selectedKeys: string[];
	currentBucket: string;
	currentPrefix: string;
	load: (bucket: string, prefix?: string, startAfter?: string, append?: boolean) => Promise<void>;
	remove: (key: string) => Promise<boolean>;
	removeMany: (keys: string[]) => Promise<boolean>;
	toggleSelected: (key: string) => void;
	clearSelection: () => void;
	selectVisible: () => void;
	allVisibleSelected: boolean;
	isEmpty: boolean;
	totalItems: number;
	loadMore: () => void;
	navigateUp: () => void;
}

export const useObjectsStore = create<ObjectsState>((set, get) => ({
	items: [],
	commonPrefixes: [],
	isTruncated: false,
	isLoading: false,
	isLoadingMore: false,
	error: null,
	nextStartAfter: null,
	selectedKeys: [],
	currentBucket: '',
	currentPrefix: '',

	load: async (bucket: string, prefix = '', startAfter?: string, append = false) => {
		const client = useConnectionStore.getState().client;
		if (!client) return;

		const prefixChanged = bucket !== get().currentBucket || prefix !== get().currentPrefix;

		if (append) {
			set({ isLoadingMore: true });
		} else {
			set({ isLoading: true });
			if (prefixChanged) {
				set({ selectedKeys: [], currentBucket: bucket, currentPrefix: prefix });
			}
		}
		set({ error: null });

		try {
			const opts: ListObjectsOptions = {
				prefix,
				startAfter,
				delimiter: '/',
				maxKeys: 200,
			};
			const result: ObjectListing = await client.listObjects(bucket, opts);

			set((state) => ({
				items: append ? [...state.items, ...result.objects] : result.objects,
				commonPrefixes: append
					? [...new Set([...state.commonPrefixes, ...result.commonPrefixes])]
					: result.commonPrefixes,
				isTruncated: result.isTruncated,
				nextStartAfter: result.nextStartAfter,
				isLoading: false,
				isLoadingMore: false,
				currentBucket: bucket,
				currentPrefix: prefix,
			}));
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : 'Failed to load objects',
				isLoading: false,
				isLoadingMore: false,
			});
		}
	},

	remove: async (key: string) => {
		const client = useConnectionStore.getState().client;
		if (!client) return false;

		try {
			await client.deleteObject(get().currentBucket, key);
			set((state) => ({
				items: state.items.filter((o) => o.key !== key),
				selectedKeys: state.selectedKeys.filter((k) => k !== key),
			}));
			return true;
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : 'Failed to delete object',
			});
			return false;
		}
	},

	removeMany: async (keys: string[]) => {
		const client = useConnectionStore.getState().client;
		if (!client) return false;
		if (keys.length === 0) return true;

		try {
			await client.deleteObjects(get().currentBucket, keys);
			const keySet = new Set(keys);
			set((state) => ({
				items: state.items.filter((o) => !keySet.has(o.key)),
				selectedKeys: [],
			}));
			return true;
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : 'Failed to delete selected objects',
			});
			return false;
		}
	},

	toggleSelected: (key: string) => {
		set((state) => ({
			selectedKeys: state.selectedKeys.includes(key)
				? state.selectedKeys.filter((k) => k !== key)
				: [...state.selectedKeys, key],
		}));
	},

	clearSelection: () => {
		set({ selectedKeys: [] });
	},

	selectVisible: () => {
		set((state) => ({
			selectedKeys: state.items.map((o) => o.key),
		}));
	},

	get allVisibleSelected() {
		const state = get();
		return state.items.length > 0 && state.items.every((o) => state.selectedKeys.includes(o.key));
	},

	get isEmpty() {
		const state = get();
		return state.items.length === 0 && state.commonPrefixes.length === 0;
	},

	get totalItems() {
		const state = get();
		return state.items.length + state.commonPrefixes.length;
	},

	loadMore: () => {
		const state = get();
		if (!state.nextStartAfter || state.isLoadingMore) return;
		get().load(state.currentBucket, state.currentPrefix, state.nextStartAfter, true);
	},

	navigateUp: () => {
		const state = get();
		const parts = state.currentPrefix.split('/').filter(Boolean);
		parts.pop();
		const newPrefix = parts.length > 0 ? parts.join('/') + '/' : '';
		get().load(state.currentBucket, newPrefix);
	},
}));
