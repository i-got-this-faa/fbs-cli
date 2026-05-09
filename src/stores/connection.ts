import { create } from 'zustand';
import { FbsApiClient } from '../services/api-client';
import type { FbsClient } from '../types/api';
import { loadConfig, saveConfig } from '../services/config-store';

interface ConnectionState {
	apiUrl: string;
	token: string;
	isConnected: boolean;
	isConnecting: boolean;
	error: string | null;
	client: FbsClient | null;
}

interface ConnectionActions {
	connect: (apiUrl: string, token: string) => Promise<void>;
	disconnect: () => void;
	tryRestore: () => Promise<void>;
}

const initialState: ConnectionState = {
	apiUrl: '',
	token: '',
	isConnected: false,
	isConnecting: false,
	error: null,
	client: null,
};

export const useConnectionStore = create<ConnectionState & ConnectionActions>((set, get) => ({
	...initialState,

	connect: async (apiUrl: string, token: string) => {
		set({ isConnecting: true, error: null });

		try {
			const trimmedUrl = apiUrl.replace(/\/+$/, '');
			const client = new FbsApiClient(trimmedUrl, token);
			const healthy = await client.healthCheck();

			if (!healthy) {
				throw new Error('Backend health check failed — server may be down or URL is incorrect.');
			}

			set({
				apiUrl: trimmedUrl,
				token,
				client,
				isConnected: true,
				isConnecting: false,
				error: null,
			});

			saveConfig({ apiUrl: trimmedUrl, token });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : 'Connection failed',
				isConnected: false,
				isConnecting: false,
				client: null,
			});
		}
	},

	disconnect: () => {
		set({ ...initialState });
	},

	tryRestore: async () => {
		const config = loadConfig();
		if (!config) return;
		await get().connect(config.apiUrl, config.token);
	},
}));
