import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import axios from 'axios';

dotenv.config();

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;
const SMTP_USERNAME = 'apikey'; // usually "apikey"
const SMTP_PASSWORD = process.env.SENDGRID_API_KEY; // API key reused for SMTP
const SMTP_HOST = 'smtp.sendgrid.net';
const SMTP_PORT = 587;
const SENDGRID_PROXY_ADDRESS = process.env.SENDGRID_PROXY_ADDRESS;

// -----------------------------
// Send email using SendGrid Web API (v3)
// -----------------------------
export async function sendEmailViaAPI(to, subject, htmlContent) {
  try {
    sgMail.setApiKey(SENDGRID_API_KEY);

    const msg = {
      to,
      from: FROM_EMAIL,
      subject,
      html: htmlContent,
    };

    const response = await sgMail.send(msg);
    console.log(`✅ Email sent via API to ${to}`);
    return response;
  } catch (error) {
    console.error('❌ Error sending via API:', error.response?.body || error);
    throw error;
  }
}

// -----------------------------
// Send email using SMTP (via nodemailer)
// -----------------------------
export async function sendEmailViaSMTP(to, subject, htmlContent) {
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      requireTLS: true,
      auth: {
        user: SMTP_USERNAME,
        pass: SMTP_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      html: htmlContent,
    });

    console.log(`✅ Email sent via SMTP to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('❌ Error sending via SMTP:', error);
    throw error;
  }
}

// -----------------------------
// Send email using API Proxy
// -----------------------------
export async function sendEmailViaAPIProxy(to, subject, htmlContent) {
  try {
    const msg = {
      from: {
        email: FROM_EMAIL,
      },
      personalizations: [
        {
          to: [{ email: to }],
          subject,
        },
      ],
      content: [
        {
          type: 'text/html',
          value: htmlContent,
        },
      ],
    };

    const response = await axios.post(SENDGRID_PROXY_ADDRESS, msg,
      {
        headers: { 'Content-Type': 'application/json' },
      });
    console.log(response.data);
    console.log(`✅ Email sent via API Proxy to ${to}`);
    return response;
  } catch (error) {
    console.error('❌ Error sending via API Proxy:', error.response?.body || error);
    throw error;
  }
}

// -----------------------------
// Send email using SMTP (via proxy)
// -----------------------------
export async function sendEmailViaSMTPProxy(to, subject, htmlContent) {
  try {
    const transporter = nodemailer.createTransport({
      host: "localhost",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: 'user1',
        pass: 'supersecret',
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      html: htmlContent,
    });

    console.log(`✅ Email sent via SMTP Proxy to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('❌ Error sending via SMTP Proxy:', error);
    throw error;
  }
}

// -----------------------------
// Usage
// -----------------------------
if (process.argv[2] === 'proxy') {
  const testEmail = process.env.TO_EMAIL;
  const testSubject = 'Sendgrid BCP Testing via Proxy';
  const testHTML = '<h1>Hello from SendGrid!</h1><p>This is a test that went through Proxy.</p>';

  // Test both methods
  (async () => {
    await sendEmailViaAPIProxy(testEmail, testSubject + ' API', testHTML);
    await sendEmailViaSMTPProxy(testEmail, testSubject + ' SMTP', testHTML);
  })();
}

if (process.argv[2] === 'direct') {
  const testEmail = process.env.TO_EMAIL;
  const testSubject = 'Sendgrid BCP Testing via Sendgrid Direct';
  const testHTML = '<h1>Hello from SendGrid!</h1><p>This is a test sent directly.</p>';

  // Test both methods
  (async () => {
    await sendEmailViaAPI(testEmail, testSubject + ' API', testHTML);
    await sendEmailViaSMTP(testEmail, testSubject + ' SMTP', testHTML);
  })();
}