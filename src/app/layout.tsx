import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Minerador de Oportunidades | Prospecção Inteligente',
  description: 'Ferramenta de mineração de leads para gestores de tráfego pago',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  )
}
