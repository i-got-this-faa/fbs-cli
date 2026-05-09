import { COLORS } from '../theme';

export interface TableColumn<T> {
	key: string;
	header: string;
	width?: number;
	render: (item: T, index: number) => string;
}

interface TableProps<T> {
	columns: TableColumn<T>[];
	items: T[];
	selectedIndex: number;
	onSelect: (index: number) => void;
	emptyMessage?: string;
	getRowId?: (item: T, index: number) => string;
	isSelected?: (item: T, index: number) => boolean;
}

export function Table<T>({
	columns,
	items,
	selectedIndex,
	onSelect,
	emptyMessage = 'No items',
	getRowId,
	isSelected,
}: TableProps<T>) {
	if (items.length === 0) {
		return (
			<box flexGrow={1} justifyContent="center" alignItems="center">
				<text fg={COLORS.textDim}>{emptyMessage}</text>
			</box>
		);
	}

	return (
		<box flexGrow={1} flexDirection="column" gap={0}>
			{/* Header */}
			<box height={1} flexDirection="row" backgroundColor={COLORS.surfaceHighlight}>
				{columns.map((col) => (
					<box key={`h-${col.key}`} width={col.width} paddingLeft={1}>
						<text fg={COLORS.textDim}>{col.header}</text>
					</box>
				))}
			</box>

			{/* Rows */}
			{items.map((item, index) => {
				const isRowSelected = index === selectedIndex;
				const isItemSelected = isSelected?.(item, index) ?? false;
				const rowId = getRowId ? getRowId(item, index) : String(index);

				return (
					<box
						key={rowId}
						height={1}
						flexDirection="row"
						backgroundColor={isRowSelected ? COLORS.selectedBg : 'transparent'}
						onMouseDown={() => onSelect(index)}
					>
						{columns.map((col) => (
							<box key={`${rowId}-${col.key}`} width={col.width} paddingLeft={1}>
								<text fg={isItemSelected ? COLORS.accent : isRowSelected ? COLORS.selectedFg : COLORS.text}>
									{col.render(item, index)}
								</text>
							</box>
						))}
					</box>
				);
			})}
		</box>
	);
}
