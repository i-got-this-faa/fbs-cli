import { useEffect } from 'react';
import { useServerStore } from '../stores/server';
import { useConnectionStore } from '../stores/connection';
import { useDashboardStore } from '../stores/dashboard';
import { PageHeader } from '../components/page-header';
import { ActionButton } from '../components/action-button';
import { Loading } from '../components/loading';
import { COLORS } from '../theme';
import { formatBytes } from '../utils/format';
import { clearConfig } from '../services/config-store';
import type { AppView } from '../components/sidebar';

interface SettingsViewProps {
	onNavigate: (view: AppView) => void;
}

export function SettingsView({ onNavigate }: SettingsViewProps) {
	const { config, isLoadingConfig, loadConfig } = useServerStore();
	const { apiUrl, token, disconnect } = useConnectionStore();
	const { metrics } = useDashboardStore();

	useEffect(() => {
		loadConfig();
	}, [loadConfig]);

	if (isLoadingConfig && !config) {
		return <Loading message="Loading settings..." />;
	}

	return (
		<box flexGrow={1} flexDirection="column">
			<PageHeader
				title="Settings"
				actions={
					<ActionButton
						label="Disconnect"
						color={COLORS.error}
						onClick={() => {
							clearConfig();
							disconnect();
							onNavigate('dashboard');
						}}
					/>
				}
			/>

			<box flexGrow={1} flexDirection="column" padding={1} gap={1}>
				<box borderStyle="rounded" borderColor={COLORS.border} padding={1} flexDirection="column" gap={1}>
					<text fg={COLORS.accent}>Connection</text>
					<box flexDirection="row">
						<text width={16} fg={COLORS.textDim}>
							Endpoint:
						</text>
						<text fg={COLORS.text}>{apiUrl}</text>
					</box>
					<box flexDirection="row">
						<text width={16} fg={COLORS.textDim}>
							Token:
						</text>
						<text fg={COLORS.text}>
							{token.slice(0, 12)}...{token.slice(-4)}
						</text>
					</box>
				</box>

				{config && (
					<box borderStyle="rounded" borderColor={COLORS.border} padding={1} flexDirection="column" gap={1}>
						<text fg={COLORS.accent}>Server Config</text>
						<box flexDirection="row">
							<text width={16} fg={COLORS.textDim}>
								Region:
							</text>
							<text fg={COLORS.text}>{config.region}</text>
						</box>
						<box flexDirection="row">
							<text width={16} fg={COLORS.textDim}>
								Dev Mode:
							</text>
							<text fg={config.devMode ? COLORS.warning : COLORS.text}>{config.devMode ? 'Yes' : 'No'}</text>
						</box>
						<box flexDirection="row">
							<text width={16} fg={COLORS.textDim}>
								Public URL:
							</text>
							<text fg={COLORS.text}>{config.publicBaseUrl || '—'}</text>
						</box>
						<box flexDirection="row">
							<text width={16} fg={COLORS.textDim}>
								S3 Max Keys:
							</text>
							<text fg={COLORS.text}>{config.limits.s3MaxKeys}</text>
						</box>
						<box flexDirection="row">
							<text width={16} fg={COLORS.textDim}>
								S3 Delete Max:
							</text>
							<text fg={COLORS.text}>{config.limits.s3DeleteObjects}</text>
						</box>
						<box flexDirection="row">
							<text width={16} fg={COLORS.textDim}>
								List Limit:
							</text>
							<text fg={COLORS.text}>{config.limits.managementObjectListLimit}</text>
						</box>
						<box flexDirection="row">
							<text width={16} fg={COLORS.textDim}>
								Activity Limit:
							</text>
							<text fg={COLORS.text}>{config.limits.managementActivityLimit}</text>
						</box>
					</box>
				)}

				<box borderStyle="rounded" borderColor={COLORS.border} padding={1} flexDirection="column" gap={1}>
					<text fg={COLORS.accent}>Storage</text>
					<box flexDirection="row">
						<text width={16} fg={COLORS.textDim}>
							Buckets:
						</text>
						<text fg={COLORS.text}>{metrics?.totalBuckets ?? '—'}</text>
					</box>
					<box flexDirection="row">
						<text width={16} fg={COLORS.textDim}>
							Objects:
						</text>
						<text fg={COLORS.text}>{metrics?.totalObjects ?? '—'}</text>
					</box>
					<box flexDirection="row">
						<text width={16} fg={COLORS.textDim}>
							Total Size:
						</text>
						<text fg={COLORS.text}>{formatBytes(metrics?.totalStorageBytes ?? 0)}</text>
					</box>
				</box>
			</box>
		</box>
	);
}
