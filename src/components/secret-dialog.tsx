import { COLORS } from '../theme';

interface SecretDialogProps {
	bearerToken: string;
	sigV4AccessKeyId: string;
	sigV4SecretKey: string;
	onDismiss: () => void;
}

export function SecretDialog({ bearerToken, sigV4AccessKeyId, sigV4SecretKey, onDismiss }: SecretDialogProps) {
	return (
		<box
			position="absolute"
			left="20%"
			top="20%"
			width="60%"
			height={10}
			borderStyle="rounded"
			borderColor={COLORS.warning}
			backgroundColor={COLORS.surface}
			flexDirection="column"
			padding={1}
			gap={1}
		>
			<text fg={COLORS.warning}>New Access Key Created — Save these credentials!</text>
			<box flexDirection="column" gap={0}>
				<text fg={COLORS.text}>Bearer Token: {bearerToken}</text>
				<text fg={COLORS.text}>SigV4 Access Key: {sigV4AccessKeyId}</text>
				<text fg={COLORS.text}>SigV4 Secret: {sigV4SecretKey}</text>
			</box>
			<box flexDirection="row" justifyContent="flex-end">
				<box paddingX={2} paddingY={0} borderStyle="single" borderColor={COLORS.borderFocus} onMouseDown={onDismiss}>
					<text fg={COLORS.accent}>Dismiss</text>
				</box>
			</box>
		</box>
	);
}
