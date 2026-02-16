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

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            // Estrategia robusta: Buscar la cantidad decimal al inicio
            // Yacelltech PDF a veces une la cantidad con la descripción (ej: "1.00CELULAR...")
            // Regex mejorado para capturar cantidades enteras (ej: 1) o decimales (1.00, 1,00)
            const quantityMatch = line.match(/^(\d+(?:[.,]\d{1,2})?)\s*(.*)/);
            if (quantityMatch) {
                // console.log("Posible item encontrado:", line); // Debug line match
                let qtyStr = quantityMatch[1].replace(',', '.');
                let qty = parseFloat(qtyStr);
                let rest = quantityMatch[2];

                // Limpiar precios del final de 'rest' si existen
                const priceIndex = rest.search(/\d{1,3}(?:,\d{3})*\.\d{2}/);
                let model = rest;
                if (priceIndex !== -1) {
                    model = rest.substring(0, priceIndex);
                }

                // Limpiar modelo
                model = cleanModelName(model);

                if (model && qty > 0) {
                    items.push({ cant: Math.round(qty), model });
                }
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

function cleanModelName(name: string): string {
    let model = name;

    const colors = [
        'negro', 'rojo', 'verde', 'azul', 'blanco', 'gris', 'plateado',
        'dorado', 'púrpura', 'morado', 'lavanda', 'rosa', 'rosado', 'amarillo', 'naranja', 'marrón',
        'cyan', 'magenta', 'grafito', 'sierra', 'black', 'red', 'green',
        'blue', 'white', 'gray', 'silver', 'gold', 'purple', 'pink',
        'yellow', 'orange', 'brown', 'graphite', 'midnight blue',
        'desert gold', 'titanium', 'oro', 'arena', 'pantone', 'tapestry',
        'arabesque', 'navy', 'violet', 'mint', 'cream', 'beige', 'charcoal',
        'blaze', 'pure', 'tendril', 'polar', 'deep', 'space', 'rose'
    ];

    model = model.replace(/\s*5g\b/gi, '');
    model = model.replace(/\s*\d+\.?\d*\"+\s*$/gi, '');
    const colorRegex = new RegExp(`\\b(${colors.join('|')})\\b`, 'gi');
    model = model.replace(colorRegex, '');
    model = model.replace(/\(\s*\)/g, '');
    model = model.replace(/\s{2,}/g, ' ').trim();

    // Safety fallback: si limpiamos todo (ej: solo era un color), devolver original
    if (!model) {
        return name.trim();
    }

    return model;
}
