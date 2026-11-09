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
    for(let burst=0;burst<11;burst++){
      const x=10+Math.random()*80,y=10+Math.random()*52;
      for(let i=0;i<34;i++){
        const spark=document.createElement('i'),angle=i/34*Math.PI*2,radius=70+Math.random()*125;
        spark.className='firework-spark';
        spark.style.cssText=`left:${x}%;top:${y}%;--dx:${Math.cos(angle)*radius}px;--dy:${Math.sin(angle)*radius}px;--spark:${['#ffb000','#ff3f68','#6557ff','#10b995','#168dff','#fff'][i%6]};animation-delay:${burst*.22}s`;
        layer.append(spark);
      }
    }
  }
  const timer=setTimeout(()=>{layer.remove();active=null;},6500);
  active=()=>{clearTimeout(timer);layer.remove();};
}
