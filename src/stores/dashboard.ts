import { create } from 'zustand';
import type { DashboardMetrics } from '../types/api';
import { useConnectionStore } from './connection';

interface DashboardState {
	metrics: DashboardMetrics | null;
	isLoading: boolean;
	error: string | null;
	load: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
	metrics: null,
	isLoading: false,
	error: null,

	load: async () => {
		const client = useConnectionStore.getState().client;
		if (!client) return;

		set({ isLoading: true, error: null });

		try {
			const metrics = await client.getMetrics();
			set({ metrics, isLoading: false });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : 'Failed to load dashboard metrics',
				isLoading: false,
			});
		}
	},
}));
