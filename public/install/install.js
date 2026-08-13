(()=>{
'use strict';
const root=document.querySelector('[data-install-progress]');
if(!root)return;
const bar=document.getElementById('installProgressBar');
const message=document.getElementById('installMessage');
const phase=document.getElementById('installPhase');
const percent=document.getElementById('installPercent');
const sync=document.getElementById('installSync');
const reconnect=document.getElementById('installReconnect');
const delays=[1200,1800,2800,4500,7000,9000];
let failures=0,timer=0,running=true,lastProgress=0,polling=false;
const schedule=delay=>{clearTimeout(timer);if(running)timer=setTimeout(poll,delay)};
const setSync=(text,state='')=>{sync.className='sync'+(state?' '+state:'');sync.textContent=text};
async function readStatus(){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch('/install/?status=1&_='+Date.now(),{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const type=response.headers.get('content-type')||'';
    if(!type.includes('application/json'))throw new Error('状态响应格式无效');
    return await response.json();
  }finally{clearTimeout(timeout)}
}
async function poll(){
  if(!running||polling)return;
  polling=true;
  try{
    const data=await readStatus();
    failures=0;
    reconnect.hidden=true;
    const progress=Math.max(lastProgress,Math.max(0,Math.min(100,Number(data.progress||0))));
    lastProgress=progress;
    bar.style.width=progress+'%';
    percent.textContent=Math.round(progress)+'%';
    message.textContent=data.message||'正在完成安装';
    phase.textContent=data.phase?'当前阶段：'+data.phase:'正在同步安装状态';
    setSync('安装状态已同步。即使刷新页面或短暂断网，安装任务也不会重新提交。');
    if(data.result==='success'){
      running=false;
      bar.style.width='100%';
      percent.textContent='100%';
      message.textContent='GoJet 安装完成';
      phase.textContent='核心服务已经通过健康检查，正在进入管理后台…';
      setSync('安装已经完成。正在安全跳转到管理后台。');
      setTimeout(()=>location.replace('/admin/'),1400);
      return;
    }
    if(data.result==='failed'){
      running=false;
      message.textContent=data.message||'安装未完成';
      phase.textContent='后台安装任务已停止，没有新的任务会被自动提交。';
      setSync('安装器已经收到明确的失败状态。请根据上方原因处理后刷新本页，原任务不会被重复执行。','bad');
      reconnect.hidden=false;
      reconnect.textContent='刷新安装页';
      reconnect.onclick=()=>location.reload();
      return;
    }
    schedule(delays[0]);
  }catch(error){
    failures+=1;
    const wait=delays[Math.min(failures,delays.length-1)];
    setSync('状态同步暂时中断，后台安装任务仍可能继续执行。请勿重复提交。页面将在 '+Math.ceil(wait/1000)+' 秒后自动重连。','warn');
    phase.textContent='正在等待状态通道恢复…';
    reconnect.hidden=false;
    reconnect.textContent='立即重连';
    schedule(wait);
  }finally{polling=false}
}
reconnect.addEventListener('click',()=>{if(!running)return;failures=0;reconnect.hidden=true;clearTimeout(timer);poll()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&running){clearTimeout(timer);poll()}});
window.addEventListener('online',()=>{if(running){clearTimeout(timer);poll()}});
poll();
})();
