import {learningView} from './view-model.js';
import {today} from './repeat-engine.js';
export function allTodayDone(data,now=today()) {
  const view=learningView(data,'all',now,now);
  return view.total>0&&view.done===view.total;
}
let active;
export function fireworks(){
  active?.();
  const layer=document.createElement('div');layer.className='celebration';
  layer.setAttribute('role','status');layer.innerHTML='<div class="celebration-message">🎉 今日任务全部完成！</div>';
  document.body.append(layer);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduced){
    for(let burst=0;burst<7;burst++){
      const x=15+Math.random()*70,y=15+Math.random()*55;
      for(let i=0;i<26;i++){
        const spark=document.createElement('i'),angle=i/26*Math.PI*2,radius=55+Math.random()*95;
        spark.className='firework-spark';
        spark.style.cssText=`left:${x}%;top:${y}%;--dx:${Math.cos(angle)*radius}px;--dy:${Math.sin(angle)*radius}px;--spark:${['#ffbc38','#f47187','#7b73f3','#35cdb0','#4bb7fb'][i%5]};animation-delay:${burst*.32}s`;
        layer.append(spark);
      }
    }
  }
  const timer=setTimeout(()=>{layer.remove();active=null;},4500);
  active=()=>{clearTimeout(timer);layer.remove();};
}
