// Import official product photography for explicitly labeled frontend previews.
import { mkdir, writeFile } from 'node:fs/promises';
const products = {
  'winter-melon': 'gel-bi-dao-rua-mat-310ml',
  lotus: 'nuoc-sen-hau-giang-140ml',
  coffee: 'ca-phe-dak-lak-lam-sach-da-chet-mat-150ml',
  'coffee-body': 'bo-duong-the-ca-phe-dak-lak-200ml',
  coconut: 'son-duong-dau-dua-ben-tre-5g',
  rose: 'thach-hoa-hong-duong-am-30ml',
};
await mkdir('public/images/manager-products', { recursive: true });
const sources = {};
for (const [name, slug] of Object.entries(products)) {
  const source = `https://cocoonvietnam.com/san-pham/${slug}`;
  const response = await fetch(source, { signal: AbortSignal.timeout(20000) });
  const html = await response.text();
  const tag = html.match(/<meta[^>]*(?:property|name)="og:image"[^>]*>/)?.[0];
  const url = tag?.match(/content="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
  if (!url || !/^https:\/\/(image|api)\.cocoonvietnam\.com\/uploads\/.+\.(png|jpg|jpeg|webp)$/i.test(url)) { console.log(name, 'No verified image', tag ?? ''); continue; }
  const photo = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!photo.ok || !photo.headers.get('content-type')?.startsWith('image/')) throw Error(`Invalid photo: ${name}`);
  const extension = url.split('.').at(-1);
  const src = `/images/manager-products/${name}.${extension}`;
  await writeFile(`public${src}`, Buffer.from(await photo.arrayBuffer()));
  sources[name] = { src, source, image: url };
  console.log(name, src);
}
await writeFile('public/images/manager-products/sources.json', JSON.stringify(sources, null, 2) + '\n');
