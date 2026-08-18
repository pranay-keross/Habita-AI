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

export type UtilityType =
  | 'electricity'
  | 'gas'
  | 'internet'
  | 'water'
  | 'waste';

export interface UtilityBill {
  id: string;
  type: UtilityType;
  provider: string;
  amount: number;
  dueDate: string;
  paid: boolean;
  createdAt: number;
}
