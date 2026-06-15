import { cookies } from 'next/headers';

export async function isAdmin() {
  const jar = await cookies();
  return jar.get('clutch_qr_admin')?.value === process.env.ADMIN_PASSWORD;
}
