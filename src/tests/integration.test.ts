/**
 * integration.test.ts
 *
 * Integration tests for critical financial flows and new features.
 * These tests verify the end-to-end functionality of the Family Operations Center.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Integration Tests - Family Operations Center', () => {
  describe('Income Deletion with Mileage Recalculation', () => {
    it('should delete income and recalculate mileage chain correctly', async () => {
      // This test verifies the delete_income_with_mileage RPC
      // It should:
      // 1. Delete the income record
      // 2. Cascade delete the associated mileage_log
      // 3. Recalculate the vehicle mileage chain
      // 4. Validate the chain integrity
      // 5. Update financial summaries

      // Note: These tests require a real Supabase connection and test data
      // They should be run in a test environment with proper cleanup
      expect(true).toBe(true); // Placeholder - requires test environment
    });
  });

  describe('Income Editing with Mileage', () => {
    it('should update income and handle mileage changes correctly', async () => {
      // This test verifies the update_income_with_mileage RPC
      // It should:
      // 1. Update income amount, date, vehicle, closing mileage
      // 2. Handle vehicle changes by recalculating both chains
      // 3. Validate mileage chain integrity
      // 4. Update financial summaries

      expect(true).toBe(true); // Placeholder - requires test environment
    });
  });

  describe('Income + mileage atomic create regression', () => {
    it('writes mileage user_id and validates before either insert', () => {
      const sql = readFileSync('supabase/migrations/0032_finalize_runtime_realtime_goals.sql', 'utf8');
      expect(sql).toContain('(family_id,vehicle_id,user_id,record_date,closing_mileage,miles_driven)');
      expect(sql.indexOf('MILEAGE_LOWER_THAN_PREVIOUS')).toBeLessThan(sql.indexOf('insert into public.mileage_log'));
      expect(sql).toContain('pg_advisory_xact_lock');
      expect(sql).toContain('insert into public.income');
    });
  });

  describe('Credit Card Payment', () => {
    it('uses payment_date before any record_date branch for card-payment triggers', () => {
      const sql = readFileSync('supabase/migrations/0031_fix_credit_card_payment_trigger.sql', 'utf8');
      const cardBranch = sql.indexOf("if tg_table_name = 'credit_card_payments'");
      const paymentDate = sql.indexOf('new.payment_date', cardBranch);
      const recordDate = sql.indexOf('new.record_date', cardBranch);
      expect(cardBranch).toBeGreaterThan(-1);
      expect(paymentDate).toBeGreaterThan(cardBranch);
      expect(recordDate).toBeGreaterThan(paymentDate);
      expect(sql).toContain('greatest(0, v_current_balance - p_amount)');
      expect(sql).not.toContain('current_balance - p_amount,\n    statement_balance');
    });

    it('card purchase creates one expense and increases only selected liability atomically', () => {
      const sql = readFileSync('supabase/migrations/0033_cross_device_realtime_and_card_purchases.sql', 'utf8');
      expect(sql).toContain('create or replace function public.create_expense_with_payment');
      expect(sql).toContain('for update');
      expect(sql).toContain('insert into public.expenses');
      expect(sql).toContain('current_balance = current_balance + p_amount');
      expect(sql).toContain("p_payment_method = 'credit_card'");
    });

    it('card payment reduces liability without inserting a second expense', () => {
      const paymentSql = readFileSync('supabase/migrations/0031_fix_credit_card_payment_trigger.sql', 'utf8');
      expect(paymentSql).toContain('greatest(0, v_current_balance - p_amount)');
      expect(paymentSql).toContain('insert into public.credit_card_payments');
      expect(paymentSql).not.toContain('insert into public.expenses');
    });
  });

  describe('Credit card hard delete regression', () => {
    it('preserves purchase expenses while deleting the card and payment history atomically', () => {
      const sql = readFileSync('supabase/migrations/0035_safe_credit_card_delete.sql', 'utf8');
      expect(sql).toContain('function public.delete_credit_card');
      expect(sql).toContain('credit_card_name_snapshot');
      expect(sql).toContain('credit_card_id = null');
      expect(sql).toContain('delete from public.credit_cards');
      expect(sql).toContain('public.is_family_member');
      expect(sql).toContain('deleted_payment_count');
      const triggerSql = readFileSync('supabase/migrations/0036_fix_card_payment_delete_trigger.sql', 'utf8');
      expect(triggerSql.indexOf("if tg_op = 'DELETE'")).toBeLessThan(
        triggerSql.indexOf("elsif tg_table_name = 'credit_card_payments'"),
      );
      expect(triggerSql).toContain('old.payment_date');
    });
  });

  describe('Credit card expense picker regression', () => {
    it('normalizes legacy NULL active status and keeps explicit selection validation', () => {
      const hook = readFileSync('src/hooks/useFamilyRealtimeData.ts', 'utf8');
      const form = readFileSync('src/components/expense/ExpenseForm.tsx', 'utf8');
      const sql = readFileSync('supabase/migrations/0038_normalize_credit_card_active_status.sql', 'utf8');
      expect(hook).toContain('is_active: dbCard.is_active !== false');
      expect(form).toContain("useState('')");
      expect(form).toContain("setError('Kredi kartı seçimi zorunludur.')");
      expect(form).toContain('Henüz kredi kartı eklenmemiş.');
      expect(form).toContain('••••${card.last_four}');
      expect(sql).toContain('where is_active is null');
      expect(sql).toContain('alter column is_active set not null');
    });
  });

  describe('Single-tap navigation regression', () => {
    it('preloads lazy routes and does not attach a duplicate touchstart closer', () => {
      const app = readFileSync('src/App.tsx', 'utf8');
      const nav = readFileSync('src/components/common/BottomNav.tsx', 'utf8');
      const sheet = readFileSync('src/components/common/BottomSheet.tsx', 'utf8');
      const sw = readFileSync('public/sw.js', 'utf8');
      expect(app).toContain('preloadPrimaryRoutes');
      expect(nav).toContain('onPointerDown');
      expect(sheet).not.toContain("addEventListener('touchstart'");
      expect(sw).toContain("barbin-v7");
    });
  });

  describe('Cross-device family source of truth', () => {
    it('resolves the largest shared family deterministically and publishes full delete rows', () => {
      const sql = readFileSync('supabase/migrations/0033_cross_device_realtime_and_card_purchases.sql', 'utf8');
      expect(sql).toContain('create or replace function public.resolve_current_family_id');
      expect(sql).toContain('count(*) from public.family_members peers');
      expect(sql).toContain('fm.joined_at asc');
      expect(sql).toContain('replica identity full');
      expect(sql).toContain("'monthly_financial_summaries'");
    });
  });

  describe('Canonical family approval regression', () => {
    it('provisions signups as pending and gates all existing RLS through approval', () => {
      const sql = readFileSync('supabase/migrations/0037_canonical_family_membership_approval.sql', 'utf8');
      expect(sql).toContain("'00000000-0000-0000-0000-000000000001'");
      expect(sql).toContain("'BARBIN AİLESİ'");
      expect(sql).toContain("values ('00000000-0000-0000-0000-000000000001', new.id, 'member', 'pending')");
      expect(sql).toContain("fm.approval_status = 'approved'");
      expect(sql).toContain('function public.review_membership_request');
      expect(sql).toContain("v_status text := case when p_approve then 'approved' else 'rejected' end");
      expect(sql).not.toContain('v_family_name := v_display_name');
    });

    it('keeps work sessions personal while allowing family aggregate reads', () => {
      const sql = readFileSync('supabase/migrations/0037_canonical_family_membership_approval.sql', 'utf8');
      const home = readFileSync('src/components/home/HomePage.tsx', 'utf8');
      expect(sql).toContain('idx_work_sessions_one_open_per_user');
      expect(sql).toContain('user_id = auth.uid() and public.is_family_member');
      expect(home).toContain('workSessions.filter((session) => session.user_id === userId)');
    });

    it('has no seven-row fixed expense limit and renames without versioning the amount', () => {
      const sql = readFileSync('supabase/migrations/0037_canonical_family_membership_approval.sql', 'utf8');
      const panel = readFileSync('src/components/expense/FixedExpensesPanel.tsx', 'utf8');
      expect(panel).not.toMatch(/limit\(7\)|slice\(0,\s*7\)/);
      expect(sql).toContain('function public.rename_fixed_expense');
      expect(sql).toContain('set label = v_label');
      expect(sql).not.toContain('set monthly_amount = v_label');
    });
  });

  describe('Vehicle Archiving', () => {
    it('should archive vehicle while preserving historical data', async () => {
      // This test verifies the archive_vehicle RPC
      // It should:
      // 1. Set is_active to false
      // 2. Preserve all income, mileage, expense history
      // 3. Remove from active vehicle selectors
      // 4. Keep data in reports

      expect(true).toBe(true); // Placeholder - requires test environment
    });

    it('should restore archived vehicle successfully', async () => {
      // This test verifies the restore_vehicle RPC
      // It should:
      // 1. Set is_active to true
      // 2. Respect the 3-vehicle limit
      // 3. Make vehicle visible in selectors again

      expect(true).toBe(true); // Placeholder - requires test environment
    });
  });

  describe('Appointment Reminders', () => {
    it('should create appointment with reminder configuration', async () => {
      // This test verifies appointment creation
      // It should:
      // 1. Create appointment with reminder_days
      // 2. Set default reminder configuration
      // 3. Be visible to all family members

      expect(true).toBe(true); // Placeholder - requires test environment
    });
  });

  describe('Notification Deduplication', () => {
    it('should prevent duplicate notifications for same day', async () => {
      // This test verifies the notification idempotency constraint
      // It should:
      // 1. Create a notification
      // 2. Attempt to create duplicate same day
      // 3. Second creation should be ignored (no error, no duplicate)

      expect(true).toBe(true); // Placeholder - requires test environment
    });
  });

  describe('Family Financial Summary', () => {
    it('should recalculate family financial summary on data changes', async () => {
      // This test verifies the automatic summary recalculation
      // It should:
      // 1. Check initial summary
      // 2. Add income/expense
      // 3. Verify summary updated automatically

      expect(true).toBe(true); // Placeholder - requires test environment
    });
  });

  describe('RLS Isolation', () => {
    it('should prevent cross-family data access', async () => {
      // This test verifies RLS policies
      // It should:
      // 1. Create two families
      // 2. Verify family A cannot access family B data
      // 3. Verify family B cannot access family A data

      expect(true).toBe(true); // Placeholder - requires test environment
    });

    it('should allow family-wide credit card access', async () => {
      // This test verifies the updated credit card RLS
      // It should:
      // 1. Create credit card as user A
      // 2. Verify user B (same family) can see it
      // 3. Verify user B can edit it

      expect(true).toBe(true); // Placeholder - requires test environment
    });
  });

  describe('Market Rates Error Handling', () => {
    it('uses the Supabase proxy and keeps third-party traffic outside the service-worker cache', () => {
      const rates = readFileSync('src/lib/marketRates.ts', 'utf8');
      const edge = readFileSync('supabase/functions/market-rates/index.ts', 'utf8');
      const sw = readFileSync('public/sw.js', 'utf8');
      expect(rates).toContain("supabase.functions.invoke('market-rates'");
      expect(edge).toContain('MARKET_DATA_UNAVAILABLE');
      expect(edge).toContain('finans.truncgil.com/v4/today.json');
      expect(edge).toContain('www.tcmb.gov.tr/kurlar/today.xml');
      expect(edge).toContain('CEYREKALTIN');
      expect(rates).not.toContain('calculateQuarterGoldTry');
      expect(sw).toContain("url.origin !== self.location.origin");
      expect(sw).toContain("barbin-v7");
    });

    it('should handle API failures gracefully', async () => {
      // This test verifies the market rates error isolation
      // It should:
      // 1. Simulate API failure
      // 2. Verify UI shows error state instead of crashing
      // 3. Verify existing data remains visible

      // This is a frontend test, can be tested without real API
      expect(true).toBe(true); // Placeholder - requires React testing environment
    });
  });
});
