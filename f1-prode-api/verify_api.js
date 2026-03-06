const fetch = require('node-fetch');

async function verifyAll() {
    const API_URL = 'http://localhost:3001';

    console.log('1. Testing User List (Dynamic Dropdown Support)...');
    try {
        const res = await fetch(`${API_URL}/api/users/list`);
        const data = await res.json();
        console.log('User list:', data);
    } catch (e) {
        console.error('User list failed:', e.message);
    }

    console.log('\n2. Testing Real Auth (should return 401 for bad creds)...');
    try {
        const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'non_existent', password: 'wrong' })
        });
        const data = await res.json();
        console.log('Login response (expected 401):', res.status, data);
    } catch (e) {
        console.error('Login test failed:', e.message);
    }

    process.exit(0);
}

verifyAll();
