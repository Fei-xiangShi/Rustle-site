// Notifies search engines that the site changed. Run after a deploy:
//   node scripts/submit-urls.mjs
// IndexNow (Bing, Yandex, Seznam, Naver…) needs no account; Baidu's push API
// runs only when BAIDU_PUSH_TOKEN is set.
const site = new URL(process.env.SITE_URL ?? 'https://rustle.fxs.life');
const INDEXNOW_KEY = '68d6b1dd1411d79673a95f2122d186d2';
const urls = ['/', '/en/'].map((p) => new URL(p, site).href);

async function indexNow() {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: site.host,
      key: INDEXNOW_KEY,
      keyLocation: new URL(`/${INDEXNOW_KEY}.txt`, site).href,
      urlList: urls,
    }),
  });
  console.log(`[indexnow] ${res.status} ${res.statusText}`);
}

async function baidu(token) {
  const res = await fetch(`http://data.zz.baidu.com/urls?site=${site.origin}&token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: urls.join('\n'),
  });
  console.log(`[baidu] ${res.status} ${await res.text()}`);
}

await indexNow();
if (process.env.BAIDU_PUSH_TOKEN) await baidu(process.env.BAIDU_PUSH_TOKEN);
