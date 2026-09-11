export interface CsvRow {
  readonly [column: string]: string;
}

export interface ParsedOrderRow {
  readonly externalOrderId: string;
  readonly orderedAt: string;
  readonly totalAmount: string;
  readonly currency: string | null;
  readonly utmCampaign: string | null;
  readonly rawRowJson: CsvRow;
}

export interface ImportOrdersSummary {
  readonly filePath: string;
  readonly headers: string[];
  readonly rowsRead: number;
  readonly rowsInserted: number;
  readonly rowsUpdated: number;
}

export interface OrderListItem {
  readonly id: string;
  readonly externalOrderId: string;
  readonly orderedAt: string;
  readonly totalAmount: string;
  readonly currency: string | null;
  readonly utmCampaign: string | null;
}
