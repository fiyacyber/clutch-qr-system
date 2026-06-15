import { isAdmin } from '@/lib/auth';
import AdminClient from './ui';
export default async function Admin(){
  const authed = await isAdmin();
  return <main className="wrap"><AdminClient authed={authed}/></main>
}
