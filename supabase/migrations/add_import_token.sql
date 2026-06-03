-- Voeg api_token kolom toe aan user_settings
-- Wordt gebruikt door de import-invoice Edge Function om de gebruiker te identificeren vanuit Make

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS api_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_user_settings_api_token
  ON user_settings(api_token)
  WHERE api_token IS NOT NULL;
