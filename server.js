const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const SPREADSHEET_ID = '1XzVtrpSDP2D9A4BIRpsWfx-TMk70frorH9qvERXyWQ0'; // Replace with your actual Spreadsheet ID
const keys = require('./config/credentials.json');

const client = new google.auth.JWT(
    keys.client_email,
    null,
    keys.private_key.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({ version: 'v4', auth: client });

client.authorize((err) => {
    if (err) {
        console.error('Error authorizing JWT:', err);
        process.exit(1); // Exit if authorization fails
    } else {
        console.log('Successfully authorized JWT');
    }
});

// Map units to row numbers
function getRowForUnit(unitNumber) {
    const unitsRowMap = {
        "554": 2, "226": 3, // AB Express
        "981": 4, "916": 5, "809": 6, "799": 7, "798": 8, "500_CT": 9, "400": 10, "122": 11,
        "121": 12, "120": 13, "119": 14, "118": 15, "117": 16, "116": 17, "115": 18, "114": 19,
        "113": 20, "112": 21, "111": 22, "110": 23, "109": 24, "108": 25, "107": 26,
        "106": 27, "105": 28, "104": 29, "103": 30, "102": 31, "101": 32, "88": 33,
        "031": 34, "009": 35, // CT Express
        "6273": 36, "5676": 37, "886": 38, "572": 39, "500_PL": 40, "413": 41, "170": 42,
        "89": 43, "25": 44, "20": 45, "007": 46, "006": 47, // Pan Logistics
        "2307": 48, "2304": 49, "2303": 50, "2216": 51, "2215": 52, "2214": 53, "2207": 54,
        "2204": 55, "2202": 56, "2104": 57, "017": 58, "001": 59, // Stratan
        "F-16": 60, "992": 61, "978": 62, "893": 63, "891": 64, "890": 65, "8896": 66,
        "8895": 67, "8894": 68, "8893": 69, "8891": 70, "865": 71, "801": 72, "748": 73,
        "713": 74, "712": 75, "711": 76, "565255": 77, "468818": 78, "468813": 79,
        "454252": 80, "2151": 81, "2043": 82, "1992": 83 // United Trans Logistics
    };
    return unitsRowMap[unitNumber] || null; // Return the row number or null if not found
}

// Endpoint to get tasks from Google Sheets
app.get('/tasks', async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Server!A2:F1000',
        });
        const values = response.data.values;
        if (!values || values.length === 0) {
            console.error('No data found in the specified range.');
            res.json([]); // Return an empty array to the client
            return;
        }
        const tasks = values.map(row => ({
            unitNumber: row[0],
            assignedAgent: row[1],
            status: row[2],
            dueDate: row[3],
            priority: row[4],
            summary: row[5]
        }));
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching data from Google Sheets:', error);
        res.status(500).json({ error: 'Error fetching data' });
    }
});

// Endpoint to add a new task
app.post('/tasks/add', async (req, res) => {
    const { unitNumber, values } = req.body;
    console.log('Incoming add task request:', req.body);

    if (!unitNumber || !values) {
        return res.status(400).json({ error: 'Missing unitNumber or values' });
    }

    // Get the row number for the given unit
    const rowNumber = getRowForUnit(unitNumber);
    if (!rowNumber) {
        return res.status(400).json({ error: `No row found for unit ${unitNumber}` });
    }

    const range = `Server!A${rowNumber}:F${rowNumber}`;

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [values] },
        });

        res.status(200).json({ message: 'Task added successfully' });
    } catch (error) {
        console.error('Error adding data to Google Sheets:', error);
        res.status(500).json({ error: 'Error adding data' });
    }
});

// Endpoint to update an existing task
app.put('/tasks/update', async (req, res) => {
    const { unitNumber, values } = req.body;
    console.log('Incoming update task request:', req.body);

    if (!unitNumber || !values) {
        return res.status(400).json({ error: 'Missing unitNumber or values' });
    }

    // Get the row number for the given unit
    const rowNumber = getRowForUnit(unitNumber);
    if (!rowNumber) {
        return res.status(400).json({ error: `No row found for unit ${unitNumber}` });
    }

    const range = `Server!A${rowNumber}:F${rowNumber}`;

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [values] },
        });

        res.status(200).json({ message: 'Task updated successfully' });
    } catch (error) {
        console.error('Error updating data in Google Sheets:', error);
        res.status(500).json({ error: 'Error updating data' });
    }
});

// Endpoint to delete a task
app.delete('/tasks/delete/:unitNumber', async (req, res) => {
    const unitNumber = req.params.unitNumber;
    console.log(`Incoming delete task request for unit ${unitNumber}`);

    // Get the row number for the given unit
    const rowNumber = getRowForUnit(unitNumber);
    if (!rowNumber) {
        return res.status(400).json({ error: `No row found for unit ${unitNumber}` });
    }

    const range = `Server!A${rowNumber}:F${rowNumber}`;

    // Create an array of empty strings to clear the row
    const emptyValues = ['', '', '', '', '', ''];

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [emptyValues] },
        });

        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting data in Google Sheets:', error);
        res.status(500).json({ error: 'Error deleting data' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});