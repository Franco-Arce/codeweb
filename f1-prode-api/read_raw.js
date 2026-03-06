const xlsx = require('xlsx');
const wb = xlsx.readFile('c:/Users/franc/OneDrive/Escritorio/Formula1Prode/Excel al cubo.xlsx');
const sheet = wb.Sheets['Peliculas'];
const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
console.log('First 5 rows:');
console.log(json.slice(0, 5));
