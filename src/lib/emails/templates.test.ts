import { describe, expect, it } from 'vitest';
import { formShareEmail, formShareEmailDefaultMessage } from '@/lib/emails/templates';

describe('formShareEmail', () => {
  it('centres every paragraph in the default sender message', () => {
    const message = formShareEmailDefaultMessage({
      senderName: 'Alex Morgan',
      formName: 'Incident report',
    });

    expect(message.match(/style="text-align: center"/g)).toHaveLength(3);
    expect(message).toContain('Alex Morgan has invited you');
  });

  it('preserves safe rich text while removing executable HTML, attributes and CSS', () => {
    const email = formShareEmail({
      senderName: 'Alex Morgan',
      formName: 'Incident report',
      formUrl: 'https://forms.example.com/f/incident-report',
      message: `
        <p style="text-align: center; color: #123456; position: fixed" onclick="steal()">
          Safe text
          <script>alert('xss')</script>
          <img src="x" onerror="steal()" />
          <a href="javascript:steal()">unsafe link</a>
          <a href="https://example.com" onclick="steal()">safe link</a>
        </p>
      `,
    });

    expect(email.html).toContain('text-align: center');
    expect(email.html).toContain('color: #123456');
    expect(email.html).toContain('href="https://example.com"');
    expect(email.html).not.toMatch(/<script|onclick|onerror|javascript:|position:\s*fixed/i);
  });

  it('escapes names used by the default message', () => {
    const message = formShareEmailDefaultMessage({
      senderName: '<img src=x onerror=steal()>',
      formName: '<script>steal()</script>',
    });

    expect(message).not.toMatch(/<img|<script/i);
    expect(message).toContain('&lt;img');
    expect(message).toContain('&lt;script');
  });
});
