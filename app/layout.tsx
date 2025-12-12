import './globals.css';
import type { ReactNode } from 'react';
import { Shell } from './components/layout/Shell'; // ← correct local import

export const metadata = {
  title: 'PugHub',
  description: 'Simple scrim coordinator',
    icons: {
      icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
