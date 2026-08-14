import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { translateError } from '../../lib/errorMessage';
import { MAX_AMOUNT } from '../../lib/format';
import { FixedExpenseRow } from '../../types/database';
import { toPacificDateString } from '../../lib/timezone';

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

  return <section style={styles.shell}>
    <div style={styles.header}><div><span style={styles.eyebrow}>HER AY</span><h2 style={styles.title}>Aylık Sabit Giderler</h2></div><strong style={styles.total}>${total.toLocaleString('en-US',{minimumFractionDigits:2})}</strong></div>
    <p style={styles.note}>Düzenli ödemeler burada tutulur. Ana ekranda gösterilmez; aylık net hesaba otomatik dahil edilir.</p>
    <form onSubmit={add} style={styles.addRow}><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Kira, sigorta, kredi…" style={styles.input}/><input value={amount} onChange={e=>setAmount(e.target.value)} type="number" step="0.01" placeholder="$" style={styles.amount}/><button disabled={saving} style={styles.add}>+</button></form>
    {error&&<div style={styles.error}>{error}</div>}
    <div style={styles.list}>{active.map(row=>{
      const val = edits[row.id] ?? row.monthly_amount.toString();
      return <div key={row.id} style={styles.item}><div style={{minWidth:0}}><strong style={styles.name}>{row.label}</strong><span style={styles.meta}>Aylık düzenli ödeme</span></div><div style={styles.actions}><span>$</span><input type="number" step="0.01" value={val} onChange={e=>startEdit(row,e.target.value)} onBlur={()=>blurSave(row)} onKeyDown={keySave} style={styles.edit}/><button onClick={()=>void remove(row)} style={styles.delete}>Sil</button></div></div>
    })}</div>
  </section>
}
const styles:Record<string,React.CSSProperties>={shell:{margin:'0 14px 18px',padding:18,borderRadius:24,background:'linear-gradient(145deg,rgba(20,14,43,.94),rgba(7,9,21,.96))',border:'1px solid rgba(168,85,247,.25)',boxShadow:'0 18px 50px rgba(0,0,0,.35)'},header:{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10},eyebrow:{fontSize:9,letterSpacing:2,color:'#A78BFA',fontWeight:900},title:{fontSize:20,margin:'4px 0',color:'#fff'},total:{fontSize:18,color:'#C084FC'},note:{fontSize:11,color:'#747A91',lineHeight:1.5},addRow:{display:'grid',gridTemplateColumns:'1.5fr .7fr 48px',gap:7,margin:'14px 0'},input:{minWidth:0,minHeight:48,padding:'12px',borderRadius:13,border:'1px solid rgba(148,163,184,.15)',background:'#070916',color:'#fff'},amount:{minWidth:0,minHeight:48,padding:'12px',borderRadius:13,border:'1px solid rgba(148,163,184,.15)',background:'#070916',color:'#34D399'},add:{border:0,borderRadius:13,background:'linear-gradient(135deg,#A855F7,#6366F1)',color:'#fff',fontSize:24,fontWeight:700},list:{display:'flex',flexDirection:'column',gap:8},item:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'12px 0',borderTop:'1px solid rgba(255,255,255,.06)'},name:{display:'block',fontSize:13,color:'#F4F4F5',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},meta:{fontSize:10,color:'#6F748A'},actions:{display:'flex',alignItems:'center',gap:5,color:'#A7ABC0'},edit:{width:82,minHeight:40,padding:'8px',borderRadius:10,border:'1px solid rgba(168,85,247,.35)',background:'#090B18',color:'#34D399',textAlign:'right',fontWeight:800},delete:{border:0,background:'transparent',color:'#FB7185',fontSize:11},error:{color:'#FB7185',fontSize:12,marginBottom:8}}
