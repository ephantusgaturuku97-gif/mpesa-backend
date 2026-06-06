const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const CONSUMER_KEY = process.env.CONSUMER_KEY || 'tpUPPjzbvO3klmen3mcR3o4gKRioaxPsJ7me';
const CONSUMER_SECRET = process.env.CONSUMER_SECRET || 'aTYXLipMKfZAYQNYyhzvrmKnAlZsEXsgzUv';
const BUSINESS_SHORT_CODE = '174379';
const PASSKEY = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const CALLBACK_URL = 'https://mpesa-backend.onrender.com/api/mpesa/callback';

async function getAccessToken() {
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    const response = await axios.get(
        'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        { headers: { Authorization: `Basic ${auth}` } }
    );
    return response.data.access_token;
}

app.post('/api/mpesa/stk-push', async (req, res) => {
    try {
        const { phoneNumber, amount } = req.body;
        
        if (!phoneNumber || !amount) {
            return res.status(400).json({ error: 'Phone number and amount required' });
        }
        
        let formattedPhone = phoneNumber.toString().replace(/\D/g, '');
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '254' + formattedPhone.substring(1);
        } else if (formattedPhone.startsWith('7')) {
            formattedPhone = '254' + formattedPhone;
        }
        
        const accessToken = await getAccessToken();
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const password = Buffer.from(BUSINESS_SHORT_CODE + PASSKEY + timestamp).toString('base64');
        
        const requestBody = {
            BusinessShortCode: BUSINESS_SHORT_CODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.round(amount),
            PartyA: formattedPhone,
            PartyB: BUSINESS_SHORT_CODE,
            PhoneNumber: formattedPhone,
            CallBackURL: CALLBACK_URL,
            AccountReference: 'DISCORD' + Date.now(),
            TransactionDesc: 'Discord Premium'
        };
        
        const response = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            requestBody,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        res.json(response.data);
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/mpesa/callback', (req, res) => {
    console.log('Callback received');
    res.json({ ResultCode: 0 });
});

app.get('/', (req, res) => {
    res.json({ status: 'M-PESA Backend Running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
