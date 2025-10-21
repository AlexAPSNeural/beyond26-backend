import nodemailer from 'nodemailer';

// Create transporter with GoDaddy SMTP relay settings
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'relay-hosting.secureserver.net',
  port: parseInt(process.env.SMTP_PORT) || 25,
  secure: false, // Use TLS
  auth: {
    user: process.env.SMTP_USER || 'asmith@beyond26advisors.com',
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('Email transporter configuration error:', error);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

/**
 * Send contact form submission email
 */
export async function sendContactEmail(formData) {
  const { name, firm, email, phone, comments } = formData;

  const emailContent = `
<html>
  <head>
    <style>
      body { font-family: Georgia, serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #000000 0%, #2a2a2a 100%); color: white; padding: 30px; text-align: center; }
      .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
      .field { margin-bottom: 20px; }
      .label { font-weight: bold; color: #000; margin-bottom: 5px; }
      .value { color: #555; }
      .footer { text-align: center; padding: 20px; color: #888; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 style="margin: 0; font-size: 28px;">Beyond26 Investment Advisors</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px;">WEBSITE: Message Received</p>
      </div>
      <div class="content">
        <div class="field">
          <div class="label">Name:</div>
          <div class="value">${name}</div>
        </div>
        ${firm ? `
        <div class="field">
          <div class="label">Firm:</div>
          <div class="value">${firm}</div>
        </div>
        ` : ''}
        <div class="field">
          <div class="label">Email:</div>
          <div class="value"><a href="mailto:${email}">${email}</a></div>
        </div>
        ${phone ? `
        <div class="field">
          <div class="label">Phone:</div>
          <div class="value">${phone}</div>
        </div>
        ` : ''}
        <div class="field">
          <div class="label">Message:</div>
          <div class="value" style="white-space: pre-wrap;">${comments}</div>
        </div>
      </div>
      <div class="footer">
        <p>This message was sent via the Beyond26 Advisors website contact form.</p>
      </div>
    </div>
  </body>
</html>
  `.trim();

  const mailOptions = {
    from: `"Beyond26 Website" <${process.env.EMAIL_FROM || 'asmith@beyond26advisors.com'}>`,
    to: [process.env.EMAIL_TO_ALEX || 'asmith@beyond26advisors.com', process.env.EMAIL_TO_EDGAR || 'esmith@beyond26advisors.com'].join(', '),
    replyTo: email,
    subject: 'WEBSITE: Message Received',
    html: emailContent,
    text: `
Name: ${name}
${firm ? `Firm: ${firm}` : ''}
Email: ${email}
${phone ? `Phone: ${phone}` : ''}

Message:
${comments}
    `.trim()
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Contact email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending contact email:', error);
    throw error;
  }
}

/**
 * Send meeting request email
 */
export async function sendMeetingRequestEmail(meetingData) {
  const { advisors, name, email, phone, firm, notes, selectedTimes } = meetingData;

  // Handle both single advisor (legacy) and multiple advisors (new)
  const advisorArray = Array.isArray(advisors) ? advisors : (advisors ? [advisors] : []);
  const advisorNames = advisorArray.map(adv =>
    adv === 'edgar' ? 'Edgar Smith' : 'Alex Smith'
  ).join(' and ');

  // Format the selected times
  const timesHtml = selectedTimes.map((time, index) => `
    <li style="margin-bottom: 10px;">
      <strong>Option ${index + 1}:</strong> ${new Date(time).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Los_Angeles',
        timeZoneName: 'short'
      })}
    </li>
  `).join('');

  const emailContent = `
<html>
  <head>
    <style>
      body { font-family: Georgia, serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #000000 0%, #2a2a2a 100%); color: white; padding: 30px; text-align: center; }
      .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
      .field { margin-bottom: 20px; }
      .label { font-weight: bold; color: #000; margin-bottom: 5px; }
      .value { color: #555; }
      .times { background: #f8f9fa; padding: 20px; border-left: 4px solid #000; margin: 20px 0; }
      .times ul { list-style: none; padding: 0; margin: 0; }
      .footer { text-align: center; padding: 20px; color: #888; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 style="margin: 0; font-size: 28px;">Beyond26 Investment Advisors</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px;">WEBSITE: Meeting Requested</p>
      </div>
      <div class="content">
        <div class="field">
          <div class="label">Meeting With:</div>
          <div class="value">${advisorNames || 'Not specified'}</div>
        </div>
        <div class="field">
          <div class="label">Requested By:</div>
          <div class="value">${name}</div>
        </div>
        <div class="field">
          <div class="label">Email:</div>
          <div class="value"><a href="mailto:${email}">${email}</a></div>
        </div>
        ${firm ? `
        <div class="field">
          <div class="label">Firm:</div>
          <div class="value">${firm}</div>
        </div>
        ` : ''}
        ${phone ? `
        <div class="field">
          <div class="label">Phone:</div>
          <div class="value">${phone}</div>
        </div>
        ` : ''}
        <div class="times">
          <div class="label" style="margin-bottom: 15px;">Suggested Meeting Times:</div>
          <ul>
            ${timesHtml}
          </ul>
        </div>
        ${notes ? `
        <div class="field">
          <div class="label">Notes:</div>
          <div class="value" style="white-space: pre-wrap;">${notes}</div>
        </div>
        ` : ''}
      </div>
      <div class="footer">
        <p>Please reply to this email to confirm one of the suggested times or propose an alternative.</p>
        <p>This request was sent via the Beyond26 Advisors website.</p>
      </div>
    </div>
  </body>
</html>
  `.trim();

  const mailOptions = {
    from: `"Beyond26 Website" <${process.env.EMAIL_FROM || 'asmith@beyond26advisors.com'}>`,
    to: [process.env.EMAIL_TO_ALEX || 'asmith@beyond26advisors.com', process.env.EMAIL_TO_EDGAR || 'esmith@beyond26advisors.com'].join(', '),
    replyTo: email,
    subject: 'WEBSITE: Meeting Requested',
    html: emailContent,
    text: `
Meeting With: ${advisorNames || 'Not specified'}
Requested By: ${name}
Email: ${email}
${firm ? `Firm: ${firm}` : ''}
${phone ? `Phone: ${phone}` : ''}

Suggested Meeting Times:
${selectedTimes.map((time, index) => `${index + 1}. ${time}`).join('\n')}

${notes ? `Notes:\n${notes}` : ''}
    `.trim()
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Meeting request email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending meeting request email:', error);
    throw error;
  }
}

export default {
  sendContactEmail,
  sendMeetingRequestEmail
};
