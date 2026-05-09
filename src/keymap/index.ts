import type { AppView } from '../components/sidebar';

export const VIEW_SHORTCUTS: Record<string, AppView> = {
	'1': 'dashboard',
	'2': 'buckets',
	'3': 'keys',
	'4': 'settings',
};

export const GLOBAL_SHORTCUTS = {
	QUIT: 'q',
	REFRESH: 'r',
	HELP: '?',
	BACK: 'escape',
} as const;
