export interface Vehicle {
  id: string;
  makeModel: string;
  registrationNumber: string;
  insuranceExpiry: string;
  documentName: string | null;
  documentReviewed: boolean;
  createdAt: number;
}

export interface HouseholdAsset {
  id: string;
  name: string;
  category: string;
  serialNumber: string;
  warrantyExpiry: string;
  createdAt: number;
}
