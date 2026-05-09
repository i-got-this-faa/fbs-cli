import { join } from 'path';
import { homedir } from 'os';

export const CONFIG_DIR = join(homedir(), '.config', 'fbs');
export const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
