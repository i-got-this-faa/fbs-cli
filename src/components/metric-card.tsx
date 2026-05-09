import { COLORS } from '../theme';

interface MetricCardProps {
	label: string;
	value: string;
	color?: string;
}

export function MetricCard({ label, value, color = COLORS.accent }: MetricCardProps) {
	return (
		<box
			flexGrow={1}
			borderStyle="rounded"
			borderColor={COLORS.border}
			paddingX={1}
			flexDirection="row"
			justifyContent="space-between"
			alignItems="center"
		>
			<text fg={COLORS.textDim}>{label}</text>
			<text fg={color}>{value}</text>
		</box>
	);
}
