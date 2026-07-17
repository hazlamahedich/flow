import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { ThemeProvider } from '@flow/tokens/providers';
import '@flow/tokens/css';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-family-flow-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-family-flow-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Flow OS',
  description: 'VA productivity platform with AI agents',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <NuqsAdapter>
          <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
