-- Change date columns from TEXT to INTEGER (seconds since epoch)
-- Since there are no existing records, we can safely recreate the table
DROP TABLE IF EXISTS subscriptions;

CREATE TABLE
	subscriptions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT UNIQUE NOT NULL,
		subscribed_at INTEGER NOT NULL,
		unsubscribed_at INTEGER,
		latest_newsletter_sent INTEGER,
		confirmed_at INTEGER,
		confirm_token TEXT,
		number_of_issues_received INTEGER DEFAULT 0
	);