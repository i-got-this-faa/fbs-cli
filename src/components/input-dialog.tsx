import { useState } from 'react';
import { COLORS } from '../theme';

interface InputDialogProps {
	title: string;
	message?: string;
	placeholder?: string;
	defaultValue?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	onConfirm: (value: string) => void;
	onCancel: () => void;
}

export function InputDialog({
	title,
	message,
	placeholder = '',
	defaultValue = '',
	confirmLabel = 'Create',
	cancelLabel = 'Cancel',
	onConfirm,
	onCancel,
}: InputDialogProps) {
	const [value, setValue] = useState(defaultValue);

	return (
		<box
			position="absolute"
			left="25%"
			top="30%"
			width="50%"
			height={message ? 7 : 6}
			borderStyle="rounded"
			borderColor={COLORS.borderFocus}
			backgroundColor={COLORS.surface}
			flexDirection="column"
			padding={1}
			gap={1}
		>
			<text fg={COLORS.text}>{title}</text>
			{message && <text fg={COLORS.textDim}>{message}</text>}
			<box borderStyle="single" borderColor={COLORS.border} padding={0}>
				<input
					value={value}
					onInput={setValue}
					onSubmit={() => onConfirm(value)}
					placeholder={placeholder}
					focused
					backgroundColor={COLORS.surfaceHighlight}
					textColor={COLORS.text}
					cursorColor={COLORS.accent}
				/>
			</box>
			<box flexDirection="row" gap={2} justifyContent="flex-end">
				<box paddingX={2} paddingY={0} borderStyle="single" borderColor={COLORS.border} onMouseDown={onCancel}>
					<text fg={COLORS.text}>{cancelLabel}</text>
				</box>
				<box
					paddingX={2}
					paddingY={0}
					borderStyle="single"
					borderColor={COLORS.borderFocus}
					onMouseDown={() => onConfirm(value)}
				>
					<text fg={COLORS.accent}>{confirmLabel}</text>
				</box>
			</box>
		</box>
	);
}
