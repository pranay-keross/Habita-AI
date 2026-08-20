import { getItem, setItem } from '../../utils/storage';
import type { HouseholdAsset, Vehicle } from './types';

const VEHICLE_STORAGE_KEY = 'habita.vehicles';
const ASSET_STORAGE_KEY = 'habita.household_assets';
export const loadVehicles = () => getItem<Vehicle[]>(VEHICLE_STORAGE_KEY, []);
export const saveVehicles = (vehicles: Vehicle[]) =>
  setItem(VEHICLE_STORAGE_KEY, vehicles);
export const loadHouseholdAssets = () =>
  getItem<HouseholdAsset[]>(ASSET_STORAGE_KEY, []);
export const saveHouseholdAssets = (assets: HouseholdAsset[]) =>
  setItem(ASSET_STORAGE_KEY, assets);
