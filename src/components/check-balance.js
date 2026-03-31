const fs = require('fs');
const filepath = 'c:\\Users\\PRASAD\\OneDrive\\Desktop\\hotel\\frontend\\src\\components\\booking-detail-sheet.tsx';

const data = fs.readFileSync(filepath, 'utf8');
const lines = data.split(/\r?\n/);

let divBalance = 0;
let spanBalance = 0;
let buttonBalance = 0;
let sheetContentBalance = 0;
let sheetBalance = 0;

lines.forEach((line, index) => {
    const lineNum = index + 1;
    // Simple count (ignoring strings/comments for now)
    const openDivs = (line.match(/<div/g) || []).length;
    const closeDivs = (line.match(/<\/div/g) || []).length;
    divBalance += openDivs - closeDivs;

    const openSheetContent = (line.match(/<SheetContent/g) || []).length;
    const closeSheetContent = (line.match(/<\/SheetContent/g) || []).length;
    sheetContentBalance += openSheetContent - closeSheetContent;

    const openSheet = (line.match(/<Sheet( |>)/g) || []).length;
    const closeSheet = (line.match(/<\/Sheet>/g) || []).length;
    sheetBalance += openSheet - closeSheet;

    if (lineNum > 800 && lineNum < 820) {
        console.log(`${lineNum}: ${line} | div: ${divBalance}`);
    }
});

console.log('Final Balance:');
console.log('div:', divBalance);
console.log('SheetContent:', sheetContentBalance);
console.log('Sheet:', sheetBalance);
