export type ExpenseCategory =
  | 'benzin'
  | 'arac_gideri'
  | 'market'
  | 'diger_aile'
  | 'diger_arac';

export interface Profile {
  user_id: string;
  display_name: string;
  email: string;
  created_at: string;
}

export interface Family {
  id: string;
  name: string;
  created_at: string;
}

export interface Vehicle {
  id: string;
  family_id: string;
  full_name: string;
  short_name: string;
  created_at: string;
}

export interface FixedExpenseRow {
  id: string;
  family_id: string;
  label: string;
  monthly_amount: number;
  effective_from: string;
  effective_to: string | null;
  created_by: string;
  created_at: string;
}

export interface MileageLogRow {
  id: string;
  family_id: string;
  vehicle_id: string;
  user_id: string;
  record_date: string;
  closing_mileage: number;
  miles_driven: number;
  income_id: string | null;
  created_at: string;
}

export interface IncomeRow {
  id: string;
  family_id: string;
  vehicle_id: string;
  user_id: string;
  amount: number;
  record_date: string;
  note: string | null;
  mileage_log_id: string;
  created_at: string;
}

export interface ExpenseRow {
  id: string;
  family_id: string;
  category: ExpenseCategory;
  vehicle_id: string | null;
  user_id: string;
  amount: number;
  record_date: string;
  note: string | null;
  created_at: string;
}

export interface UserSettingsRow {
  user_id: string;
  sound_enabled: boolean;
  speech_enabled: boolean;
  push_enabled: boolean;
  push_subscription: unknown | null;
  updated_at: string;
}
