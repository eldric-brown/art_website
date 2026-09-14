-- 009: 站点 Logo / favicon 配置（默认使用 Artvee 资源，后台可替换）
INSERT OR REPLACE INTO site_content (key, value) VALUES
  ('site.favicon',         'https://mdl.artvee.com/assets/icon-350x350.png'),
  ('site.logo_icon_light', 'https://mdl.artvee.com/assets/logow-4.svg'),
  ('site.logo_icon_dark',  'https://mdl.artvee.com/assets/icon-350x350.png');
