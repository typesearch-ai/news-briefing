import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Newsreader } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap', preload: false });
const newsreader = Newsreader({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-newsreader', display: 'swap' });

export const metadata: Metadata = {
  title: 'News briefing · typesearch',
  description: 'A daily news briefing for any country, language and topic, with every sentence linked to its source. Built with typesearch and the Vercel AI SDK.',
};

export const viewport: Viewport = { themeColor: '#fafaf9' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${newsreader.variable}`}>
      <body>{children}</body>
    </html>
  );
}
