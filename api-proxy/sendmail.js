export const handler = async (context, event, callback) => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };
      if (event.httpMethod === 'OPTIONS') {
        return callback(null, { statusCode: 204, headers, body: '' });
      }
  
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event;
      const subject =
        body.subject ||
        (body.personalizations?.[0]?.subject ?? '');
  
      body.custom_args = {
        ...(body.custom_args || {}),
        email_subject: subject.slice(0, 512),
      };
      body.personalizations = (body.personalizations || []).map((p) => ({
        ...p,
        custom_args: {
          ...(p.custom_args || {}),
          email_subject: subject.slice(0, 512),
        },
      }));
  
      const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${context.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
  
      const text = await resp.text();
      return callback(null, {
        statusCode: resp.status,
        headers,
        body: JSON.stringify({ ok: resp.ok, status: resp.status, body: text }),
      });
    } catch (err) {
      return callback(null, {
        statusCode: 500,
        body: JSON.stringify({ error: err.message }),
      });
    }
  };