import { useEffect } from 'react';
import { useDashboardStore } from '../stores/dashboard';
import { useBucketsStore } from '../stores/buckets';
import { useServerStore } from '../stores/server';
import { t, fg } from '@opentui/core';
import { PageHeader } from '../components/page-header';
import { Table } from '../components/table';
import { Loading } from '../components/loading';
import { formatBytes, timeAgo, truncate } from '../utils/format';
import { COLORS } from '../theme';
import type { ActivityItem, Bucket } from '../types/api';
import type { AppView } from '../components/sidebar';

interface DashboardViewProps {
	onNavigate: (view: AppView, bucket?: string) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
	const { metrics, isLoading, error, load: loadMetrics } = useDashboardStore();
	const { items: buckets, isLoading: isLoadingBuckets, load: loadBuckets } = useBucketsStore();
	const { activity, isLoadingActivity, loadActivity } = useServerStore();

	useEffect(() => {
		loadMetrics();
		loadBuckets();
		loadActivity({ limit: 20 });
	}, [loadMetrics, loadBuckets, loadActivity]);

	if (isLoading && !metrics) {
		return <Loading message="Loading dashboard..." />;
	}

	if (error) {
		return (
			<box flexGrow={1} justifyContent="center" alignItems="center">
				<text fg={COLORS.error}>{error}</text>
			</box>
		);
	}

	const bucketCount = metrics?.totalBuckets ?? 0;
	const objectCount = metrics?.totalObjects ?? 0;
	const storageBytes = metrics?.totalStorageBytes ?? 0;
	const keyCount = metrics?.totalKeys ?? 0;
	const activeKeys = metrics?.activeKeys ?? 0;

	const sortedBuckets = [...buckets].sort((a, b) => (b.totalObjectBytes ?? 0) - (a.totalObjectBytes ?? 0));

	const statsContent = t`${fg(COLORS.info)(`Buckets: ${bucketCount}`)}  ${fg(COLORS.textMuted)('│')}  ${fg(COLORS.success)(`Objects: ${objectCount}`)}  ${fg(COLORS.textMuted)('│')}  ${fg(COLORS.warning)(`Storage: ${formatBytes(storageBytes)}`)}  ${fg(COLORS.textMuted)('│')}  ${fg(COLORS.accent)(`Keys: ${activeKeys}/${keyCount}`)}`;

	return (
		<box flexGrow={1} flexDirection="column">
			<PageHeader title="Dashboard" actions={<text content={statsContent} />} />

			<box flexGrow={1} flexDirection="column" padding={1} gap={1}>
				<box flexDirection="column" flexGrow={1} gap={0}>
					<text fg={COLORS.textDim}>Buckets (by size)</text>
					{isLoadingBuckets && buckets.length === 0 ? (
						<Loading message="Loading buckets..." />
					) : (
						<Table
							columns={[
								{ key: 'name', header: 'Name', width: 20, render: (b: Bucket) => b.name },
								{ key: 'objects', header: 'Objects', width: 10, render: (b: Bucket) => String(b.objectCount ?? 0) },
								{ key: 'size', header: 'Size', width: 12, render: (b: Bucket) => formatBytes(b.totalObjectBytes ?? 0) },
							]}
							items={sortedBuckets}
							selectedIndex={-1}
							onSelect={(index) => {
								const bucket = sortedBuckets[index];
								if (bucket) onNavigate('bucket-detail', bucket.name);
							}}
							emptyMessage="No buckets"
							getRowId={(b) => b.name}
						/>
					)}
				</box>

				<box flexDirection="column" flexGrow={1} gap={0}>
					<text fg={COLORS.textDim}>Recent Activity</text>
					{isLoadingActivity && activity.length === 0 ? (
						<Loading message="Loading activity..." />
					) : (
						<Table
							columns={[
								{ key: 'action', header: 'Action', width: 16, render: (a: ActivityItem) => a.action },
								{ key: 'bucket', header: 'Bucket', width: 16, render: (a: ActivityItem) => a.bucket },
								{
									key: 'key',
									header: 'Key',
									width: 30,
									render: (a: ActivityItem) => (a.key ? truncate(a.key, 28) : '-'),
								},
								{ key: 'time', header: 'Time', width: 12, render: (a: ActivityItem) => timeAgo(a.createdAt) },
							]}
							items={activity}
							selectedIndex={-1}
							onSelect={() => {}}
							emptyMessage="No recent activity"
						/>
					)}
				</box>
			</box>
		</box>
	);
}
