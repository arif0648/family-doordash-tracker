import React, { useState } from 'react';
import { colors, radius } from '../../theme/theme';

const INCOME_CATEGORIES = ['DoorDash', 'Bahşiş', 'Bonus', 'Diğer'] as const;
const EXPENSE_CATEGORIES = ['Benzin', 'Otopark', 'Yemek', 'Bakım', 'Araç', 'Diğer'] as const;

interface QuickActionButtonsProps {
  /**
   * Bir kategori seçildiğinde çağrılır. Gerçek kayıt (Supabase insert)
   * burada YAPILMAZ — bu bileşen sadece UI'dır. Var olan "gelir/gider
   * ekle" akışınla (muhtemelen zaten bir modal/route olarak mevcut)
   * burayı birbirine bu callback'lerle bağla.
   */
  onSelectIncomeCategory: (category: (typeof INCOME_CATEGORIES)[number]) => void;
  onSelectExpenseCategory: (category: (typeof EXPENSE_CATEGORIES)[number]) => void;
}

/**
 * Ana ekranın üst bölümünde, başparmakla kolay ulaşılabilir iki büyük buton.
 * Dokunulunca aynı kartın altında kategori çipleri açılır — kullanıcı en az
 * dokunuşla (buton + kategori = 2 dokunuş) kayıt akışını başlatabilir.
 */
export function QuickActionButtons({ onSelectIncomeCategory, onSelectExpenseCategory }: QuickActionButtonsProps) {
  const [open, setOpen] = useState<'income' | 'expense' | null>(null);

  return (
    <div>
      <div style={styles.row}>
        <button
          type="button"
          style={{ ...styles.actionButton, ...styles.incomeButton }}
          onClick={() => setOpen(open === 'income' ? null : 'income')}
        >
          <span style={styles.actionIcon}>＋</span> GELİR EKLE
        </button>
        <button
          type="button"
          style={{ ...styles.actionButton, ...styles.expenseButton }}
          onClick={() => setOpen(open === 'expense' ? null : 'expense')}
        >
          <span style={styles.actionIcon}>－</span> GİDER EKLE
        </button>
      </div>

      {open === 'income' && (
        <ChipRow
          items={INCOME_CATEGORIES}
          accent={colors.neonGreen}
          onSelect={(c) => {
            onSelectIncomeCategory(c);
            setOpen(null);
          }}
        />
      )}
      {open === 'expense' && (
        <ChipRow
          items={EXPENSE_CATEGORIES}
          accent={colors.negative}
          onSelect={(c) => {
            onSelectExpenseCategory(c);
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}

function ChipRow<T extends string>({
  items,
  accent,
  onSelect,
}: {
  items: readonly T[];
  accent: string;
  onSelect: (item: T) => void;
}) {
  return (
    <div style={styles.chipRow}>
      {items.map((item) => (
        <button
          key={item}
          type="button"
          style={{ ...styles.chip, borderColor: accent, color: accent }}
          onClick={() => onSelect(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: { display: 'flex', gap: 10, marginTop: 14 },
  actionButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    border: 'none',
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.3,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  incomeButton: { background: colors.neonGreen, color: '#06210F' },
  expenseButton: { background: 'transparent', color: colors.negative, border: `1.5px solid ${colors.negative}` },
  actionIcon: { fontSize: 15 },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    padding: '10px 14px',
    borderRadius: radius.pill,
    background: 'rgba(255,255,255,0.03)',
    border: '1.5px solid',
    fontSize: 12.5,
    fontWeight: 700,
    minHeight: 40,
    cursor: 'pointer',
  },
};
