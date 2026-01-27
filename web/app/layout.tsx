import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CineMatch - Group Movie Decisions Made Easy',
  description: 'AI-powered group movie decision platform. Swipe, match, and watch together in 5 minutes.',
  keywords: ['movie', 'group decision', 'swipe', 'AI', 'recommendation'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
