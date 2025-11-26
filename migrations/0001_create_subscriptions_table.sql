CREATE TABLE subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    subscribed_at TEXT NOT NULL,
    unsubscribed_at TEXT,
    latest_newsletter_sent TEXT,
    number_of_issues_received INTEGER DEFAULT 0
);