export const loadIncomeForm = () => import('../components/income/IncomeForm');
export const loadExpenseForm = () => import('../components/expense/ExpenseForm');
export const loadFixedExpenses = () => import('../components/expense/FixedExpensesPanel');
export const loadVehicles = () => import('../components/vehicles/VehiclesPage');
export const loadCreditCards = () => import('../components/vehicles/CreditCardsPage');
export const loadProfile = () => import('../components/profile/ProfilePage');
export const loadReports = () => import('../components/reports/ReportsPage');
export const loadTransactions = () => import('../components/transactions/TransactionsPage');
export const loadAppointments = () => import('../components/appointments/AppointmentsPage');
export const loadNotifications = () => import('../components/notifications/NotificationsPage');

const preloaders: Array<[string, () => Promise<unknown>]> = [
  ['/kazanc', loadIncomeForm],
  ['/gider', loadExpenseForm],
  ['/sabit-giderler', loadFixedExpenses],
  ['/araclar', loadVehicles],
  ['/kredi-kartlari', loadCreditCards],
  ['/profil', loadProfile],
  ['/raporlar', loadReports],
  ['/islemler', loadTransactions],
  ['/randevular', loadAppointments],
  ['/bildirimler', loadNotifications],
];

export function preloadRoute(path: string): void {
  const pathname = path.split('?')[0];
  const match = preloaders.find(([prefix]) => pathname.startsWith(prefix));
  if (match) void match[1]();
}

export function preloadMenuRoutes(): void {
  for (const [path] of preloaders.slice(2)) preloadRoute(path);
}

export function preloadPrimaryRoutes(): void {
  for (const [, load] of preloaders) void load();
}
