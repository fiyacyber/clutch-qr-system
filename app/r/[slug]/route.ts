import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const supabase = supabaseAdmin();
  const { data: campaign } = await supabase.from('qr_campaigns').select('*').eq('slug', slug).eq('active', true).single();
  if (!campaign) return new NextResponse('QR link not found or inactive.', { status: 404 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  const ip_hash = crypto.createHash('sha256').update(ip + (process.env.ADMIN_PASSWORD || '')).digest('hex');
  await supabase.from('qr_scans').insert({
    campaign_id: campaign.id,
    slug,
    ip_hash,
    user_agent: req.headers.get('user-agent'),
    referrer: req.headers.get('referer')
  });
  return NextResponse.redirect(campaign.destination_url, 302);
}
