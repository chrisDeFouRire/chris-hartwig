ALTER TABLE subscriptions 
ADD COLUMN confirmed_at TEXT,
ADD COLUMN confirm_token TEXT;