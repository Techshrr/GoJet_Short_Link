const {test,expect}=require('@playwright/test');

const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4180';

test('administrator dashboard renders real analytics trend dimensions and pipeline',async({page})=>{
  await page.goto(base+'/admin/');
  await page.getByLabel('管理员邮箱').fill('owner@example.test');
  await page.getByLabel('密码').fill('OwnerPassword!2026');
  await page.getByRole('button',{name:'登录',exact:true}).click();

  await expect(page.getByRole('heading',{name:'平台概览',exact:true}).last()).toBeVisible();
  await expect(page.getByRole('heading',{name:'最近 30 天访问趋势',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'访问构成',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'分析管道',exact:true})).toBeVisible();

  const today=page.locator('.metric').filter({hasText:'今日点击'}).first();
  await expect(today).toContainText('7');
  await expect(page.locator('.adminTrendBar')).toHaveCount(30);

  for(const title of ['访问来源','国家 / 地区','设备','浏览器']){
    await expect(page.locator('.adminDimension').filter({hasText:title}).first()).toBeVisible();
  }
  await expect(page.locator('.adminDimension').filter({hasText:'访问来源'}).first()).toContainText('referer');
  await expect(page.locator('.adminDimension').filter({hasText:'国家 / 地区'}).first()).toContainText('SG');
  await expect(page.locator('.adminDimension').filter({hasText:'设备'}).first()).toContainText('desktop');
  await expect(page.locator('.adminDimension').filter({hasText:'浏览器'}).first()).toContainText('chrome');

  await expect(page.locator('.adminPipelineGrid article')).toHaveCount(5);
  await expect(page.getByText('实时 + 持久化',{exact:true})).toBeVisible();
  await expect(page.locator('#content')).not.toContainText('正在加载平台数据');
});
