// 9A 초월 등급 모습: 유일·불멸·태초·만제 — 몸 색 다시 칠하기 + 기운(오라) 불꽃
// 몸 색: 등급별로 스프라이트 시트를 한 번만 다시 칠해 둠(캐시) · 기운: 몸 뒤 불꽃 혀 + 바닥 충격파 + 앞쪽 상승 기류·번개
(function(){
const KC={flameHeight:1.3,flowSpeed:1.0,boltLevel:1,showGroundRing:1,lite:0};
class KiAura {
  constructor() {
    this.presets = {
      
      unique: {
        outerColor: "rgba(148, 163, 184, 0.25)",
        midColor: "rgba(226, 232, 240, 0.45)",
        coreColor: "#ffffff",
        boltColor: null,
        hasSecondLayer: false,
        particleColor: "#e2e8f0"
      },
      
      immortal: {
        outerColor: "rgba(245, 158, 11, 0.38)",
        midColor: "rgba(255, 215, 0, 0.72)",
        coreColor: "#fffbeb",
        boltColor: "#ffd700",
        hasSecondLayer: false,
        particleColor: "#ffd700"
      },
      
      primordial: {
        outerColor: "rgba(0, 102, 255, 0.48)",
        midColor: "rgba(0, 240, 255, 0.78)",
        coreColor: "#ffffff",
        boltColor: "#00f0ff",
        hasSecondLayer: true,
        secondColor: "rgba(56, 189, 248, 0.5)",
        particleColor: "#00f0ff"
      },
      
      emperor: {
        outerColor: "rgba(225, 29, 72, 0.58)",
        midColor: "rgba(255, 30, 66, 0.85)",
        coreColor: "#ffffff",
        boltColor: "#ff1744",
        hasSecondLayer: true,
        secondColor: "rgba(224, 242, 254, 0.65)", 
        particleColor: "#ff1e42"
      }
    };

    
    this.flameSeeds = Array.from({ length: 18 }, (_, i) => ({
      offsetX: ((i / 17) - 0.5) * 1.45,
      widthRatio: 0.16 + (i % 3) * 0.06,
      heightRatio: 0.85 + Math.sin(i * 1.7) * 0.35,
      freq: 2.2 + (i % 4) * 0.6,
      phase: i * 0.9
    }));

    
    this.motes = Array.from({ length: 28 }, (_, i) => ({
      rx: (Math.random() - 0.5) * 1.5,
      ry: Math.random() * 1.4 - 0.7,
      speed: 0.6 + Math.random() * 1.1,
      len: 8 + Math.random() * 18,
      isStreak: i % 2 === 0,
      phase: Math.random() * Math.PI * 2
    }));
  }

  
  drawBackKi(ctx, cx, cy, sw, sh, tier, time) {
    const p = this.presets[tier] || this.presets.unique;
    const t = time * 0.006 * KC.flowSpeed;
    const baseW = sw * 0.62;
    const baseH = sh * 0.72 * KC.flameHeight;
    const footY = cy + sh * 0.46;

    ctx.save();

    
    if (KC.showGroundRing && tier !== 'unique') {
      ctx.save();
      ctx.translate(cx, footY);
      ctx.scale(1, 0.32);

      
      for (let w = 0; w < 2; w++) {
        const waveP = ((t * 0.25 + w * 0.5) % 1);
        const r = baseW * (0.65 + waveP * 0.85);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = p.midColor;
        ctx.globalAlpha = (1 - waveP) * 0.75;
        ctx.lineWidth = 3 * (1 - waveP);
        ctx.stroke();
      }
      ctx.restore();
    }

    
    ctx.globalCompositeOperation = 'lighter';

    
    const auraGrad = ctx.createRadialGradient(cx, cy - baseH * 0.1, baseW * 0.1, cx, cy - baseH * 0.1, baseW * 1.45);
    auraGrad.addColorStop(0, p.midColor);
    auraGrad.addColorStop(0.55, p.outerColor);
    auraGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy - baseH * 0.12, baseW * 1.4, baseH * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();

    
    this._renderFlameLayer(ctx, cx, footY, baseW * 1.12, baseH * 1.15, p.outerColor, t, 1.0);
    this._renderFlameLayer(ctx, cx, footY, baseW * 0.86, baseH * 0.92, p.midColor, t * 1.25, 0.85);

    
    if (p.hasSecondLayer) {
      this._renderFlameLayer(ctx, cx, footY, baseW * 0.72, baseH * 0.82, p.secondColor, t * 1.45, 0.7);
    }

    
    this._renderFlameLayer(ctx, cx, footY, baseW * 0.54, baseH * 0.65, p.coreColor, t * 1.6, 0.55);

    ctx.restore();
  }

  _renderFlameLayer(ctx, cx, footY, maxW, maxH, color, t, intensity) {
    ctx.save();
    ctx.fillStyle = color;
    const seeds = this.flameSeeds, N = seeds.length, paths = [];
    const glow = !KC.lite;   // 렉 줄이기: 번짐(shadowBlur)은 불꽃마다가 아니라 층마다 딱 한 번

    seeds.forEach(s => {
      const wave = Math.sin(t * s.freq + s.phase);
      const flutter = Math.cos(t * (s.freq * 1.3) + s.phase);

      const bx = cx + s.offsetX * maxW;
      const bw = maxW * s.widthRatio * (0.85 + wave * 0.18);
      const fh = maxH * s.heightRatio * (0.82 + flutter * 0.22);
      const tipX = bx + wave * (maxW * 0.22) - s.offsetX * (maxW * 0.15); 

      const p = new Path2D();
      p.moveTo(bx - bw, footY);
      p.bezierCurveTo(
        bx - bw * 1.15, footY - fh * 0.35,
        tipX - bw * 0.35, footY - fh * 0.75,
        tipX, footY - fh
      );
      p.bezierCurveTo(
        tipX + bw * 0.35, footY - fh * 0.75,
        bx + bw * 1.15, footY - fh * 0.35,
        bx + bw, footY
      );
      p.closePath();
      paths.push(p);
      ctx.fill(p);
    });

    if (glow) {
      // 번짐 한 번: 모양은 화면 밖으로 멀리 그리고 그림자만 제자리에 남김
      const OFF = 6000, k = (ctx.getTransform ? ctx.getTransform().a : 1) || 1;
      ctx.shadowColor = color;
      ctx.shadowBlur = 18 * intensity;
      ctx.shadowOffsetX = OFF;
      ctx.translate(-OFF / k, 0);
      const all = new Path2D();
      paths.forEach(p => all.addPath(p));
      ctx.fill(all);
    }

    ctx.restore();
  }

  
  drawFrontKi(ctx, cx, cy, sw, sh, tier, time) {
    const p = this.presets[tier] || this.presets.unique;
    const t = time * 0.006 * KC.flowSpeed;
    const baseW = sw * 0.65;
    const baseH = sh * 0.75 * KC.flameHeight;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    
    this.motes.forEach((m, mi) => {
      m.ry -= 0.025 * m.speed * KC.flowSpeed;
      if (m.ry < -0.95) {
        m.ry = 0.65;
        m.rx = (Math.random() - 0.5) * 1.45;
      }

      const px = cx + m.rx * baseW;
      const py = cy + m.ry * baseH;
      const alpha = Math.sin(((0.65 - m.ry) / 1.6) * Math.PI) * 0.85;
      if (alpha <= 0.05) return;

      if (KC.lite && (mi & 1)) return;   // 느릴 땐 알갱이 절반만
      ctx.save();
      ctx.globalAlpha = alpha;
      if (m.isStreak) {
        
        const grad = ctx.createLinearGradient(px, py + m.len, px, py - m.len);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.5, p.particleColor);
        grad.addColorStop(1, '#ffffff');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, py + m.len);
        ctx.lineTo(px, py - m.len);
        ctx.stroke();
      } else {
        
        if (!KC.lite) {   // 번짐 대신 흐린 원 (훨씬 가벼워요)
          ctx.globalAlpha = alpha * 0.35;
          ctx.fillStyle = p.particleColor;
          ctx.beginPath();
          ctx.arc(px, py, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
        }
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    
    if (p.boltColor && KC.boltLevel > 0) {
      const boltChance = KC.boltLevel === 2 ? 0.55 : 0.25;
      if (Math.random() < boltChance) {
        const boltCount = (tier === 'emperor' && KC.boltLevel === 2) ? 2 : 1;
        for (let b = 0; b < boltCount; b++) {
          const startAng = Math.random() * Math.PI * 2;
          const rStart = baseW * 0.45;
          let bx = cx + Math.cos(startAng) * rStart;
          let by = cy + Math.sin(startAng) * (baseH * 0.55);

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(bx, by);
          const segs = 5;
          for (let s = 1; s <= segs; s++) {
            bx += (Math.random() - 0.5) * (baseW * 0.65);
            by += (Math.random() - 0.65) * (baseH * 0.45);
            ctx.lineTo(bx, by);
          }

          
          ctx.strokeStyle = p.boltColor;
          ctx.lineWidth = 3.5;
          ctx.shadowColor = p.boltColor;
          ctx.shadowBlur = KC.lite?0:16;
          ctx.stroke();

          
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    ctx.restore();
  }
}


const KEY={6:'unique',7:'immortal',8:'primordial',9:'emperor'};
const hx=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const lerp=(a,b,f)=>[0,1,2].map(k=>Math.round(a[k]+(b[k]-a[k])*f));
const grad=(R,t)=>{t=Math.max(0,Math.min(1,t));const n=R.length-1,i=Math.min(n-1,Math.floor(t*n));return lerp(hx(R[i]),hx(R[i+1]),t*n-i)};
const hsv=(h,s,v)=>{h=((h%1)+1)%1;const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),u=v*(1-(1-f)*s);const m=[[v,u,p],[q,v,p],[p,v,u],[p,q,v],[u,p,v],[v,p,q]][i%6];return m.map(x=>Math.round(x*255))};
const EDGE={immortal:'#8fb4ff',primordial:'#fff0a0',emperor:'#ff2030'};
function recolor(src,tier){const w=src.naturalWidth||src.width,h=src.naturalHeight||src.height;const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.drawImage(src,0,0);
  if(tier==='unique')return c;
  const d=g.getImageData(0,0,w,h),p=d.data,out=new Uint8ClampedArray(p);const A=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&p[(y*w+x)*4+3]>10;const e=hx(EDGE[tier]);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=(y*w+x)*4;
    if(p[o+3]<10){if(A(x+1,y)||A(x-1,y)||A(x,y+1)||A(x,y-1)){out[o]=e[0];out[o+1]=e[1];out[o+2]=e[2];out[o+3]=255}continue}
    const r=p[o],gg=p[o+1],b=p[o+2],L=(.299*r+.587*gg+.114*b)/255;let col;
    if(tier==='immortal'){if(L<.13)col=hx('#05061c');else{col=grad(['#0a0c34','#3a1f9a','#2f6bff','#4fe6ff','#ffffff'],.12+L*.88);const band=Math.sin((x*.9+y*.6)*.35);if(band>.75)col=lerp(col,hsv(.55+.15*Math.sin(x*.3),.35,1),(band-.75)*3);col=lerp([r,gg,b],col,.85)}}
    else if(tier==='primordial'){if(L<.13)col=hx('#3a2000');else{col=grad(['#3a1d00','#b06a00','#ffc22a','#fff0a8','#ffffff'],.1+L*.9);if(L>.55){col=lerp(col,hsv((x+y)*.04,.45,1),.35+.25*Math.sin((x-y)*.5))}col=lerp([r,gg,b],col,.88)}}
    else{if(L<.13)col=[0,0,0];else{col=grad(['#06040a','#24182c','#55405a','#9a8296'],.15+L*.85);const v=Math.abs(Math.sin(x*.55+y*.31+Math.sin(y*.4)*2));if(v>.975)col=lerp(col,grad(['#ff3b1a','#ffb020','#fff2a0'],(v-.975)*40),.85)}}
    out[o]=col[0];out[o+1]=col[1];out[o+2]=col[2]}
  g.putImageData(new ImageData(out,w,h),0,0);return c}
// 등급 모습의 스프라이트(같은 meta · 다시 칠한 그림) — 그림이 아직 안 불러졌으면 원래 것
function spr(S,r){const k=KEY[r];if(!S||!k||k==='unique')return S;S._t=S._t||{};if(S._t[k])return S._t[k];
  try{const img={};for(const a in S.img){const im=S.img[a];if(!im||!(im.naturalWidth||im.width))return S;img[a]=recolor(im,k)}const T={meta:S.meta,img};S._t[k]=T;return T}catch(e){return S}}
function bbox(S){if(S._bb)return S._bb;const A=S.meta.anims.idle,im=S.img.idle;let bb={x:0,y:0,w:A.w,h:A.h};
  try{const c=document.createElement('canvas');c.width=A.w;c.height=A.h;const g=c.getContext('2d');g.drawImage(im,0,0,A.w,A.h,0,0,A.w,A.h);const d=g.getImageData(0,0,A.w,A.h).data;let x0=A.w,y0=A.h,x1=0,y1=0;for(let y=0;y<A.h;y++)for(let x=0;x<A.w;x++)if(d[(y*A.w+x)*4+3]>10){if(x<x0)x0=x;if(y<y0)y0=y;if(x>x1)x1=x;if(y>y1)y1=y}if(x1>=x0)bb={x:x0,y:y0,w:x1-x0+1,h:y1-y0+1}}catch(e){}
  return S._bb=bb}
// 그리기: 그림 중심 (x,y)·배율 sc 기준으로 몸 상자에 맞춰 기운을 둘러요
function box(S,x,y,sc){const A=S.meta.anims.idle,b=bbox(S);return[x+(b.x+b.w/2-A.w/2)*sc,y+(b.y+b.h/2-A.h/2)*sc,b.w*sc,b.h*sc]}
let _fb=-1,_fn=0;
function budget(ms){const b=Math.floor(ms/12);if(b!==_fb){_fb=b;_fn=0}_fn++;KC.lite=_fn>3?1:0;return _fn<=10}   // 한 프레임 안에서 4번째부터 번짐 끔 · 11번째부터 생략
function back(eng,c,S,x,y,sc,r,ms){const k=KEY[r];if(!k||!S||!S.meta)return;if(!budget(ms))return;const q=box(S,x,y,sc);eng.drawBackKi(c,q[0],q[1],q[2],q[3],k,ms)}
function front(eng,c,S,x,y,sc,r,ms){const k=KEY[r];if(!k||!S||!S.meta)return;if(_fn>10)return;const q=box(S,x,y,sc);eng.drawFrontKi(c,q[0],q[1],q[2],q[3],k,ms)}
window.TFX={KC,KEY,KiAura,spr,back,front,recolor,eng:()=>new KiAura()};
})();
