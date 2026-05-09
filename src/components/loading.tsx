import { COLORS } from '../theme';

interface LoadingProps {
	message?: string;
}

export function Loading({ message = 'Loading...' }: LoadingProps) {
	return (
		<box flexGrow={1} justifyContent="center" alignItems="center" flexDirection="column" gap={1}>
			<text fg={COLORS.accent}>◐</text>
			<text fg={COLORS.textDim}>{message}</text>
		</box>
	);
}
