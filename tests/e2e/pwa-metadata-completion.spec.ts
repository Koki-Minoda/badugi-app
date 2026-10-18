import {test,expect} from '@playwright/test';
import {APP_URL} from './authHelper';
test('PWA metadata: decodable PNG, dimensions, start URL and installability',async({page,browserName},info)=>{
 await page.goto(APP_URL);
 const manifestUrl=await page.locator('link[rel="manifest"]').getAttribute('href');expect(manifestUrl).toBeTruthy();
 const manifest=await (await page.request.get(new URL(manifestUrl!,APP_URL).href)).json();
 expect(manifest.start_url).toBe('/');expect(manifest.display).toBe('standalone');
 for(const icon of manifest.icons){const url=new URL(icon.src,APP_URL).href;const response=await page.request.get(url);expect(response.ok()).toBe(true);const data=await response.body();expect([...data.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
  const dimensions=await page.evaluate(async src=>{const img=new Image();img.src=src;await img.decode();return `${img.naturalWidth}x${img.naturalHeight}`;},url);expect(icon.sizes.split(' ')).toContain(dimensions);
 }
 if(browserName==='chromium'){const cdp=await page.context().newCDPSession(page);const errors=await cdp.send('Page.getInstallabilityErrors');expect(errors.installabilityErrors).toEqual([]);await info.attach('installability',{body:JSON.stringify(errors),contentType:'application/json'});await cdp.detach();}
});
