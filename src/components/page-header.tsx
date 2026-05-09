import type { ReactNode } from 'react';
import { COLORS } from '../theme';

interface PageHeaderProps {
	title: string;
	actions?: ReactNode;
}

export function PageHeader({ title, actions }: PageHeaderProps) {
	return (
		<box
			height={1}
			flexDirection="row"
			justifyContent="space-between"
			alignItems="center"
			paddingLeft={1}
			paddingRight={1}
			backgroundColor={COLORS.surface}
			borderStyle="single"
			borderColor={COLORS.border}
		>
			<text fg={COLORS.text}>{title}</text>
			{actions ?? null}
		</box>
	);
}
