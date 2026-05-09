import { COLORS } from '../theme';

interface ActionButtonProps {
	label: string;
	color?: string;
	onClick: () => void;
}

export function ActionButton({ label, color = COLORS.accent, onClick }: ActionButtonProps) {
	return (
		<box paddingX={1} onMouseDown={onClick}>
			<text fg={color}>{label}</text>
		</box>
	);
}
