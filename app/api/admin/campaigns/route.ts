import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(){
  if (!(await isAdmin())) return NextResponse.json({ error:'Unauthorized' },{ status:401 });
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.rpc('get_qr_campaigns_with_counts');
  if (!error) return NextResponse.json(data);
  const { data: campaigns } = await supabase.from('qr_campaigns').select('*').order('created_at',{ascending:false});
  return NextResponse.json(campaigns || []);
}

export async function POST(req: NextRequest){
  if (!(await isAdmin())) return NextResponse.json({ error:'Unauthorized' },{ status:401 });
  const body = await req.json();
  const slug = String(body.slug || '').toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  if (!slug || !body.business_name || !body.destination_url) return NextResponse.json({ error:'Missing fields' },{ status:400 });
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('qr_campaigns').upsert({ slug, business_name: body.business_name, destination_url: body.destination_url, notes: body.notes || '', active: body.active ?? true }, { onConflict:'slug' }).select().single();
  if (error) return NextResponse.json({ error:error.message },{ status:400 });
  return NextResponse.json(data);
}
