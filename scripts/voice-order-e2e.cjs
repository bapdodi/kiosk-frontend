const puppeteer=require('puppeteer');
const fs=require('node:fs');
const path=require('node:path');
const {createServer}=require('node:http');
// Serve a previously built app on an ephemeral local port. All API/Live requests below are mocked.
const dist=path.resolve(__dirname,'../dist');
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'};
const assert=require('node:assert/strict');
(async()=>{
 const server=createServer((request,response)=>{
   const requested=path.join(dist,new URL(request.url,'http://localhost').pathname);
   const file=fs.existsSync(requested)&&fs.statSync(requested).isFile()?requested:path.join(dist,'index.html');
   response.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
   response.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 server.unref();
 const baseUrl=`http://127.0.0.1:${server.address().port}`;
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||(fs.existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':undefined),headless:true,args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 try {
 for (const {mobile, mode} of [{mobile:false,mode:'voice'},{mobile:true,mode:'voice'},{mobile:false,mode:'touch'}]) {
 const page=await browser.newPage();
 await page.setViewport(mobile ? {width:390,height:844} : {width:1280,height:900});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let submitted=0, attempts=0;
 const orderRequests=[];
 await page.setRequestInterception(true);
 page.on('request',r=>{
 const path=new URL(r.url()).pathname;
 let body;
 if(path==='/api/categories') body=[{id:1,name:'배관',level:'main'}];
 else if(path==='/api/products/all') body=[{id:10,name:'동 엘보',erpCode:'100',categories:[{mainCategory:1}],images:[],combinations:[{id:20,name:'15A / 국산',erpCode:'101'},{id:21,name:'20A / 수입',erpCode:'102'}]}];
 else if(path==='/api/customers') body=[{NAME:'3번',CODE:1196},{NAME:'동광설비',CODE:10}];
 else if(path==='/api/order-voice/status') body={available:true};
 else if(path==='/api/order-voice/session') body={token:'auth_tokens/test',model:'gemini-3.8-live',expiresAt:new Date(Date.now()+540000).toISOString()};
 else if(path==='/api/orders' && r.method()==='POST') {attempts++;orderRequests.push({key:r.headers()['idempotency-key'],body:JSON.parse(r.postData())});if(mode==='voice'&&attempts===1){r.respond({status:503,contentType:'text/plain',body:'테스트 접수 오류'});return;}submitted++;body={id:42};}
 else if(path.startsWith('/api/')) body=[];
 if(body!==undefined)r.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});else r.continue();
 });
 await page.evaluateOnNewDocument(()=>{
 window.wsSent=[];window.microphoneTracks=[];
 const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
 navigator.mediaDevices.getUserMedia=async(...args)=>{const stream=await original(...args);window.microphoneTracks.push(...stream.getTracks());return stream;};
 window.WebSocket=class{
 static OPEN=1;
 constructor(){window.testSocket=this;this.readyState=1;setTimeout(()=>this.onopen?.({}),0);}
 send(raw){const data=JSON.parse(raw);window.wsSent.push(data);if(data.setup)setTimeout(()=>this.emit({setupComplete:{}}),0);}
 emit(data){this.onmessage?.({data:new Blob([JSON.stringify(data)],{type:'application/json'})});}
 close(){this.readyState=3;this.onclose?.({code:1000});}
 };
 });
 const clickText=async text=>{await page.evaluate(t=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(t));if(!b)throw new Error('No button '+t);b.click();},text);};
 await page.goto(baseUrl,{waitUntil:'networkidle0'});
 const cartButton=mobile?'.kiosk-cart .cart-voice-button':'.kiosk-cart-bar .cart-voice-button';
 const firstButton=mobile?'.mobile-header-right .cart-voice-button':'.attract-voice .cart-voice-button';
 await page.waitForSelector(firstButton);
 if(process.env.VOICE_SCREENSHOT_DIR && mode==='voice') await page.screenshot({path:path.join(process.env.VOICE_SCREENSHOT_DIR,mobile?'voice-first-mobile.png':'voice-first-desktop.png')});
 await page.click(firstButton);
 await page.waitForSelector('.customer-select-head');
 await page.waitForFunction(()=>wsSent.some(m=>m.clientContent));
 async function calls(functionCalls){await page.evaluate(c=>testSocket.emit({toolCall:{functionCalls:c}}),functionCalls);await page.waitForFunction(n=>wsSent.some(m=>m.toolResponse?.functionResponses?.some(r=>r.id===n)),{},functionCalls.at(-1).id);}
 const result=async id=>page.evaluate(id=>wsSent.filter(m=>m.toolResponse).flatMap(m=>m.toolResponse.functionResponses).find(r=>r.id===id).response.result,id);
 await calls([{id:'badCustomer',name:'select_customer',args:{customerCode:'unknown'}}]);
 assert.ok((await result('badCustomer')).error);
 await calls([{id:'customerSearch',name:'search_customers',args:{query:'동광'}}]);
 assert.equal((await result('customerSearch')).customers[0].name,'동광설비');
 await calls([{id:'customerSelect',name:'select_customer',args:{customerCode:mobile?'1196':'10'}}]);
 await page.waitForSelector(mobile?'.mobile-header-right .cart-voice-button':cartButton);
 assert.equal(await page.$('.voice-order-dialog'),null);
 assert.equal(await page.$('.voice-order-launch'),null);
 await calls([{id:'s1',name:'search_products',args:{query:'엘보'}}]);
 await page.waitForSelector('.product-card');
 await calls([{id:'o1',name:'get_product_options',args:{productId:'10'}}]);
 const detail=mobile?'.mp-page':'.product-detail-view';
 await page.waitForSelector(detail);
 await calls([{id:'sel',name:'select_product_option',args:{productId:'10',optionId:'20',quantity:2}}]);
 await page.waitForFunction(selector=>document.querySelector(selector+' button[aria-pressed="true"]')?.textContent.includes('15A'),{},detail);
 await page.waitForFunction(selector=>document.querySelector(selector+' input[type="number"]')?.value==='2',{},detail);
 // The caller can still touch the original options; get_screen reads that choice.
 await page.evaluate(selector=>[...document.querySelectorAll(selector+' button')].find(b=>b.textContent.includes('20A / 수입')).click(),detail);
 await calls([{id:'ui',name:'get_screen',args:{}}]);
 assert.equal(Object.values((await result('ui')).selectedProduct.selections).flat().includes('20A / 수입'),true);
 await calls([{id:'bad',name:'add_to_cart',args:{productId:'10',optionId:'999',quantity:2}}]);
 assert.ok((await result('bad')).error);
 await calls([{id:'a1',name:'add_to_cart',args:{productId:'10',optionId:'20',quantity:2}},{id:'a2',name:'add_to_cart',args:{productId:'10',optionId:'20',quantity:3}}]);
 await page.waitForFunction(()=>document.querySelector('.cart-bar-qty')?.textContent==='5');
 await calls([{id:'a2',name:'add_to_cart',args:{productId:'10',optionId:'20',quantity:3}}]);
 const cart=(await result('a2')).cart;
 assert.equal(cart[0].quantity,5);
 await calls([{id:'q1',name:'set_cart_quantity',args:{cartId:cart[0].cartId,quantity:4}}]);
 await page.waitForFunction(()=>document.querySelector('.cart-bar-qty')?.textContent==='4');
 if(process.env.VOICE_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.VOICE_SCREENSHOT_DIR,mobile?'voice-mobile.png':'voice-desktop.png')});
 // Navigating the existing UI does not end the call. The same cart button hangs up.
 if(mobile) await page.click('.mp-cart');
 await page.click(cartButton);
 await page.waitForFunction(()=>microphoneTracks.every(t=>t.readyState==='ended'));
 assert.equal(await page.evaluate(()=>testSocket.readyState),3);
 await page.click(cartButton);
 await page.waitForFunction(selector=>document.querySelector(selector)?.textContent.includes('통화 종료'),{},cartButton);
 await calls([{id:'r1',name:'prepare_review',args:{}}]);
 await page.waitForSelector('.review-title');
 assert.equal(submitted,0);
 assert.equal(await page.evaluate(()=>testSocket.readyState),1);
 const readback=async()=>{
   await page.evaluate(()=>testSocket.emit({serverContent:{outputTranscription:{text:'상호와 상품 규격 수량을 확인했습니다. 주문 접수할까요?'},turnComplete:true}}));
   await new Promise(resolve=>setTimeout(resolve,180));
 };
 const say=async(text,finished=true)=>page.evaluate(({text,finished})=>testSocket.emit({serverContent:{inputTranscription:{text,finished}}}),{text,finished});
 if(mode==='voice') {
   const review1=(await result('r1')).reviewId;
   await calls([{id:'noYes',name:'confirm_order',args:{reviewId:review1}}]);assert.ok((await result('noYes')).error);
   await readback();
   await say('네',false);
   await calls([{id:'partialYes',name:'confirm_order',args:{reviewId:review1}}]);assert.ok((await result('partialYes')).error);
   await say(' 그런데 하나 빼주세요',true);
   await calls([{id:'negative',name:'confirm_order',args:{reviewId:review1}}]);assert.ok((await result('negative')).error);
   await calls([{id:'edit',name:'set_cart_quantity',args:{cartId:cart[0].cartId,quantity:3}}]);
   await calls([{id:'stale',name:'confirm_order',args:{reviewId:review1}}]);assert.ok((await result('stale')).error);
   assert.equal(attempts,0);
   await calls([{id:'r2',name:'prepare_review',args:{}}]);await readback();await say('네 주문해주세요');
   await calls([{id:'failedSubmit',name:'confirm_order',args:{reviewId:(await result('r2')).reviewId}}]);
   assert.ok((await result('failedSubmit')).error);assert.equal(submitted,0);assert.equal(attempts,1);
   await calls([{id:'r3',name:'prepare_review',args:{}}]);await readback();await say('네 주문해주세요');
   const confirmed={id:'confirmed',name:'confirm_order',args:{reviewId:(await result('r3')).reviewId}};
   await calls([confirmed]);assert.equal((await result('confirmed')).orderNumber,'42');
   await calls([confirmed,{id:'duplicate',name:'confirm_order',args:{reviewId:confirmed.args.reviewId}}]);
   assert.equal(attempts,2);assert.equal(orderRequests[0].key,orderRequests[1].key);
   assert.deepEqual(orderRequests[0].body,orderRequests[1].body);
 } else await page.click('.review-confirm');
 await page.waitForSelector('.order-done-title');
 assert.equal(submitted,1);
 assert.equal(orderRequests.at(-1).body.erpCustomerCode,mobile?'1196':'10');
 assert.equal(orderRequests.at(-1).body.items[0].quantity,mode==='voice'?3:4);
 assert.equal('price' in orderRequests.at(-1).body.items[0],false);
 await page.waitForFunction(()=>microphoneTracks.every(t=>t.readyState==='ended'));
 // Completion remains visible while the server's success announcement plays, then the call closes.
 await page.evaluate(()=>testSocket.emit({serverContent:{outputTranscription:{text:'주문번호 42번으로 접수되었습니다.'},turnComplete:true}}));
 if(process.env.VOICE_SCREENSHOT_DIR && mode==='voice') await page.screenshot({path:path.join(process.env.VOICE_SCREENSHOT_DIR,mobile?'voice-done-mobile.png':'voice-done-desktop.png')});
 await page.waitForFunction(()=>testSocket.readyState===3);
 assert.equal(await page.evaluate(()=>microphoneTracks.every(t=>t.readyState==='ended')),true);
 assert.deepEqual(errors,[]);
 await page.close();
 console.log(`PASS ${mobile?'mobile':'desktop'} ${mode}: starts on welcome; selects customer/guest; existing UI; explicit fresh voice confirmation; rejects partial/negative/stale confirmation; retries idempotently; completion and call cleanup.`);
 }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exit(1);});
