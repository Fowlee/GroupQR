# GroupQR — QR Code Embarkation Generator

A small internal tool built for **Go Nordic Cruiseline** to speed up embarkation
check-in for passenger groups. Staff paste raw booking/embarkation data, and
the tool extracts each passenger's details and generates a scannable,
print-ready QR code card for boarding.

## Why it exists

Embarkation staff previously cross-checked passenger lists by hand against
paper manifests — slow and error-prone during high-volume group boarding.
This tool turns a block of pasted embarkation data into a sorted, searchable,
printable set of passenger cards with a QR code per passenger (encoding their
Bcard number) in a couple of seconds.

## Stack

- **Frontend**: static HTML/CSS/JS (no framework, no build step) — runs
  entirely client-side in the browser using a vendored copy of
  [`qrcode.js`](qrcode.min.js) for QR rendering.
- **CLI**: a small Node.js script (`index.js`) using
  [`qrcode`](https://www.npmjs.com/package/qrcode) and
  [`pdfkit`](https://www.npmjs.com/package/pdfkit) to generate a printable PDF
  version of the same passenger list.
- No backend, no database, no network calls — all data stays local to
  whoever is running the tool.

## How the QR generation works

1. **Parsing** — pasted embarkation text is scanned with regex to pull out:
   - 9-digit **Bcard numbers** (`\b\d{9}\b`)
   - 6-digit **booking numbers** (`\b\d{6}\b`)
   - passenger **names**, matched as all-caps word groups at the end of each
     line (e.g. `ENGSTRØM LARS`)
   - optional 4-letter **port codes** on their own line

   These are paired up positionally into passenger records.
2. **QR encoding** — each passenger's Bcard number is encoded into a QR code
   (the value staff scan at the gate to pull up that passenger's booking).
3. **Rendering** — passengers are laid out as ID-card-sized blocks (QR code +
   name + Bcard/booking/port) in a two-column grid, sized for
   `85.6mm × 54mm` (standard card size) when printed.
4. **Output** — either printed straight from the browser (`window.print()`
   with dedicated print CSS), or generated as a paginated PDF via the CLI.

## Running locally

### Browser tool (interactive, print-from-browser)

Just open [index.html](index.html) directly in a browser — no server or
build step required. Paste embarkation data into the text area, click
**Generate List**, then **Print**.

### CLI tool (PDF export)

```bash
npm install
npm start
```

Paste the embarkation data into the terminal, press **Enter twice** to
finish input, and a `boarding_list.pdf` file is generated in the project
root.

## Notes on this repo

- `logo.png` (Go Nordic Cruiseline branding) and any generated
  `boarding_list.pdf` are intentionally excluded from version control (see
  [.gitignore](.gitignore)) since they can contain real company branding or
  real passenger data. Drop your own `logo.png` in the project root to
  restore the branded header.
- This is a demo/portfolio copy of an internal tool — no live passenger data
  or credentials are included anywhere in this repository.
