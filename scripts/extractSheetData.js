const puppeteer = require('puppeteer');
const https = require('https');

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9223' });
  const pages = await browser.pages();
  const sheetPage = pages.find(p => p.url().includes('docs.google.com/spreadsheets'));
  if (!sheetPage) return;

  const cookies = await sheetPage.cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  console.log(`Extracted ${cookies.length} cookies.`);

  const spreadsheetId = '1fCXMjJSxZp8chU8q2vy94AQCEBRKtCvxo2dwJ_L6_RM';
  const gid = '686195741'; // 'Stock list' tab

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

  https.get(url, { headers: { 'Cookie': cookieHeader } }, (res) => {
    console.log('Status code:', res.statusCode);
    if (res.statusCode === 302 || res.statusCode === 307) {
      console.log('Redirecting to:', res.headers.location);
      https.get(res.headers.location, { headers: { 'Cookie': cookieHeader } }, (res2) => {
        let data = '';
        res2.on('data', c => data += c);
        res2.on('end', () => console.log('Redirected Data preview:\n', data.substring(0, 500)));
      });
      return;
    }
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log('Data preview:\n', data.substring(0, 500));
    });
  });
}

main().catch(console.error);
