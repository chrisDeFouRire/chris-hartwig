-- Create newsletter_sends table for auditability and idempotency
CREATE TABLE IF NOT EXISTS newsletter_sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL,
    issue_number INTEGER NOT NULL,
    sent_at INTEGER NOT NULL,
    postmark_message_id TEXT,
    last_error TEXT,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
    UNIQUE(subscription_id, issue_number)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_subscription_issue ON newsletter_sends(subscription_id, issue_number);
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_issue ON newsletter_sends(issue_number);
