-- Customer link forms define an omitted/blank visit limit as unlimited.
-- Do not silently inherit a hidden platform click cap that contradicts that UI contract.
INSERT INTO system_settings(setting_key,setting_value,is_encrypted)
VALUES('links.default_click_limit','0',FALSE)
ON DUPLICATE KEY UPDATE setting_value='0',is_encrypted=FALSE;
