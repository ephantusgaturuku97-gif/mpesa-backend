const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Your credentials from Safaricom Developer Portal
const CONSUMER_KEY = process.env.CONSUMER_KEY || 'YOUR_CONSUMER_KEY';
const CONSUMER_SECRET = process.env.CONSUMER_SECRET || 'YOUR_CONSUMER_SECRET';
const BUSINESS_SHORT_CODE = '174379'; // Sandbox shortcode
const PASSKEY = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const CALLBACK_URL = process.env.CALLBACK_URL || 'https://your-app.onrender.com/api/mpesa/callback';

// Get OAuth Token
async function getAccessToken() {
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    try {
        const response = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            { headers: { Authorization: `Basic ${auth}` } }
        );
        return response.data.access_token;
    } catch (error) {
        console.error('Token error:', error.response?.data || error.message);
        throw error;
    }
}

// STK Push Endpoint
app.post('/api/mpesa/stk-push', async (req, res) => {
    const { phoneNumber, amount } = req.body;

    if (!phoneNumber || !amount) {
        return res.status(400).json({ error: 'Phone number and amount are required' });
    }

    // Format phone number to 254XXXXXXXXX
    let formattedPhone = phoneNumber.toString().replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('7')) {
        formattedPhone = '254' + formattedPhone;
    }

    if (!formattedPhone.match(/^254[17]\d{8}$/)) {
        return res.status(400).json({ error: 'Invalid phone number format' });
    }

    try {
        const accessToken = await getAccessToken();
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const password = Buffer.from(`${BUSINESS_SHORT_CODE}${PASSKEY}${timestamp}`).toString('base64');

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
            AccountReference: `DISCORD-${Date.now()}`,
            TransactionDesc: 'Discord Lifetime Membership'
        };

        const response = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            requestBody,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        console.log('STK Push Response:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('STK Push Error:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data || 'Payment initiation failed' });
    }
});

// Callback Endpoint (M-PESA sends confirmation here)
app.post('/api/mpesa/callback', (req, res) => {
    console.log('Callback received:', JSON.stringify(req.body, null, 2));
    
    const resultCode = req.body.Body?.stkCallback?.ResultCode;
    
    if (resultCode === '0') {
        const amount = req.body.Body?.stkCallback?.CallbackMetadata?.Item?.find(i => i.Name === 'Amount')?.Value;
        const phone = req.body.Body?.stkCallback?.CallbackMetadata?.Item?.find(i => i.Name === 'PhoneNumber')?.Value;
        const transactionId = req.body.Body?.stkCallback?.CallbackMetadata?.Item?.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
        
        console.log(`Payment successful: ${transactionId} - ${phone} paid KES ${amount}`);
        // Here you can add code to send email to you or save to database
    } else {
        console.log(`Payment failed: ${req.body.Body?.stkCallback?.ResultDesc}`);
    }
    
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'M-PESA Backend is running', endpoints: ['/api/mpesa/stk-push', '/api/mpesa/callback'] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));