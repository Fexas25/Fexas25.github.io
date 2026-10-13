(() => {
  'use strict';
  const root=document.querySelector('[data-music-player]');if(!root)return;
  const audio=root.querySelector('audio'),toggle=root.querySelector('.music-toggle'),panel=root.querySelector('.music-panel');
  const title=root.querySelector('[data-music-title]'),artist=root.querySelector('[data-music-artist]'),play=root.querySelector('[data-music-play]'),status=root.querySelector('[data-music-status]');
  let tracks;try{tracks=JSON.parse(root.querySelector('[data-music-tracks]').textContent);}catch{return;}
  if(!Array.isArray(tracks)||!tracks.length){root.hidden=true;return;}
  const storage='mx-music-v1';let index=0,wanted=false,loaded=false,seek=0,generation=0,leaving=false,lastSave=0,notice='';
  const english=()=>document.documentElement.lang==='en';
  const text=(zh,en)=>english()?en:zh;
  const label=(el,zh,en)=>{const value=text(zh,en);el.setAttribute('aria-label',value);el.title=value;};
  try{const saved=JSON.parse(sessionStorage.getItem(storage));if(saved){const found=tracks.findIndex(t=>t.id===saved.id);if(found>=0){index=found;seek=Number.isFinite(saved.time)&&saved.time>0?saved.time:0;wanted=saved.playing===true;}}}catch{}
  audio.volume=.35;
  function save(){try{sessionStorage.setItem(storage,JSON.stringify({id:tracks[index].id,time:loaded&&audio.readyState>=1&&Number.isFinite(audio.currentTime)?audio.currentTime:seek,playing:wanted}));}catch{}}
  function render(){
    root.classList.toggle('is-playing',!audio.paused&&!audio.ended);
    title.textContent=tracks[index].title;title.title=tracks[index].title;
    artist.textContent=tracks[index].artist;artist.title=tracks[index].artist;
    label(toggle,'音乐','Music');label(panel,'音乐播放器','Music player');
    label(root.querySelector('[data-music-prev]'),'上一首','Previous track');label(root.querySelector('[data-music-next]'),'下一首','Next track');
    label(play,wanted?'暂停':'播放',wanted?'Pause':'Play');
    play.setAttribute('aria-busy',String(wanted&&audio.paused));
    status.hidden=!notice;status.textContent=notice==='error'?text('暂时无法播放，点击播放重试。','Could not play. Press play to retry.'):notice==='gesture'?text('点一下播放，继续听。','Press play to continue.'):notice==='loading'?text('加载中…','Loading…'):'';
  }
  function load(){if(loaded)return;loaded=true;audio.src=(window.MX_SITE_ORIGIN||'')+tracks[index].src;audio.load();}
  async function start(){
    const version=++generation;wanted=true;notice='loading';load();render();save();
    try{await audio.play();if(version!==generation)return;notice='';render();save();}
    catch(error){if(version!==generation||leaving)return;wanted=false;notice=error.name==='NotAllowedError'?'gesture':'error';render();save();}
  }
  function pause(){generation++;wanted=false;notice='';audio.pause();render();save();}
  function change(delta){const resume=wanted;generation++;wanted=false;audio.pause();index=(index+delta+tracks.length)%tracks.length;loaded=false;seek=0;notice='';audio.removeAttribute('src');audio.load();render();save();if(resume)start();}
  function close(focus=false){panel.hidden=true;toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus({preventScroll:true});}
  toggle.addEventListener('click',()=>{const open=panel.hidden;panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));});
  document.addEventListener('click',event=>{if(!root.contains(event.target))close();});
  root.addEventListener('focusout',event=>{if(event.relatedTarget&&!root.contains(event.relatedTarget))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();close(true);}});
  play.addEventListener('click',()=>{if(wanted)pause();else{if(audio.error)loaded=false;start();}});
  root.querySelector('[data-music-prev]').addEventListener('click',()=>change(-1));
  root.querySelector('[data-music-next]').addEventListener('click',()=>change(1));
  audio.addEventListener('loadedmetadata',()=>{if(seek){audio.currentTime=Number.isFinite(audio.duration)?Math.min(seek,Math.max(0,audio.duration-.1)):seek;seek=0;}});
  audio.addEventListener('playing',()=>{notice='';render();save();});
  audio.addEventListener('waiting',()=>{if(wanted){notice='loading';render();}});
  audio.addEventListener('pause',()=>{if(leaving)return;render();});
  audio.addEventListener('ended',()=>{wanted=true;change(1);});
  audio.addEventListener('error',()=>{if(!loaded||leaving)return;generation++;wanted=false;notice='error';render();save();});
  audio.addEventListener('timeupdate',()=>{if(Date.now()-lastSave>3000){lastSave=Date.now();save();}});
  document.addEventListener('play',event=>{if(event.target!==audio&&event.target instanceof HTMLMediaElement)pause();},true);
  document.addEventListener('visibilitychange',()=>{root.classList.toggle('is-page-hidden',document.hidden);if(document.hidden)save();});
  addEventListener('pagehide',()=>{save();leaving=true;generation++;audio.pause();close();});
  addEventListener('pageshow',event=>{leaving=false;if(event.persisted&&wanted)start();});
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  render();if(wanted)start();
})();
