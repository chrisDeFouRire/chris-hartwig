import { Models, ServerClient } from 'postmark';
import type { WorkerEnv } from '../types/worker';
import { WorkflowEntrypoint } from 'cloudflare:workers';
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

interface NewsletterParams {
  issueNumber: number;
  dryRun?: boolean;
  limit?: number;
}

interface SubscriptionRow {
  id: number;
  email: string;
  name: string | null;
  latest_newsletter_sent: number | null;
}

interface PostmarkOutboundMessage {
  MessageID: string;
  Recipient: string;
  Tag: string;
  SubmittedAt: string;
}

interface PostmarkOutboundResponse {
  TotalCount: number;
  Messages: PostmarkOutboundMessage[];
}

export class SendNewsletterIssue extends WorkflowEntrypoint<WorkerEnv, NewsletterParams> {
  async run(event: WorkflowEvent<NewsletterParams>, step: WorkflowStep): Promise<unknown> {
    const { issueNumber, dryRun = false, limit } = event.payload;

    console.log(`Starting newsletter send for issue ${issueNumber}`, { dryRun, limit });

    // Step 1: Load issue HTML from ASSETS (email template includes unsubscribe link)
    const htmlContent = await step.do<string>('load-issue-html', async () => {
      const emailPath = `/newsletter/email/${issueNumber}/`;
      const request = new Request(`${this.env.CANONICAL_URL}${emailPath}`);

      try {
        const response = await this.env.ASSETS.fetch(request);
        if (!response.ok) {
          throw new Error(`Failed to fetch issue HTML: ${response.status} ${response.statusText}`);
        }
        const html = await response.text();
        if (!html || html.trim().length === 0) {
          throw new Error(`Issue HTML is empty for issue ${issueNumber}`);
        }
        return html;
      } catch (error) {
        console.error('Error loading issue HTML:', error);
        throw new Error(`Could not load HTML for issue ${issueNumber}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // Step 2: Get issue metadata (title, description) for email subject
    const issueMetadata = await step.do<{ issueNumber: number; title: string; description: string; webUrl: string }>('load-issue-metadata', async () => {
      const issuesPath = '/newsletter/issues.json';
      const request = new Request(`${this.env.CANONICAL_URL}${issuesPath}`);

      try {
        const response = await this.env.ASSETS.fetch(request);
        if (!response.ok) {
          throw new Error(`Failed to fetch issues metadata: ${response.status}`);
        }
        const data: { issues: Array<{ issueNumber: number; title: string; description: string; webUrl: string }> } = await response.json();
        const issue = data.issues.find((i) => i.issueNumber === issueNumber);
        if (!issue) {
          throw new Error(`Issue ${issueNumber} not found in metadata`);
        }
        return issue;
      } catch (error) {
        console.error('Error loading issue metadata:', error);
        throw new Error(`Could not load metadata for issue ${issueNumber}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // Step 3: Get recipients who haven't received this issue
    const recipients = await step.do<SubscriptionRow[]>('get-recipients', async () => {
      const query = `
        SELECT id, email, name, latest_newsletter_sent
        FROM subscriptions
        WHERE unsubscribed_at IS NULL
          AND confirmed_at IS NOT NULL
          AND (latest_newsletter_sent IS NULL OR latest_newsletter_sent < ?)
        ORDER BY id ASC
        ${limit ? `LIMIT ?` : ''}
      `;

      const stmt = limit
        ? this.env.DB.prepare(query).bind(issueNumber, limit)
        : this.env.DB.prepare(query.replace('LIMIT ?', '')).bind(issueNumber);

      const result = await stmt.all<SubscriptionRow>();
      return result.results || [];
    });

    console.log(`Found ${recipients.length} recipients for issue ${issueNumber}`);

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        issueNumber,
        recipientsCount: recipients.length,
        recipients: recipients.map((r) => ({ id: r.id, email: r.email, name: r.name })),
      };
    }

    // Step 4: Read Postmark token (must be serializable when returned from a step)
    const postmarkApiToken = await step.do<string>('get-postmark-token', async () => {
      if (!this.env.POSTMARK_API_TOKEN) {
        throw new Error('POSTMARK_API_TOKEN is not configured');
      }
      return this.env.POSTMARK_API_TOKEN;
    });

    // Step 5: Send email to each recipient (one durable step per user)
    const results = [];
    for (const recipient of recipients) {
      const sendResult = await step.do(`send:${recipient.id}`, async () => {
        // Re-check recipient status (in case updated by concurrent run)
        const currentRecipient = await this.env.DB.prepare(
          'SELECT id, email, name, latest_newsletter_sent FROM subscriptions WHERE id = ? AND unsubscribed_at IS NULL AND confirmed_at IS NOT NULL'
        ).bind(recipient.id).first<SubscriptionRow>();

        if (!currentRecipient) {
          console.log(`Skipping recipient ${recipient.id} - no longer eligible`);
          return { skipped: true, reason: 'no_longer_eligible', recipientId: recipient.id };
        }

        const postmarkClient = new ServerClient(postmarkApiToken);

        // Check if already sent via Postmark search (idempotency)
        const tag = `newsletter-issue-${issueNumber}`;
        try {
          const searchUrl = `https://api.postmarkapp.com/messages/outbound?recipient=${encodeURIComponent(currentRecipient.email)}&tag=${encodeURIComponent(tag)}&count=1`;
          const searchResponse = await fetch(searchUrl, {
            headers: {
              'Accept': 'application/json',
              'X-Postmark-Server-Token': postmarkApiToken,
            },
          });

          if (searchResponse.ok) {
            const searchData = await searchResponse.json<PostmarkOutboundResponse>();
            if (searchData.TotalCount > 0 && searchData.Messages.length > 0) {
              console.log(`Email already sent to ${currentRecipient.email} for issue ${issueNumber}`);
              // Idempotent DB update: only bump counters if this issue wasn't already recorded
              await this.env.DB.prepare(
                `UPDATE subscriptions
                 SET latest_newsletter_sent = CASE
                   WHEN latest_newsletter_sent IS NULL OR latest_newsletter_sent < ? THEN ?
                   ELSE latest_newsletter_sent
                 END,
                 number_of_issues_received = CASE
                   WHEN latest_newsletter_sent IS NULL OR latest_newsletter_sent < ? THEN number_of_issues_received + 1
                   ELSE number_of_issues_received
                 END
                 WHERE id = ?`
              ).bind(issueNumber, issueNumber, issueNumber, recipient.id).run();
              return { skipped: true, reason: 'already_sent', recipientId: recipient.id, email: currentRecipient.email };
            }
          }
        } catch (error) {
          console.warn(`Postmark search failed for ${currentRecipient.email}, continuing anyway:`, error);
          // Continue with send attempt
        }

        // Send email via Postmark
        try {
          const greeting = currentRecipient.name ? `Hi ${currentRecipient.name},` : 'Hi,';
          const textBody = `${greeting}\n\n${issueMetadata.title}\n\n${issueMetadata.description}\n\nRead online: ${issueMetadata.webUrl}\n\n---\nYou're receiving this because you subscribed to the Vibe Software Engineering newsletter.\nUnsubscribe: ${this.env.CANONICAL_URL}/unsubscribe`;

          const sendResult = await postmarkClient.sendEmail({
            From: 'chris@chris-hartwig.com',
            To: currentRecipient.email,
            Subject: `${issueMetadata.title} | Newsletter Issue #${issueNumber}`,
            HtmlBody: htmlContent,
            TextBody: textBody,
            Tag: tag,
            TrackOpens: false,
            TrackLinks: Models.LinkTrackingOptions.None,
          });

          // Idempotent DB update: workflow retries/replays shouldn't double-increment.
          await this.env.DB.prepare(
            `UPDATE subscriptions
             SET latest_newsletter_sent = CASE
               WHEN latest_newsletter_sent IS NULL OR latest_newsletter_sent < ? THEN ?
               ELSE latest_newsletter_sent
             END,
             number_of_issues_received = CASE
               WHEN latest_newsletter_sent IS NULL OR latest_newsletter_sent < ? THEN number_of_issues_received + 1
               ELSE number_of_issues_received
             END
             WHERE id = ?`
          ).bind(issueNumber, issueNumber, issueNumber, recipient.id).run();

          console.log(`Successfully sent email to ${currentRecipient.email} (MessageID: ${sendResult.MessageID})`);
          return {
            success: true,
            recipientId: recipient.id,
            email: currentRecipient.email,
            messageId: sendResult.MessageID,
          };
        } catch (error) {
          console.error(`Failed to send email to ${currentRecipient.email}:`, error);
          throw new Error(`Failed to send email to ${currentRecipient.email}: ${error instanceof Error ? error.message : String(error)}`);
        }
      });

      results.push(sendResult);
    }

    const successful = results.filter((r) => r.success === true).length;
    const skipped = results.filter((r) => r.skipped === true).length;
    const failed = results.length - successful - skipped;

    return {
      success: true,
      issueNumber,
      totalRecipients: recipients.length,
      successful,
      skipped,
      failed,
      results,
    };
  }
}
