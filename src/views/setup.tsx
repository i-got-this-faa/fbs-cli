import { useState } from 'react';
import { useConnectionStore } from '../stores/connection';
import { COLORS } from '../theme';

export function SetupView() {
	const { connect, isConnecting, error } = useConnectionStore();
	const [url, setUrl] = useState('http://127.0.0.1:9000');
	const [token, setToken] = useState('');

	return (
		<box flexGrow={1} justifyContent="center" alignItems="center" flexDirection="column" gap={2}>
			<box
				width={50}
				borderStyle="rounded"
				borderColor={COLORS.accent}
				backgroundColor={COLORS.surface}
				flexDirection="column"
				padding={2}
				gap={1}
			>
				<text fg={COLORS.accent}>Connect to FBS</text>
				<text fg={COLORS.textDim}>Enter your backend URL and bearer token.</text>

				<box flexDirection="row" gap={1} alignItems="center">
					<text width={12} fg={COLORS.textDim}>
						URL:
					</text>
					<box flexGrow={1} borderStyle="single" borderColor={COLORS.border}>
						<input
							value={url}
							onInput={setUrl}
							placeholder="http://127.0.0.1:9000"
							focused
							backgroundColor={COLORS.surfaceHighlight}
							textColor={COLORS.text}
							cursorColor={COLORS.accent}
						/>
					</box>
				</box>

				<box flexDirection="row" gap={1} alignItems="center">
					<text width={12} fg={COLORS.textDim}>
						Token:
					</text>
					<box flexGrow={1} borderStyle="single" borderColor={COLORS.border}>
						<input
							value={token}
							onInput={setToken}
							placeholder="fbsa_..."
							backgroundColor={COLORS.surfaceHighlight}
							textColor={COLORS.text}
							cursorColor={COLORS.accent}
						/>
					</box>
				</box>

				<box
					paddingX={2}
					paddingY={0}
					borderStyle="single"
					borderColor={COLORS.accent}
					onMouseDown={() => connect(url, token)}
				>
					<text fg={COLORS.accent}>{isConnecting ? 'Connecting...' : 'Connect'}</text>
				</box>

				{error && <text fg={COLORS.error}>{error}</text>}
			</box>
		</box>
	);
}
