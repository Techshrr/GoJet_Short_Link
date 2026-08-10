const { test, expect } = require('@playwright/test');

const base='http://127.0.0.1:4173';

test('public abuse report page submits through the real product route',async({page})=>{
  await page.goto(base+'/report-abuse/?url=https%3A%2F%2Fgojet.cc%2Fbad-link');
  await expect(page.getByRole('heading',{name:'举报滥用链接'})).toBeVisible();
  await expect(page.getByLabel('被举报的 GoJet 短链接')).toHaveValue('https://gojet.cc/bad-link');
  await page.getByLabel('举报原因').selectOption('phishing');
  await page.getByLabel('联系邮箱（可选）').fill('reporter@example.test');
  await page.getByLabel('补充说明（可选）').fill('该链接展示疑似仿冒登录页面。');
  const requestPromise=page.waitForRequest(req=>req.url().endsWith('/api/public/abuse-reports')&&req.method()==='POST');
  await page.getByRole('button',{name:'提交举报'}).click();
  const request=await requestPromise;
  const payload=request.postDataJSON();
  expect(payload.url).toBe('https://gojet.cc/bad-link');
  expect(payload.reason).toBe('phishing');
  expect(payload.reporter_email).toBe('reporter@example.test');
  await expect(page.getByText(/举报已提交，参考编号 #42/)).toBeVisible();
});

test('abuse report page exposes trust-and-safety context without authentication',async({page})=>{
  await page.goto(base+'/report-abuse/');
  await expect(page.getByText('TRUST & SAFETY',{exact:true})).toBeVisible();
  await expect(page.getByText(/安全审核队列/)).toBeVisible();
  await expect(page.getByRole('button',{name:'提交举报'})).toBeVisible();
});
