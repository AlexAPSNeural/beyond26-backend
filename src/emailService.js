/**
 * Email Service using Resend
 *
 * Resend is a reliable email API service that works from any server.
 * No SMTP issues, no IP blocking, no GoDaddy/Office365 restrictions.
 *
 * Setup: https://resend.com/signup
 * 1. Sign up for free account
 * 2. Get API key from https://resend.com/api-keys
 * 3. Add domain at https://resend.com/domains and verify DNS
 * 4. Set RESEND_API_KEY in Render environment variables
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_FROM = process.env.EMAIL_FROM || 'asmith@beyond26advisors.com';
const EMAIL_TO_ALEX = process.env.EMAIL_TO_ALEX || 'asmith@beyond26advisors.com';
const EMAIL_TO_EDGAR = process.env.EMAIL_TO_EDGAR || 'esmith@beyond26advisors.com';

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
        <p style="margin: 10px 0 0 0; font-size: 16px;">Message Received</p>
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

  try {
    const { data, error } = await resend.emails.send({
      from: `Beyond26 Website <${EMAIL_FROM}>`,
      to: [EMAIL_TO_ALEX, EMAIL_TO_EDGAR],
      replyTo: email,
      subject: 'WEBSITE: Message Received',
      html: emailContent,
    });

    if (error) {
      console.error('❌ Resend error:', error);
      throw new Error(error.message || 'Failed to send email');
    }

    console.log('✅ Contact email sent via Resend:', data.id);
    return { success: true, emailId: data.id };
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
        <p style="margin: 10px 0 0 0; font-size: 16px;">Meeting Requested</p>
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

  try {
    const { data, error } = await resend.emails.send({
      from: `Beyond26 Website <${EMAIL_FROM}>`,
      to: [EMAIL_TO_ALEX, EMAIL_TO_EDGAR],
      replyTo: email,
      subject: 'WEBSITE: Meeting Requested',
      html: emailContent,
    });

    if (error) {
      console.error('❌ Resend error:', error);
      throw new Error(error.message || 'Failed to send email');
    }

    console.log('✅ Meeting request email sent via Resend:', data.id);
    return { success: true, emailId: data.id };
  } catch (error) {
    console.error('❌ Error sending meeting request email:', error);
    throw error;
  }
}

export default {
  sendContactEmail,
  sendMeetingRequestEmail
};
