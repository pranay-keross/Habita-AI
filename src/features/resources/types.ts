export interface QuickTapItem {
  id: string;
  name: string;
  unitLabel: string;
  active: boolean;
  createdAt: number;
}

export interface ResourceLog {
  id: string;
  quickTapItemId: string;
  itemName: string;
  quantity: number;
  loggedAt: number;
  note: string;
}
