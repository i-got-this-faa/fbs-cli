const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

/** Format bytes into a human-readable string (mirrors go-humanize behavior) */
export function formatBytes(bytes: number, decimals = 1): string {
	if (bytes === 0) return '0 B';
	if (bytes < 0) return '-' + formatBytes(-bytes, decimals);

	const k = 1024;
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), UNITS.length - 1);
	const value = bytes / Math.pow(k, i);

	return `${value.toFixed(decimals)} ${UNITS[i]}`;
}

/** Format an ISO timestamp into a relative time string */
export function timeAgo(isoString: string): string {
	const now = Date.now();
	const then = new Date(isoString).getTime();
	const diffMs = now - then;

	const seconds = Math.floor(diffMs / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (seconds < 60) return 'just now';
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 30) return `${days}d ago`;
	return formatDate(isoString);
}

/** Format an ISO timestamp into a human-readable date */
export function formatDate(isoString: string): string {
	return new Date(isoString).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}

/** Extract the "filename" from an S3 object key (last segment after /) */
export function keyBasename(key: string): string {
	const parts = key.split('/').filter(Boolean);
	return parts[parts.length - 1] ?? key;
}

/** Truncate a string with ellipsis */
export function truncate(str: string, maxLen: number): string {
	if (str.length <= maxLen) return str;
	return str.slice(0, maxLen - 1) + '…';
}
