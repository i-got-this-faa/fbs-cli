import { COLORS } from '../theme';

export type AppView = 'dashboard' | 'buckets' | 'bucket-detail' | 'keys' | 'settings';

const VIEW_ITEMS: { key: AppView; label: string; shortcut: string }[] = [
	{ key: 'dashboard', label: 'Dashboard', shortcut: '1' },
	{ key: 'buckets', label: 'Buckets', shortcut: '2' },
	{ key: 'keys', label: 'Keys', shortcut: '3' },
	{ key: 'settings', label: 'Settings', shortcut: '4' },
];

interface SidebarProps {
	activeView: AppView;
	onSelect: (view: AppView) => void;
}

export function Sidebar({ activeView, onSelect }: SidebarProps) {
	return (
		<box
			width={20}
			flexDirection="column"
			backgroundColor={COLORS.surface}
			borderStyle="single"
			borderColor={COLORS.borderDim}
			paddingTop={1}
			gap={0}
		>
			<text attributes={1} fg={COLORS.accent} paddingLeft={1}>
				FBS
			</text>

			{VIEW_ITEMS.map((item) => {
				const isActive = activeView === item.key || (item.key === 'buckets' && activeView === 'bucket-detail');
				return (
					<box
						key={item.key}
						height={1}
						flexDirection="row"
						paddingLeft={1}
						backgroundColor={isActive ? COLORS.selectedBg : 'transparent'}
						onMouseDown={() => onSelect(item.key)}
					>
						<text fg={isActive ? COLORS.selectedFg : COLORS.textDim}>
							{isActive ? '▸' : ' '} {item.label}
						</text>
						<text fg={COLORS.textMuted}> [{item.shortcut}]</text>
					</box>
				);
			})}
		</box>
	);
}
