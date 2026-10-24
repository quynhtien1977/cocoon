// Optional local browser check. Requires Microsoft Edge on Windows and a completed npm run build.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3191', '--hostname', '127.0.0.1'], { windowsHide: true, stdio: 'ignore' });
const browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--no-first-run', '--remote-debugging-port=9291', '--user-data-dir=D:/cocoon/apps/web/.next/landing-browser', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, id = 0;
const pending = new Map();
async function until(fn) { for (let i=0;i<100;i++) { try { if (await fn()) return; } catch {} await delay(100); } throw Error('Browser check timed out'); }
function send(method, params={}) { return new Promise((resolve,reject)=> { const n=++id; const timer=setTimeout(()=>reject(Error(method)),15000); pending.set(n,{resolve,reject,timer}); ws.send(JSON.stringify({id:n,method,params})); }); }
async function evaluate(expression) { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
try {
  await until(async()=> (await fetch('http://127.0.0.1:3191/')).ok);
  let target; await until(async()=> { target=(await (await fetch('http://127.0.0.1:9291/json')).json()).find(x=>x.type==='page'); return target; });
  ws=new WebSocket(target.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  ws.onmessage=e=>{const m=JSON.parse(e.data);const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result);}};
  await send('Page.enable'); await mkdir('.next/landing-previews',{recursive:true});
  for(const width of [1440,1024,390,320]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:'http://127.0.0.1:3191/'});
    await until(()=>evaluate('document.readyState==="complete" && !!document.querySelector("h1")'));
    await evaluate('document.fonts.ready.then(()=>true)'); await delay(500);
    assert.equal(await evaluate('getComputedStyle(document.querySelector("header")).display'),'grid','CSS module must load');
    await evaluate('[...document.images].forEach(i=>i.loading="eager")');
    await until(()=>evaluate('[...document.images].every(i=>i.complete && i.naturalWidth>0)'));
    const overflow=await evaluate('[...document.querySelectorAll("body *")].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,className:e.className,right:e.getBoundingClientRect().right})).slice(0,12)');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'No horizontal overflow: '+JSON.stringify(overflow));
    await evaluate('scrollTo(0,0)');
    assert.equal(await evaluate('document.querySelector("main > section").getBoundingClientRect().bottom >= innerHeight - 1'),true,'Hero fills the first viewport');
    assert.equal(await evaluate('[...document.querySelectorAll("button")].filter(b=>b.getAttribute("aria-label")?.startsWith("Xem bộ sưu tập")).length'),0,'Carousel dots are hidden');
    assert.equal(await evaluate('/0[1-3]\\s*\\/\\s*03/.test(document.querySelector("main > section").textContent)'),false,'Carousel page count is removed');
    const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(`.next/landing-previews/home-${width}.png`,Buffer.from(shot.data,'base64'));
    const previousTitle=await evaluate('document.querySelector("h1").textContent');
    await evaluate('[...document.querySelectorAll("button")].find(e=>e.getAttribute("aria-label")==="Bộ sưu tập tiếp theo").click()');
    await until(()=>evaluate('document.querySelector("h1").textContent !== '+JSON.stringify(previousTitle)));
    const manualTitle=await evaluate('document.querySelector("h1").textContent');
    await delay(2200);
    assert.notEqual(await evaluate('document.querySelector("h1").textContent'),manualTitle,'Carousel still advances automatically');
    assert.equal(await evaluate('document.querySelector("#spotlight-title").textContent'),'Dầu gội bồ kết');
    assert.equal(await evaluate('document.querySelectorAll("#cau-chuyen img").length'),3,'Spotlight has three image layers');
    const beforeScroll=await evaluate('getComputedStyle(document.querySelector("#cau-chuyen img")).transform');
    await evaluate('document.querySelector("#cau-chuyen").scrollIntoView({behavior:"instant",block:"start"})');
    await delay(900);
    const afterScroll=await evaluate('getComputedStyle(document.querySelector("#cau-chuyen img")).transform');
    assert.notEqual(afterScroll,beforeScroll,'Product layers move with scroll');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'No overflow at spotlight');
    assert.equal(await evaluate('document.querySelector("#cau-chuyen a").href'),'https://cocoonvietnam.com/san-pham/dau-goi-bo-ket-500ml','Buy link opens the featured product');
    const spotlightShot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(`.next/landing-previews/spotlight-${width}.png`,Buffer.from(spotlightShot.data,'base64'));
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    assert.equal(await evaluate('getComputedStyle(document.querySelector("#cau-chuyen img")).transform'),'none','Reduced motion disables parallax');
    await send('Emulation.setEmulatedMedia',{features:[]});
    await evaluate('document.querySelector("header a[aria-label]").click()');
    await until(()=>evaluate('scrollY===0'));
    await evaluate('document.querySelector("#san-pham").scrollIntoView({behavior:"instant",block:"start"})');
    await delay(200);
    const imageCenter=await evaluate('(()=>{const r=document.querySelector("#san-pham article a").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',...imageCenter});
    await delay(600);
    assert.equal(await evaluate('getComputedStyle(document.querySelectorAll("#san-pham article img")[1]).opacity'),'1','Hover reveals alternate product image');
    const productsShot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(`.next/landing-previews/products-${width}.png`,Buffer.from(productsShot.data,'base64'));
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});
    await delay(600);
    assert.equal(await evaluate('getComputedStyle(document.querySelectorAll("#san-pham article img")[1]).opacity'),'0','Pointer leave restores original product image');
    await evaluate('document.querySelector("#san-pham input[type=range]").focus()');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',windowsVirtualKeyCode:35});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'End',code:'End',windowsVirtualKeyCode:35});
    await until(()=>evaluate('document.querySelector("#bestseller-track").scrollLeft>0'));
    await until(()=>evaluate('document.querySelector("#san-pham input[type=range]").value===document.querySelector("#san-pham input[type=range]").max'));
    const endScroll=await evaluate('document.querySelector("#bestseller-track").scrollLeft');
    await evaluate('[...document.querySelectorAll("button")].find(b=>b.getAttribute("aria-label")==="Sản phẩm trước").click()');
    await until(()=>evaluate('document.querySelector("#bestseller-track").scrollLeft<'+endScroll));
    await evaluate('[...document.querySelectorAll("button")].find(e=>e.textContent==="Chăm sóc tóc").click()');
    await until(()=>evaluate('document.querySelectorAll("#san-pham article").length===1'));
    assert.equal(await evaluate('document.querySelector("#bestseller-track").scrollLeft'),0,'Filtering resets slider position');
    assert.equal(await evaluate('document.querySelector("#san-pham input[type=range]")'),null,'Slider hidden when all results fit');
    await evaluate('[...document.querySelectorAll("button")].find(e=>e.getAttribute("aria-label")==="Tìm sản phẩm").click()');
    await until(()=>evaluate('!!document.querySelector("#landing-search")'));
    await evaluate('document.querySelector("#landing-search").focus()');
    await send('Input.insertText',{text:'not-a-product'});
    await until(()=>evaluate('document.querySelectorAll("#san-pham article").length===0'));
    await evaluate('[...document.querySelectorAll("button")].find(e=>e.textContent==="Xem tất cả sản phẩm").click()');
    await until(()=>evaluate('document.querySelectorAll("#san-pham article").length===5'));
    assert.equal(await evaluate('[...document.querySelectorAll("#san-pham article h3")].at(-1).textContent'),'Cà phê Đắk Lắk làm sạch da chết cơ thể');
    await evaluate('document.querySelector("footer").scrollIntoView({behavior:"instant",block:"end"})');
    await evaluate('document.querySelector("footer a[aria-label]").click()');
    await until(()=>evaluate('scrollY===0'));
    if(width===390){
      await evaluate('[...document.querySelectorAll("button")].find(e=>e.getAttribute("aria-label")==="Mở menu").click()');
      await until(()=>evaluate('!!document.querySelector("[role=dialog]")'));
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await until(()=>evaluate('!document.querySelector("[role=dialog]")'));
    }
    console.log(`PASS ${width}px: CSS, overflow, carousel, filtering`);
  }
  for(const path of ['/login','/admin']) { await send('Page.navigate',{url:'http://127.0.0.1:3191'+path});await until(()=>evaluate('document.readyState==="complete" && location.pathname==='+JSON.stringify(path)));assert.equal(await evaluate('document.querySelectorAll("main").length'),1);console.log('PASS preserved '+path); }
} finally { if(ws?.readyState===1){await send('Browser.close').catch(()=>{});ws.close();}browser.kill();server.kill(); }
