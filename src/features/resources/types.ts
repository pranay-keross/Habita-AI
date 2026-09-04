export interface QuickTapItem {
  id: string;
  name: string;
  unitLabel: string;
  icon: string;
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

export interface UtilityTypeOption {
  id: number;
  utilityName: string;
  active: boolean;
}

export interface UtilityBill {
  id: string;
  utilityTypeId: number | null;
  type: UtilityType;
  provider: string;
  amount: number;
  dueDate: string;
  paid: boolean;
  createdAt: number;
}
