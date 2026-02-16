import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'SaaS App (Next.js)',
    description: 'Aplicación SaaS moderna',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es">
            <body className="min-h-screen bg-white" suppressHydrationWarning={true}>{children}</body>
        </html>
    );
}
