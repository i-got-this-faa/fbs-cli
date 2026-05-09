import { COLORS } from '../theme';
import type { AppView } from './sidebar';

const VIEW_TITLES: Record<AppView, string> = {
	dashboard: 'Dashboard',
	buckets: 'Buckets',
	'bucket-detail': 'Object Browser',
	keys: 'Access Keys',
	settings: 'Settings',
};

interface TopBarProps {
	activeView: AppView;
	currentBucket?: string;
	currentPrefix?: string;
}

export function TopBar({ activeView, currentBucket, currentPrefix }: TopBarProps) {
	let breadcrumb = VIEW_TITLES[activeView];

	if (activeView === 'bucket-detail' && currentBucket) {
		const prefixParts = currentPrefix ? currentPrefix.split('/').filter(Boolean) : [];
		const prefixDisplay = prefixParts.length > 0 ? ` / ${prefixParts.join(' / ')}` : '';
		breadcrumb = `Buckets > ${currentBucket}${prefixDisplay}`;
	}

	return (
		<box
			height={1}
			flexDirection="row"
			alignItems="center"
			paddingLeft={1}
			paddingRight={1}
			backgroundColor={COLORS.surface}
			borderStyle="single"
			borderColor={COLORS.border}
		>
			<text fg={COLORS.text}>{breadcrumb}</text>
		</box>
	);
}
