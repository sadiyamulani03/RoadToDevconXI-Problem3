import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Web3Provider } from "./web3-provider.tsx"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "Pay the Wells You Drank From",
  description: "Trace every contribution. Reward every dependency. Retroactive public-goods funding through dependency graphs.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans min-h-screen flex flex-col">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  )
}
