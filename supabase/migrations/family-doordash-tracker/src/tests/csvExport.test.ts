/**
 * csvExport.test.ts — vitest formatı. NOT RUN in this sandbox (npm/vitest
 * kurulamadı). toCsv() saf bir fonksiyon olduğu için mantığı doğrudan
 * `node` ile de doğrulanabilir; aşağıdaki testler production CI'da
 * `npm run test` ile çalıştırılmalıdır.
 */
import { describe, it, expect } from 'vitest';
import { toCsv } from '../csvExport';

interface Row {
  date: string;
  amount: number;
  note: string;
}

describe('toCsv', () => {
  it('basit satırları doğru formatlar', () => {
    const rows: Row[] = [{ date: '2026-08-05', amount: 100, note: 'test' }];
    const csv = toCsv(rows, [
      { header: 'Tarih', accessor: (r) => r.date },
      { header: 'Tutar', accessor: (r) => r.amount },
      { header: 'Not', accessor: (r) => r.note },
    ]);
    expect(csv).toBe('Tarih,Tutar,Not\r\n2026-08-05,100,test');
  });

  it('virgül/tırnak/newline içeren alanları RFC4180 kurallarına göre kaçırır', () => {
    const rows: Row[] = [{ date: '2026-08-05', amount: 100, note: 'a, "quoted" note' }];
    const csv = toCsv(rows, [
      { header: 'Tarih', accessor: (r) => r.date },
      { header: 'Not', accessor: (r) => r.note },
    ]);
    expect(csv).toContain('"a, ""quoted"" note"');
  });

  it('boş satır listesinde sadece başlık satırını döner', () => {
    const csv = toCsv<Row>([], [{ header: 'Tarih', accessor: (r) => r.date }]);
    expect(csv).toBe('Tarih');
  });
});
