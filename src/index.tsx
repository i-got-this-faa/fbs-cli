import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { App } from './app';
import { COLORS } from './theme';

async function main() {
	const renderer = await createCliRenderer({
		exitOnCtrlC: true,
		screenMode: 'alternate-screen',
		backgroundColor: COLORS.bg,
	});

	renderer.setTerminalTitle('FBS CLI');
	createRoot(renderer).render(<App />);
}

main().catch((err) => {
	console.error('Failed to start FBS CLI:', err);
	process.exit(1);
});
