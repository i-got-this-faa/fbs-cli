import { useState, useEffect, useCallback } from 'react';
import { useKeyboard } from '@opentui/react';
import { useConnectionStore } from './stores/connection';
import { Sidebar, type AppView } from './components/sidebar';
import { StatusBar } from './components/status-bar';
import { SetupView } from './views/setup';
import { DashboardView } from './views/dashboard';
import { BucketsView } from './views/buckets';
import { BucketDetailView } from './views/bucket-detail';
import { KeysView } from './views/keys';
import { SettingsView } from './views/settings';
import { COLORS } from './theme';

export function App() {
	const { isConnected, tryRestore, apiUrl } = useConnectionStore();
	const [activeView, setActiveView] = useState<AppView>('dashboard');
	const [currentBucket, setCurrentBucket] = useState<string>('');
	const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined);

	useEffect(() => {
		tryRestore();
	}, [tryRestore]);

	const navigate = useCallback((view: AppView, bucket?: string) => {
		setActiveView(view);
		if (bucket) {
			setCurrentBucket(bucket);
		}
	}, []);

	const handleKey = useCallback(
		(key: { name: string; ctrl: boolean }) => {
			if (key.ctrl && key.name === 'c') return;

			if (key.name === 'q') {
				process.exit(0);
			}

			if (key.name === 'r') {
				setStatusMessage('Refreshing...');
				setTimeout(() => setStatusMessage(undefined), 1000);
				return;
			}

			switch (key.name) {
				case '1':
					setActiveView('dashboard');
					break;
				case '2':
					setActiveView('buckets');
					break;
				case '3':
					setActiveView('keys');
					break;
				case '4':
					setActiveView('settings');
					break;
				case 'escape':
					if (activeView === 'bucket-detail') {
						setActiveView('buckets');
					}
					break;
			}
		},
		[activeView],
	);

	useKeyboard(handleKey);

	const handleSidebarSelect = useCallback(
		(view: AppView) => {
			if (view === 'buckets' && activeView === 'bucket-detail') {
				setCurrentBucket('');
			}
			setActiveView(view);
		},
		[activeView],
	);

	const renderView = () => {
		if (!isConnected) {
			return <SetupView />;
		}

		switch (activeView) {
			case 'dashboard':
				return <DashboardView onNavigate={navigate} />;
			case 'buckets':
				return <BucketsView onNavigate={navigate} />;
			case 'bucket-detail':
				return <BucketDetailView bucketName={currentBucket} />;
			case 'keys':
				return <KeysView />;
			case 'settings':
				return <SettingsView onNavigate={navigate} />;
			default:
				return <DashboardView onNavigate={navigate} />;
		}
	};

	return (
		<box flexGrow={1} flexDirection="row" backgroundColor={COLORS.bg} padding={0} gap={0}>
			{isConnected && <Sidebar activeView={activeView} onSelect={handleSidebarSelect} />}

			<box flexGrow={1} flexDirection="column" gap={0}>
				<box flexGrow={1} flexDirection="column">
					{renderView()}
				</box>

				{isConnected && (
					<StatusBar activeView={activeView} isConnected={isConnected} apiUrl={apiUrl} message={statusMessage} />
				)}
			</box>
		</box>
	);
}
