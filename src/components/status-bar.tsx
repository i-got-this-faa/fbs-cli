import { COLORS } from '../theme';
import type { AppView } from './sidebar';

const VIEW_SHORTCUTS: Record<AppView, string> = {
	dashboard: '1',
	buckets: '2',
	'bucket-detail': '2',
	keys: '3',
	settings: '4',
};

interface StatusBarProps {
	activeView: AppView;
	isConnected: boolean;
	apiUrl: string;
	message?: string;
}

export function StatusBar({ activeView, isConnected, apiUrl, message }: StatusBarProps) {
	const shortcuts = `q:quit r:refresh ${VIEW_SHORTCUTS[activeView]}:view ↑↓:nav Enter:select`;
	const status = isConnected ? `● Connected` : '○ Disconnected';
	const url = apiUrl ? ` ${apiUrl}` : '';

	return (
		<box
			height={1}
			flexDirection="row"
			justifyContent="space-between"
			alignItems="center"
			paddingLeft={1}
			paddingRight={1}
			backgroundColor={COLORS.statusBarBg}
			borderStyle="single"
			borderColor={COLORS.border}
		>
			<text fg={COLORS.statusBarFg}>{message ?? shortcuts}</text>
			<text fg={isConnected ? COLORS.success : COLORS.error}>
				{status}
				{url}
			</text>
		</box>
	);
}
