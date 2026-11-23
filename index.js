require('dotenv').config({ quiet: true });
const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// Credentials stay in the ignored .env file, never in source control.
const hubspot = axios.create({
    baseURL: 'https://api.hubapi.com',
    timeout: 15000,
    headers: { Authorization: `Bearer ${process.env.PRIVATE_APP_ACCESS}` }
});
const objectPath = '/crm/v3/objects/2-257084201';
const fields = ['name', 'species', 'light_level'];
const formTitle = 'Update Custom Object Form | Integrating With HubSpot I Practicum';

// GET / reads all pages of Plants and passes the records to the table.
app.get('/', async (req, res) => {
    try {
        const data = [];
        let after;
        do {
            const response = await hubspot.get(objectPath, {
                params: { properties: fields.join(','), limit: 100, after }
            });
            data.push(...response.data.results);
            after = response.data.paging?.next?.after;
        } while (after);
        res.render('homepage', { title: 'Plants | Integrating With HubSpot I Practicum', data });
    } catch (error) {
        // Do not log the Axios error object: it contains the Authorization header.
        console.error('Read Plants failed:', error.response?.status || error.code);
        res.status(502).send('Unable to load Plants. Check your connection and try again.');
    }
});

// GET displays the form; it does not create records.
app.get('/update-cobj', (req, res) => {
    res.render('updates', { title: formTitle, values: {}, error: null });
});

// POST creates a record, then redirects to the updated homepage.
app.post('/update-cobj', async (req, res) => {
    const properties = {};
    for (const field of fields) {
        properties[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : '';
    }
    if (fields.some(field => !properties[field] || properties[field].length > 200)) {
        return res.status(400).render('updates', {
            title: formTitle, values: properties, error: 'Complete all fields using 1 to 200 characters.'
        });
    }
    try {
        await hubspot.post(objectPath, { properties });
        res.redirect(303, '/');
    } catch (error) {
        console.error('Create Plant failed:', error.response?.status || error.code);
        res.status(502).render('updates', {
            title: formTitle, values: properties,
            error: 'Creation could not be confirmed. Check the homepage before trying again.'
        });
    }
});

if (require.main === module) {
    if (!process.env.PRIVATE_APP_ACCESS) {
        console.error('Set PRIVATE_APP_ACCESS in your local .env file.');
        process.exit(1);
    }
    app.listen(3000, '127.0.0.1', () => console.log('Listening on http://localhost:3000'));
}
module.exports = app;
