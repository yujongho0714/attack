/*
  © 2026 유종호 (용인대 정도 태권도 2관). All rights reserved.
  vox3d.js — 도트 그림을 입체(복셀) 모델로 바꿔 주는 도구 (three.js r128)
  · 그림 가장자리는 얇게, 가운데는 도톰하게 부풀려서 진짜 3D 모델처럼 보이게 해요
  · 포켓몬(레조넌스 8방향 도트) · 바람의나라 드레스업 캐릭터 · 아무 그림이나
*/
(function(){
'use strict';
const T=THREE;
const _cv=document.createElement('canvas'),_cx=_cv.getContext('2d',{willReadFrequently:true});
function pixels(src,sx,sy,sw,sh,dw,dh){dw=dw||sw;dh=dh||sh;_cv.width=dw;_cv.height=dh;_cx.imageSmoothingEnabled=dw>=sw;_cx.clearRect(0,0,dw,dh);_cx.drawImage(src,sx,sy,sw,sh,0,0,dw,dh);return _cx.getImageData(0,0,dw,dh).data}
const LIN=new Float32Array(256);for(let i=0;i<256;i++){const c=i/255;LIN[i]=c<.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)}
/* 그림 한 장 → 입체 모양
   opt.s: 한 칸 크기 · opt.ax/ay: 발 위치(그림 좌표) · opt.maxT: 최대 두께(칸) · opt.bulge: 부풀림 · opt.flip: 좌우 뒤집기 */
function build(src,sx,sy,sw,sh,opt){
  opt=opt||{};const maxT=opt.maxT||6,bul=opt.bulge==null?.9:opt.bulge,minT=opt.minT||1.6;
  // opt.res: 큰 그림은 칸 수를 줄여서 가볍게 (폰에서도 부드럽게) · opt.h: 원하는 높이
  const k=opt.res?Math.min(1,opt.res/Math.max(sw,sh)):1;const W=Math.max(1,Math.round(sw*k)),H=Math.max(1,Math.round(sh*k)),N=W*H;
  const s=opt.h?opt.h/H:(opt.s||.06)/k;if(k<1){if(opt.ax!=null)opt=Object.assign({},opt,{ax:opt.ax*k});if(opt.ay!=null&&opt.ay!=='auto')opt=Object.assign({},opt,{ay:opt.ay*k})}
  const px=pixels(src,sx,sy,sw,sh,W,H);const op=new Uint8Array(N);let cnt=0;
  for(let i=0;i<N;i++)if(px[i*4+3]>110){op[i]=1;cnt++}
  if(!cnt)return null;
  // 가장자리까지 거리
  const d=new Int16Array(N).fill(0);const q=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!op[i])continue;
    if(x===0||y===0||x===W-1||y===H-1||!op[i-1]||!op[i+1]||!op[i-W]||!op[i+W]){d[i]=1;q.push(i)}}
  for(let h=0;h<q.length;h++){const i=q[h],x=i%W,y=(i/W)|0,nd=d[i]+1;
    if(x>0&&op[i-1]&&!d[i-1]){d[i-1]=nd;q.push(i-1)}if(x<W-1&&op[i+1]&&!d[i+1]){d[i+1]=nd;q.push(i+1)}
    if(y>0&&op[i-W]&&!d[i-W]){d[i-W]=nd;q.push(i-W)}if(y<H-1&&op[i+W]&&!d[i+W]){d[i+W]=nd;q.push(i+W)}}
  const th=new Float32Array(N);for(let i=0;i<N;i++)if(op[i])th[i]=Math.min(maxT,Math.round((minT+(d[i]-1)*bul)*2)/2);
  let by=0;for(let i=0;i<N;i++)if(op[i])by=Math.max(by,(i/W|0)+1);
  const ax=opt.ax==null?W/2:opt.ax,ay=opt.ay==null||opt.ay==='auto'?by:opt.ay;
  // 같은 색 · 같은 두께 칸은 하나로 합쳐서 면 수를 크게 줄여요 (구린 폰에서도 가볍게)
  const qc=new Int32Array(N);for(let i=0;i<N;i++)qc[i]=((px[i*4]>>3)<<10)|((px[i*4+1]>>3)<<5)|(px[i*4+2]>>3);
  const P=[],Nn=[],C=[],I=[];let nv=0;
  const fl=opt.flip?-1:1;const X=x=>(x-ax)*s*fl;
  function quad(ax_,ay_,az,bx,by_,bz,cx,cy,cz,dx,dy,dz,nx,ny,nz,c,f){
    const r=LIN[((c>>10)&31)*8+4]*f,g=LIN[((c>>5)&31)*8+4]*f,b=LIN[(c&31)*8+4]*f;
    P.push(ax_,ay_,az,bx,by_,bz,cx,cy,cz,dx,dy,dz);for(let k=0;k<4;k++){Nn.push(nx,ny,nz);C.push(r,g,b)}I.push(nv,nv+1,nv+2,nv,nv+2,nv+3);nv+=4}
  const T2=i=>th[i]*s/2;
  const nbT=(ok,ni)=>ok&&op[ni]?th[ni]:0;
  // 앞 · 뒤 · 위 · 아래 (가로로 합치기)
  for(let y=0;y<H;y++){const Y1=(ay-y)*s,Y0=(ay-y-1)*s;
    for(let pass=0;pass<3;pass++){let x=0;
      while(x<W){const i=y*W+x;
        const nt=pass===1?nbT(y>0,i-W):pass===2?nbT(y<H-1,i+W):-1;
        if(!op[i]||(pass>0&&nt>=th[i])){x++;continue}
        const c=qc[i],t=th[i];let x2=x;
        while(x2+1<W){const j=y*W+x2+1;if(!op[j]||qc[j]!==c||th[j]!==t)break;const nj=pass===1?nbT(y>0,j-W):pass===2?nbT(y<H-1,j+W):-1;if(nj!==nt)break;x2++}
        let xa=X(x),xb=X(x2+1);if(xa>xb){const q=xa;xa=xb;xb=q}const tt=t*s/2;
        if(pass===0){quad(xa,Y0,tt,xb,Y0,tt,xb,Y1,tt,xa,Y1,tt,0,0,1,c,1);quad(xb,Y0,-tt,xa,Y0,-tt,xa,Y1,-tt,xb,Y1,-tt,0,0,-1,c,.8)}
        else{const n2=nt*s/2;const zs=nt===0?[[-tt,tt]]:[[n2,tt],[-tt,-n2]];
          for(const [z0,z1] of zs){if(pass===1)quad(xa,Y1,z1,xb,Y1,z1,xb,Y1,z0,xa,Y1,z0,0,1,0,c,.95);else quad(xa,Y0,z0,xb,Y0,z0,xb,Y0,z1,xa,Y0,z1,0,-1,0,c,.62)}}
        x=x2+1}}}
  // 왼쪽 · 오른쪽 (세로로 합치기)
  for(let x=0;x<W;x++){for(const side of [-1,1]){const nx=fl>0?x+side:x-side;const ok=nx>=0&&nx<W;let y=0;
    while(y<H){const i=y*W+x;const nt=ok?nbT(true,y*W+nx):0;if(!op[i]||nt>=th[i]){y++;continue}
      const c=qc[i],t=th[i];let y2=y;
      while(y2+1<H){const j=(y2+1)*W+x;if(!op[j]||qc[j]!==c||th[j]!==t)break;const nj=ok?nbT(true,(y2+1)*W+nx):0;if(nj!==nt)break;y2++}
      const Yt=(ay-y)*s,Yb=(ay-y2-1)*s,tt=t*s/2,n2=nt*s/2;const xl=Math.min(X(x),X(x+1)),xr=Math.max(X(x),X(x+1));
      const zs=nt===0?[[-tt,tt]]:[[n2,tt],[-tt,-n2]];
      for(const [z0,z1] of zs){if(side<0)quad(xl,Yb,z0,xl,Yb,z1,xl,Yt,z1,xl,Yt,z0,-1,0,0,c,.78);else quad(xr,Yb,z1,xr,Yb,z0,xr,Yt,z0,xr,Yt,z1,1,0,0,c,.78)}
      y=y2+1}}}
  const G=new T.BufferGeometry();G.setAttribute('position',new T.Float32BufferAttribute(P,3));G.setAttribute('normal',new T.Float32BufferAttribute(Nn,3));G.setAttribute('color',new T.Float32BufferAttribute(C,3));
  G.setIndex(nv>65535?new T.Uint32BufferAttribute(I,1):new T.Uint16BufferAttribute(I,1));
  G.computeBoundingSphere();G.userData={w:W*s,h:H*s};return G;
}
const MAT=new T.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:.05,envMapIntensity:.45});
function mat(tint){if(!tint)return MAT;const m=MAT.clone();m.color.setHex(tint);m.emissive=new T.Color(tint);m.emissiveIntensity=.12;return m}

/* ---------- 포켓몬 (../rz/KEY/) ---------- */
const PKC={};
function loadImg(src){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src})}
function pkLoad(base,key){const k=base+key;if(PKC[k])return PKC[k];return PKC[k]=(async()=>{const b=base+key+'/';const meta=await fetch(b+key+'.pmd.json').then(r=>r.json());const img={};
  await Promise.all(['walk','idle'].map(async st=>{const A=meta.anims[st];if(A)img[st]=await loadImg(b+A.f+'-Anim.png')}));return{meta,img,geo:{}}})().catch(()=>null)}
const _f=new T.Vector3();
/* 한 화면에 새 모양을 너무 많이 만들면 끊겨서 · 화면마다 몇 개까지만 */
let BUD=2;function frame(n){BUD=n||2}
/* 8방향 줄 번호: 0아래(카메라 쪽) 1아래오른 2오른 3위오른 4위 5위왼 6왼 7아래왼 */
function dirRow(cam,obj,hx,hz){const dx=cam.position.x-obj.position.x,dz=cam.position.z-obj.position.z;const toCam=Math.atan2(dx,dz),head=Math.atan2(hx,hz);
  let a=head-toCam;a=Math.atan2(Math.sin(a),Math.cos(a));return((Math.round(-a/(Math.PI/4))%8)+8)%8}
class Poke{
  constructor(base,key,o){o=o||{};this.key=key;this.size=o.size||1;this.root=new T.Group();this.mesh=new T.Mesh(undefined,mat(o.tint));this.mesh.castShadow=true;this.mesh.receiveShadow=false;this.root.add(this.mesh);
    this.t=Math.random()*5;this.row=0;this.hx=0;this.hz=1;this.ready=false;this.st='idle';this.gk='';
    pkLoad(base,key).then(P=>{if(!P)return;this.P=P;this.ready=true;this.name=P.meta.name;this.dex=P.meta.dex})}
  ay(im,A,row){const k=row+'_'+A.f;this.P.ayc=this.P.ayc||{};if(this.P.ayc[k])return this.P.ayc[k];const c=document.createElement('canvas');c.width=im.width;c.height=A.h;const x=c.getContext('2d');x.drawImage(im,0,row*A.h,im.width,A.h,0,0,im.width,A.h);
    const d=x.getImageData(0,0,im.width,A.h).data;let by=0;for(let y=A.h-1;y>=0&&!by;y--)for(let xx=0;xx<im.width;xx++)if(d[(y*im.width+xx)*4+3]>110){by=y+1;break}return this.P.ayc[k]=by||A.h}
  tick(dt,cam,vx,vz){
    if(!this.ready)return;const mv=Math.hypot(vx||0,vz||0)>.01;if(mv){this.hx=vx;this.hz=vz}
    const st=(mv||!this.P.img.idle)&&this.P.img.walk?'walk':'idle';const A=this.P.meta.anims[st],im=this.P.img[st];if(!A||!im)return;
    this.t+=dt*(mv?1.4:1);const tot=A.d.reduce((a,b)=>a+b,0)/60;let tt=this.t%tot,fi=0;for(;fi<A.d.length;fi++){tt-=A.d[fi]/60;if(tt<0)break}fi=Math.min(fi,A.n-1);
    const rows=Math.max(1,Math.round(im.height/A.h));const row=rows>1?dirRow(cam,this.root,this.hx,this.hz):0;
    const gk=st+row+'_'+fi;
    if(gk!==this.gk){let g=this.P.geo[gk];if(!g&&BUD>0){BUD--;g=build(im,fi*A.w,row*A.h,A.w,A.h,{s:.085,ax:A.w/2,ay:this.ay(im,A,row),maxT:11,bulge:1.25,minT:2});this.P.geo[gk]=g}if(g){this.gk=gk;this.mesh.geometry=g}}
    this.mesh.scale.setScalar(this.size);
    // 카메라 쪽으로 몸을 돌림 (옆에서 봐도 두께가 보이게 살짝만)
    this.root.rotation.y=Math.atan2(cam.position.x-this.root.position.x,cam.position.z-this.root.position.z);
  }
}

/* ---------- 바람의나라 드레스업 주인공 (../dressup/) ---------- */
class Hero{
  constructor(base){this.base=base;this.root=new T.Group();this.mesh=new T.Mesh(undefined,MAT);this.mesh.castShadow=true;this.root.add(this.mesh);this.geo={};this.gk='';this.F=null;this.pk=null}
  async dress(eq){
    const base=this.base;const pk=this.pk||(this.pk=await fetch(base+'dress.json').then(r=>r.json()).catch(()=>null));if(!pk)return;
    const li=s=>loadImg(base+s);const bimg=await li('base.webp');if(!bimg)return;
    const its=[];for(const cat in eq){const [c,id]=String(eq[cat]).split(':');const it=(pk.cats[c]||[]).find(o=>String(o.id)===id);if(!it)continue;its.push({cat,v:it.v,img:await li(it.s),mask:it.e?await li(it.e):null})}
    const bw=pk.base.box[2],bh=pk.base.box[3],F={};
    for(const m in pk.base.v){F[m]=pk.base.v[m].map((bf,fi)=>{const c=document.createElement('canvas');c.width=pk.W;c.height=pk.H;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
      const at=(it,cb)=>{const v=it.v[m];if(!v||!it.img)return;const f=v[4][Math.min(fi,v[4].length-1)];cb(v,f)};
      its.filter(it=>it.cat==='cape').forEach(it=>at(it,(v,f)=>g.drawImage(it.img,f[0],f[1],v[2],v[3],v[0],v[1],v[2],v[3])));
      const bc=document.createElement('canvas');bc.width=pk.W;bc.height=pk.H;const bg=bc.getContext('2d');bg.imageSmoothingEnabled=false;bg.drawImage(bimg,bf[0],bf[1],bw,bh,0,0,bw,bh);bg.globalCompositeOperation='destination-out';
      its.filter(it=>it.mask&&it.cat!=='cape').forEach(it=>at(it,(v,f)=>bg.drawImage(it.mask,f[0],f[1],v[2],v[3],v[0],v[1],v[2],v[3])));g.drawImage(bc,0,0);
      ['shoes','weapon','shield','armor','coat','hair','helmet'].forEach(cat=>its.filter(it=>it.cat===cat).forEach(it=>at(it,(v,f)=>g.drawImage(it.img,f[0],f[1],v[2],v[3],v[0],v[1],v[2],v[3]))));return c})}
    this.F=F;this.geo={};this.gk='';this.foot=pk.foot;this.W=pk.W;this.H=pk.H;
  }
  /* hx,hz: 바라보는 방향 · mv: 걷는 중 · atk: 공격 동작 0~1 */
  tick(now,cam,hx,hz,mv,atk){
    if(!this.F)return;const row=dirRow(cam,this.root,hx,hz);// 0앞 2오른 4뒤 6왼
    const d=(row===0||row===1||row===7)?'f':(row>=3&&row<=5)?'b':'r';const flip=row===5||row===6||row===7?(d==='r'):false;
    const lf=row>=5&&row<=7&&d==='r';
    const key=(atk?'atk_':'walk_')+d;const L=this.F[key]||this.F['walk_'+d];const fi=atk?(atk>.5?0:Math.min(1,L.length-1)):mv?Math.floor(now/125)%L.length:0;
    const gk=key+fi+(lf?'L':'');
    if(gk!==this.gk){let g=this.geo[gk];if(!g&&(BUD>0||!this.mesh.geometry.attributes.position)){BUD--;g=build(L[fi],0,0,this.W,this.H,{s:.034,res:VOX.heroRes||170,ax:this.foot[0],ay:this.foot[1],maxT:9,bulge:.7,minT:2,flip:lf});this.geo[gk]=g}if(g){this.gk=gk;this.mesh.geometry=g}}
    this.root.rotation.y=Math.atan2(cam.position.x-this.root.position.x,cam.position.z-this.root.position.z);
  }
}

/* ---------- 3D 알 ---------- */
function eggGeo(){const pts=[];for(let i=0;i<=14;i++){const a=i/14*Math.PI;pts.push(new T.Vector2(Math.max(.001,.55*Math.sin(a)*(1+.13*Math.cos(a))),.72*(1-Math.cos(a))))}return new T.LatheGeometry(pts,16)}
let EGG_G=null;
function eggTex(c1,c2,kind){const c=document.createElement('canvas');c.width=128;c.height=128;const x=c.getContext('2d');x.fillStyle=c1;x.fillRect(0,0,128,128);x.fillStyle=c2;
  if(kind===0){for(let i=0;i<22;i++){x.beginPath();x.arc(Math.random()*128,Math.random()*128,3+Math.random()*7,0,7);x.fill()}}
  else if(kind===1){for(let y=10;y<128;y+=26){x.beginPath();for(let xx=0;xx<=128;xx+=8)x.lineTo(xx,y+Math.sin(xx/10)*5);x.lineTo(128,y+9);for(let xx=128;xx>=0;xx-=8)x.lineTo(xx,y+9+Math.sin(xx/10)*5);x.fill()}}
  else{for(let i=0;i<9;i++){const sx=Math.random()*128,sy=Math.random()*128;x.save();x.translate(sx,sy);x.beginPath();for(let k=0;k<10;k++){const r=k%2?4:10,a=k*Math.PI/5;x.lineTo(Math.cos(a)*r,Math.sin(a)*r)}x.fill();x.restore()}}
  const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.wrapS=t.wrapT=T.RepeatWrapping;return t}
const EGM={};
function egg(c1,c2,kind,glow){EGG_G=EGG_G||eggGeo();const key=c1+c2+kind+(glow||0);if(EGM[key]){const e=new T.Mesh(EGG_G,EGM[key]);e.castShadow=true;return e}const m=EGM[key]=new T.MeshStandardMaterial({map:eggTex(c1,c2,kind||0),roughness:.28,metalness:.05,envMapIntensity:1});
  if(glow){m.emissive=new T.Color(glow);m.emissiveIntensity=.35}const e=new T.Mesh(EGG_G,m);e.castShadow=true;return e}

const STX={};
function stripTex(img,n,key){if(STX[key])return STX[key];const fw=Math.floor(img.width/n),a=[];for(let i=0;i<n;i++){const c=document.createElement('canvas');c.width=fw;c.height=img.height;c.getContext('2d').drawImage(img,i*fw,0,fw,img.height,0,0,fw,img.height);const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;a.push(t)}return STX[key]=a}
/* ---------- 유니티 느낌 화면 설정 ---------- */
function setupRenderer(r,scene,skyTop,skyBot){
  r.outputEncoding=T.sRGBEncoding;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=.92;r.shadowMap.enabled=true;r.shadowMap.type=T.PCFShadowMap;r.physicallyCorrectLights=false;
  // 하늘 그라데이션 → 반사광(환경맵)
  const es=new T.Scene();const sg=new T.SphereGeometry(50,32,16);const sc=document.createElement('canvas');sc.width=4;sc.height=256;const sx=sc.getContext('2d');const gr=sx.createLinearGradient(0,0,0,256);gr.addColorStop(0,skyTop||'#6fb4ff');gr.addColorStop(.55,'#e8f3ff');gr.addColorStop(1,skyBot||'#7a8a6a');sx.fillStyle=gr;sx.fillRect(0,0,4,256);
  const st=new T.CanvasTexture(sc);st.encoding=T.sRGBEncoding;es.add(new T.Mesh(sg,new T.MeshBasicMaterial({map:st,side:T.BackSide})));
  const pm=new T.PMREMGenerator(r);const env=pm.fromScene(es,.04).texture;scene.environment=env;pm.dispose();
  const bg=new T.CanvasTexture(sc);bg.encoding=T.sRGBEncoding;scene.background=bg;
  return env;
}
function sunLight(scene,range){const h=new T.HemisphereLight(0xdfefff,0x4a5a3a,.3);scene.add(h);const d=new T.DirectionalLight(0xfff1d6,2.1);d.position.set(30,60,25);d.castShadow=true;d.shadow.mapSize.set(1024,1024);
  const R=range||40;Object.assign(d.shadow.camera,{left:-R,right:R,top:R,bottom:-R,near:1,far:200});d.shadow.bias=-.0004;d.shadow.normalBias=.02;scene.add(d);scene.add(d.target);return d}

window.VOX={frame,stripTex,build,mat,Poke,Hero,egg,eggTex,setupRenderer,sunLight,loadImg,pkLoad,dirRow};
})();
