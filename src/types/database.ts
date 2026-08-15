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
  make: string | null;
  model: string | null;
  year: number | null;
  fuel_type: string | null;
  is_active: boolean;
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
  mileage_log_id: string | null;
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
  payment_method: 'cash_bank' | 'credit_card';
  credit_card_id: string | null;
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

export interface WeeklyGoalRow {
  user_id: string;
  vehicle_id?: string | null;
  display_name: string;
  weekly_goal: number;
  week_income: number;
  remaining: number;
  percent: number;
}

export type RealtimeStatus = 'connecting' | 'live' | 'offline';

// Credit Card Types
export interface CreditCardRow {
  id: string;
  family_id: string;
  user_id: string;
  card_name: string;
  last_four: string | null;
  credit_limit: number | null;
  current_balance: number;
  minimum_payment: number | null;
  statement_balance: number | null;
  due_date: string | null;
  next_payment_date: string | null;
  payment_status: 'PAID' | 'DUE_SOON' | 'URGENT' | 'OVERDUE' | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreditCardPaymentRow {
  id: string;
  family_id: string;
  credit_card_id: string;
  amount: number;
  payment_date: string;
  created_by: string | null;
  note: string | null;
  created_at: string;
}

// Appointment Types
export type AppointmentType =
  | 'vehicle_maintenance'
  | 'oil_change'
  | 'registration'
  | 'insurance_renewal'
  | 'school_event'
  | 'child_activity'
  | 'doctor'
  | 'dentist'
  | 'family_appointment'
  | 'personal_reminder'
  | 'other';

export type AppointmentStatus = 'upcoming' | 'completed' | 'cancelled';

export interface AppointmentRow {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  type: AppointmentType;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  created_by: string;
  assigned_to: string | null;
  reminder_days: number[];
  status: AppointmentStatus;
  created_at: string;
  updated_at: string;
}

// Notification Types
export type NotificationType =
  | 'CREDIT_CARD'
  | 'PAYMENT'
  | 'APPOINTMENT'
  | 'VEHICLE'
  | 'FINANCIAL'
  | 'SYSTEM';

export interface NotificationRow {
  id: string;
  family_id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  reference_id: string | null;
  reference_type: string | null;
  read_at: string | null;
  created_at: string;
}

// Work Session Types
export interface WorkSessionRow {
  id: string;
  family_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

// Monthly Financial Summary Types
export interface MonthlyFinancialSummaryRow {
  id: string;
  family_id: string;
  year: number;
  month: number;
  total_income: number;
  total_expenses: number;
  total_card_debt: number;
  card_payments: number;
  total_miles: number;
  net_balance: number;
  income_per_mile: number;
  created_at: string;
  updated_at: string;
}

export type FinancialTrendStatus = 'IMPROVING' | 'STABLE' | 'DECLINING';

export interface FinancialTrend {
  current_month_income: number;
  current_month_expenses: number;
  current_month_net: number;
  current_month_card_debt: number;
  previous_month_income: number;
  previous_month_expenses: number;
  previous_month_net: number;
  previous_month_card_debt: number;
  income_change: number;
  expense_change: number;
  net_change: number;
  card_debt_change: number;
  trend_status: FinancialTrendStatus;
}
