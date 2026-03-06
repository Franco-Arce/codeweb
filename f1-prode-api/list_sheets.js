const xlsx = require('xlsx');
const wb = xlsx.readFile('c:/Users/franc/OneDrive/Escritorio/Formula1Prode/Excel al cubo.xlsx');
console.log('Sheet Names:', wb.SheetNames);
