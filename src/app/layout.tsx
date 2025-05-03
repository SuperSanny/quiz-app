import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import {Toaster} from '@/components/ui/toaster'; // Import Toaster

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'QuizTime Champions', // Updated title
  description: 'Real-time anonymous quiz application with stats', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Basic Header Example (Optional) */}
        {/*
        <header className="bg-card border-b p-4">
            <nav className="container mx-auto flex justify-between items-center">
                <a href="/" className="text-lg font-bold text-primary">QuizTime</a>
                <div>
                    <a href="/quiz" className="mr-4 hover:text-primary">Join</a>
                    <a href="/scores" className="mr-4 hover:text-primary">Scores</a>
                    <a href="/stats" className="hover:text-primary">Stats</a>
                </div>
            </nav>
        </header>
         */}
        <main className="min-h-screen flex flex-col">{children}</main>
        <Toaster /> {/* Add Toaster component */}
      </body>
    </html>
  );
}
