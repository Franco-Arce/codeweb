const xlsx = require('xlsx');
const wb = xlsx.readFile('c:/Users/franc/OneDrive/Escritorio/Formula1Prode/Excel al cubo.xlsx');
const sheet = wb.Sheets['Peliculas'];
const data = xlsx.utils.sheet_to_json(sheet);
console.log('Sheet records:', data.length);
if (data.length > 0) {
    console.log('Sample record:', data[0]);
} else {
    // Check if it has any ref
    console.log('Sheet Range:', sheet['!ref']);
}
