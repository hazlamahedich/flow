import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
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
        <ThemeProvider defaultTheme="dark">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
