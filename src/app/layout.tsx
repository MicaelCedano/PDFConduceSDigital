import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'PDFConduceSDigital',
    description: 'Sistema Digital de Gestión de Conduces y Garantías',
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
