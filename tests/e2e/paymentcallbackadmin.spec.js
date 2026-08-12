const {test,expect}=require('@playwright/test');

const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4180';

async function adminLogin(page){
  await page.goto(base+'/admin/');
  await page.getByLabel('管理员邮箱').fill('owner@example.test');
  await page.getByLabel('密码').fill('OwnerPassword!2026');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.getByText('平台概览',{exact:true}).first()).toBeVisible();
}

test('administrator billing shows a real rejected payment callback event',async({page,request})=>{
  const requestID='browsercallbackreject0001';
  const merchantOrder='BROWSERCALLBACKOBSERVE';
  const probe=await request.fetch(base+'/api/payments/epay/notify',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded','X-Request-ID':requestID},
    data:`pid=1000&out_trade_no=${merchantOrder}&sign=00000000000000000000000000000000&sign_type=MD5`
  });
  expect(probe.status()).toBeGreaterThanOrEqual(400);

  await adminLogin(page);
  await page.getByRole('button',{name:'套餐与账单',exact:true}).click();
  await expect(page.getByRole('heading',{name:'最近支付回调',exact:true})).toBeVisible();

  const row=page.locator('#content tr').filter({hasText:merchantOrder}).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText('EPAY');
  await expect(row).toContainText('已拒绝');
  await expect(row).toContainText(requestID);
  await expect(row).toContainText(merchantOrder);
});
