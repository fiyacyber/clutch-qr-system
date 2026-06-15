import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.password !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set('clutch_qr_admin', body.password, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60*60*24*7 });
  return res;
}
