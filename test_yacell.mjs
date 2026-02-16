import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse/lib/pdf-parse.js');

const PDF_FILE = '../yacelltech 14-2 iphone.pdf';

async function test() {
    try {
        const buffer = fs.readFileSync(PDF_FILE);
        const data = await pdf(buffer);
        console.log("--- TEXTO EXTRAIDO ---");
        console.log(data.text);
        console.log("----------------------");
    } catch (e) {
        console.error(e);
    }
}

test();
