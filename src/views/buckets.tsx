import { useEffect, useState } from 'react';
import { useBucketsStore } from '../stores/buckets';
import { PageHeader } from '../components/page-header';
import { ActionButton } from '../components/action-button';
import { Table } from '../components/table';
import { Loading } from '../components/loading';
import { ConfirmDialog } from '../components/confirm-dialog';
import { InputDialog } from '../components/input-dialog';
import { formatBytes, formatDate } from '../utils/format';
import { COLORS } from '../theme';
import type { Bucket } from '../types/api';
import type { AppView } from '../components/sidebar';

interface BucketsViewProps {
	onNavigate: (view: AppView, bucket?: string) => void;
}

export function BucketsView({ onNavigate }: BucketsViewProps) {
	const { items, isLoading, error, load, remove, create, empty } = useBucketsStore();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [showCreate, setShowCreate] = useState(false);
	const [showDelete, setShowDelete] = useState(false);
	const [showEmpty, setShowEmpty] = useState(false);

	useEffect(() => {
		load();
	}, [load]);

	if (isLoading && items.length === 0) {
		return <Loading message="Loading buckets..." />;
	}

	const selectedBucket = items[selectedIndex];

	return (
		<box flexGrow={1} flexDirection="column">
			<PageHeader
				title="Buckets"
				actions={
					<>
						<ActionButton label="+New" onClick={() => setShowCreate(true)} />
						{selectedBucket && (
							<>
								<ActionButton label="Empty" color={COLORS.warning} onClick={() => setShowEmpty(true)} />
								<ActionButton label="Delete" color={COLORS.error} onClick={() => setShowDelete(true)} />
							</>
						)}
					</>
				}
			/>

			<box flexGrow={1} flexDirection="column" padding={1} gap={1}>
				{error && <text fg={COLORS.error}>{error}</text>}

				<Table
					columns={[
						{ key: 'name', header: 'Name', width: 20, render: (b: Bucket) => b.name },
						{ key: 'objects', header: 'Objects', width: 10, render: (b: Bucket) => String(b.objectCount ?? 0) },
						{ key: 'size', header: 'Size', width: 12, render: (b: Bucket) => formatBytes(b.totalObjectBytes ?? 0) },
						{ key: 'created', header: 'Created', width: 12, render: (b: Bucket) => formatDate(b.createdAt) },
					]}
					items={items}
					selectedIndex={selectedIndex}
					onSelect={(index) => {
						setSelectedIndex(index);
						onNavigate('bucket-detail', items[index]?.name);
					}}
					emptyMessage="No buckets"
					getRowId={(b) => b.name}
				/>
			</box>

			{showCreate && (
				<InputDialog
					title="Create Bucket"
					message="Enter a DNS-compliant bucket name."
					placeholder="my-bucket"
					onConfirm={async (name) => {
						const ok = await create(name);
						if (ok) setShowCreate(false);
					}}
					onCancel={() => setShowCreate(false)}
				/>
			)}

			{showDelete && selectedBucket && (
				<ConfirmDialog
					title="Delete Bucket"
					message={`Are you sure you want to delete "${selectedBucket.name}"? This cannot be undone.`}
					onConfirm={async () => {
						const ok = await remove(selectedBucket.name);
						if (ok) {
							setShowDelete(false);
							setSelectedIndex(0);
						}
					}}
					onCancel={() => setShowDelete(false)}
					isDestructive
				/>
			)}

			{showEmpty && selectedBucket && (
				<ConfirmDialog
					title="Empty Bucket"
					message={`Are you sure you want to empty "${selectedBucket.name}"? All objects will be deleted.`}
					onConfirm={async () => {
						const ok = await empty(selectedBucket.name);
						if (ok) setShowEmpty(false);
					}}
					onCancel={() => setShowEmpty(false)}
					isDestructive
				/>
			)}
		</box>
	);
}
