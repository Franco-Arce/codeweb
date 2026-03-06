import fs from 'fs';

async function getGroup() {
    const url = "https://7103.api.greenapi.com/waInstance7103523905/getContacts/31a3b591e91b48e0adef98fb205b06f64e25920d7cbe402dbe";
    try {
        const res = await fetch(url);
        const data = await res.json();
        const groups = data.filter((c: any) => c.id.endsWith('@g.us'));
        const matches = groups.filter((g: any) => g.name && g.name.toLowerCase().includes('nestor') || g.name && g.name.toLowerCase().includes('fede'));
        console.log("Found matching groups:", matches);
    } catch (e) {
        console.error(e);
    }
}

getGroup();
