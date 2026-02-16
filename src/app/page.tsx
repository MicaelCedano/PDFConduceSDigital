"use client";

import { useState, useEffect, ChangeEvent, KeyboardEvent } from 'react';
import { Truck, ShieldCheck, History, Menu, X, Plus, Trash2, Pencil, Download, Moon, Sun, Monitor, Laptop } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './globals.css';
import { extractConduceData, Item, ExtractionResult } from './actions';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface HistoryEntry {
    id: number;
    type: 'Conduce' | 'Garantía';
    desc: string;
    date: string;
    time: string;
}

interface NewItem extends Item { }

interface GarantiaItem {
    cant: string | number;
    model: string;
    imeis: string;
}

export default function Home() {
    const [activeTab, setActiveTab] = useState<'conduce' | 'garantia' | 'historial'>('conduce');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [themeColor, setThemeColor] = useState('#3B82F6');
    const [logo, setLogo] = useState<string | null>(null);
    const [pdfPreview, setPdfPreview] = useState<string | null>(null);
    const [darkMode, setDarkMode] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // --- CONDUCE STATE ---
    const [items, setItems] = useState<Item[]>([]);
    const [newItem, setNewItem] = useState<NewItem>({ cant: 1, model: '' });
    const [destinatario, setDestinatario] = useState('');
    const [factura, setFactura] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadFilename, setUploadFilename] = useState<string | null>(null);
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
    const [editingItemValue, setEditingItemValue] = useState<Item | null>(null);

    // --- FILE UPLOAD ---
    const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const result: ExtractionResult = await extractConduceData(formData);

            if (result.success && result.data) {
                setUploadFilename(file.name);
                if (result.data.cliente) setDestinatario(result.data.cliente);
                if (result.data.factura) setFactura(result.data.factura);
                if (result.data.items && result.data.items.length > 0) {
                    setItems(result.data.items);
                }
            } else {
                console.error("Error from server:", result.error);
                alert(`Error al procesar el PDF: ${result.error || 'Fallo desconocido'}`);
            }
        } catch (err: any) {
            console.error(err);
            alert(`Error de conexión o código: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    const base64 = ev.target.result as string;
                    setLogo(base64);
                    localStorage.setItem('company_logo', base64);
                }
            };
            reader.readAsDataURL(file);
        }
    };


    // --- GARANTIA STATE ---
    const [gItems, setGItems] = useState<GarantiaItem[]>([]);
    const [newGItem, setNewGItem] = useState<GarantiaItem>({ cant: 1, model: '', imeis: '' });
    const [storeName, setStoreName] = useState('ANGELO');
    const [gDate, setGDate] = useState(new Date().toISOString().split('T')[0]);
    const [editingGItemIndex, setEditingGItemIndex] = useState<number | null>(null);
    const [editingGItemValue, setEditingGItemValue] = useState<GarantiaItem | null>(null);

    // --- HISTORIAL STATE ---
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    // Load History and Logo on Mount
    useEffect(() => {
        setIsMounted(true);
        if (typeof window !== 'undefined') {
            const savedHistory = localStorage.getItem('pdf_history');
            if (savedHistory) setHistory(JSON.parse(savedHistory));

            const savedLogo = localStorage.getItem('company_logo');
            if (savedLogo) setLogo(savedLogo);

            const savedTheme = localStorage.getItem('dark_mode');
            if (savedTheme === 'true') setDarkMode(true);
        }
    }, []);

    useEffect(() => {
        if (isMounted) {
            localStorage.setItem('dark_mode', darkMode.toString());
            if (darkMode) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    }, [darkMode, isMounted]);

    const addToHistory = (type: 'Conduce' | 'Garantía', desc: string) => {
        const newEntry: HistoryEntry = {
            id: Date.now(),
            type,
            desc,
            date: new Date().toLocaleDateString('es-DO'),
            time: new Date().toLocaleTimeString('es-DO')
        };
        const updated = [newEntry, ...history].slice(0, 50); // Keep last 50
        setHistory(updated);
        localStorage.setItem('pdf_history', JSON.stringify(updated));
    };

    // --- ACTIONS (CONDUCE) ---
    const addItem = () => {
        if (!newItem.model.trim()) return;
        setItems([...items, newItem]);
        setNewItem({ cant: 1, model: '' });
    };
    const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
    const startEditItem = (idx: number) => {
        setEditingItemIndex(idx);
        setEditingItemValue({ ...items[idx] });
    };
    const saveEditedItem = () => {
        if (editingItemIndex !== null && editingItemValue) {
            const updated = [...items];
            updated[editingItemIndex] = editingItemValue;
            setItems(updated);
            setEditingItemIndex(null);
            setEditingItemValue(null);
        }
    };

    // --- ACTIONS (GARANTIA) ---
    const addGItem = () => {
        if (!newGItem.model.trim()) return;
        setGItems([...gItems, newGItem]);
        setNewGItem({ cant: 1, model: '', imeis: '' });
    };
    const removeGItem = (idx: number) => setGItems(gItems.filter((_, i) => i !== idx));
    const startEditGItem = (idx: number) => {
        setEditingGItemIndex(idx);
        setEditingGItemValue({ ...gItems[idx] });
    };
    const saveEditedGItem = () => {
        if (editingGItemIndex !== null && editingGItemValue) {
            const updated = [...gItems];
            updated[editingGItemIndex] = editingGItemValue;
            setGItems(updated);
            setEditingGItemIndex(null);
            setEditingGItemValue(null);
        }
    };

    // --- PDF GENERATORS ---
    const generateConducePDF = () => {
        const doc = new jsPDF();
        const date = new Date().toLocaleDateString('es-DO');

        // --- COLORS & DYNAMIC SIZING ---
        const darkColor = [44, 62, 80] as [number, number, number];

        // Adaptar tamaño según cantidad de items para intentar que quepa en 1 hoja
        // A4 height ~297mm. Header takes ~50mm. Footer needs ~60mm. Available for table ~180mm.
        let tableFontSize = 10;
        let tablePadding = 4;

        if (items.length > 15) { tableFontSize = 9; tablePadding = 2.5; }
        if (items.length > 25) { tableFontSize = 8; tablePadding = 1.8; }
        if (items.length > 35) { tableFontSize = 7; tablePadding = 1.2; }
        if (items.length > 42) { tableFontSize = 6.5; tablePadding = 1.0; } // Más ajustado verticalmente

        // --- 1. HEADER (Logo Left, Title Right) ---

        // Logo
        if (logo) {
            try {
                const imgProps = (doc as any).getImageProperties(logo);
                // Mantener aspect ratio, max height 20mm, max width 50mm
                const maxHeight = 20;
                const maxWidth = 50;
                let w = imgProps.width;
                let h = imgProps.height;
                const ratio = w / h;

                if (h > maxHeight) { h = maxHeight; w = h * ratio; }
                if (w > maxWidth) { w = maxWidth; h = w / ratio; }

                doc.addImage(logo, 'PNG', 14, 10, w, h);
            } catch (e) { console.error(e); }
        }

        // Title Block (Right Aligned)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.text("CONDUCE DE ENTREGA", 196, 20, { align: 'right' });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text(`Fecha: ${date}`, 196, 27, { align: 'right' });
        doc.text(`Factura N°: ${factura || 'S/N'}`, 196, 32, { align: 'right' });

        // --- 2. CLIENT INFO (Left, below Logo) ---
        // Separator Line
        doc.setDrawColor(200);
        doc.setLineWidth(0.5);
        doc.line(14, 38, 196, 38);

        // Cliente Section
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text("CLIENTE / DESTINATARIO", 14, 45);

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        // Multiline client name if too long
        const clientName = (destinatario || 'Consumidor Final').toUpperCase();
        const splitClient = doc.splitTextToSize(clientName, 180);
        doc.text(splitClient, 14, 51);

        // --- 3. PRODUCT TABLE ---
        // Start below client info
        let tableY = 51 + (splitClient.length * 6) + 5;

        autoTable(doc, {
            startY: tableY,
            head: [['CANT', 'DESCRIPCIÓN', 'VERIFICACIÓN']],
            body: items.map(it => [
                it.cant,
                it.model,
                '' // Empty for manual check
            ]),
            theme: 'striped', // striped rows for readability
            styles: {
                fontSize: tableFontSize,
                cellPadding: tablePadding,
                valign: 'middle',
                textColor: 60,
                lineColor: [220, 220, 220],
                lineWidth: 0.1
            },
            headStyles: {
                fillColor: darkColor,
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 25, fontStyle: 'bold' },
                1: { halign: 'left' },
                2: { halign: 'center', cellWidth: 35 }
            },
            didParseCell: (data) => {
                // Custom checkbox logic for "VERIFICACIÓN" column
                if (data.section === 'body' && data.column.index === 2) {
                    data.cell.text = []; // Clear text
                }
            },
            didDrawCell: (data) => {
                if (data.section === 'body' && data.column.index === 2) {
                    const dim = tableFontSize / 2.5 + 2;
                    const x = data.cell.x + (data.cell.width - dim) / 2;
                    const y = data.cell.y + (data.cell.height - dim) / 2;
                    doc.setDrawColor(100);
                    doc.rect(x, y, dim, dim, 'S'); // Draw square box
                }
            }
        });

        // --- 4. TOTAL & FOOTER (Estrategia inteligente de espaciado) ---
        // @ts-ignore
        let currentY = doc.lastAutoTable.finalY;
        const totalItems = items.reduce((acc, curr) => acc + curr.cant, 0);

        // Constantes de la página
        const pageHeight = 297; // A4 en mm
        const bottomMargin = 15; // Margen inferior seguro
        const maxY = pageHeight - bottomMargin; // 282mm

        // Calcular espacio disponible
        const availableSpace = maxY - currentY;

        // Alturas estimadas de cada sección
        const totalHeight = 5; // Altura del texto "TOTAL UNIDADES"
        const noteTitleHeight = 4; // "Nota Importante:"
        const noteTextHeight = 12; // ~2 líneas de texto legal
        const signaturesHeight = 10; // Líneas de firma + texto

        const totalContentHeight = totalHeight + noteTitleHeight + noteTextHeight + signaturesHeight;

        // Ajuste de emergencia de fuentes si el espacio es CRÍTICO
        let legalFontSize = 7;
        let legalInterline = 2.5;
        if (availableSpace < totalContentHeight + 10) {
            legalFontSize = 6;
            legalInterline = 2.0;
        }

        // Calcular espaciado dinámico
        let spacerAfterTable, spacerAfterTotal, spacerAfterNoteTitle, spacerBeforeSignatures;

        if (availableSpace >= totalContentHeight + 40) {
            spacerAfterTable = 8;
            spacerAfterTotal = 12;
            spacerAfterNoteTitle = 5;
            spacerBeforeSignatures = 30; // Más espacio para firmas
        } else if (availableSpace >= totalContentHeight + 20) {
            spacerAfterTable = 6;
            spacerAfterTotal = 8;
            spacerAfterNoteTitle = 4;
            spacerBeforeSignatures = 22;
        } else if (availableSpace >= totalContentHeight) {
            spacerAfterTable = 4;
            spacerAfterTotal = 6;
            spacerAfterNoteTitle = 3;
            spacerBeforeSignatures = 15;
        } else {
            // ESPACIO EXTREMADAMENTE BAJO
            spacerAfterTable = 3;
            spacerAfterTotal = 4;
            spacerAfterNoteTitle = 2;
            spacerBeforeSignatures = 10;
        }

        currentY += spacerAfterTable;

        // TOTAL UNIDADES
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text(`TOTAL UNIDADES: ${totalItems}`, 196, currentY, { align: 'right' });

        currentY += spacerAfterTotal;

        // NOTA LEGAL
        doc.setFontSize(legalFontSize);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("Nota Importante:", 14, currentY);

        currentY += spacerAfterNoteTitle;

        doc.setFont("helvetica", "normal");
        const legalLines = [
            'Al firmar como "Recibido Conforme", el cliente acepta las políticas de la empresa y certifica que ha recibido la mercancía detallada.',
            'Cualquier reclamo debe realizarse antes de retirar la mercancía. No nos hacemos responsables tras la salida.'
        ];

        legalLines.forEach(line => {
            const splitLine = doc.splitTextToSize(line, 180);
            doc.text(splitLine, 14, currentY);
            currentY += (splitLine.length * legalInterline);
        });

        currentY += spacerBeforeSignatures;

        // Verificación final - forzar si se pasa del límite
        if (currentY > maxY - 10) {
            currentY = maxY - 10;
        }

        // FIRMAS
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);

        // Left Signature
        doc.line(30, currentY, 90, currentY);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);
        doc.text("Despachado por", 60, currentY + 5, { align: 'center' });

        // Right Signature
        doc.line(120, currentY, 180, currentY);
        doc.text("RECIBIDO CONFORME", 150, currentY + 5, { align: 'center' });

        const pdfBlobUrl = doc.output('bloburl');
        setPdfPreview(pdfBlobUrl);
        // window.open(pdfBlobUrl, '_blank'); // Comentado para usar la vista previa interna
        addToHistory('Conduce', `${destinatario} (${items.length} items)`);
    };

    const generateGarantiaPDF = () => {
        const doc = new jsPDF();
        const dateStr = new Date(gDate).toLocaleDateString('es-DO');

        doc.setFontSize(24);
        doc.setTextColor(0, 0, 128); // Navy
        doc.text("RECIBO DE GARANTIA", 14, 25);

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Fecha: ${dateStr}`, 14, 35);
        doc.text(`Tienda: ${storeName}`, 14, 42);

        doc.setFontSize(10);
        doc.text("Calle Duarte, Esq Dr Ferry #54\nSucursal La Romana\nRNC: 132872975", 200, 25, { align: 'right' });

        const bodyData = gItems.map(item => {
            let desc = item.model;
            if (item.imeis) desc += `\nIMEIs: ${item.imeis}`;
            return [item.cant, desc];
        });

        autoTable(doc, {
            startY: 55,
            head: [['CANT', 'DESCRIPCIÓN']],
            body: bodyData,
            styles: { fontSize: 12, cellPadding: 3 },
            headStyles: { fillColor: [200, 200, 200], textColor: 0, fontStyle: 'bold' },
            theme: 'grid'
        });

        // @ts-ignore
        let finalY = doc.lastAutoTable.finalY + 20;
        doc.setFontSize(9);
        doc.text("La garantía quedará anulada si el equipo presenta daños físicos, humedad o mal uso.", 14, finalY);

        finalY += 25;
        doc.line(14, finalY, 80, finalY);
        doc.text("Firma", 14, finalY + 5);

        const pdfBlobUrl = doc.output('bloburl');
        setPdfPreview(pdfBlobUrl);
        // doc.save(`Garantia_${storeName}.pdf`);
        addToHistory('Garantía', `${storeName} (${gItems.length} items)`);
    };

    if (!isMounted) return <div className="min-h-screen bg-background" />;

    return (
        <div className={cn("flex min-h-screen font-sans bg-background text-foreground transition-colors duration-300", darkMode && "dark")}>

            {/* SIDEBAR */}
            <aside className={cn(
                "fixed inset-y-0 left-0 z-30 w-64 bg-card border-r border-border transform transition-transform duration-300 md:relative md:translate-x-0 flex flex-col",
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-6 border-b border-border flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-primary-foreground shadow-md transition-all hover:scale-105" style={{ backgroundColor: themeColor }}>
                            <Truck size={20} />
                        </div>
                        <span className="font-bold text-xl tracking-tight">PDFConduceSDigital</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="md:hidden">
                        <X size={20} />
                    </Button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {[
                        { id: 'conduce', icon: Truck, label: 'Generar Conduce' },
                        { id: 'garantia', icon: ShieldCheck, label: 'Recibo Garantía' },
                        { id: 'historial', icon: History, label: 'Historial' }
                    ].map((tab) => (
                        <Button
                            key={tab.id}
                            variant={activeTab === tab.id ? "secondary" : "ghost"}
                            className={cn(
                                "w-full justify-start gap-3 h-11 px-4 text-sm font-medium rounded-xl transition-all",
                                activeTab === tab.id ? "shadow-sm bg-secondary" : "text-muted-foreground hover:bg-muted"
                            )}
                            onClick={() => setActiveTab(tab.id as any)}
                        >
                            <tab.icon size={18} /> {tab.label}
                        </Button>
                    ))}
                </nav>

                <div className="p-4 border-t border-border mt-auto space-y-4">
                    <div className="bg-muted/30 p-1.5 rounded-xl border border-border/50 flex items-center justify-between">
                        <Button
                            variant={!darkMode ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setDarkMode(false)}
                            className="flex-1 rounded-lg h-8 gap-2"
                        >
                            <Sun size={14} /> <span className="text-[10px] font-bold uppercase">Luz</span>
                        </Button>
                        <Button
                            variant={darkMode ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setDarkMode(true)}
                            className="flex-1 rounded-lg h-8 gap-2"
                        >
                            <Moon size={14} /> <span className="text-[10px] font-bold uppercase">Noche</span>
                        </Button>
                    </div>
                </div>
            </aside>

            {/* CONTENT */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative bg-muted/20">
                <header className="md:hidden bg-card p-4 border-b border-border flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                            <Menu size={24} />
                        </Button>
                        <span className="font-extrabold tracking-tight text-lg uppercase italic">PDFConduceSDigital</span>
                    </div>
                    <Badge variant="outline" className="px-3 py-1 bg-background">v2.2</Badge>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8">

                    {/* --- MODULE: CONDUCE --- */}
                    {activeTab === 'conduce' && (
                        <div className="max-w-5xl mx-auto animate-fadeIn pb-20">
                            <header className="mb-8">
                                <h1 className="text-3xl font-bold tracking-tight">Nuevo Conduce</h1>
                                <p className="text-muted-foreground">Documento de entrega profesional y personalizado.</p>
                            </header>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-8">
                                    {/* FILE UPLOAD CARD */}
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cargar Factura (PDF)</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="relative border-2 border-dashed border-input rounded-xl p-8 text-center hover:bg-muted/50 transition-all group overflow-hidden">
                                                <input
                                                    suppressHydrationWarning={true}
                                                    type="file"
                                                    accept=".pdf"
                                                    onChange={handleFileUpload}
                                                    disabled={isUploading}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                />
                                                <div className="flex flex-col items-center gap-3">
                                                    {isUploading ? (
                                                        <div className="flex flex-col items-center gap-3 animate-pulse">
                                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                                            <span className="text-sm font-bold text-primary italic">Procesando {uploadFilename || 'archivo'}...</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                                                <Truck size={24} />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <span className="text-sm font-semibold tracking-tight">
                                                                    {uploadFilename ? `Listo: ${uploadFilename}` : 'Suelta tu PDF aquí'}
                                                                </span>
                                                                <p className="text-xs text-muted-foreground/80 leading-relaxed font-medium">
                                                                    {uploadFilename ? 'Haz clic para cambiar el archivo' : 'Extracción automática de datos'}
                                                                </p>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* LOGO UPLOAD CARD */}
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Logo Empresa</CardTitle>
                                        </CardHeader>
                                        <CardContent className="flex flex-col md:flex-row items-center gap-6">
                                            <div className="w-20 h-20 bg-muted border border-border rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-inner group">
                                                {logo ? <img src={logo} alt="Logo" className="w-full h-full object-contain transition-transform group-hover:scale-110" /> : <span className="text-[10px] text-muted-foreground font-bold uppercase opacity-50">Logotipo</span>}
                                            </div>
                                            <div className="flex-1 w-full space-y-3">
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleLogoUpload}
                                                    className="cursor-pointer file:font-semibold file:text-primary"
                                                />
                                                <p className="text-[10px] text-muted-foreground/70 font-semibold uppercase tracking-tight">Preferiblemente formato PNG o JPG con fondo blanco.</p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* CLIENT INFO CARD */}
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Información del Cliente</CardTitle>
                                        </CardHeader>
                                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-muted-foreground/80 ml-1 uppercase tracking-tighter">Cliente / Destinatario</label>
                                                <Input suppressHydrationWarning={true} type="text" value={destinatario} onChange={e => setDestinatario(e.target.value)} className="h-11 font-medium bg-background" placeholder="Nombre completo" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-muted-foreground/80 ml-1 uppercase tracking-tighter">No. Factura</label>
                                                <Input suppressHydrationWarning={true} type="text" value={factura} onChange={e => setFactura(e.target.value)} className="h-11 font-medium bg-background" placeholder="B0100000000" />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* ITEMS CARD */}
                                    <Card className="min-h-[450px] flex flex-col overflow-hidden">
                                        <CardHeader className="flex flex-row items-center justify-between pb-3 bg-muted/30">
                                            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Items del Conduce</CardTitle>
                                            <Badge variant="secondary" className="font-bold text-[10px]">{items.length} PRODUCTOS</Badge>
                                        </CardHeader>

                                        {/* ADD ITEM ROW */}
                                        <div className="p-4 border-b border-border bg-muted/10 flex flex-col md:flex-row gap-3">
                                            <div className="flex-1 flex gap-2">
                                                <Input suppressHydrationWarning={true} type="number" min="1" value={newItem.cant} onChange={e => setNewItem({ ...newItem, cant: parseInt(e.target.value) })} className="w-16 h-10 text-center font-bold" />
                                                <Input suppressHydrationWarning={true} type="text" value={newItem.model} onChange={e => setNewItem({ ...newItem, model: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addItem()} className="flex-1 h-10 font-medium" placeholder="Modelo o descripción..." />
                                            </div>
                                            <Button onClick={addItem} className="gap-2 font-bold uppercase tracking-widest text-xs h-10">
                                                <Plus size={16} /> Agregar
                                            </Button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-b-2">
                                                        <TableHead className="w-20 text-center font-black text-[10px] uppercase">Cant</TableHead>
                                                        <TableHead className="font-black text-[10px] uppercase">Descripción</TableHead>
                                                        <TableHead className="w-16 text-right font-black text-[10px] uppercase">Acc</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {items.map((item, idx) => (
                                                        <TableRow key={idx} className="group transition-colors odd:bg-muted/5">
                                                            <TableCell className="text-center font-bold">{item.cant}</TableCell>
                                                            <TableCell className="font-medium">{item.model}</TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    <Dialog open={editingItemIndex === idx} onOpenChange={(open) => !open && setEditingItemIndex(null)}>
                                                                        <DialogTrigger asChild>
                                                                            <Button variant="ghost" size="icon" onClick={() => startEditItem(idx)} className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10">
                                                                                <Pencil size={14} />
                                                                            </Button>
                                                                        </DialogTrigger>
                                                                        <DialogContent className="sm:max-w-[425px]">
                                                                            <DialogHeader>
                                                                                <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Editar Producto</DialogTitle>
                                                                            </DialogHeader>
                                                                            <div className="grid gap-4 py-4">
                                                                                <div className="grid gap-2">
                                                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Cantidad</label>
                                                                                    <Input
                                                                                        type="number"
                                                                                        value={editingItemValue?.cant || 1}
                                                                                        onChange={(e) => setEditingItemValue(prev => prev ? { ...prev, cant: parseInt(e.target.value) } : null)}
                                                                                        className="font-bold"
                                                                                    />
                                                                                </div>
                                                                                <div className="grid gap-2">
                                                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Descripción / Modelo</label>
                                                                                    <Input
                                                                                        value={editingItemValue?.model || ''}
                                                                                        onChange={(e) => setEditingItemValue(prev => prev ? { ...prev, model: e.target.value } : null)}
                                                                                        className="font-medium"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            <DialogFooter>
                                                                                <Button onClick={saveEditedItem} className="w-full font-black uppercase tracking-widest text-xs h-11">Guardar Cambios</Button>
                                                                            </DialogFooter>
                                                                        </DialogContent>
                                                                    </Dialog>
                                                                    <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                                                        <Trash2 size={14} />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            {items.length === 0 && (
                                                <div className="h-[250px] flex flex-col items-center justify-center text-center p-8 gap-4 grayscale opacity-40">
                                                    <Truck size={48} className="text-muted-foreground animate-bounce" />
                                                    <p className="text-[10px] font-black uppercase tracking-tighter italic">No hay productos en esta entrega</p>
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                </div>

                                <div className="space-y-8">
                                    <Card className="sticky top-8 overflow-hidden shadow-2xl border-2">
                                        <CardContent className="p-8 space-y-8">
                                            <div className="space-y-4">
                                                <Button
                                                    size="lg"
                                                    onClick={generateConducePDF}
                                                    disabled={items.length === 0}
                                                    className="w-full h-16 text-lg font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.03] active:scale-95 gap-3"
                                                >
                                                    <Download size={24} /> Generar PDF
                                                </Button>
                                                <p className="text-center text-[10px] text-muted-foreground font-black uppercase tracking-widest animate-pulse italic">Formato A4 Profesional</p>
                                            </div>

                                            <Separator />

                                            <div className="space-y-4">
                                                <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tema del Documento</CardTitle>
                                                <div className="grid grid-cols-4 gap-3">
                                                    {['#000000', '#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#f43f5e', '#a855f7'].map(c => (
                                                        <button
                                                            key={c}
                                                            onClick={() => setThemeColor(c)}
                                                            className={cn(
                                                                "w-10 h-10 rounded-xl border-2 transition-all hover:scale-125 hover:rotate-6 shadow-sm",
                                                                themeColor === c ? "border-primary ring-4 ring-primary/20 scale-110" : "border-transparent"
                                                            )}
                                                            style={{ backgroundColor: c }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    )
                    }

                    {/* --- MODULE: GARANTIA --- */}
                    {activeTab === 'garantia' && (
                        <div className="max-w-4xl mx-auto animate-fadeIn pb-20">
                            <header className="mb-8">
                                <h1 className="text-3xl font-black tracking-tighter uppercase italic">Recibo de Garantía</h1>
                                <p className="text-muted-foreground font-medium">Emisión de certificados de garantía profesional.</p>
                            </header>

                            <Card className="mb-8 border-2">
                                <CardContent className="pt-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-muted-foreground/80 ml-1 uppercase tracking-tighter">Nombre de Tienda</label>
                                            <Input suppressHydrationWarning={true} type="text" value={storeName} onChange={e => setStoreName(e.target.value)} className="h-11 font-bold" placeholder="NOMBRE COMERCIAL" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-muted-foreground/80 ml-1 uppercase tracking-tighter">Fecha de Emisión</label>
                                            <Input suppressHydrationWarning={true} type="date" value={gDate} onChange={e => setGDate(e.target.value)} className="h-11 font-bold" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="overflow-hidden mb-8 border-2">
                                <CardHeader className="bg-muted/30 pb-3">
                                    <CardTitle className="text-xs font-black text-muted-foreground uppercase tracking-widest">Productos en Garantía</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="p-6 border-b border-border bg-muted/10 space-y-4">
                                        <div className="flex flex-col md:flex-row gap-3">
                                            <Input suppressHydrationWarning={true} type="number" min="1" value={newGItem.cant} onChange={e => setNewGItem({ ...newGItem, cant: e.target.value })} className="w-16 h-11 text-center font-black" />
                                            <Input suppressHydrationWarning={true} type="text" value={newGItem.model} onChange={e => setNewGItem({ ...newGItem, model: e.target.value })} className="flex-1 h-11 font-medium" placeholder="Modelo del equipo..." />
                                            <Input suppressHydrationWarning={true} type="text" value={newGItem.imeis} onChange={e => setNewGItem({ ...newGItem, imeis: e.target.value })} className="flex-[1.5] h-11 font-medium" placeholder="IMEIs / Series..." />
                                        </div>
                                        <Button onClick={addGItem} className="w-full h-11 font-black uppercase tracking-widest text-xs">
                                            <Plus size={16} className="mr-2" /> Agregar Producto
                                        </Button>
                                    </div>
                                    <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
                                        {gItems.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-5 hover:bg-muted/30 transition-colors group">
                                                <div className="flex gap-6 items-start">
                                                    <span className="font-black text-xl text-primary mt-1">{item.cant}x</span>
                                                    <div className="space-y-1.5">
                                                        <div className="font-bold text-sm uppercase tracking-tight leading-none">{item.model}</div>
                                                        {item.imeis && (
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className="font-mono text-[9px] px-1.5 py-0 bg-background/50 border-input text-muted-foreground">IMEI: {item.imeis}</Badge>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Dialog open={editingGItemIndex === idx} onOpenChange={(open) => !open && setEditingGItemIndex(null)}>
                                                        <DialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" onClick={() => startEditGItem(idx)} className="text-muted-foreground hover:text-primary hover:bg-primary/10">
                                                                <Pencil size={16} />
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="sm:max-w-[425px]">
                                                            <DialogHeader>
                                                                <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Editar Producto (Garantía)</DialogTitle>
                                                            </DialogHeader>
                                                            <div className="grid gap-4 py-4">
                                                                <div className="grid gap-2">
                                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Cantidad</label>
                                                                    <Input
                                                                        type="number"
                                                                        value={editingGItemValue?.cant || 1}
                                                                        onChange={(e) => setEditingGItemValue(prev => prev ? { ...prev, cant: e.target.value } : null)}
                                                                        className="font-bold"
                                                                    />
                                                                </div>
                                                                <div className="grid gap-2">
                                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Modelo del Equipo</label>
                                                                    <Input
                                                                        value={editingGItemValue?.model || ''}
                                                                        onChange={(e) => setEditingGItemValue(prev => prev ? { ...prev, model: e.target.value } : null)}
                                                                        className="font-medium"
                                                                    />
                                                                </div>
                                                                <div className="grid gap-2">
                                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">IMEIs / Números de Serie</label>
                                                                    <Input
                                                                        value={editingGItemValue?.imeis || ''}
                                                                        onChange={(e) => setEditingGItemValue(prev => prev ? { ...prev, imeis: e.target.value } : null)}
                                                                        className="font-medium"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <DialogFooter>
                                                                <Button onClick={saveEditedGItem} className="w-full font-black uppercase tracking-widest text-xs h-11">Actualizar Garantía</Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
                                                    <Button variant="ghost" size="icon" onClick={() => removeGItem(idx)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                        {gItems.length === 0 && (
                                            <div className="p-16 text-center text-muted-foreground/30 flex flex-col items-center gap-4 grayscale">
                                                <ShieldCheck size={48} className="animate-pulse" />
                                                <p className="font-black text-[10px] uppercase tracking-[0.3em] italic">Sin productos registrados</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Button
                                onClick={generateGarantiaPDF}
                                disabled={gItems.length === 0}
                                className="w-full h-16 text-lg font-black uppercase tracking-[0.3em] shadow-2xl transition-all hover:scale-[1.01] active:scale-95 gap-3"
                            >
                                <ShieldCheck size={24} /> Emitir Garantía
                            </Button>
                        </div>
                    )}

                    {/* --- MODULE: HISTORIAL --- */}
                    {activeTab === 'historial' && (
                        <div className="max-w-3xl mx-auto animate-fadeIn pb-20">
                            <header className="mb-8 text-center md:text-left">
                                <h1 className="text-3xl font-black tracking-tighter uppercase italic">Historial Local</h1>
                                <p className="text-muted-foreground font-medium tracking-tight">Registro de documentos generados en este equipo.</p>
                            </header>

                            <Card className="overflow-hidden border-2">
                                <CardContent className="p-0 divide-y divide-border">
                                    {history.length === 0 ? (
                                        <div className="p-24 text-center grayscale opacity-30 flex flex-col items-center gap-6">
                                            <History size={64} className="stroke-[1.5]" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.4em] italic">No hay actividad reciente</p>
                                        </div>
                                    ) : (
                                        history.map(entry => (
                                            <div key={entry.id} className="p-6 flex items-center justify-between hover:bg-muted/30 transition-all cursor-default group">
                                                <div className="flex items-center gap-6">
                                                    <div className={cn(
                                                        "w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner border transition-transform group-hover:scale-110",
                                                        entry.type === 'Conduce' ? "bg-blue-500/5 text-blue-600 border-blue-500/10" : "bg-purple-500/5 text-purple-600 border-purple-500/10"
                                                    )}>
                                                        {entry.type === 'Conduce' ? <Truck size={24} /> : <ShieldCheck size={24} />}
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="font-black text-base tracking-tight leading-none group-hover:text-primary transition-colors">{entry.desc}</div>
                                                        <div className="flex items-center gap-2">
                                                            <History className="w-3 h-3 text-muted-foreground/60" />
                                                            <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-tighter italic">{entry.date} • {entry.time}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Badge variant={entry.type === 'Conduce' ? "default" : "secondary"} className="font-black text-[10px] px-3 py-1 uppercase tracking-widest shadow-sm">
                                                    {entry.type}
                                                </Badge>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}

                </div>

                {/* PDF PREVIEW MODAL */}
                {pdfPreview && (
                    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-fadeIn">
                        <Card className="w-full max-w-6xl h-full flex flex-col overflow-hidden shadow-2xl border-2">
                            <CardHeader className="p-4 border-b border-border flex flex-row justify-between items-center bg-muted/30 shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shadow-sm transition-transform hover:rotate-12"><Download size={20} /></div>
                                    <div>
                                        <CardTitle className="font-black text-lg tracking-tighter uppercase italic">Vista Previa</CardTitle>
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-70">Documento listo para descargar</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Button asChild className="font-black uppercase tracking-widest text-xs h-10 px-6 gap-2">
                                        <a href={pdfPreview} download="documento.pdf">
                                            <Download size={16} /> Descargar
                                        </a>
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setPdfPreview(null)} className="h-10 w-10">
                                        <X size={20} />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 bg-muted/10 p-4 min-h-0">
                                <iframe
                                    src={pdfPreview}
                                    className="w-full h-full border border-border rounded-xl shadow-2xl bg-white"
                                    title="PDF Preview"
                                />
                            </CardContent>
                        </Card>
                    </div>
                )}
            </main>
        </div>
    );
}
