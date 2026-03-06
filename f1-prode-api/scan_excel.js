const xlsx = require('xlsx');
const wb = xlsx.readFile('c:/Users/franc/OneDrive/Escritorio/Formula1Prode/Excel al cubo.xlsx');
const sheet = wb.Sheets['Peliculas'];
const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
let dataFound = false;
for (let i = 1; i < json.length; i++) {
    if (json[i].length > 0 && json[i].some(cell => cell !== null && cell !== '')) {
        console.log(`Data found at row ${i + 1}:`, json[i]);
        dataFound = true;
        break;
    }
}
if (!dataFound) console.log('No data found in Peliculas sheet.');

const sheet2 = wb.Sheets['Peliculas_por_ver'];
if (sheet2) {
    const json2 = xlsx.utils.sheet_to_json(sheet2, { header: 1 });
    console.log('Peliculas_por_ver first row:', json2[0]);
    console.log('Peliculas_por_ver row count:', json2.length);
}
