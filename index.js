#!/usr/bin/env node
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const QRCode = require('qrcode');

const LOGO_PATH = path.join(__dirname, 'logo.png');

function extractPassengers(rawData) {
    const passengers = [];

    // Find all 9-digit Bcard numbers
    const bcardNos = rawData.match(/\b\d{9}\b/g) || [];

    // Find all 6-digit booking numbers
    const bookingNos = rawData.match(/\b\d{6}\b/g) || [];

    // Find names in CAPS at end of description lines
    // Names are fully uppercase at the end, like "ENGSTRØM LARS"
    const lines = rawData.split('\n');
    const names = [];

    for (const line of lines) {
        // Match 2+ uppercase words at the end of a line (allowing Nordic chars and hyphens)
        const nameMatch = line.match(/([A-ZÆØÅÄÖ][A-ZÆØÅÄÖ\-\.]+(?:\s+[A-ZÆØÅÄÖ][A-ZÆØÅÄÖ\-\.]+)+)\s*$/);
        if (nameMatch) {
            names.push(nameMatch[1].trim());
        }
    }

    // Pair Bcard numbers with booking numbers and names
    for (let i = 0; i < bcardNos.length; i++) {
        passengers.push({
            bcardNo: bcardNos[i],
            bookingNo: bookingNos[i] || '',
            name: names[i] || 'UNKNOWN',
            number: i + 1
        });
    }

    return passengers;
}

async function generateQRCodes(passengers) {
    const qrCodes = [];
    for (const p of passengers) {
        const qrBuffer = await QRCode.toBuffer(p.bcardNo, {
            type: 'png',
            width: 150,
            margin: 1
        });
        qrCodes.push(qrBuffer);
    }
    return qrCodes;
}

async function generatePDF(passengers, outputFile = 'boarding_list.pdf') {
    // Generate QR codes first
    console.log('Generating QR codes...');
    const qrCodes = await generateQRCodes(passengers);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 30 });
        const stream = fs.createWriteStream(outputFile);

        doc.pipe(stream);

        // Logo
        if (fs.existsSync(LOGO_PATH)) {
            doc.image(LOGO_PATH, 30, 25, { width: 140 });
            doc.moveDown(3);
        }

        // Title
        doc.fontSize(18).font('Helvetica-Bold')
           .text('Embarkation List', { align: 'center' });
        doc.moveDown(0.2);

        // Date and count
        doc.fontSize(9).font('Helvetica')
           .fillColor('#666')
           .text(`Generated: ${new Date().toLocaleString('no-NO')}  |  Total: ${passengers.length}`, { align: 'center' });
        doc.fillColor('black');
        doc.moveDown(0.8);

        // Two-column card layout
        const pageWidth = doc.page.width;
        const margin = 15;
        const cardWidth = (pageWidth - 2 * margin) / 2;
        const cardHeight = 115;
        const cardPadding = 12;

        let y = doc.y;

        passengers.forEach((p, index) => {
            const col = index % 2; // 0 = left, 1 = right
            const cardX = margin + col * cardWidth;

            // Check for page break
            if (col === 0 && y + cardHeight > doc.page.height - 20) {
                doc.addPage();
                y = 20;
            }

            // Card border (solid line for cutting)
            doc.rect(cardX, y, cardWidth, cardHeight).stroke('#000');

            // Alternate background
            if (Math.floor(index / 2) % 2 === 0) {
                doc.rect(cardX + 0.5, y + 0.5, cardWidth - 1, cardHeight - 1).fill('#f5f5f5');
                doc.fillColor('black');
            }

            // QR Code on left side - bigger
            const qrSize = 90;
            const qrX = cardX + 8;
            const qrY = y + (cardHeight - qrSize) / 2;
            doc.image(qrCodes[index], qrX, qrY, { width: qrSize });

            // Text content to the right of QR
            const textX = cardX + qrSize + 14;
            const textWidth = cardWidth - qrSize - 20;

            // Passenger number (top right corner)
            doc.font('Helvetica').fontSize(8).fillColor('#888');
            doc.text(`#${p.number}`, textX, y + 8, { width: textWidth, align: 'right' });
            doc.fillColor('black');

            // Name (bold, prominent)
            doc.font('Helvetica-Bold').fontSize(11);
            doc.text(p.name, textX, y + 20, { width: textWidth, lineGap: 1 });

            // Bcard No label and value
            doc.font('Helvetica').fontSize(7).fillColor('#666');
            doc.text('BCARD NO', textX, y + 55);
            doc.font('Helvetica-Bold').fontSize(10).fillColor('black');
            doc.text(p.bcardNo, textX, y + 64);

            // Booking number
            doc.font('Helvetica').fontSize(7).fillColor('#666');
            doc.text('BOOKING', textX + 75, y + 55);
            doc.font('Helvetica-Bold').fontSize(10).fillColor('black');
            doc.text(p.bookingNo, textX + 75, y + 64);

            // Move to next row after second column
            if (col === 1) {
                y += cardHeight;
            }
        });

        doc.end();

        stream.on('finish', () => resolve(outputFile));
        stream.on('error', reject);
    });
}

async function main() {
    console.log('='.repeat(50));
    console.log('  EMBARKATION LIST GENERATOR');
    console.log('='.repeat(50));
    console.log('\nDump embarkation window data below.');
    console.log('Press Enter twice when done to generate list.\n');
    console.log('-'.repeat(50));

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const lines = [];
    let emptyCount = 0;

    for await (const line of rl) {
        if (line === '') {
            emptyCount++;
            if (emptyCount >= 2) {
                break;
            }
        } else {
            emptyCount = 0;
        }
        lines.push(line);
    }

    rl.close();

    const rawData = lines.join('\n');

    if (!rawData.trim()) {
        console.log('\nNo data entered. Exiting.');
        return;
    }

    console.log('\n' + '-'.repeat(50));
    console.log('Processing...');

    const passengers = extractPassengers(rawData);

    if (passengers.length === 0) {
        console.log('No passengers found. Make sure data contains 9-digit EMB codes.');
        return;
    }

    console.log(`\nFound ${passengers.length} passenger(s) to board:\n`);
    passengers.forEach(p => {
        console.log(`  ${String(p.number).padStart(3)}.  ${p.bcardNo}  |  ${p.bookingNo}  |  ${p.name}`);
    });

    const outputFile = await generatePDF(passengers);
    console.log(`\nBoarding list generated: ${outputFile}`);
    console.log('='.repeat(50));
}

main().catch(console.error);
