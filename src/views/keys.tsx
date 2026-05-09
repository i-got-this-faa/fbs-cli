import { useEffect, useState } from 'react';
import { useKeysStore } from '../stores/keys';
import { PageHeader } from '../components/page-header';
import { ActionButton } from '../components/action-button';
import { Table } from '../components/table';
import { Loading } from '../components/loading';
import { ConfirmDialog } from '../components/confirm-dialog';
import { InputDialog } from '../components/input-dialog';
import { SecretDialog } from '../components/secret-dialog';
import { formatDate } from '../utils/format';
import { COLORS } from '../theme';
import type { AccessKey } from '../types/api';

export function KeysView() {
	const { items, isLoading, error, load, create, toggleActive, remove, lastCreatedSecret, dismissSecret } =
		useKeysStore();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [showCreate, setShowCreate] = useState(false);
	const [showDelete, setShowDelete] = useState(false);
	const [showRename, setShowRename] = useState(false);

	useEffect(() => {
		load();
	}, [load]);

	if (isLoading && items.length === 0) {
		return <Loading message="Loading keys..." />;
	}

	const selectedKey = items[selectedIndex];

	return (
		<box flexGrow={1} flexDirection="column">
			<PageHeader
				title="Access Keys"
				actions={
					<>
						<ActionButton label="+New" onClick={() => setShowCreate(true)} />
						{selectedKey && (
							<>
								<ActionButton
									label={selectedKey.isActive ? 'Deactivate' : 'Activate'}
									color={COLORS.info}
									onClick={async () => {
										await toggleActive(selectedKey.id, !selectedKey.isActive);
									}}
								/>
								<ActionButton label="Rename" color={COLORS.warning} onClick={() => setShowRename(true)} />
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
						{ key: 'name', header: 'Name', width: 20, render: (k: AccessKey) => k.displayName },
						{ key: 'role', header: 'Role', width: 10, render: (k: AccessKey) => k.role },
						{
							key: 'status',
							header: 'Status',
							width: 10,
							render: (k: AccessKey) => (k.isActive ? 'Active' : 'Inactive'),
						},
						{ key: 'created', header: 'Created', width: 12, render: (k: AccessKey) => formatDate(k.createdAt) },
					]}
					items={items}
					selectedIndex={selectedIndex}
					onSelect={setSelectedIndex}
					emptyMessage="No access keys"
					getRowId={(k) => k.id}
				/>
			</box>

			{showCreate && (
				<InputDialog
					title="Create Access Key"
					message="Enter a display name and choose a role."
					placeholder="developer-laptop"
					confirmLabel="Create"
					onConfirm={async (displayName) => {
						const ok = await create({ displayName, role: 'member' });
						if (ok) setShowCreate(false);
					}}
					onCancel={() => setShowCreate(false)}
				/>
			)}

			{showRename && selectedKey && (
				<InputDialog
					title="Rename Key"
					defaultValue={selectedKey.displayName}
					confirmLabel="Rename"
					onConfirm={async (displayName) => {
						const ok = await useKeysStore.getState().rename(selectedKey.id, displayName);
						if (ok) setShowRename(false);
					}}
					onCancel={() => setShowRename(false)}
				/>
			)}

			{showDelete && selectedKey && (
				<ConfirmDialog
					title="Delete Access Key"
					message={`Delete key "${selectedKey.displayName}"?`}
					onConfirm={async () => {
						const ok = await remove(selectedKey.id);
						if (ok) {
							setShowDelete(false);
							setSelectedIndex(0);
						}
					}}
					onCancel={() => setShowDelete(false)}
					isDestructive
				/>
			)}

			{lastCreatedSecret && (
				<SecretDialog
					bearerToken={lastCreatedSecret.bearerToken}
					sigV4AccessKeyId={lastCreatedSecret.sigV4.accessKeyId}
					sigV4SecretKey={lastCreatedSecret.sigV4.secretKey}
					onDismiss={dismissSecret}
				/>
			)}
		</box>
	);
}
