import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname } from 'path';
import { CONFIG_PATH } from '../config';

export interface SavedConfig {
	apiUrl: string;
	token: string;
}

export function loadConfig(): SavedConfig | null {
	try {
		if (!existsSync(CONFIG_PATH)) return null;
		const raw = readFileSync(CONFIG_PATH, 'utf-8');
		return JSON.parse(raw) as SavedConfig;
	} catch {
		return null;
	}
}

export function saveConfig(config: SavedConfig): void {
	try {
		mkdirSync(dirname(CONFIG_PATH), { recursive: true });
		writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
	} catch {
		// silently fail if we can't write config
	}
}

export function clearConfig(): void {
	try {
		if (existsSync(CONFIG_PATH)) {
			writeFileSync(CONFIG_PATH, '{}', 'utf-8');
		}
	} catch {
		// silently fail
	}
}
