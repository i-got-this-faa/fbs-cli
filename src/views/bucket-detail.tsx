import { useEffect, useState } from 'react';
import { useObjectsStore } from '../stores/objects';
import { useBucketsStore } from '../stores/buckets';
import { PageHeader } from '../components/page-header';
import { ActionButton } from '../components/action-button';
import { Table } from '../components/table';
import { Loading } from '../components/loading';
import { ConfirmDialog } from '../components/confirm-dialog';
import { formatBytes, timeAgo, keyBasename } from '../utils/format';
import { COLORS } from '../theme';

interface BucketDetailViewProps {
	bucketName: string;
}

export function BucketDetailView({ bucketName }: BucketDetailViewProps) {
	const {
		items,
		commonPrefixes,
		isLoading,
		isTruncated,
		error,
		selectedKeys,
		currentPrefix,
		load,
		remove,
		removeMany,
		clearSelection,
		loadMore,
		navigateUp,
	} = useObjectsStore();
	const { loadOne } = useBucketsStore();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [showDelete, setShowDelete] = useState(false);
	const [showDeleteMany, setShowDeleteMany] = useState(false);

	useEffect(() => {
		load(bucketName);
		loadOne(bucketName);
	}, [bucketName, load, loadOne]);

	if (isLoading && items.length === 0 && commonPrefixes.length === 0) {
		return <Loading message="Loading objects..." />;
	}

	const allRows: {
		type: 'prefix' | 'object';
		key: string;
		name: string;
		size?: number;
		contentType?: string;
		updatedAt?: string;
	}[] = [
		...commonPrefixes.map((p) => ({ type: 'prefix' as const, key: p, name: `📁 ${keyBasename(p)}` })),
		...items.map((o) => ({
			type: 'object' as const,
			key: o.key,
			name: keyBasename(o.key),
			size: o.size,
			contentType: o.contentType,
			updatedAt: o.updatedAt,
		})),
	];

	const selectedRow = allRows[selectedIndex];

	const prefixParts = currentPrefix ? currentPrefix.split('/').filter(Boolean) : [];
	const prefixDisplay = prefixParts.length > 0 ? ` / ${prefixParts.join(' / ')}` : '';
	const breadcrumb = `Buckets > ${bucketName}${prefixDisplay}`;

	return (
		<box flexGrow={1} flexDirection="column">
			<PageHeader
				title={breadcrumb}
				actions={
					<>
						{currentPrefix && <ActionButton label="←Up" color={COLORS.info} onClick={() => navigateUp()} />}
						{selectedKeys.length > 0 && (
							<ActionButton
								label={`Delete(${selectedKeys.length})`}
								color={COLORS.error}
								onClick={() => setShowDeleteMany(true)}
							/>
						)}
						{selectedRow?.type === 'object' && (
							<ActionButton label="Delete" color={COLORS.error} onClick={() => setShowDelete(true)} />
						)}
					</>
				}
			/>

			<box flexGrow={1} flexDirection="column" padding={1} gap={1}>
				{error && <text fg={COLORS.error}>{error}</text>}

				<Table
					columns={[
						{ key: 'name', header: 'Name', width: 30, render: (r) => r.name },
						{
							key: 'size',
							header: 'Size',
							width: 10,
							render: (r) => (r.size !== undefined ? formatBytes(r.size) : '-'),
						},
						{ key: 'type', header: 'Type', width: 16, render: (r) => r.contentType ?? 'folder' },
						{ key: 'updated', header: 'Updated', width: 12, render: (r) => (r.updatedAt ? timeAgo(r.updatedAt) : '-') },
					]}
					items={allRows}
					selectedIndex={selectedIndex}
					onSelect={(index) => {
						const row = allRows[index];
						if (row?.type === 'prefix') {
							load(bucketName, row.key);
							setSelectedIndex(0);
						} else {
							setSelectedIndex(index);
						}
					}}
					emptyMessage="This bucket is empty"
					getRowId={(r) => r.key}
					isSelected={(r) => r.type === 'object' && selectedKeys.includes(r.key)}
				/>

				{isTruncated && (
					<box paddingX={2} paddingY={0} borderStyle="single" borderColor={COLORS.info} onMouseDown={() => loadMore()}>
						<text fg={COLORS.info}>Load More</text>
					</box>
				)}
			</box>

			{showDelete && selectedRow?.type === 'object' && (
				<ConfirmDialog
					title="Delete Object"
					message={`Delete "${selectedRow.name}"?`}
					onConfirm={async () => {
						const ok = await remove(selectedRow.key);
						if (ok) {
							setShowDelete(false);
							setSelectedIndex(0);
						}
					}}
					onCancel={() => setShowDelete(false)}
					isDestructive
				/>
			)}

			{showDeleteMany && (
				<ConfirmDialog
					title="Delete Selected Objects"
					message={`Delete ${selectedKeys.length} selected objects?`}
					onConfirm={async () => {
						const ok = await removeMany(selectedKeys);
						if (ok) {
							setShowDeleteMany(false);
							clearSelection();
						}
					}}
					onCancel={() => setShowDeleteMany(false)}
					isDestructive
				/>
			)}
		</box>
	);
}
