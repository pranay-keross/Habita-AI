export type CaregiverRateType = 'hourly' | 'monthly';

export interface Caregiver {
  id: string;
  name: string;
  service: string;
  rateType: CaregiverRateType;
  rate: number;
  phone: string;
  notes: string;
  createdAt: number;
}
