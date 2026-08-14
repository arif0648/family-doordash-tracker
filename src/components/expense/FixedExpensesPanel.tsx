import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { translateError } from '../../lib/errorMessage';
import { MAX_AMOUNT } from '../../lib/format';
import { FixedExpenseRow } from '../../types/database';
import { toPacificDateString } from '../../lib/timezone';
import { Button, PageHeader, PageShell, Surface } from '../ui/primitives';

export function FixedExpensesPanel({ familyId, expenses, onChanged }: { familyId:string; expenses:FixedExpenseRow[]; onChanged:()=>void }) {
  const [label,setLabel]=useState('');
  const [amount,setAmount]=useState('');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [edits,setEdits]=useState<Record<string,string>>({});
  const active = expenses.filter(e=>!e.effective_to);
  const total = active.reduce((s,e)=>s+Number(e.monthly_amount||0),0);

  async function add(e:React.FormEvent){
    e.preventDefault(); setError(null);
    const n=Number(amount);
    if(!label.trim()||!Number.isFinite(n)||n<0){setError('Gider adı ve geçerli tutar girin.');return;}
    if(n > MAX_AMOUNT){setError(`Tutar ${MAX_AMOUNT.toLocaleString('en-US')} $ üzerinde olamaz.`);return;}
    const user=(await supabase.auth.getUser()).data.user;
    if(!user){setError('Oturum bulunamadı.');return;}
    setSaving(true);
    const {error}=await supabase.from('fixed_expenses').insert({family_id:familyId,label:label.trim(),monthly_amount:n,effective_from:toPacificDateString(new Date()),created_by:user.id});
    setSaving(false);
    if(error){setError(translateError(error.message));return;}
    setLabel('');setAmount('');onChanged();
  }

  async function save(row:FixedExpenseRow, next:string){
    const n=Number(next); if(!Number.isFinite(n)||n<0){setError('Geçerli bir tutar girin.');return;}
    if(n > MAX_AMOUNT){setError(`Tutar ${MAX_AMOUNT.toLocaleString('en-US')} $ üzerinde olamaz.`);return;}
    if(n === Number(row.monthly_amount)) {setEdits(prev=>{const updated={...prev};delete updated[row.id];return updated;});return;}
    const {error:saveError}=await supabase.rpc('set_family_fixed_expense', {p_family_id:familyId,p_label:row.label,p_monthly_amount:n,p_effective_from:toPacificDateString(new Date())});
    if(saveError){setError(translateError(saveError.message));} else {setError(null);setEdits(prev=>{const updated={...prev};delete updated[row.id];return updated;});onChanged();}
  }

  function startEdit(row:FixedExpenseRow, value:string){
    setEdits(prev=>({...prev,[row.id]:value}));
  }

  function blurSave(row:FixedExpenseRow){
    const value = edits[row.id];
    if(value!==undefined) void save(row,value);
  }

  function keySave(e: React.KeyboardEvent<HTMLInputElement>){
    if(e.key==='Enter'){ (e.currentTarget as HTMLInputElement).blur(); }
  }

  async function remove(row:FixedExpenseRow){
    if(!confirm(`${row.label} sabit giderini silmek istiyor musun?`))return;
    const {error}=await supabase.from('fixed_expenses').delete().eq('id',row.id).eq('family_id',familyId);
    if(error)setError(translateError(error.message)); else onChanged();
  }

  return <PageShell>
    <PageHeader eyebrow="Her ay" title="Aylık Sabit Giderler" description="Düzenli ödemeler aylık net hesaba otomatik dahil edilir." action={<strong style={styles.total}>${total.toLocaleString('en-US',{minimumFractionDigits:2})}</strong>} />
    <Surface>
      <form onSubmit={add} style={styles.addRow}><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Kira, sigorta, kredi…"/><input value={amount} onChange={e=>setAmount(e.target.value)} type="number" step="0.01" placeholder="$"/><Button tone="primary" disabled={saving} aria-label="Sabit gider ekle">+</Button></form>
      {error&&<div style={styles.error}>{error}</div>}
      <div style={styles.list}>{active.map(row=>{
      const val = edits[row.id] ?? row.monthly_amount.toString();
      return <div key={row.id} style={styles.item}><div style={{minWidth:0}}><strong style={styles.name}>{row.label}</strong><span style={styles.meta}>Aylık düzenli ödeme</span></div><div style={styles.actions}><span>$</span><input aria-label={`${row.label} tutarı`} type="number" step="0.01" value={val} onChange={e=>startEdit(row,e.target.value)} onBlur={()=>blurSave(row)} onKeyDown={keySave} style={styles.edit}/><Button type="button" tone="danger" onClick={()=>void remove(row)} style={styles.delete}>Sil</Button></div></div>
      })}</div>
    </Surface>
  </PageShell>
}
const styles:Record<string,React.CSSProperties>={total:{padding:'7px 9px',borderRadius:11,border:'1px solid rgba(60,200,237,.15)',background:'rgba(60,200,237,.06)',color:'#bdeafa',fontSize:15},addRow:{display:'grid',gridTemplateColumns:'1.45fr .7fr 46px',gap:7,marginBottom:10},list:{display:'flex',flexDirection:'column'},item:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'11px 0',borderTop:'1px solid var(--border)'},name:{display:'block',fontSize:13,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},meta:{display:'block',fontSize:10,color:'var(--muted)'},actions:{display:'flex',alignItems:'center',gap:5,color:'var(--text-secondary)'},edit:{width:82,minHeight:38,padding:'7px',color:'var(--positive)',textAlign:'right',fontWeight:750},delete:{minHeight:38,padding:'7px 9px',fontSize:11},error:{color:'var(--negative)',fontSize:12,marginBottom:8}}
