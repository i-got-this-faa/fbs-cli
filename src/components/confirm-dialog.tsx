import { useState } from 'react';
import { COLORS } from '../theme';

interface ConfirmDialogProps {
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	onConfirm: () => void;
	onCancel: () => void;
	isDestructive?: boolean;
}

export function ConfirmDialog({
	title,
	message,
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	onConfirm,
	onCancel,
	isDestructive = false,
}: ConfirmDialogProps) {
	const [focused, setFocused] = useState<'confirm' | 'cancel'>('cancel');

	return (
		<box
			position="absolute"
			left="25%"
			top="30%"
			width="50%"
			height={6}
			borderStyle="rounded"
			borderColor={isDestructive ? COLORS.error : COLORS.borderFocus}
			backgroundColor={COLORS.surface}
			flexDirection="column"
			padding={1}
			gap={1}
		>
			<text fg={isDestructive ? COLORS.error : COLORS.text}>{title}</text>
			<text fg={COLORS.textDim}>{message}</text>
			<box flexDirection="row" gap={2} justifyContent="flex-end">
				<box
					paddingX={2}
					paddingY={0}
					borderStyle="single"
					borderColor={focused === 'cancel' ? COLORS.borderFocus : COLORS.border}
					onMouseDown={() => {
						setFocused('cancel');
						onCancel();
					}}
				>
					<text fg={COLORS.text}>{cancelLabel}</text>
				</box>
				<box
					paddingX={2}
					paddingY={0}
					borderStyle="single"
					borderColor={focused === 'confirm' ? COLORS.borderFocus : COLORS.border}
					onMouseDown={() => {
						setFocused('confirm');
						onConfirm();
					}}
				>
					<text fg={isDestructive ? COLORS.error : COLORS.accent}>{confirmLabel}</text>
				</box>
			</box>
		</box>
	);
}
