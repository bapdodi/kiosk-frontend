// Sends synthetic Korean speech through the real microphone/worklet/WebSocket path. No real orders are allowed.
const puppeteer=require('puppeteer');const fs=require('node:fs');const path=require('node:path');
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||(fs.existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':undefined),args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 try {
  const page=await browser.newPage();await page.setViewport({width:1280,height:900});
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36');
  let orders=0,frames=0,nonSilent=0,maxSample=0,setup=false,outputUntil=0;
  let userText='',modelText='',outputAfterInput=false,injected=false;const tools=[];
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',r=>{if(new URL(r.url()).pathname==='/api/orders'&&r.method()==='POST'){orders++;r.abort();}else r.continue();});
  await page.evaluateOnNewDocument(()=>{
   window.__testInputContexts=[];window.__testMicStreams=[];
   navigator.mediaDevices.getUserMedia=async()=>{
    window.__inputContext=new AudioContext({sampleRate:48000});__testInputContexts.push(__inputContext);await __inputContext.resume();
    window.__inputDestination=__inputContext.createMediaStreamDestination();
    window.__micStream=__inputDestination.stream;__testMicStreams.push(__micStream);return __micStream;
   };
  });
  const cdp=await page.createCDPSession();await cdp.send('Network.enable');
  cdp.on('Network.webSocketFrameSent',({response})=>{
   try {const data=JSON.parse(response.payloadData);const audio=data.realtimeInput?.audio;if(audio){frames++;const raw=Buffer.from(audio.data,'base64');let peak=0;for(let i=0;i+1<raw.length;i+=2)peak=Math.max(peak,Math.abs(raw.readInt16LE(i)));if(peak>100)nonSilent++;maxSample=Math.max(maxSample,peak);}}catch{}
  });
  cdp.on('Network.webSocketFrameReceived',({response})=>{
   try{const data=JSON.parse(response.opcode===2?Buffer.from(response.payloadData,'base64').toString():response.payloadData);
    if(data.setupComplete)setup=true;
    const content=data.serverContent;
    if(content?.inputTranscription?.text)userText+=content.inputTranscription.text;
    if(content?.outputTranscription?.text){modelText+=content.outputTranscription.text;if(injected)outputAfterInput=true;}
    for(const p of content?.modelTurn?.parts||[]){if(p.inlineData?.mimeType?.startsWith('audio/pcm')){const rate=Number(p.inlineData.mimeType.match(/rate=(\d+)/)?.[1]||24000);outputUntil=Math.max(Date.now(),outputUntil)+Buffer.from(p.inlineData.data,'base64').length/2/rate*1000;}}
    for(const call of data.toolCall?.functionCalls||[])tools.push(call.name);
   }catch{}
  });
  await page.goto(process.env.KIOSK_TEST_URL||'https://donggwang.vercel.app',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('.attract-voice .cart-voice-button');await page.click('.attract-voice .cart-voice-button');
  await page.waitForFunction(()=>document.querySelector('.customer-select-head .cart-voice-button')?.textContent.includes('통화 종료'),{timeout:45000});
  for(let i=0;i<30&&!modelText;i++)await new Promise(r=>setTimeout(r,1000));
  await new Promise(r=>setTimeout(r,Math.max(1500,Math.min(15000,outputUntil-Date.now()+1500))));
  console.log('Before speech:',JSON.stringify({setup,frames,nonSilent,modelReplyReceived:!!modelText}));
  // Reconnect is available directly in the existing call controls; it must release the old track.
  await page.click('.customer-select-head .voice-input-actions button:first-child');
  await page.waitForFunction(()=>__testMicStreams.length===2&&__testMicStreams[0].getTracks().every(t=>t.readyState==='ended'));
  injected=true;
  const encoded=fs.readFileSync(path.join(__dirname,'fixtures/voice-order-input.mp3')).toString('base64');
  const duration=await page.evaluate(async encoded=>{const data=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));const buffer=await __inputContext.decodeAudioData(data.buffer);const source=__inputContext.createBufferSource();source.buffer=buffer;source.connect(__inputDestination);source.start();return buffer.duration;},encoded);
  for(let i=0;i<Math.ceil(duration)+25&&!outputAfterInput;i++)await new Promise(r=>setTimeout(r,1000));
  const heardVisible=await page.evaluate(()=>[...document.querySelectorAll('.voice-input-heard')].some(e=>e.textContent.includes('비회원')));
  const button=await page.$('.customer-select-head .cart-voice-button')||await page.$('.kiosk-cart-bar .cart-voice-button');if(button)await button.click();
  console.log(JSON.stringify({setup,frames,nonSilent,maxSample,inputRecognized:userText,outputAfterInput,heardVisible,microphoneReconnected:true,tools,orders,errors}));
  await page.evaluate(()=>Promise.all(__testInputContexts.map(c=>c.close())));
  if(!userText.includes('비회원')||!outputAfterInput||!heardVisible||nonSilent===0||orders||errors.length)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
