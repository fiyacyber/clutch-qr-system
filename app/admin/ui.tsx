'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

type Campaign={slug:string;business_name:string;destination_url:string;notes?:string;active:boolean;scan_count?:number};
export default function AdminClient({authed}:{authed:boolean}){
  const [ok,setOk]=useState(authed); const [password,setPassword]=useState(''); const [items,setItems]=useState<Campaign[]>([]);
  const [form,setForm]=useState({slug:'',business_name:'',destination_url:'',notes:''});
  const [qr,setQr]=useState('');
  async function login(){const r=await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})}); if(r.ok){setOk(true); load();} else alert('Wrong password');}
  async function load(){const r=await fetch('/api/admin/campaigns'); if(r.ok)setItems(await r.json());}
  async function save(){const r=await fetch('/api/admin/campaigns',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(form)}); if(!r.ok) return alert((await r.json()).error); setForm({slug:'',business_name:'',destination_url:'',notes:''}); load();}
  async function makeQr(slug:string){const url=`${process.env.NEXT_PUBLIC_APP_URL || location.origin}/r/${slug}`; setQr(await QRCode.toDataURL(url,{width:900,margin:2}));}
  useEffect(()=>{if(ok)load()},[ok]);
  if(!ok) return <section className="card login"><h1>Clutch QR Admin</h1><input type="password" placeholder="Admin password" value={password} onChange={e=>setPassword(e.target.value)} /><button className="btn" onClick={login}>Log in</button></section>;
  return <><h1>Clutch QR Admin</h1><div className="grid"><section className="card"><h2>Create / Update QR</h2><label>Business Name</label><input value={form.business_name} onChange={e=>setForm({...form,business_name:e.target.value})}/><label>Slug</label><input placeholder="johns-landscaping" value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})}/><label>Destination URL</label><input placeholder="https://example.com" value={form.destination_url} onChange={e=>setForm({...form,destination_url:e.target.value})}/><label>Notes</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/><button className="btn" onClick={save}>Save QR</button></section><section className="card"><h2>QR Preview</h2>{qr ? <><img src={qr} style={{maxWidth:'100%'}}/><a className="btn secondary" href={qr} download="clutch-qr.png">Download PNG</a></> : <p className="muted">Click Generate QR on a campaign.</p>}</section></div><section className="card" style={{marginTop:18}}><h2>Campaigns</h2><table><thead><tr><th>Business</th><th>QR Link</th><th>Destination</th><th>Scans</th><th></th></tr></thead><tbody>{items.map(i=><tr key={i.slug}><td><b>{i.business_name}</b><br/><span className="pill">{i.active?'Active':'Inactive'}</span></td><td>/r/{i.slug}</td><td><a href={i.destination_url} target="_blank">{i.destination_url}</a></td><td>{i.scan_count ?? 0}</td><td><button className="btn" onClick={()=>makeQr(i.slug)}>Generate QR</button></td></tr>)}</tbody></table></section></>;
}
