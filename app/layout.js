import './globals.css';
import { Inter, Oswald } from 'next/font/google';
import Nav from '@/components/Nav';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Oswald({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

export const metadata = { title: 'Neural Football Tournament', description: 'Tournament management and live player auction' };
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#060814' };

export default function Layout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
