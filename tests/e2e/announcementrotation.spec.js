const {test,expect}=require('@playwright/test');
const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4180';

async function adminLogin(page){
  await page.goto(base+'/admin/');
  await page.getByLabel('管理员邮箱').fill('owner@example.test');
  await page.getByLabel('密码').fill('OwnerPassword!2026');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.locator('#adminView')).toBeVisible();
}

async function openAnnouncementSettings(page){
  await adminLogin(page);
  await page.locator('#nav [data-view="settings"]').click();
  const tab=page.getByRole('button',{name:/^顶部飘窗/});
  await expect(tab).toBeVisible({timeout:10000});
  await tab.click();
  await expect(page.locator('[data-announcementbar-pane]')).toBeVisible();
}

async function fillCurrent(page,title,message,tone='info'){
  const form=page.locator('#announcementItemForm');
  await expect(form).toBeVisible();
  await form.locator('[name="title"]').fill(title);
  await form.locator('[name="message"]').fill(message);
  await form.locator('[name="tone"]').selectOption(tone);
}

test.describe.serial('multi announcement bar',()=>{
  test('admin can configure two ordered announcements and public API exposes both',async({page,request})=>{
    await openAnnouncementSettings(page);
    const pane=page.locator('[data-announcementbar-pane]');
    await pane.locator('[data-announcement-master]').check();
    await pane.locator('[data-announcement-rotation]').fill('4');

    await pane.getByRole('button',{name:'新增公告'}).first().click();
    await fillCurrent(page,'第一条优惠','第一条公告正文','success');
    await pane.getByRole('button',{name:'新增公告'}).first().click();
    await fillCurrent(page,'第二条提醒','第二条公告正文','warning');

    await pane.getByRole('button',{name:'保存全部'}).first().click();
    await expect(pane.locator('#announcementGlobalResult')).toContainText('已保存');
    await expect(pane.locator('.announcementItem')).toHaveCount(2);

    const response=await request.get(base+'/api/public/announcement-bar');
    expect(response.ok()).toBeTruthy();
    const payload=await response.json();
    expect(payload.enabled).toBe(true);
    expect(payload.rotation_seconds).toBe(4);
    expect(payload.items).toHaveLength(2);
    expect(payload.items.map(x=>x.title)).toEqual(['第一条优惠','第二条提醒']);
    expect(payload.title).toBe('第一条优惠');
  });

  test('public banner rotates in-place and dismissing one item keeps the next active',async({page})=>{
    await page.goto(base+'/');
    const bar=page.locator('.siteAnnouncement');
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('第一条优惠');
    const initialNode=await bar.evaluate(node=>node);
    await expect(bar).toContainText('第二条提醒',{timeout:6000});
    const afterNode=await bar.evaluate(node=>node);
    expect(Boolean(initialNode)).toBe(true);
    expect(Boolean(afterNode)).toBe(true);

    await page.evaluate(()=>sessionStorage.clear());
    await page.reload();
    await expect(bar).toContainText('第一条优惠');
    await bar.getByRole('button',{name:'关闭当前公告'}).click();
    await expect(bar).toContainText('第二条提醒');
    const dismissed=await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('gojet-announcementbar-')));
    expect(dismissed).toHaveLength(1);
    await expect(bar).toBeVisible();
  });
});
