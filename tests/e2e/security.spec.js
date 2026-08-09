const{test,expect}=require('@playwright/test');
test('public pages emit no inline executable user content',async({page})=>{await page.goto('/products/url-shortener/');await expect(page.locator('script:not([src])')).toHaveCount(0);await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0)});
test('unknown public path remains available to redirect plane in deployment config',async()=>{const fs=require('fs');const config=fs.readFileSync('deploy/nginx/gojet.conf','utf8');expect(config).toContain('try_files $uri $uri/ @redirect');expect(config).toContain('location @redirect')});
