import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Scruttin - Authentic Voice Ruts & Audio Storytelling',
  description: 'A social platform for authentic, short-form audio storytelling. Voluntary voice street interviews swiped one Rut at a time.',
  openGraph: {
    title: 'Scruttin - Authentic Voice Ruts & Audio Storytelling',
    description: 'A social platform for authentic, short-form audio storytelling. Voluntary voice street interviews swiped one Rut at a time.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Scruttin - Authentic Voice Ruts & Audio Storytelling',
    description: 'A social platform for authentic, short-form audio storytelling. Voluntary voice street interviews swiped one Rut at a time.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
