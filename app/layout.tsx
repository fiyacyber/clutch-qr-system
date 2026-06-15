import './style.css';
export const metadata = { title: 'Clutch QR System', description: 'Dynamic QR redirects for Clutch Print Shop' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
