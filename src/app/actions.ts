'use server'

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Polyfill DOMMatrix for pdf-parse/pdf.js in Node environment
// @ts-ignore
if (typeof Promise.withResolvers === 'undefined') {
    // Shim for unrelated issues if any, but focus on DOMMatrix
}

if (!(global as any).DOMMatrix) {
    (global as any).DOMMatrix = class DOMMatrix {
        a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
        constructor() {
            this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
        }
    };
}

const pdf = require('pdf-parse/lib/pdf-parse.js');

export interface Item {
    cant: number;
    model: string;
}

export interface ExtractionResult {
    success: boolean;
    data?: {
        cliente: string;
        factura: string;
        items: Item[];
    };
    error?: string;
}

export interface ChargerItem {
    qty: number;
    desc: string;
    type: 'usb' | 'usc' | 'cc';
}

export interface ClassifyResult {
    success: boolean;
    data?: {
        usb: ChargerItem[];
        usc: ChargerItem[];
        cc: ChargerItem[];
    };
    error?: string;
}

// Helper to detect if a line represents an IMEI or serial number
function isImeiOrSerialLine(s: string): boolean {
    const upper = s.toUpperCase();
    if (
        upper.includes('IMEI') || 
        upper.includes('SERIE') || 
        upper.includes('SERIAL') ||
        /\bS\/N\b/.test(upper) ||
        /\bN\/S\b/.test(upper) ||
        /\bSN\b/.test(upper)
    ) {
        return true;
    }
    // Clean spaces and dashes to check for 14 to 16 digit numbers (typical IMEI)
    const cleanDigits = s.replace(/[-\s]/g, '');
    if (/\d{14,16}/.test(cleanDigits)) {
        return true;
    }
    return false;
}

// Server Action para procesar el PDF
export async function extractConduceData(formData: FormData): Promise<ExtractionResult> {
    try {
        const file = formData.get('file') as File;
        if (!file) {
            throw new Error('No se subió ningún archivo');
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Ensure pdf parser is available (simple check for classic lib)
        const pdfParser = typeof pdf === 'function' ? pdf : pdf.default;

        if (typeof pdfParser !== 'function') {
            throw new Error(`Failed to load PDF parser. Expected function, got ${typeof pdfParser}.`);
        }

        const data = await pdfParser(buffer);
        const text = data.text;

        console.log("--- EXTRACCIÓN PDF ---");
        console.log("Texto extraído (primeros 500 chars):", text.substring(0, 500));

        // --- LOGICA DE EXTRACCION BASADA EN PYTHON ---

        // 1. Cliente
        let cliente = "";
        const clienteMatch = text.match(/Cliente:\s*([\s\S]*?)(?=\s*(?:Dirección:|Vendedor:|$))/i);

        if (clienteMatch && clienteMatch[1].trim()) {
            cliente = clienteMatch[1].trim();
            cliente = cliente.replace(/\n/g, " ").trim();
        } else {
            // Fallback para Yacelltech: El nombre del cliente suele estar en la línea ANTERIOR a "Cliente:"
            // Buscamos "Cliente:" y tomamos la línea previa no vacía
            const clienteIndex = text.indexOf('Cliente:');
            if (clienteIndex !== -1) {
                const textBefore = text.substring(0, clienteIndex);
                const linesBefore = textBefore.split('\n').map(l => l.trim()).filter(l => l);
                if (linesBefore.length > 0) {
                    // Tomar la última línea no vacía antes de "Cliente:"
                    // Ignorar líneas "basura" comunes si es necesario
                    cliente = linesBefore[linesBefore.length - 1];
                }
            }
        }
        console.log("Cliente detectado:", cliente);

        // 2. Factura
        let factura = "";
        // Regex original: No Factura \s* (\w+)
        // Regex mejorado para evitar capturar textos largos
        const facturaMatch = text.match(/No Factura\s*([A-Za-z0-9\-\.]+)/i);
        // Fallback Yacelltech: "No Factura\nCondiciones:\n...\n2375" (Numero aparece abajo)
        // O "No Factura" seguido de numero.
        // En el dump:
        // No Factura
        // Condiciones:
        // DE CONTADO
        // Fecha: ...
        // 2375 <- Este parece ser el numero de factura, suelto?
        // O quizas "2375" esta cerca de "No Factura"?
        // En el dump: "SIN DEFINIR \n 2375 \n No Factura"
        // Wait:
        // Vendedor:
        //  SIN DEFINIR 
        // 2375
        // No Factura
        // Condiciones:

        // Parece que "2375" está ANTES de "No Factura".

        if (facturaMatch) {
            factura = facturaMatch[1].trim();
        }

        // Validación anti-falsos positivos
        const invalidTokens = ['CONDICIONES', 'DE', 'CONTADO', 'CREDITO', 'FECHA', 'VENDEDOR'];
        if (factura && (factura.length > 20 || invalidTokens.includes(factura.toUpperCase()))) {
            factura = "";
        }

        // Estrategia 2 (Yacelltech): El número suele estar en la línea anterior a "No Factura"
        if (!factura) {
            const lines = text.split('\n').map(l => l.trim()).filter(l => l);
            const nfIndex = lines.findIndex(l => l.toLowerCase().includes('no factura'));

            if (nfIndex > 0) {
                for (let i = 1; i <= 2; i++) {
                    const prev = lines[nfIndex - i];
                    if (prev) {
                        // Buscar un token que parezca número (evitando fechas con /)
                        if ((/^\d+$/.test(prev) || (/^[A-Z0-9\-]+$/.test(prev))) && prev.length < 12 && !prev.includes('/')) {
                            factura = prev;
                            break;
                        }
                    }
                }
            }
        }

        console.log("Factura detectada:", factura);

        // 3. Items
        const items: Item[] = [];
        const lines = text.split('\n');

        console.log(`Analizando ${lines.length} líneas para items...`);

        const BLACKLIST = ['NO FACTURA', 'CONDICIONES', 'VENDEDOR', 'CLIENTE', 'FECHA', 'SUBTOTAL', 'DESCUENTO', 'ITBIS', 'TOTAL', 'PAGINA', 'RECIBIDO POR', 'REALIZADO POR'];
        const isBlacklisted = (s: string) => BLACKLIST.some(b => s.toUpperCase().includes(b));

        let pendingQty: number | null = null;
        let lastItemIndex: number | null = null; // para continuar descripción en múltiples líneas

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            const quantityMatch = line.match(/^(\d+(?:[.,]\d{1,2})?)\s*(.*)/);

            if (quantityMatch) {
                let qtyStr = quantityMatch[1].replace(',', '.');
                let qty = parseFloat(qtyStr);
                let rest = quantityMatch[2].trim();

                if (qty === 0) continue;
                if (qty > 9000) continue;
                if (rest.startsWith('/')) continue;
                if (rest.startsWith('-')) continue;

                if (rest.length > 0) {
                    if (/^[\d.,]+$/.test(rest)) continue;
                    if (isImeiOrSerialLine(rest)) continue;

                    // Línea como "10W", "33W", "20W": es especificación de vatios, no un item nuevo
                    if (/^[A-Za-z]{1,4}$/.test(rest)) {
                        if (lastItemIndex !== null) {
                            // Añadir la especificación (ej: "10W") al último item
                            items[lastItemIndex].model = (items[lastItemIndex].model + ' ' + qty + rest).trim();
                        }
                        continue;
                    }

                    let model = rest;
                    const priceIndex = model.search(/\d{1,3}(?:,\d{3})*\.\d{2}/);
                    if (priceIndex !== -1) {
                        model = model.substring(0, priceIndex);
                    }

                    model = cleanModelName(model);
                    if (model) {
                        items.push({ cant: Math.round(qty), model });
                        lastItemIndex = items.length - 1;
                        pendingQty = null;
                    }
                } else {
                    pendingQty = qty;
                    lastItemIndex = null;
                }
            }
            else if (pendingQty !== null) {
                let model = cleanModelName(line);

                if (model) {
                    if (isBlacklisted(model) || model.length < 3 || isImeiOrSerialLine(model)) {
                        pendingQty = null;
                        lastItemIndex = null;
                        continue;
                    }
                }

                if (model) {
                    items.push({ cant: Math.round(pendingQty), model });
                    lastItemIndex = items.length - 1;
                }
                pendingQty = null;
            }
            else if (lastItemIndex !== null) {
                // Continuación de descripción en línea siguiente (ej: "PRO", "TPC 33W")
                if (/^[\d.,]+$/.test(line)) { lastItemIndex = null; continue; }
                if (isBlacklisted(line)) { lastItemIndex = null; continue; }
                if (isImeiOrSerialLine(line)) { lastItemIndex = null; continue; }
                if (line.length < 2) continue;
                const combined = items[lastItemIndex].model + ' ' + line;
                items[lastItemIndex].model = cleanModelName(combined.trim());
            }
        }

        // Agrupar items iguales
        const grouped = items.reduce((acc: Item[], curr: Item) => {
            const found = acc.find(i => i.model === curr.model);
            if (found) {
                found.cant += curr.cant;
            } else {
                acc.push({ ...curr });
            }
            return acc;
        }, []);

        console.log("Items encontrados:", grouped.length);
        console.log("Data final items:", JSON.stringify(grouped));

        return {
            success: true,
            data: {
                cliente,
                factura,
                items: grouped
            }
        };

    } catch (error: any) {
        console.error("Error procesando PDF:", error);
        return { success: false, error: error.message };
    }
}

function classifyChargerType(desc: string): 'usb' | 'usc' | 'cc' {
    const d = desc.toUpperCase();
    const numMatch = d.match(/IPHONE\s+(\d+)/);
    if (!numMatch) return 'usb';
    const n = parseInt(numMatch[1]);
    const isPro = d.includes('PRO');
    if (n <= 11) return 'usb';
    if (n === 12 && !isPro) return 'usb';
    if (n === 12 && isPro) return 'usc';
    if (n === 13 || n === 14) return 'usc';
    if (n >= 15) return 'cc';
    return 'usb';
}

export async function classifyChargersFromPDF(formData: FormData): Promise<ClassifyResult> {
    try {
        const file = formData.get('file') as File;
        if (!file) throw new Error('No se subió ningún archivo');

        const buffer = Buffer.from(await file.arrayBuffer());
        const pdfParser = typeof pdf === 'function' ? pdf : pdf.default;
        if (typeof pdfParser !== 'function') throw new Error('PDF parser no disponible');

        const data = await pdfParser(buffer);
        const text = data.text;

        const rawItems: { qty: number; desc: string }[] = [];
        const reg = /(\d+)[.,]00\s+(CELULAR\s+APPLE\s+IPHONE[\w\s\+]+?)\s+\d[\d,.]+[.,]00/gi;
        let match;
        while ((match = reg.exec(text)) !== null) {
            rawItems.push({ qty: parseInt(match[1]), desc: match[2].trim() });
        }

        const usb: ChargerItem[] = [];
        const usc: ChargerItem[] = [];
        const cc: ChargerItem[] = [];

        for (const item of rawItems) {
            const type = classifyChargerType(item.desc);
            const ci: ChargerItem = { ...item, type };
            if (type === 'usb') usb.push(ci);
            else if (type === 'usc') usc.push(ci);
            else cc.push(ci);
        }

        return { success: true, data: { usb, usc, cc } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

function cleanModelName(name: string): string {
    let model = name;

    const colors = [
        'negro', 'rojo', 'verde', 'azul', 'blanco', 'gris', 'plateado',
        'dorado', 'púrpura', 'purpura', 'morado', 'lavanda', 'rosa', 'rosado', 'amarillo', 'naranja', 'marrón',
        'cyan', 'magenta', 'grafito', 'sierra', 'black', 'red', 'green',
        'blue', 'white', 'gray', 'grey', 'silver', 'gold', 'purple', 'pink',
        'yellow', 'orange', 'brown', 'graphite', 'midnight blue',
        'desert gold', 'titanium', 'oro', 'arena', 'pantone', 'tapestry',
        'arabesque', 'navy', 'violet', 'mint', 'cream', 'beige', 'charcoal',
        'blaze', 'pure', 'tendril', 'polar', 'deep', 'space', 'rose',
        'veil', 'ink', 'desert', 'awesome', 'light', 'ligth', 'dark', 'celestial', 'ocaso'
    ];

    model = model.replace(/\s*5g\b/gi, '');
    // model = model.replace(/\s*\d+\.?\d*\"+\s*$/gi, ''); // FIX: No borrar pulgadas (TVs)

    // Limpiar códigos de modelo Samsung comunes (ej: SM-A566B, SM-A556E/DS)
    model = model.replace(/\bSM-[A-Z0-9\/]+\b/gi, '');

    // Re-habilitamos limpieza de colores para agrupar
    const colorRegex = new RegExp(`\\b(${colors.join('|')})\\b`, 'gi');
    model = model.replace(colorRegex, '');

    // Limpiar codigos de producto especificos de Khan (ej: PB970015CR, KM4, MK4K para agrupar)
    model = model.replace(/\bPB\d+[A-Z0-9]*\b/gi, ''); // Motorola part numbers
    model = model.replace(/\b(KM4K?|MK4K?)\b/gi, ''); // Tecno part suffixes
    model = model.replace(/\b(VEIL|INK|DESERT)\b/gi, ''); // Fallback for uppercase not caught

    model = model.replace(/\(\s*\)/g, '');
    model = model.replace(/[()]/g, ''); // Remove remaining parens (e.g. from "(AZUL)")
    model = model.replace(/\s{2,}/g, ' ').trim();

    // Safety fallback: si limpiamos todo (ej: solo era un color), devolver original
    if (!model) {
        return name.trim();
    }

    return model;
}
