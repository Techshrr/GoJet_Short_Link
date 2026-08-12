-- Keep one canonical website logo and one browser icon.
-- Mail, PDF, public pages and consoles all consume brand.logo_url.
-- These legacy slots had no independent runtime consumer and created divergent brand state.
DELETE FROM system_settings
WHERE setting_key IN (
  'brand.logo_dark_url',
  'brand.logo_light_url',
  'brand.logo_square_url',
  'brand.apple_touch_icon_url',
  'brand.pwa_icon_url',
  'brand.share_image_url',
  'brand.login_image_url',
  'brand.mail_logo_url'
);
