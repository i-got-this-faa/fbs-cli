import { create } from 'zustand';
import type { ActivityItem, ListActivityOptions, ServerConfig } from '../types/api';
import { useConnectionStore } from './connection';

interface ServerState {
	config: ServerConfig | null;
	activity: ActivityItem[];
	isLoadingConfig: boolean;
	isLoadingActivity: boolean;
	error: string | null;
	loadConfig: () => Promise<void>;
	loadActivity: (opts?: ListActivityOptions) => Promise<void>;
	refresh: () => Promise<void>;
}

export const useServerStore = create<ServerState>((set, get) => ({
	config: null,
	activity: [],
	isLoadingConfig: false,
	isLoadingActivity: false,
	error: null,

	loadConfig: async () => {
		const client = useConnectionStore.getState().client;
		if (!client) return;

		set({ isLoadingConfig: true, error: null });

		try {
			const config = await client.getConfig();
			set({ config, isLoadingConfig: false });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : 'Failed to load server config',
				isLoadingConfig: false,
			});
		}
	},

	loadActivity: async (opts?: ListActivityOptions) => {
		const client = useConnectionStore.getState().client;
		if (!client) return;

		set({ isLoadingActivity: true, error: null });

		try {
			const activity = await client.listActivity(opts);
			set({ activity, isLoadingActivity: false });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : 'Failed to load activity',
				isLoadingActivity: false,
			});
		}
	},

	refresh: async () => {
		await Promise.all([get().loadConfig(), get().loadActivity()]);
	},
}));
