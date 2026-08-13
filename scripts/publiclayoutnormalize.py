#!/usr/bin/env python3
from pathlib import Path


def change(path, old, new):
    p=Path(path); text=p.read_text(encoding='utf-8')
    if text.count(old)!=1:
        raise SystemExit(f'{path}: expected one occurrence, got {text.count(old)}: {old}')
    p.write_text(text.replace(old,new,1),encoding='utf-8')

change('frontend/publicsite/assets/styles.css',
'.container,.wrap{width:min(1180px,calc(100% - 40px));margin:auto}',
'.container,.wrap{width:min(1320px,calc(100% - 56px));margin:auto}')
change('frontend/publicsite/assets/styles.css',
'.nav{height:100%;display:flex;align-items:center;gap:25px}',
'.nav{height:100%;display:flex;align-items:center;gap:28px}.navLinks{display:flex;align-items:center;gap:24px}.navProduct{position:relative}.accountNav{display:flex;align-items:center;gap:12px;margin-left:8px}.accountNav>a:not(.btn){padding:8px 2px}.accountNav .btn{min-height:40px;padding:0 17px}')
change('frontend/publicsite/assets/styles.css',
'.footerGrid,.footer-grid{display:grid;grid-template-columns:1.4fr repeat(4,1fr);gap:30px}',
'.footerGrid,.footer-grid{display:grid;grid-template-columns:1.55fr repeat(4,1fr);gap:36px}.footerBrand p{max-width:360px}.footerBrand strong,.footerBrand small{display:block;margin-top:8px}.footerBrand small{color:#829089;font-size:12px}')
change('frontend/publicsite/assets/styles.css',
'@media(max-width:900px){.nav>a:not(.logo),.nav>button,.nav-links{display:none}',
'@media(max-width:900px){.navLinks,.accountNav{display:none}.nav>a:not(.logo),.nav>button,.nav-links{display:none}')
change('frontend/publicsite/assets/styles.css',
'@media(max-width:560px){.container,.wrap{width:min(100% - 28px,1180px)}',
'@media(max-width:560px){.container,.wrap{width:min(100% - 28px,1320px)}')

home=Path('frontend/publicsite/assets/home.css')
text=home.read_text(encoding='utf-8')
prefix='body{background:#fff;color:var(--mk-ink)}.site-nav{max-width:1200px!important;height:76px!important}.brand{font-size:24px!important;color:#0b1324!important}.brand span{color:var(--mk-green)!important}.nav-links{gap:28px!important}.nav-links a{font-size:13px!important;color:#475467!important}.nav-actions{gap:9px!important}.nav-actions a{border-radius:10px!important}.nav-actions .primary{background:#0b1324!important;color:#fff!important;border-color:#0b1324!important}'
if prefix not in text: raise SystemExit('obsolete homepage shell CSS block not found')
text=text.replace(prefix,'body{background:#fff;color:var(--mk-ink)}',1)
for old,new in [
('.mk-hero{padding:84px 20px 44px', '.mk-hero{padding:76px 24px 52px'),
('max-width:950px;margin:20px auto 18px','max-width:1080px;margin:20px auto 18px'),
('.mk-demo{width:min(860px,calc(100% - 28px))','.mk-demo{width:min(980px,calc(100% - 28px))'),
('.mk-section{max-width:1180px;margin:0 auto;padding:96px 22px}', '.mk-section{max-width:1320px;margin:0 auto;padding:96px 28px}'),
('.mk-cta{max-width:1120px;margin:20px auto 90px', '.mk-cta{max-width:1260px;margin:20px auto 90px'),
('.accountNav{display:flex;align-items:center;gap:9px}', '.accountNav{display:flex;align-items:center;gap:12px}')]:
    if text.count(old)!=1: raise SystemExit(f'home.css occurrence mismatch: {old} -> {text.count(old)}')
    text=text.replace(old,new,1)
home.write_text(text,encoding='utf-8')

page=Path('frontend/publicsite/pages/home.html')
text=page.read_text(encoding='utf-8')
replacements={
'/pricing/':'/pricing',
'/products/qr-code/':'/products/qrcode',
'/products/analytics/':'/products/analytics',
'/products/text-sharing/':'/products/textsharing',
'/products/file-sharing/':'/products/filesharing',
}
for old,new in replacements.items(): text=text.replace(old,new)
page.write_text(text,encoding='utf-8')
print('Public layout and homepage canonical URLs normalized')
