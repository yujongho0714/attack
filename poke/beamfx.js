/* 9T·9U 기술 이펙트 엔진 묶음 (사용자가 준 HTML·코드 3개를 그대로 옮겨 연결)
   ① 빔: 'HDR 블룸 18속성 빔 공용 엔진' (BloomBeamEngine)  → window.BEAMFX (빔 기술)
   ② 발사체: '18속성 기본 투사체(연사) & 빔 HDR 블룸 엔진' (BurstBloomVFXEngine) → window.PROJFX (날아가는 기술, 기술 레벨이 오르면 여러 발)
   ③ 근접: '18속성 세키로 베기 · 할퀴기 · 주먹 · 깨물기' (MeleeBloomVFXEngine) → window.MELEEFX (붙어서 때리는 기술, 기술 레벨이 오르면 연타)
   각 엔진의 원본 클래스·속성 색·설정은 그대로 두고, 게임 카메라(확대·이동) 위에 그리는 부분만 덧붙였어요. */
(function(){
// 공통: 게임 카메라 변환 그대로 오프스크린에 그리기
function renderWorld(E, mainCtx, time, dt){
  const cv = mainCtx.canvas;
  if (E.vfxCanvas.width !== cv.width || E.vfxCanvas.height !== cv.height) E.resize(cv.width, cv.height);
  const m = mainCtx.getTransform();
  E.vfxCtx.setTransform(1, 0, 0, 1, 0, 0); E.vfxCtx.clearRect(0, 0, cv.width, cv.height); E.vfxCtx.setTransform(m);
  E._world = 1; mainCtx.save(); mainCtx.setTransform(1, 0, 0, 1, 0, 0);
  try { E.updateAndRender(mainCtx, time, dt); } finally { E._world = 0; mainCtx.restore(); E.vfxCtx.setTransform(1, 0, 0, 1, 0, 0); }
}
const tid = (S, t) => { t = String(t || 'normal').toLowerCase(); return S.find(s => s.id === t) || S.find(s => s.id === 'normal') || S[0]; };
let last = 0; const dtNow = () => { const n = performance.now(), d = last ? Math.min(4, (n - last) / 16.667) : 1; last = n; return [n, d]; };

// ===================== ① 빔 =====================
const BEAM = (function(){

// [HDR 블룸(멀티패스 블러) 포함 18속성 빔 공용 엔진 - 클로드 게임 통합용]
// 초기화: beamEngine.resize(canvas.width, canvas.height)
// 발사: beamEngine.fire('water', startX, startY, targetX, targetY)
// 렌더: beamEngine.updateAndRender(ctx, time, 1.0)

const TYPE_SPECS = [
  {
    "id": "water",
    "kor": "물",
    "move": "하이드로펌프",
    "desc": "원뿔 고압 수류 + 나선 와류 링 + 물보라 왕관",
    "cOuter": "#0047ab",
    "cMid": "#00b4ff",
    "cCore": "#ffffff",
    "cAccent": "#a5f3fc",
    "blend": "lighter",
    "width": 56,
    "chargeDur": 10,
    "fireDur": 34,
    "particleShape": "droplet"
  },
  {
    "id": "fire",
    "kor": "불꽃",
    "move": "화염방사",
    "desc": "다층 난류 화염 리본 + 화염 고리",
    "cOuter": "#991b1b",
    "cMid": "#ff4d00",
    "cCore": "#fef08a",
    "cAccent": "#ff9e00",
    "blend": "lighter",
    "width": 52,
    "chargeDur": 9,
    "fireDur": 36,
    "particleShape": "ember"
  },
  {
    "id": "electric",
    "kor": "전기",
    "move": "10만볼트",
    "desc": "프랙탈 다중 분기 번개 + 플라즈마 방전장",
    "cOuter": "#a16207",
    "cMid": "#facc15",
    "cCore": "#ffffff",
    "cAccent": "#38bdf8",
    "blend": "lighter",
    "width": 46,
    "chargeDur": 8,
    "fireDur": 28,
    "particleShape": "spark"
  },
  {
    "id": "grass",
    "kor": "풀",
    "move": "솔라빔",
    "desc": "태양광 집속 구체 + 에메랄드 덩굴 나선",
    "cOuter": "#15803d",
    "cMid": "#4ade80",
    "cCore": "#fef9c3",
    "cAccent": "#a3e635",
    "blend": "lighter",
    "width": 58,
    "chargeDur": 14,
    "fireDur": 34,
    "particleShape": "leaf"
  },
  {
    "id": "ice",
    "kor": "얼음",
    "move": "냉동빔",
    "desc": "지그재그 냉기 코어 + 육각 빙결 결정",
    "cOuter": "#0369a1",
    "cMid": "#38bdf8",
    "cCore": "#ffffff",
    "cAccent": "#e0f2fe",
    "blend": "lighter",
    "width": 44,
    "chargeDur": 10,
    "fireDur": 32,
    "particleShape": "crystal"
  },
  {
    "id": "steel",
    "kor": "강철",
    "move": "러스터캐논",
    "desc": "은백색 메탈릭 레일건 + 회전 육각 프리즘",
    "cOuter": "#334155",
    "cMid": "#cbd5e1",
    "cCore": "#ffffff",
    "cAccent": "#38bdf8",
    "blend": "lighter",
    "width": 48,
    "chargeDur": 11,
    "fireDur": 30,
    "particleShape": "spark"
  },
  {
    "id": "dragon",
    "kor": "드래곤",
    "move": "용의파동",
    "desc": "이중 나선 용맥 에너지포",
    "cOuter": "#3730a3",
    "cMid": "#00ff9d",
    "cCore": "#ffffff",
    "cAccent": "#818cf8",
    "blend": "lighter",
    "width": 54,
    "chargeDur": 11,
    "fireDur": 34,
    "particleShape": "orb"
  },
  {
    "id": "psychic",
    "kor": "에스퍼",
    "move": "사이코빔",
    "desc": "공간 왜곡 염동력 파동 링",
    "cOuter": "#86198f",
    "cMid": "#f472b6",
    "cCore": "#00f0ff",
    "cAccent": "#e879f9",
    "blend": "lighter",
    "width": 48,
    "chargeDur": 10,
    "fireDur": 32,
    "particleShape": "star"
  },
  {
    "id": "ghost",
    "kor": "고스트",
    "move": "섀도빔",
    "desc": "칠흑 심연 코어 + 보라 도깨비불",
    "cOuter": "#3b0764",
    "cMid": "#9333ea",
    "cCore": "#07020d",
    "cAccent": "#c084fc",
    "blend": "source-over",
    "width": 52,
    "chargeDur": 11,
    "fireDur": 34,
    "particleShape": "wisp"
  },
  {
    "id": "dark",
    "kor": "악",
    "move": "악의파동",
    "desc": "칠흑 먹물 코어 + 검붉은 톱니 파동",
    "cOuter": "#18181b",
    "cMid": "#ff1e42",
    "cCore": "#050103",
    "cAccent": "#ff6b81",
    "blend": "source-over",
    "width": 54,
    "chargeDur": 10,
    "fireDur": 32,
    "particleShape": "ink"
  },
  {
    "id": "fairy",
    "kor": "페어리",
    "move": "문포스 빔",
    "desc": "핑크 프리즘 광선 + 십자 별빛 스파클",
    "cOuter": "#be185d",
    "cMid": "#f9a8d4",
    "cCore": "#ffffff",
    "cAccent": "#fde047",
    "blend": "lighter",
    "width": 50,
    "chargeDur": 11,
    "fireDur": 34,
    "particleShape": "crescent"
  },
  {
    "id": "fighting",
    "kor": "격투",
    "move": "파동탄 캐논",
    "desc": "기공파 압축 에너지 빔 + 소닉 붐 콘",
    "cOuter": "#c2410c",
    "cMid": "#fb923c",
    "cCore": "#ffffff",
    "cAccent": "#fde047",
    "blend": "lighter",
    "width": 54,
    "chargeDur": 10,
    "fireDur": 30,
    "particleShape": "spark"
  },
  {
    "id": "poison",
    "kor": "독",
    "move": "베놈제트",
    "desc": "끓어오르는 독액 스트림 + 맹독 거품",
    "cOuter": "#4c1d95",
    "cMid": "#a855f7",
    "cCore": "#a3e635",
    "cAccent": "#d946ef",
    "blend": "source-over",
    "width": 50,
    "chargeDur": 9,
    "fireDur": 34,
    "particleShape": "bubble"
  },
  {
    "id": "ground",
    "kor": "땅",
    "move": "대지의힘 포",
    "desc": "황토 모래폭풍 + 다면체 암석 파편",
    "cOuter": "#713f12",
    "cMid": "#d97706",
    "cCore": "#fef08a",
    "cAccent": "#f59e0b",
    "blend": "source-over",
    "width": 56,
    "chargeDur": 10,
    "fireDur": 34,
    "particleShape": "rock"
  },
  {
    "id": "rock",
    "kor": "바위",
    "move": "파워젬",
    "desc": "다면체 보석 프리즘 광선",
    "cOuter": "#78350f",
    "cMid": "#fbbf24",
    "cCore": "#ffffff",
    "cAccent": "#f59e0b",
    "blend": "lighter",
    "width": 46,
    "chargeDur": 10,
    "fireDur": 30,
    "particleShape": "crystal"
  },
  {
    "id": "flying",
    "kor": "비행",
    "move": "폭풍 에어포",
    "desc": "초음속 진공 칼바람 링 + 기류 터널",
    "cOuter": "#0284c7",
    "cMid": "#bae6fd",
    "cCore": "#ffffff",
    "cAccent": "#e0f2fe",
    "blend": "lighter",
    "width": 54,
    "chargeDur": 9,
    "fireDur": 32,
    "particleShape": "crescent"
  },
  {
    "id": "bug",
    "kor": "벌레",
    "move": "시그널빔",
    "desc": "진동하는 연두·황금 음파",
    "cOuter": "#3f6212",
    "cMid": "#a3e635",
    "cCore": "#fef08a",
    "cAccent": "#38bdf8",
    "blend": "lighter",
    "width": 46,
    "chargeDur": 9,
    "fireDur": 32,
    "particleShape": "orb"
  },
  {
    "id": "normal",
    "kor": "노말",
    "move": "파괴광선",
    "desc": "초거대 황금 파괴 에너지 캐논",
    "cOuter": "#c2410c",
    "cMid": "#facc15",
    "cCore": "#ffffff",
    "cAccent": "#ff5500",
    "blend": "lighter",
    "width": 76,
    "chargeDur": 15,
    "fireDur": 40,
    "particleShape": "spark"
  }
];

class BloomBeamEngine {
  constructor() {
    this.beams = [];
    this.particles = [];
    this.shockwaves = [];
    this.shake = 0;
    this.config = {
      widthScale: 1.0,
      bloomIntensity: 0.9, // 블룸(블러) 덧씌우기 강도 (0.0 ~ 1.5)
      blurRadius: 10       // 블러 확산 반경 (px)
    };

    // 후처리 전용 오프스크린 버퍼 2장 (원본 VFX용 + 저해상도 블러용)
    this.vfxCanvas = document.createElement('canvas');
    this.vfxCtx = this.vfxCanvas.getContext('2d');
    this.bloomCanvas = document.createElement('canvas');
    this.bloomCtx = this.bloomCanvas.getContext('2d');
  }

  resize(w, h) {
    this.vfxCanvas.width = w;
    this.vfxCanvas.height = h;
    // 모바일 60FPS 유지를 위해 블룸 버퍼는 1/4 해상도로 최적화
    this.bloomCanvas.width = Math.max(1, Math.floor(w * 0.25));
    this.bloomCanvas.height = Math.max(1, Math.floor(h * 0.25));
  }

  fire(typeId, x1, y1, x2, y2) {
    const spec = TYPE_SPECS.find(t => t.id === typeId) || TYPE_SPECS[0];
    this.beams.push({
      spec, x1, y1, x2, y2,
      phase: 'charge',
      chargeTimer: spec.chargeDur, maxCharge: spec.chargeDur,
      fireTimer: spec.fireDur, maxFire: spec.fireDur,
      impactTriggered: false
    });

    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = 45 + Math.random() * 60;
      this.particles.push({
        x: x1 + Math.cos(a) * dist, y: y1 + Math.sin(a) * dist,
        vx: -Math.cos(a) * (dist / spec.chargeDur),
        vy: -Math.sin(a) * (dist / spec.chargeDur),
        r: 2.5 + Math.random() * 3.5,
        color: i % 2 === 0 ? spec.cMid : spec.cCore,
        shape: 'orb', gravity: 0, drag: 0.98, rot: a, vRot: 0.1,
        life: spec.chargeDur, maxLife: spec.chargeDur, blend: spec.blend
      });
    }
  }

  _spawnImpact(spec, x, y, angle) {
    this.shake = spec.id === 'normal' ? 24 : 14;
    this.shockwaves.push({ x, y, r: 10, maxR: 135 * this.config.widthScale, color: spec.cCore, width: 7, life: 18, maxLife: 18 });
    this.shockwaves.push({ x, y, r: 10, maxR: 195 * this.config.widthScale, color: spec.cMid, width: 4.5, life: 24, maxLife: 24 });

    for (let i = 0; i < 36; i++) {
      const a = angle + Math.PI + (Math.random() - 0.5) * Math.PI * 1.6;
      const spd = 2.5 + Math.random() * 13;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 18, y: y + (Math.random() - 0.5) * 18,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        r: (3 + Math.random() * 5.5) * this.config.widthScale,
        color: i % 3 === 0 ? spec.cCore : (i % 3 === 1 ? spec.cMid : spec.cAccent),
        darkFill: spec.cOuter, shape: spec.particleShape,
        gravity: spec.particleShape === 'rock' ? 0.25 : 0.04,
        drag: 0.93, rot: Math.random() * 6, vRot: (Math.random() - 0.5) * 0.24,
        life: 28 + Math.floor(Math.random() * 18), maxLife: 46, blend: spec.blend
      });
    }
  }

  /**
   * 메인 캔버스에 [원본 VFX] + [멀티패스 HDR 블러 블룸] 합성 출력
   */
  // 9T: 게임 카메라(확대·이동) 그대로 그리기 — mainCtx의 지금 변환을 오프스크린에도 똑같이 씀
  updateAndRenderWorld(mainCtx, time, dtScale = 1.0) {
    const cv = mainCtx.canvas;
    if (this.vfxCanvas.width !== cv.width || this.vfxCanvas.height !== cv.height) this.resize(cv.width, cv.height);
    const m = mainCtx.getTransform();
    this.vfxCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.vfxCtx.clearRect(0, 0, cv.width, cv.height);
    this.vfxCtx.setTransform(m);
    this._world = 1;
    mainCtx.save(); mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    try { this.updateAndRender(mainCtx, time, dtScale); } finally { this._world = 0; mainCtx.restore(); this.vfxCtx.setTransform(1, 0, 0, 1, 0, 0); }
  }
  get busy() { return this.beams.length + this.particles.length + this.shockwaves.length > 0; }

  updateAndRender(mainCtx, time, dtScale = 1.0) {
    if (this.shake > 0.2) this.shake *= Math.pow(0.84, dtScale);
    else this.shake = 0;

    const w = this.vfxCanvas.width, h = this.vfxCanvas.height;
    const vctx = this.vfxCtx;
    if (!this._world) vctx.clearRect(0, 0, w, h);

    // 1단계: 오프스크린 VFX 버퍼에 날카로운 원본 이펙트 렌더링
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      if (b.live) {   // 9T: 게임 빔(길이·방향이 매 순간 바뀜)을 그대로 따라 그림
        if (!b.seen) { b.fade -= dtScale; if (b.fade <= 0) { this.beams.splice(i, 1); continue; } }
        b.seen = 0;
        const amt = Math.max(0, Math.min(1, b.fade / 8)) * b.k;
        b.fireTimer = amt; b.maxFire = 1;
        if (!b.impactTriggered && b.full) { b.impactTriggered = true; this._spawnImpact(b.spec, b.x2, b.y2, Math.atan2(b.y2 - b.y1, b.x2 - b.x1)); }
        this._drawFire(vctx, b, time, 1);
        if (b.aw) { const col = AWC[Math.min(6, b.aw)], W0 = b.spec.width * this.config.widthScale * .55;   // 9Z 각성: 빔 테두리 + 번개
          vctx.save(); vctx.translate(b.x1, b.y1); vctx.rotate(Math.atan2(b.y2 - b.y1, b.x2 - b.x1)); const L = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
          vctx.globalAlpha = .9; vctx.strokeStyle = col; vctx.lineWidth = 2 + b.aw * .5; [-1, 1].forEach(sd => { vctx.beginPath(); vctx.moveTo(0, sd * W0); vctx.lineTo(L, sd * W0); vctx.stroke(); });
          if (b.aw >= 3) for (let k = 0; k < (b.aw >= 5 ? 5 : 2); k++) { const x = Math.random() * L, sd = Math.random() < .5 ? -1 : 1; zig(vctx, x, sd * W0, x + 30, sd * (W0 + 22), col, 1.8); }
          vctx.restore(); }
        continue;
      }
      if (b.phase === 'charge') {
        this._drawCharge(vctx, b, time);
        b.chargeTimer -= dtScale;
        if (b.chargeTimer <= 0) b.phase = 'fire';
      } else {
        const prog = 1 - (b.fireTimer / b.maxFire);
        const reach = Math.min(1, prog * 5.2);
        if (reach >= 0.92 && !b.impactTriggered) {
          b.impactTriggered = true;
          this._spawnImpact(b.spec, b.x2, b.y2, Math.atan2(b.y2 - b.y1, b.x2 - b.x1));
        }
        this._drawFire(vctx, b, time, reach);
        b.fireTimer -= dtScale;
        if (b.fireTimer <= 0) this.beams.splice(i, 1);
      }
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      const prog = 1 - (sw.life / sw.maxLife);
      const curR = sw.r + (sw.maxR - sw.r) * (1 - Math.pow(1 - prog, 3));
      const alpha = sw.life / sw.maxLife;

      vctx.save();
      vctx.globalCompositeOperation = 'lighter';
      vctx.globalAlpha = alpha * 0.85;
      vctx.strokeStyle = sw.color;
      vctx.lineWidth = sw.width * alpha;
      vctx.beginPath(); vctx.arc(sw.x, sw.y, curR, 0, Math.PI * 2); vctx.stroke();
      vctx.restore();

      sw.life -= dtScale;
      if (sw.life <= 0) this.shockwaves.splice(i, 1);
    }

    this._drawParticles(vctx, dtScale);

    // 2단계: 메인 캔버스에 원본 선명한 VFX 합성
    mainCtx.drawImage(this.vfxCanvas, 0, 0);

    // 3단계: HDR 블룸(멀티패스 블러) 패스 합성 -> 고급스러운 시네마틱 광원 번짐 완성!
    if (this.config.bloomIntensity > 0.05) {
      const bw = this.bloomCanvas.width, bh = this.bloomCanvas.height;
      const bctx = this.bloomCtx;
      bctx.clearRect(0, 0, bw, bh);
      bctx.save();
      bctx.filter = `blur(${this.config.blurRadius}px) saturate(1.4)`;
      bctx.drawImage(this.vfxCanvas, 0, 0, bw, bh);
      bctx.restore();

      mainCtx.save();
      mainCtx.globalCompositeOperation = 'lighter';
      mainCtx.globalAlpha = Math.min(1.0, this.config.bloomIntensity);
      mainCtx.drawImage(this.bloomCanvas, 0, 0, w, h);

      // 강도가 1.0 초과 시 2차 광폭 블룸 한 번 더 덧씌워 극강의 시네마틱 발광 연출
      if (this.config.bloomIntensity > 1.0) {
        mainCtx.globalAlpha = this.config.bloomIntensity - 1.0;
        mainCtx.drawImage(this.bloomCanvas, 0, 0, w, h);
      }
      mainCtx.restore();
    }
  }

  _drawCharge(ctx, b, time) {
    const { spec } = b;
    const prog = 1 - (b.chargeTimer / b.maxCharge);
    const r = (12 + prog * 34) * this.config.widthScale;
    ctx.save();
    ctx.translate(b.x1, b.y1);
    ctx.rotate(Math.atan2(b.y2 - b.y1, b.x2 - b.x1));
    ctx.globalCompositeOperation = spec.blend;

    const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.3);
    cg.addColorStop(0, spec.cCore); cg.addColorStop(0.5, spec.cMid); cg.addColorStop(1, 'transparent');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2); ctx.fill();

    const ringR = (56 - prog * 30) * this.config.widthScale;
    ctx.strokeStyle = spec.cMid; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(10, 0, ringR * 0.35, ringR, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  _drawFire(ctx, b, time, reach) {
    const { spec } = b;
    const ratio = b.fireTimer / b.maxFire;
    const prog = 1 - ratio;
    const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
    const dist = Math.hypot(dx, dy) * reach;
    const W = spec.width * this.config.widthScale * (b.live ? Math.max(.25, ratio) : ratio);

    ctx.save();
    ctx.globalCompositeOperation = spec.blend;
    ctx.translate(b.x1, b.y1);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.globalAlpha = Math.min(1, ratio * 1.4);
    const prog0 = prog;

    if (spec.id === 'water' || spec.id === 'flying') {
      const startW = W * 0.35, endW = W * 1.12;
      const g = ctx.createLinearGradient(0, -endW, 0, endW);
      g.addColorStop(0, 'transparent'); g.addColorStop(0.2, spec.cOuter);
      g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.8, spec.cOuter); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, -startW); ctx.lineTo(dist, -endW); ctx.lineTo(dist, endW); ctx.lineTo(0, startW); ctx.closePath(); ctx.fill();

      for (let r = 0; r < 7; r++) {
        const rt = ((r / 7) + prog * 2.8) % 1;
        const rx = dist * rt, ry = startW * 1.1 + (endW * 1.1 - startW * 1.1) * rt;
        ctx.beginPath(); ctx.ellipse(rx, 0, ry * 0.3, ry, 0, -Math.PI * 0.72, Math.PI * 0.72);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = (4.5 + rt * 3) * ratio; ctx.lineCap = 'round'; ctx.stroke();
      }
    } else if (spec.id === 'fire') {
      [{ w: W * 1.3, clr: spec.cOuter, amp: 18, f: 0.025 }, { w: W * 0.8, clr: spec.cMid, amp: 12, f: 0.04 }, { w: W * 0.35, clr: spec.cCore, amp: 6, f: 0.055 }].forEach((ly, idx) => {
        ctx.beginPath();
        for (let x = 0; x <= dist; x += 12) {
          const wy = Math.sin(x * ly.f - time * 0.045 + idx * 1.5) * ly.amp * (0.3 + (x / Math.max(1, dist)) * 0.9);
          x === 0 ? ctx.moveTo(x, wy) : ctx.lineTo(x, wy);
        }
        ctx.strokeStyle = ly.clr; ctx.lineWidth = ly.w; ctx.lineCap = 'round'; ctx.stroke();
      });
    } else if (spec.id === 'electric') {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dist, 0);
      ctx.strokeStyle = spec.cOuter; ctx.lineWidth = W * 0.8; ctx.lineCap = 'round'; ctx.stroke();
      for (let bIdx = 0; bIdx < 4; bIdx++) {
        ctx.beginPath(); ctx.moveTo(0, 0);
        for (let s = 1; s < 14; s++) {
          ctx.lineTo((dist / 14) * s, (Math.random() - 0.5) * (bIdx === 0 ? 18 : 54) * ratio);
        }
        ctx.lineTo(dist, 0);
        ctx.strokeStyle = bIdx === 0 ? '#ffffff' : (bIdx === 3 ? spec.cAccent : spec.cMid);
        ctx.lineWidth = (bIdx === 0 ? 6.5 : 3) * ratio; ctx.stroke();
      }
    } else if (spec.id === 'dragon') {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dist, 0);
      ctx.strokeStyle = spec.cOuter; ctx.lineWidth = W * 0.9; ctx.lineCap = 'round'; ctx.stroke();
      [-1, 1].forEach(dir => {
        ctx.beginPath();
        for (let x = 0; x <= dist; x += 10) {
          const wy = Math.sin(x * 0.045 - time * 0.035) * W * 0.72 * dir;
          x === 0 ? ctx.moveTo(x, wy) : ctx.lineTo(x, wy);
        }
        ctx.strokeStyle = dir === 1 ? spec.cMid : '#ffffff'; ctx.lineWidth = 6.5 * ratio; ctx.stroke();
      });
    } else if (spec.id === 'ghost' || spec.id === 'dark') {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dist, 0);
      ctx.strokeStyle = spec.cMid; ctx.lineWidth = W * 1.1; ctx.lineCap = 'round'; ctx.stroke();
      ctx.strokeStyle = spec.cCore; ctx.lineWidth = W * 0.55; ctx.stroke();
    } else {
      const g = ctx.createLinearGradient(0, -W, 0, W);
      g.addColorStop(0, 'transparent'); g.addColorStop(0.2, spec.cOuter);
      g.addColorStop(0.45, spec.cMid); g.addColorStop(0.5, spec.cCore);
      g.addColorStop(0.55, spec.cMid); g.addColorStop(0.8, spec.cOuter); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.roundRect(0, -W * 0.9, dist + 15, W * 1.8, W); ctx.fill();

      for (let r = 0; r < 6; r++) {
        const rt = ((r / 6) + prog * 2.4) % 1;
        ctx.beginPath(); ctx.ellipse(dist * rt, 0, 12 * ratio, W * 1.1, 0, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3.5 * ratio; ctx.stroke();
      }
    }

    if (reach >= 0.92) {
      const ig = ctx.createRadialGradient(dist, 0, 4, dist, 0, W * 1.45);
      ig.addColorStop(0, '#ffffff'); ig.addColorStop(0.4, spec.cMid); ig.addColorStop(1, 'transparent');
      ctx.fillStyle = ig;
      ctx.beginPath(); ctx.arc(dist, 0, W * 1.45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  _drawParticles(ctx, dtScale) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dtScale; p.y += p.vy * dtScale;
      p.vy += p.gravity * dtScale;
      p.vx *= Math.pow(p.drag, dtScale); p.vy *= Math.pow(p.drag, dtScale);
      p.rot += p.vRot * dtScale; p.life -= dtScale;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }

      ctx.save();
      ctx.globalCompositeOperation = p.blend;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'spark') ctx.fillRect(-p.r * 2.2, -1.5, p.r * 4.4, 3);
      else if (p.shape === 'star') { ctx.fillRect(-p.r * 1.5, -1.5, p.r * 3, 3); ctx.fillRect(-1.5, -p.r * 1.5, 3, p.r * 3); }
      else { ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
  }
}



const beamEngine = new BloomBeamEngine();
beamEngine.config = { widthScale: 1.6, bloomIntensity: 1.5, blurRadius: 2 };   // 사용자 설정 그대로
return { E: beamEngine, S: TYPE_SPECS };
})();

// ===================== ② 발사체 =====================
const PROJ = (function(){
const TYPE_SPECS = [
  {
    "id": "fire",
    "kor": "불꽃",
    "projMove": "불꽃발사",
    "beamMove": "화염방사",
    "cOuter": "#991b1b",
    "cMid": "#ff4d00",
    "cCore": "#fef08a",
    "cAccent": "#ff9e00",
    "blend": "lighter",
    "projShape": "fireball",
    "width": 52
  },
  {
    "id": "water",
    "kor": "물",
    "projMove": "물대포",
    "beamMove": "하이드로펌프",
    "cOuter": "#0047ab",
    "cMid": "#00b4ff",
    "cCore": "#ffffff",
    "cAccent": "#a5f3fc",
    "blend": "lighter",
    "projShape": "waterdrop",
    "width": 56
  },
  {
    "id": "electric",
    "kor": "전기",
    "projMove": "전기쇼크",
    "beamMove": "10만볼트",
    "cOuter": "#a16207",
    "cMid": "#facc15",
    "cCore": "#ffffff",
    "cAccent": "#38bdf8",
    "blend": "lighter",
    "projShape": "sparkbolt",
    "width": 46
  },
  {
    "id": "grass",
    "kor": "풀",
    "projMove": "잎날가르기",
    "beamMove": "솔라빔",
    "cOuter": "#15803d",
    "cMid": "#4ade80",
    "cCore": "#fef9c3",
    "cAccent": "#a3e635",
    "blend": "lighter",
    "projShape": "leaf",
    "width": 58
  },
  {
    "id": "ice",
    "kor": "얼음",
    "projMove": "얼음뭉치",
    "beamMove": "냉동빔",
    "cOuter": "#0369a1",
    "cMid": "#38bdf8",
    "cCore": "#ffffff",
    "cAccent": "#e0f2fe",
    "blend": "lighter",
    "projShape": "shard",
    "width": 44
  },
  {
    "id": "steel",
    "kor": "강철",
    "projMove": "불릿펀치탄",
    "beamMove": "러스터캐논",
    "cOuter": "#334155",
    "cMid": "#cbd5e1",
    "cCore": "#ffffff",
    "cAccent": "#38bdf8",
    "blend": "lighter",
    "projShape": "bullet",
    "width": 48
  },
  {
    "id": "dragon",
    "kor": "드래곤",
    "projMove": "용의숨결",
    "beamMove": "용의파동",
    "cOuter": "#3730a3",
    "cMid": "#00ff9d",
    "cCore": "#ffffff",
    "cAccent": "#818cf8",
    "blend": "lighter",
    "projShape": "orb",
    "width": 54
  },
  {
    "id": "psychic",
    "kor": "에스퍼",
    "projMove": "염동력탄",
    "beamMove": "사이코빔",
    "cOuter": "#86198f",
    "cMid": "#f472b6",
    "cCore": "#00f0ff",
    "cAccent": "#e879f9",
    "blend": "lighter",
    "projShape": "ringorb",
    "width": 48
  },
  {
    "id": "ghost",
    "kor": "고스트",
    "projMove": "섀도볼",
    "beamMove": "섀도빔",
    "cOuter": "#3b0764",
    "cMid": "#9333ea",
    "cCore": "#07020d",
    "cAccent": "#c084fc",
    "blend": "source-over",
    "projShape": "shadowball",
    "width": 52
  },
  {
    "id": "dark",
    "kor": "악",
    "projMove": "악의검기",
    "beamMove": "악의파동",
    "cOuter": "#18181b",
    "cMid": "#ff1e42",
    "cCore": "#050103",
    "cAccent": "#ff6b81",
    "blend": "source-over",
    "projShape": "crescent",
    "width": 54
  },
  {
    "id": "fairy",
    "kor": "페어리",
    "projMove": "요정의바람",
    "beamMove": "문포스 빔",
    "cOuter": "#be185d",
    "cMid": "#f9a8d4",
    "cCore": "#ffffff",
    "cAccent": "#fde047",
    "blend": "lighter",
    "projShape": "star",
    "width": 50
  },
  {
    "id": "fighting",
    "kor": "격투",
    "projMove": "파동탄",
    "beamMove": "기공캐논",
    "cOuter": "#c2410c",
    "cMid": "#fb923c",
    "cCore": "#ffffff",
    "cAccent": "#fde047",
    "blend": "lighter",
    "projShape": "orb",
    "width": 54
  },
  {
    "id": "poison",
    "kor": "독",
    "projMove": "오물폭탄",
    "beamMove": "베놈제트",
    "cOuter": "#4c1d95",
    "cMid": "#a855f7",
    "cCore": "#a3e635",
    "cAccent": "#d946ef",
    "blend": "source-over",
    "projShape": "bubble",
    "width": 50
  },
  {
    "id": "ground",
    "kor": "땅",
    "projMove": "진흙폭탄",
    "beamMove": "대지의힘 포",
    "cOuter": "#713f12",
    "cMid": "#d97706",
    "cCore": "#fef08a",
    "cAccent": "#f59e0b",
    "blend": "source-over",
    "projShape": "rock",
    "width": 56
  },
  {
    "id": "rock",
    "kor": "바위",
    "projMove": "암석포",
    "beamMove": "파워젬",
    "cOuter": "#78350f",
    "cMid": "#fbbf24",
    "cCore": "#ffffff",
    "cAccent": "#f59e0b",
    "blend": "lighter",
    "projShape": "rock",
    "width": 46
  },
  {
    "id": "flying",
    "kor": "비행",
    "projMove": "에어슬래시",
    "beamMove": "폭풍 에어포",
    "cOuter": "#0284c7",
    "cMid": "#bae6fd",
    "cCore": "#ffffff",
    "cAccent": "#e0f2fe",
    "blend": "lighter",
    "projShape": "crescent",
    "width": 54
  },
  {
    "id": "bug",
    "kor": "벌레",
    "projMove": "벌레의야단",
    "beamMove": "시그널빔",
    "cOuter": "#3f6212",
    "cMid": "#a3e635",
    "cCore": "#fef08a",
    "cAccent": "#38bdf8",
    "blend": "lighter",
    "projShape": "ringorb",
    "width": 46
  },
  {
    "id": "normal",
    "kor": "노말",
    "projMove": "스피드스타",
    "beamMove": "파괴광선",
    "cOuter": "#c2410c",
    "cMid": "#facc15",
    "cCore": "#ffffff",
    "cAccent": "#ff5500",
    "blend": "lighter",
    "projShape": "star",
    "width": 72
  }
];

class BurstBloomVFXEngine {
  constructor() {
    this.projectiles = [];
    this.beams = [];
    this.particles = [];
    this.shockwaves = [];
    this.shake = 0;

    this.config = {
      burstCount: 5,       // 연사 횟수 (1 ~ 12발)
      burstInterval: 70,   // 연사 간격 (ms)
      bloomIntensity: 0.9, // HDR 블룸(블러) 강도
      blurRadius: 10
    };

    this.vfxCanvas = document.createElement('canvas');
    this.vfxCtx = this.vfxCanvas.getContext('2d');
    this.bloomCanvas = document.createElement('canvas');
    this.bloomCtx = this.bloomCanvas.getContext('2d');
  }

  resize(w, h) {
    this.vfxCanvas.width = w;
    this.vfxCanvas.height = h;
    this.bloomCanvas.width = Math.max(1, Math.floor(w * 0.25));
    this.bloomCanvas.height = Math.max(1, Math.floor(h * 0.25));
  }

  /**
   * 연사 발사 메인 함수 (클로드 게임 코드에서 이 함수 하나만 호출하면 됨!)
   * @param {string} typeId 속성 ID ('fire', 'water' 등)
   * @param {string} mode 'projectile' (기본기) | 'beam' (빔/수압포)
   * @param {number} x1 시작 X
   * @param {number} y1 시작 Y
   * @param {number} x2 타겟 X
   * @param {number} y2 타겟 Y
   * @param {number} customCount 연사 횟수 (생략 시 config.burstCount 사용)
   */
  fireBurst(typeId, mode, x1, y1, x2, y2, customCount = null) {
    const count = Math.max(1, customCount ?? this.config.burstCount);
    const interval = mode === 'beam' ? Math.max(95, this.config.burstInterval * 1.4) : this.config.burstInterval;
    const baseAngle = Math.atan2(y2 - y1, x2 - x1);
    const dist = Math.max(80, Math.hypot(x2 - x1, y2 - y1));

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        // 연사 시 자연스러운 미세 탄퍼짐(Spread) 적용
        const spread = count > 1 ? (Math.random() - 0.5) * (mode === 'beam' ? 0.12 : 0.18) : 0;
        const ang = baseAngle + spread;
        const tx = x1 + Math.cos(ang) * dist;
        const ty = y1 + Math.sin(ang) * dist;

        if (mode === 'projectile') {
          this._spawnProjectile(typeId, x1, y1, tx, ty, ang);
        } else {
          this._spawnBeam(typeId, x1, y1, tx, ty);
        }
      }, i * interval);
    }
  }

  _spawnProjectile(typeId, x1, y1, x2, y2, angle) {
    const spec = TYPE_SPECS.find(t => t.id === typeId) || TYPE_SPECS[0];
    const speed = 15.5;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const maxLife = Math.max(10, Math.ceil(dist / speed));

    this.projectiles.push({
      spec,
      x: x1, y: y1,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      rot: angle,
      r: 14,
      trail: [],
      life: maxLife,
      maxLife
    });

    // 발사구 반동 머즐 스파크
    for (let i = 0; i < 6; i++) {
      const a = angle + (Math.random() - 0.5) * 0.9;
      const spd = 2 + Math.random() * 5;
      this.particles.push({
        x: x1, y: y1, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        r: 2.5 + Math.random() * 2.5, color: spec.cCore,
        life: 12, maxLife: 12, blend: spec.blend
      });
    }
  }

  _spawnBeam(typeId, x1, y1, x2, y2) {
    const spec = TYPE_SPECS.find(t => t.id === typeId) || TYPE_SPECS[0];
    this.beams.push({
      spec, x1, y1, x2, y2,
      life: 24, maxLife: 24,
      impacted: false
    });
  }

  _spawnImpact(spec, x, y, scale = 1.0) {
    this.shake = Math.max(this.shake, 9 * scale);
    this.shockwaves.push({
      x, y, r: 6, maxR: 58 * scale,
      color: spec.cMid, width: 4.5 * scale,
      life: 14, maxLife: 14
    });

    const count = Math.floor(14 * scale);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (2 + Math.random() * 8) * scale;
      this.particles.push({
        x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        r: (2.5 + Math.random() * 4) * scale,
        color: i % 2 === 0 ? spec.cCore : spec.cMid,
        life: 18 + Math.floor(Math.random() * 10),
        maxLife: 28,
        blend: spec.blend
      });
    }
  }

  updateAndRender(mainCtx, time, dtScale = 1.0) {
    if (this.shake > 0.2) this.shake *= Math.pow(0.84, dtScale);
    else this.shake = 0;

    const w = this.vfxCanvas.width, h = this.vfxCanvas.height;
    const vctx = this.vfxCtx;
    if (!this._world) vctx.clearRect(0, 0, w, h);
    this._drawLive && this._drawLive(vctx, dtScale);   // 9U: 게임 발사체(판정 있는 것)를 같은 붓으로 그림

    // 1) 기본 투사체(불꽃발사 등) 업데이트 및 렌더링
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 9) p.trail.shift();

      p.x += p.vx * dtScale;
      p.y += p.vy * dtScale;
      p.rot += 0.22 * dtScale;
      p.life -= dtScale;

      // 비행 중 꼬리 파티클 방출
      if (Math.random() < 0.65) {
        this.particles.push({
          x: p.x + (Math.random() - 0.5) * 8,
          y: p.y + (Math.random() - 0.5) * 8,
          vx: -p.vx * 0.15 + (Math.random() - 0.5) * 2,
          vy: -p.vy * 0.15 + (Math.random() - 0.5) * 2,
          r: 2.5 + Math.random() * 3,
          color: Math.random() > 0.4 ? p.spec.cMid : p.spec.cCore,
          life: 14, maxLife: 14, blend: p.spec.blend
        });
      }

      this._drawProjectile(vctx, p);

      if (p.life <= 0) {
        this._spawnImpact(p.spec, p.x, p.y, 1.0);
        this.projectiles.splice(i, 1);
      }
    }

    // 2) 빔·수압포 업데이트 및 렌더링
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      const prog = 1 - b.life / b.maxLife;
      const reach = Math.min(1, prog * 5.0);
      if (reach >= 0.9 && !b.impacted) {
        b.impacted = true;
        this._spawnImpact(b.spec, b.x2, b.y2, 1.6);
      }
      this._drawBeam(vctx, b, time, reach);
      b.life -= dtScale;
      if (b.life <= 0) this.beams.splice(i, 1);
    }

    // 3) 충격파 링
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      const prog = 1 - sw.life / sw.maxLife;
      const curR = sw.r + (sw.maxR - sw.r) * (1 - Math.pow(1 - prog, 2.5));
      const alpha = sw.life / sw.maxLife;

      vctx.save();
      vctx.globalCompositeOperation = 'lighter';
      vctx.globalAlpha = alpha * 0.85;
      vctx.strokeStyle = sw.color;
      vctx.lineWidth = sw.width * alpha;
      vctx.beginPath(); vctx.arc(sw.x, sw.y, curR, 0, Math.PI * 2); vctx.stroke();
      vctx.restore();

      sw.life -= dtScale;
      if (sw.life <= 0) this.shockwaves.splice(i, 1);
    }

    // 4) 파티클
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dtScale; pt.y += pt.vy * dtScale;
      pt.vx *= Math.pow(0.92, dtScale); pt.vy *= Math.pow(0.92, dtScale);
      pt.life -= dtScale;
      if (pt.life <= 0) { this.particles.splice(i, 1); continue; }

      vctx.save();
      vctx.globalCompositeOperation = pt.blend;
      vctx.globalAlpha = pt.life / pt.maxLife;
      vctx.fillStyle = pt.color;
      vctx.beginPath(); vctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); vctx.fill();
      vctx.restore();
    }

    // 5) 메인 캔버스에 원본 + HDR 블룸(블러) 합성
    mainCtx.drawImage(this.vfxCanvas, 0, 0);

    if (this.config.bloomIntensity > 0.05) {
      const bw = this.bloomCanvas.width, bh = this.bloomCanvas.height;
      const bctx = this.bloomCtx;
      bctx.clearRect(0, 0, bw, bh);
      bctx.save();
      bctx.filter = `blur(${this.config.blurRadius}px) saturate(1.4)`;
      bctx.drawImage(this.vfxCanvas, 0, 0, bw, bh);
      bctx.restore();

      mainCtx.save();
      mainCtx.globalCompositeOperation = 'lighter';
      mainCtx.globalAlpha = Math.min(1.0, this.config.bloomIntensity);
      mainCtx.drawImage(this.bloomCanvas, 0, 0, w, h);
      if (this.config.bloomIntensity > 1.0) {
        mainCtx.globalAlpha = this.config.bloomIntensity - 1.0;
        mainCtx.drawImage(this.bloomCanvas, 0, 0, w, h);
      }
      mainCtx.restore();
    }
  }

  // 속성별 기본 투사체(불꽃발사, 물대포, 잎날가르기, 섀도볼 등) 그리기
  _drawProjectile(ctx, p) {
    const { spec } = p;
    ctx.save();
    ctx.globalCompositeOperation = spec.blend;

    // 1) 꼬리 잔상(Motion Trail)
    if (p.trail.length > 1) {
      for (let i = 0; i < p.trail.length - 1; i++) {
        const t = i / p.trail.length;
        ctx.beginPath();
        ctx.moveTo(p.trail[i].x, p.trail[i].y);
        ctx.lineTo(p.trail[i + 1].x, p.trail[i + 1].y);
        ctx.strokeStyle = spec.cMid;
        ctx.globalAlpha = t * 0.7;
        ctx.lineWidth = p.r * 1.4 * t;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
    ctx.translate(p.x, p.y);
    const sh = spec.projShape;

    if (sh === 'fireball' || sh === 'waterdrop') {
      // 불꽃발사(화염구) / 물대포(물방울탄): 유선형 물방울/불꽃 머리
      ctx.rotate(p.angle);
      const g = ctx.createRadialGradient(4, 0, 2, 0, 0, p.r * 1.4);
      g.addColorStop(0, spec.cCore); g.addColorStop(0.5, spec.cMid); g.addColorStop(1, spec.cOuter);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(p.r * 1.4, 0);
      ctx.quadraticCurveTo(0, -p.r * 1.1, -p.r * 1.8, 0);
      ctx.quadraticCurveTo(0, p.r * 1.1, p.r * 1.4, 0);
      ctx.closePath(); ctx.fill();
    } else if (sh === 'leaf' || sh === 'shard' || sh === 'bullet') {
      // 잎날가르기 / 얼음뭉치 / 강철탄: 날카로운 다이아몬드/탄두
      ctx.rotate(sh === 'leaf' ? p.rot : p.angle);
      ctx.fillStyle = spec.cMid; ctx.strokeStyle = spec.cCore; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p.r * 1.5, 0); ctx.lineTo(0, -p.r * 0.7);
      ctx.lineTo(-p.r * 1.3, 0); ctx.lineTo(0, p.r * 0.7);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (sh === 'crescent') {
      // 에어슬래시 / 악의검기: 날카로운 초승달 검기
      ctx.rotate(p.angle);
      ctx.strokeStyle = spec.cMid; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(-6, 0, p.r * 1.4, -0.9, 0.9); ctx.stroke();
      ctx.strokeStyle = spec.cCore; ctx.lineWidth = 3; ctx.stroke();
    } else if (sh === 'star') {
      // 스피드스타 / 페어리 별빛: 회전하는 4각/5각 별
      ctx.rotate(p.rot);
      ctx.fillStyle = spec.cCore;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        ctx.rotate(Math.PI / 2);
        ctx.moveTo(0, 0); ctx.lineTo(4, -4); ctx.lineTo(p.r * 1.3, 0); ctx.lineTo(4, 4);
      }
      ctx.fill();
    } else if (sh === 'shadowball') {
      // 섀도볼: 보라 외곽 + 칠흑 코어
      ctx.fillStyle = spec.cMid;
      ctx.beginPath(); ctx.arc(0, 0, p.r * 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = spec.cCore;
      ctx.beginPath(); ctx.arc(0, 0, p.r * 0.72, 0, Math.PI * 2); ctx.fill();
    } else {
      // 전기쇼크 / 파동탄 / 오물폭탄 / 암석포: 에너지 구체
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, p.r * 1.2);
      g.addColorStop(0, spec.cCore); g.addColorStop(0.55, spec.cMid); g.addColorStop(1, spec.cOuter);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, p.r * 1.15, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }

  // 빔·수압포 그리기
  _drawBeam(ctx, b, time, reach) {
    const { spec } = b;
    const ratio = b.life / b.maxLife;
    const prog = 1 - ratio;
    const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
    const dist = Math.hypot(dx, dy) * reach;
    const W = spec.width * 0.85 * ratio;

    ctx.save();
    ctx.globalCompositeOperation = spec.blend;
    ctx.translate(b.x1, b.y1);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.globalAlpha = Math.min(1, ratio * 1.4);

    const g = ctx.createLinearGradient(0, -W, 0, W);
    g.addColorStop(0, 'transparent'); g.addColorStop(0.2, spec.cOuter);
    g.addColorStop(0.45, spec.cMid); g.addColorStop(0.5, spec.cCore);
    g.addColorStop(0.55, spec.cMid); g.addColorStop(0.8, spec.cOuter); g.addColorStop(1, 'transparent');

    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(0, -W, dist + 15, W * 2, W); ctx.fill();

    for (let r = 0; r < 5; r++) {
      const rt = ((r / 5) + prog * 2.6) % 1;
      ctx.beginPath(); ctx.ellipse(dist * rt, 0, 10 * ratio, W * 1.1, 0, 0, Math.PI * 2);
      ctx.strokeStyle = spec.cCore; ctx.lineWidth = 3 * ratio; ctx.stroke();
    }
    ctx.restore();
  }
}


const vfxEngine = new BurstBloomVFXEngine();
vfxEngine.config = { burstCount: 1, burstInterval: 155, bloomIntensity: 0.55, blurRadius: 6 };   // 사용자 설정은 블룸 1.4였지만, 게임 화면 위에서는 작은 발사체 모양이 하얗게 날아가 버려서 0.55로 낮춤
// 9U: 게임 발사체(위치는 게임이 정함)를 원본 모양·꼬리·꼬리 불씨로 그림
vfxEngine.live = new Map();
vfxEngine._drawLive = function(vctx, dt){
  for (const [k, p] of this.live) {
    if (performance.now() - (p.seenT || 0) > 120) { this.live.delete(k); continue; }   // 게임이 0.12초 동안 안 부르면 사라진 것
    p.rot += 0.22 * dt;
    p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 9) p.trail.shift();
    if (Math.random() < 0.65) this.particles.push({ x: p.x + (Math.random() - .5) * 8, y: p.y + (Math.random() - .5) * 8, vx: -p.vx * .15 + (Math.random() - .5) * 2, vy: -p.vy * .15 + (Math.random() - .5) * 2, r: 2.5 + Math.random() * 3, color: Math.random() > .4 ? p.spec.cMid : p.spec.cCore, life: 14, maxLife: 14, blend: p.spec.blend });
    this._drawProjectile(vctx, p);
    if (p.aw) auraAt(vctx, p.x, p.y, p.r * (p.mel ? 1.6 : 1), p.aw, performance.now());   // 9Z 각성 기운
  }
};
// 9V: 근접 기술도 날아가게 — 베기(초승달 검기) · 할퀴기(3줄 발톱) · 주먹(날아가는 주먹) · 깨물기(턱)
const _dp = vfxEngine._drawProjectile.bind(vfxEngine);
vfxEngine._drawProjectile = function(ctx, p){
  if (!p.mel) return _dp(ctx, p);
  const sp = p.spec, r = p.r, ink = sp.cCore === '#050103' || sp.cCore === '#07020d';
  ctx.save(); ctx.globalCompositeOperation = sp.blend;
  if (p.trail.length > 1) for (let i = 0; i < p.trail.length - 1; i++) { const t = i / p.trail.length;   // 꼬리: 가늘어지는 한 줄 (물결 모양 없음)
    ctx.beginPath(); ctx.moveTo(p.trail[i].x, p.trail[i].y); ctx.lineTo(p.trail[i + 1].x, p.trail[i + 1].y);
    ctx.strokeStyle = sp.cMid; ctx.globalAlpha = t * .4; ctx.lineWidth = r * .7 * t; ctx.lineCap = 'round'; ctx.stroke(); }
  ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.globalAlpha = 1;
  if (p.mel === 'slash') {   // 9V-4: 사용자 '세키로 먹물 베기' = X자 — 붓모 스탬프 두 획이 X로 엇갈려 날아감 (맞으면 원본 세키로 X 베기가 터짐)
    const M = window.BEAMFX && BEAMFX._M, ms = M && (M.S.find(t => t.id === sp.id) || M.S[0]);
    const tip = M && M.E._getBrushTip(ms.inkCore || '#040102', ms.cMid);
    const L = r * 2.3, th = r * 2.2, N = 22, core = ms ? ms.cMid : sp.cMid;
    ctx.globalCompositeOperation = 'source-over';
    [[.8, 1], [-.8, -1]].forEach(([ang, alt]) => {   // 두 획: 진행 방향 기준 ±46° (원본처럼 획마다 휘는 방향이 반대)
      const c = Math.cos(ang), s2 = Math.sin(ang), nx = -s2, ny = c, cv = alt * L * .28;
      const P = u => { const t = u * 2 - 1, bend = (1 - t * t) * cv; return { x: c * L * t + nx * bend, y: s2 * L * t + ny * bend }; };
      for (let i = 0; i <= N; i++) { const u = i / N, a = P(u), b = P(Math.min(1, u + .02)), tan = Math.atan2(b.y - a.y, b.x - a.x);
        const pr = u < .12 ? .4 + (u / .12) * .75 : 1.15 * Math.pow(1 - (u - .12) / .88, .58);   // 원본 필압(입필→행필→수필)
        const w = th * Math.max(.16, pr), h = w * .6;
        if (tip) { ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(tan); ctx.drawImage(tip, -w * .7, -h * .5, w * 1.4, h); ctx.restore(); } }
      ctx.beginPath(); for (let i = 0; i <= N; i += 2) { const a = P(i / N); i ? ctx.lineTo(a.x, a.y) : ctx.moveTo(a.x, a.y); }
      ctx.strokeStyle = core; ctx.lineWidth = Math.max(2, r * .13); ctx.lineCap = 'round'; ctx.stroke();   // 칼날 코어선
    });
    if (!p.drops) p.drops = Array.from({ length: 12 }, () => ({ x: (Math.random() - .5) * L * 1.6, y: (Math.random() - .5) * L * 1.6, r: 1.5 + Math.random() * 4, rim: Math.random() > .5 }));
    for (const d of p.drops) { ctx.fillStyle = d.rim ? core : (ms ? ms.inkCore : '#040102'); ctx.beginPath(); ctx.ellipse(d.x - d.r * 4, d.y, d.r * 2.2, d.r, 0, 0, 7); ctx.fill(); }   // 먹물 방울
  } else if (p.mel === 'claw') {
    [-.75, 0, .75].forEach((oy, i) => { const L = i === 1 ? r * 3 : r * 2.4, y = oy * r;
      ctx.fillStyle = sp.cMid; ctx.beginPath(); ctx.moveTo(-L * .6, y); ctx.lineTo(L * .1, y - r * .32); ctx.lineTo(L * .5, y); ctx.lineTo(L * .1, y + r * .22); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = ink ? sp.cMid : sp.cCore; ctx.lineWidth = r * .12; ctx.beginPath(); ctx.moveTo(-L * .5, y); ctx.lineTo(L * .42, y); ctx.stroke(); });
  } else if (p.mel === 'punch') {
    const k = r / 26; ctx.scale(k, k);
    ctx.strokeStyle = sp.cMid; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(26, 0, 50, -1.3, 1.3); ctx.stroke();
    ctx.fillStyle = sp.cOuter; ctx.strokeStyle = sp.cMid; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(-44, -38, 76, 76, 18); ctx.fill(); ctx.stroke();
    [-24, -8, 8, 24].forEach(y => { ctx.fillStyle = sp.cMid; ctx.strokeStyle = ink ? '#fff' : sp.cCore; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(2, y - 7, 32, 14, 6); ctx.fill(); ctx.stroke(); });
  } else {   // bite
    const k = r / 30; ctx.scale(k, k); ctx.rotate(Math.PI / 2 * (Math.cos(p.angle) < 0 ? -1 : 1) * 0);
    [-1, 1].forEach(d => { ctx.save(); ctx.translate(0, d * 16); ctx.scale(1, d);
      ctx.strokeStyle = sp.cMid; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-40, 6); ctx.quadraticCurveTo(10, -26, 46, 4); ctx.stroke();
      [-26, -8, 10, 28].forEach((x, i) => { const w = i === 1 || i === 2 ? 9 : 7, h = i === 1 || i === 2 ? 26 : 18;
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = sp.cMid; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - w, -4); ctx.lineTo(x, -4 + h); ctx.lineTo(x + w, -4); ctx.closePath(); ctx.fill(); ctx.stroke(); });
      ctx.restore(); });
  }
  ctx.restore();
};
return { E: vfxEngine, S: TYPE_SPECS };
})();

// ===================== ③ 근접 =====================
const MEL = (function(){
const TYPE_SPECS = [
  { id: "dark",     kor: "악",     cOuter: "#18181b", cMid: "#ff1e42", cCore: "#050103", inkCore: "#040102", blend: "source-over" },
  { id: "fire",     kor: "불꽃",   cOuter: "#991b1b", cMid: "#ff4d00", cCore: "#fef08a", inkCore: "#140300", blend: "lighter" },
  { id: "water",    kor: "물",     cOuter: "#0047ab", cMid: "#00b4ff", cCore: "#ffffff", inkCore: "#020b1a", blend: "lighter" },
  { id: "electric", kor: "전기",   cOuter: "#a16207", cMid: "#facc15", cCore: "#ffffff", inkCore: "#120d00", blend: "lighter" },
  { id: "grass",    kor: "풀",     cOuter: "#15803d", cMid: "#4ade80", cCore: "#fef9c3", inkCore: "#021208", blend: "lighter" },
  { id: "ice",      kor: "얼음",   cOuter: "#0369a1", cMid: "#38bdf8", cCore: "#ffffff", inkCore: "#02101a", blend: "lighter" },
  { id: "steel",    kor: "강철",   cOuter: "#334155", cMid: "#cbd5e1", cCore: "#ffffff", inkCore: "#090d14", blend: "lighter" },
  { id: "dragon",   kor: "드래곤", cOuter: "#3730a3", cMid: "#00ff9d", cCore: "#ffffff", inkCore: "#030b14", blend: "lighter" },
  { id: "psychic",  kor: "에스퍼", cOuter: "#86198f", cMid: "#f472b6", cCore: "#00f0ff", inkCore: "#120214", blend: "lighter" },
  { id: "ghost",    kor: "고스트", cOuter: "#3b0764", cMid: "#9333ea", cCore: "#07020d", inkCore: "#06010d", blend: "source-over" },
  { id: "fairy",    kor: "페어리", cOuter: "#be185d", cMid: "#f9a8d4", cCore: "#ffffff", inkCore: "#1a030f", blend: "lighter" },
  { id: "fighting", kor: "격투",   cOuter: "#c2410c", cMid: "#fb923c", cCore: "#ffffff", inkCore: "#140500", blend: "lighter" },
  { id: "poison",   kor: "독",     cOuter: "#4c1d95", cMid: "#a855f7", cCore: "#a3e635", inkCore: "#0c0214", blend: "source-over" },
  { id: "ground",   kor: "땅",     cOuter: "#713f12", cMid: "#d97706", cCore: "#fef08a", inkCore: "#120802", blend: "source-over" },
  { id: "rock",     kor: "바위",   cOuter: "#78350f", cMid: "#fbbf24", cCore: "#ffffff", inkCore: "#120902", blend: "lighter" },
  { id: "flying",   kor: "비행",   cOuter: "#0284c7", cMid: "#bae6fd", cCore: "#ffffff", inkCore: "#03101a", blend: "lighter" },
  { id: "bug",      kor: "벌레",   cOuter: "#3f6212", cMid: "#a3e635", cCore: "#fef08a", inkCore: "#081202", blend: "lighter" },
  { id: "normal",   kor: "노말",   cOuter: "#94a3b8", cMid: "#f8fafc", cCore: "#ffffff", inkCore: "#0b0d12", blend: "lighter" }
];

class MeleeBloomVFXEngine {
  constructor() {
    this.effects = [];
    this.particles = [];
    this.shockwaves = [];
    this.brushCache = {};
    this.shake = 0;

    this.config = {
      burstCount: 3,
      scale: 1.0,
      bloomIntensity: 0.9,
      blurRadius: 10
    };

    this.vfxCanvas = document.createElement('canvas');
    this.vfxCtx = this.vfxCanvas.getContext('2d');
    this.bloomCanvas = document.createElement('canvas');
    this.bloomCtx = this.bloomCanvas.getContext('2d');
  }

  resize(w, h) {
    this.vfxCanvas.width = w;
    this.vfxCanvas.height = h;
    this.bloomCanvas.width = Math.max(1, Math.floor(w * 0.25));
    this.bloomCanvas.height = Math.max(1, Math.floor(h * 0.25));
  }

  // 세키로 스타일 서예 붓모(Bristle) 스탬프 텍스처 캐시 생성기
  _getBrushTip(coreColor, rimColor) {
    const key = `${coreColor}_${rimColor}`;
    if (this.brushCache[key]) return this.brushCache[key];

    const size = 120;
    const off = document.createElement('canvas');
    off.width = size; off.height = size;
    const octx = off.getContext('2d');
    const cx = size / 2, cy = size / 2;

    // 외곽 속성 발광 번짐(Wet Ink Bleed Halo)
    const halo = octx.createRadialGradient(cx, cy, 4, cx, cy, size * 0.48);
    halo.addColorStop(0, rimColor);
    halo.addColorStop(0.45, rimColor + '66');
    halo.addColorStop(1, 'transparent');
    octx.fillStyle = halo;
    octx.beginPath(); octx.arc(cx, cy, size * 0.48, 0, Math.PI * 2); octx.fill();

    // 85개의 미세한 붓털 점묘 클러스터 (중심 칠흑 먹물 + 가장자리 갈필)
    for (let i = 0; i < 85; i++) {
      const distRatio = Math.pow(Math.random(), 1.55);
      const angle = Math.random() * Math.PI * 2;
      const rx = cx + Math.cos(angle) * (size * 0.34 * distRatio);
      const ry = cy + Math.sin(angle) * (size * 0.22 * distRatio);
      const bristleR = (1 - distRatio * 0.68) * (2.2 + Math.random() * 5.0);

      octx.beginPath();
      octx.ellipse(rx, ry, bristleR * 1.55, bristleR * 0.7, angle, 0, Math.PI * 2);
      if (distRatio > 0.76) {
        octx.fillStyle = rimColor;
        octx.globalAlpha = 0.68;
      } else {
        octx.fillStyle = coreColor;
        octx.globalAlpha = 0.94;
      }
      octx.fill();
    }

    this.brushCache[key] = off;
    return off;
  }

  _getCubicBezierPoint(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    const x = mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x;
    const y = mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y;
    const tx = 3 * mt * mt * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
    const ty = 3 * mt * mt * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
    return { x, y, angle: Math.atan2(ty, tx) };
  }

  fireBurst(typeId, mode, x1, y1, x2, y2, customCount = null) {
    const spec = TYPE_SPECS.find(t => t.id === typeId) || TYPE_SPECS[0];
    const count = Math.max(1, customCount ?? this.config.burstCount);
    const baseAngle = Math.atan2(y2 - y1, x2 - x1);

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const alt = (i % 2 === 0 ? 1 : -1);
        const ox = count > 1 ? (Math.random() - 0.5) * 34 : 0;
        const oy = count > 1 ? (Math.random() - 0.5) * 34 : 0;

        if (mode === 'slash') {
          // [세키로 불사베기] X자 및 대각선으로 교차하는 3차 베지어 서예 붓터치 생성
          const cx = x2 + ox, cy = y2 + oy;
          const slashAng = baseAngle + alt * (0.55 + Math.random() * 0.35);
          const halfL = 165 * this.config.scale;
          const curve = alt * 55 * this.config.scale;
          const cos = Math.cos(slashAng), sin = Math.sin(slashAng);
          const nx = -sin, ny = cos;

          const p0 = { x: cx - cos * halfL, y: cy - sin * halfL };
          const p3 = { x: cx + cos * halfL, y: cy + sin * halfL };
          const p1 = { x: cx - cos * halfL * 0.35 + nx * curve, y: cy - sin * halfL * 0.35 + ny * curve };
          const p2 = { x: cx + cos * halfL * 0.35 + nx * curve * 0.6, y: cy + sin * halfL * 0.35 + ny * curve * 0.6 };

          const thickness = 58 * this.config.scale;
          const tip = this._getBrushTip(spec.inkCore || '#040102', spec.cMid);

          const tails = Array.from({ length: 14 }, () => ({
            offsetN: (Math.random() - 0.5) * thickness * 0.85,
            extraLen: (30 + Math.random() * 75) * this.config.scale,
            width: (1.2 + Math.random() * 2.8) * this.config.scale,
            curve: (Math.random() - 0.5) * 24,
            isRim: Math.random() > 0.55
          }));

          const drops = Array.from({ length: 32 }, () => ({
            u: 0.08 + Math.random() * 0.88,
            distN: (Math.random() - 0.5) * thickness * 2.3,
            r: (1.5 + Math.pow(Math.random(), 2) * 7.5) * this.config.scale,
            stretch: 1 + Math.random() * 2.4,
            isRim: Math.random() > 0.45
          }));

          this.effects.push({
            mode: 'slash', spec, p0, p1, p2, p3, thickness, tip, tails, drops,
            life: 30, maxLife: 30
          });
          this._spawnImpact(spec, cx, cy, 1.15, true);

        } else if (mode === 'claw') {
          this.effects.push({
            mode: 'claw', spec,
            x: x2 + ox, y: y2 + oy,
            angle: baseAngle + alt * 0.58,
            scale: this.config.scale,
            life: 22, maxLife: 22
          });
          this._spawnImpact(spec, x2 + ox, y2 + oy, 1.0);

        } else if (mode === 'punch') {
          const spreadAng = baseAngle + (count > 1 ? (Math.random() - 0.5) * 0.22 : 0);
          const dist = Math.hypot(x2 - x1, y2 - y1);
          const tx = x1 + Math.cos(spreadAng) * dist;
          const ty = y1 + Math.sin(spreadAng) * dist;
          this.effects.push({
            mode: 'punch', spec,
            x1, y1, x2: tx, y2: ty,
            angle: spreadAng,
            scale: this.config.scale,
            impacted: false,
            life: 26, maxLife: 26
          });

        } else if (mode === 'bite') {
          this.effects.push({
            mode: 'bite', spec,
            x: x2 + ox, y: y2 + oy,
            scale: this.config.scale,
            impacted: false,
            life: 26, maxLife: 26
          });
        }
      }, i * 125);
    }
  }

  _spawnImpact(spec, x, y, power = 1.0, isInkSlash = false) {
    this.shake = Math.max(this.shake, 13 * power);
    this.shockwaves.push({
      x, y, r: 8, maxR: 78 * power * this.config.scale,
      color: spec.cMid, width: 5 * power, life: 15, maxLife: 15
    });

    const count = Math.floor(20 * power);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (3 + Math.random() * 11) * power;
      const isBlackPetal = isInkSlash && Math.random() > 0.45;
      this.particles.push({
        x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        r: (2.5 + Math.random() * 5) * this.config.scale,
        color: isBlackPetal ? (spec.inkCore || '#050102') : (i % 2 === 0 ? spec.cCore : spec.cMid),
        isSpark: !isInkSlash && i % 3 === 0,
        isPetal: isInkSlash,
        rot: a, vRot: (Math.random() - 0.5) * 0.25,
        life: 22 + Math.floor(Math.random() * 12),
        maxLife: 34,
        blend: isBlackPetal ? 'source-over' : spec.blend
      });
    }
  }

  updateAndRender(mainCtx, time, dtScale = 1.0) {
    if (this.shake > 0.2) this.shake *= Math.pow(0.84, dtScale);
    else this.shake = 0;

    const w = this.vfxCanvas.width, h = this.vfxCanvas.height;
    const vctx = this.vfxCtx;
    if (!this._world) vctx.clearRect(0, 0, w, h);

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const ef = this.effects[i];
      if (ef.mode === 'slash') this._drawSekiroSlash(vctx, ef);
      else if (ef.mode === 'claw') this._drawClaw(vctx, ef);
      else if (ef.mode === 'punch') this._drawPunch(vctx, ef);
      else if (ef.mode === 'bite') this._drawBite(vctx, ef);

      ef.life -= dtScale;
      if (ef.life <= 0) this.effects.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      const prog = 1 - sw.life / sw.maxLife;
      const curR = sw.r + (sw.maxR - sw.r) * (1 - Math.pow(1 - prog, 2.5));
      const alpha = sw.life / sw.maxLife;

      vctx.save();
      vctx.globalCompositeOperation = 'lighter';
      vctx.globalAlpha = alpha * 0.85;
      vctx.strokeStyle = sw.color;
      vctx.lineWidth = sw.width * alpha;
      vctx.beginPath(); vctx.arc(sw.x, sw.y, curR, 0, Math.PI * 2); vctx.stroke();
      vctx.restore();

      sw.life -= dtScale;
      if (sw.life <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dtScale; p.y += p.vy * dtScale;
      p.vx *= Math.pow(0.92, dtScale); p.vy *= Math.pow(0.92, dtScale);
      p.rot += (p.vRot || 0) * dtScale;
      p.life -= dtScale;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }

      vctx.save();
      vctx.globalCompositeOperation = p.blend;
      vctx.globalAlpha = p.life / p.maxLife;
      vctx.translate(p.x, p.y);
      vctx.rotate(p.rot);
      vctx.fillStyle = p.color;
      if (p.isPetal) {
        // 흩날리는 먹물 재 & 꽃잎 실루엣
        vctx.beginPath();
        vctx.moveTo(-p.r * 1.5, 0);
        vctx.quadraticCurveTo(0, -p.r * 0.8, p.r * 1.5, 0);
        vctx.quadraticCurveTo(0, p.r * 0.8, -p.r * 1.5, 0);
        vctx.fill();
      } else if (p.isSpark) {
        vctx.fillRect(-p.r * 2.2, -1.5, p.r * 4.4, 3);
      } else {
        vctx.beginPath(); vctx.arc(0, 0, p.r, 0, Math.PI * 2); vctx.fill();
      }
      vctx.restore();
    }

    mainCtx.drawImage(this.vfxCanvas, 0, 0);

    if (this.config.bloomIntensity > 0.05) {
      const bw = this.bloomCanvas.width, bh = this.bloomCanvas.height;
      const bctx = this.bloomCtx;
      bctx.clearRect(0, 0, bw, bh);
      bctx.save();
      bctx.filter = `blur(${this.config.blurRadius}px) saturate(1.4)`;
      bctx.drawImage(this.vfxCanvas, 0, 0, bw, bh);
      bctx.restore();

      mainCtx.save();
      mainCtx.globalCompositeOperation = 'lighter';
      mainCtx.globalAlpha = Math.min(1.0, this.config.bloomIntensity);
      mainCtx.drawImage(this.bloomCanvas, 0, 0, w, h);
      if (this.config.bloomIntensity > 1.0) {
        mainCtx.globalAlpha = this.config.bloomIntensity - 1.0;
        mainCtx.drawImage(this.bloomCanvas, 0, 0, w, h);
      }
      mainCtx.restore();
    }
  }

  // [1] 세키로 먹물 베기 (서예 붓모 스탬핑 + 필압 변화 + 수필 갈필 + 먹물 스플래터)
  _drawSekiroSlash(ctx, ef) {
    const { spec } = ef;
    const ratio = ef.life / ef.maxLife;
    const prog = 1 - ratio;
    const drawReach = Math.min(1, prog * 4.4);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(1, ratio * 1.35);

    // 1) 베지어 곡선을 따라 80번 붓모 스탬프 찍기 (입필-행필-수필 필압 적용)
    const totalSteps = 80;
    const steps = Math.floor(totalSteps * drawReach);
    for (let i = 0; i <= steps; i++) {
      const u = i / totalSteps;
      const pt = this._getCubicBezierPoint(ef.p0, ef.p1, ef.p2, ef.p3, u);

      let pressure = u < 0.12
        ? 0.4 + (u / 0.12) * 0.75
        : 1.15 * Math.pow(1 - (u - 0.12) / 0.88, 0.58);

      const stampW = ef.thickness * pressure * (0.9 + Math.sin(u * 40) * 0.12);
      const stampH = stampW * 0.6;

      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.angle);
      ctx.drawImage(ef.tip, -stampW * 0.7, -stampH * 0.5, stampW * 1.4, stampH);
      ctx.restore();
    }

    // 2) 획 내부를 가르는 날카로운 속성 발광 칼날 코어선
    ctx.beginPath();
    for (let i = 0; i <= steps; i += 2) {
      const u = i / totalSteps;
      const pt = this._getCubicBezierPoint(ef.p0, ef.p1, ef.p2, ef.p3, u);
      const nx = -Math.sin(pt.angle), ny = Math.cos(pt.angle);
      const off = Math.sin(u * Math.PI * 4) * (ef.thickness * 0.1);
      i === 0 ? ctx.moveTo(pt.x + nx * off, pt.y + ny * off) : ctx.lineTo(pt.x + nx * off, pt.y + ny * off);
    }
    ctx.strokeStyle = spec.cMid;
    ctx.lineWidth = 3.5 * ratio;
    ctx.stroke();

    // 3) 수필(획 끝)에서 거칠게 찢어지는 갈필 붓털 꼬리 14가닥
    if (drawReach > 0.72) {
      const endPt = this._getCubicBezierPoint(ef.p0, ef.p1, ef.p2, ef.p3, drawReach);
      const nx = -Math.sin(endPt.angle), ny = Math.cos(endPt.angle);
      const tx = Math.cos(endPt.angle), ty = Math.sin(endPt.angle);

      ef.tails.forEach(tl => {
        const sx = endPt.x + nx * tl.offsetN * 0.4;
        const sy = endPt.y + ny * tl.offsetN * 0.4;
        const ex = sx + tx * tl.extraLen + nx * tl.curve;
        const ey = sy + ty * tl.extraLen + ny * tl.curve;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo((sx + ex) * 0.5 + nx * tl.curve * 0.5, (sy + ey) * 0.5 + ny * tl.curve * 0.5, ex, ey);
        ctx.strokeStyle = tl.isRim ? spec.cMid : (spec.inkCore || '#040102');
        ctx.lineWidth = tl.width * ratio;
        ctx.lineCap = 'round';
        ctx.stroke();
      });
    }

    // 4) 궤적 주변 먹물·속성 방울 스플래터 (飛白)
    ef.drops.forEach(dp => {
      if (dp.u > drawReach) return;
      const pt = this._getCubicBezierPoint(ef.p0, ef.p1, ef.p2, ef.p3, dp.u);
      const nx = -Math.sin(pt.angle), ny = Math.cos(pt.angle);
      const dx = pt.x + nx * dp.distN * (1 + prog * 0.25);
      const dy = pt.y + ny * dp.distN * (1 + prog * 0.25);

      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(pt.angle);
      ctx.fillStyle = dp.isRim ? spec.cMid : (spec.inkCore || '#040102');
      ctx.beginPath();
      ctx.ellipse(0, 0, dp.r * dp.stretch * ratio, dp.r * ratio, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.restore();
  }

  // [2] 할퀴기 (매직클로 3조 발톱)
  _drawClaw(ctx, ef) {
    const { spec } = ef;
    const ratio = ef.life / ef.maxLife;
    const swipe = Math.min(1, (1 - ratio) * 4.2);

    ctx.save();
    ctx.globalCompositeOperation = spec.blend;
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    ctx.scale(ef.scale, ef.scale);
    ctx.globalAlpha = Math.min(1, ratio * 1.4);

    [-26, 0, 26].forEach((oy, idx) => {
      const len = idx === 1 ? 165 : 135;
      const sx = -len / 2;
      const ex = sx + len * swipe;

      ctx.beginPath();
      ctx.moveTo(sx, oy);
      ctx.lineTo(sx + len * 0.35 * swipe, oy - 11 * ratio);
      ctx.lineTo(sx + len * 0.5 * swipe, oy - 19 * ratio);
      ctx.lineTo(sx + len * 0.68 * swipe, oy - 9 * ratio);
      ctx.lineTo(ex, oy);
      ctx.lineTo(sx + len * 0.65 * swipe, oy + 9 * ratio);
      ctx.lineTo(sx + len * 0.48 * swipe, oy + 18 * ratio);
      ctx.closePath();

      ctx.fillStyle = spec.cMid;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(sx + 10, oy);
      ctx.lineTo(ex - 10, oy);
      ctx.strokeStyle = spec.cCore;
      ctx.lineWidth = 4.5 * ratio;
      ctx.stroke();
    });

    ctx.restore();
  }

  // [3] 주먹 날리기 (거대 4마디 3D 정권)
  _drawPunch(ctx, ef) {
    const { spec } = ef;
    const ratio = ef.life / ef.maxLife;
    const prog = 1 - ratio;
    const reach = Math.min(1, Math.pow(prog * 3.2, 1.4));

    if (reach >= 0.92 && !ef.impacted) {
      ef.impacted = true;
      this._spawnImpact(spec, ef.x2, ef.y2, 1.45);
    }

    const cx = ef.x1 + (ef.x2 - ef.x1) * reach;
    const cy = ef.y1 + (ef.y2 - ef.y1) * reach;
    const sc = (0.65 + reach * 0.5) * ef.scale * (ratio < 0.25 ? ratio / 0.25 : 1);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ef.angle);
    ctx.scale(sc, sc);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = spec.cMid;
    ctx.lineWidth = 10 * ratio;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(28, 0, 56, -Math.PI * 0.46, Math.PI * 0.46); ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4 * ratio;
    ctx.beginPath(); ctx.arc(32, 0, 56, -Math.PI * 0.4, Math.PI * 0.4); ctx.stroke();
    ctx.restore();

    ctx.fillStyle = spec.cOuter;
    ctx.strokeStyle = spec.cMid;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-52, -44, 88, 88, 22);
    ctx.fill(); ctx.stroke();

    [-30, -10, 10, 30].forEach(fy => {
      ctx.fillStyle = spec.cMid;
      ctx.strokeStyle = spec.cCore;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(2, fy - 9, 38, 18, 7);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(22, fy - 3, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    });

    ctx.restore();
  }

  // [4] 깨물기 (상하악 송곳니 맞물림)
  _drawBite(ctx, ef) {
    const { spec } = ef;
    const ratio = ef.life / ef.maxLife;
    const prog = 1 - ratio;
    const snap = Math.min(1, Math.pow(prog * 3.4, 2.0));

    if (snap >= 0.95 && !ef.impacted) {
      ef.impacted = true;
      this._spawnImpact(spec, ef.x, ef.y, 1.35);
    }

    const gap = (1 - snap) * 95;

    ctx.save();
    ctx.translate(ef.x, ef.y);
    ctx.scale(ef.scale, ef.scale);
    ctx.globalAlpha = Math.min(1, ratio * 1.45);

    [-1, 1].forEach(dir => {
      ctx.save();
      ctx.translate(0, dir * gap);
      ctx.scale(1, dir);

      ctx.strokeStyle = spec.cMid;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-95, 10);
      ctx.quadraticCurveTo(0, -35, 95, 10);
      ctx.stroke();

      [-72, -44, -18, 0, 18, 44, 72].forEach((fx, idx) => {
        const isCanine = (idx === 1 || idx === 5);
        const fw = isCanine ? 17 : 12;
        const fh = isCanine ? 62 : 42;

        ctx.fillStyle = spec.cCore === '#050103' ? '#ffffff' : spec.cCore;
        ctx.strokeStyle = spec.cMid;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(fx - fw, -8);
        ctx.lineTo(fx, -8 + fh);
        ctx.lineTo(fx + fw, -8);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      });

      ctx.restore();
    });

    ctx.restore();
  }
}


const meleeEngine = new MeleeBloomVFXEngine();
meleeEngine.config = { burstCount: 3, scale: 1.0, bloomIntensity: 0.9, blurRadius: 10 };
return { E: meleeEngine, S: TYPE_SPECS };
})();

// ===================== 게임에서 부르는 곳 =====================
const LIVE = new Map();
const busyB = () => BEAM.E.beams.length + BEAM.E.particles.length + BEAM.E.shockwaves.length > 0;
const busyP = () => PROJ.E.projectiles.length + PROJ.E.beams.length + PROJ.E.particles.length + PROJ.E.shockwaves.length + PROJ.E.live.size > 0;
const busyM = () => MEL.E.effects.length + MEL.E.particles.length + MEL.E.shockwaves.length > 0;
// 기술 레벨 → 몇 발/몇 연타 (Lv.1~2: 1 · 3~4: 2 · 5~6: 3 · 7~8: 4)
const countOf = (L, max) => Math.max(1, Math.min(max || 4, 1 + Math.floor(((L | 0) - 1) / 2)));
// 근접 기술 이름 → 모양 (깨물기 · 할퀴기 · 주먹 · 베기)
const meleeMode = (name, type) => { const n = String(name || ''); const t = String(type || '').toUpperCase();
  if (/물기|깨물|엄니|이빨|독니|송곳니|크런치|씹|바크|무는|팽|이빨/.test(n)) return 'bite';
  if (/할퀴|클로|손톱|발톱|찢|긁/.test(n)) return 'claw';
  if (/펀치|주먹|파운드|정권|박치기|태클|몸통|들이받|킥|차기|메가톤|어퍼|잽|때리|누르기|스톰프|짓밟|해머|촙|당수|돌진|부딪|헤드|바디|박|격/.test(n)) return 'punch';
  if (/베기|커터|슬래시|칼|검|참|가르|블레이드|날개|에어|크로스|낫|가위|리프|자르/.test(n)) return 'slash';
  return /FIGHTING|NORMAL|ROCK|GROUND|STEEL/.test(t) ? 'punch' : 'slash'; };
// ===================== ④ 그림 이펙트 (사용자 그림을 누끼 따서 6칸 띠로: ui/fx/*.webp) =====================
// 칸 크기 421×424 · 바닥 가운데(210, 409)가 기준점 · seq=[[칸,초],…] · hit=맞는 칸
const SPR = { fw: 421, fh: 424, base: 15, img: {}, list: [], live: new Map(),
  SEQ: { quake: { seq: [[0,.07],[1,.07],[2,.08],[3,.15],[4,.2],[5,.3]], hit: 3 },
         thunder: { seq: [[0,.08],[1,.07],[2,.1],[3,.15],[4,.16],[5,.26]], hit: 2, glow: 1 },
         rock: { seq: [[0,.12],[1,.09],[2,.09],[3,.15],[4,.18],[5,.26]], hit: 2 },
         wave: { seq: [[3,.08],[4,.18],[5,.3]], hit: 0 } } };
const sprImg = n => { let im = SPR.img[n]; if (!im) { im = SPR.img[n] = new Image(); im.src = 'ui/fx/' + n + '.webp'; } return im; };
['quake', 'thunder', 'rock', 'wave'].forEach(sprImg);   // 미리 불러 두기
function sprDraw(ctx, n, f, x, y, w, alpha, flip, glow){
  const im = sprImg(n); if (!im.complete || !im.naturalWidth) return;
  const k = im.naturalHeight / SPR.fh, h = w * SPR.fh / SPR.fw;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(im, f * SPR.fw * k, 0, SPR.fw * k, SPR.fh * k, -w / 2, -h + h * SPR.base / SPR.fh, w, h);
  if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * .45; ctx.drawImage(im, f * SPR.fw * k, 0, SPR.fw * k, SPR.fh * k, -w / 2, -h + h * SPR.base / SPR.fh, w, h); }
  ctx.restore();
}
function sprRender(ctx, dt){
  const now = performance.now();
  for (let i = SPR.list.length - 1; i >= 0; i--) { const a = SPR.list[i]; a.t += dt / 60;
    if (a.fly) { const T = a.fly.T, u = Math.min(1, a.t / T);   // 날아가는 파도: 1~3칸 반복하며 이동 → 도착하면 부서짐
      if (u < 1) { const f = a.t < .07 ? 1 : 2 + (Math.floor(a.t / .12) % 2); sprDraw(ctx, a.n, f, a.fly.x1 + (a.fly.x2 - a.fly.x1) * u, a.fly.y1 + (a.fly.y2 - a.fly.y1) * u, a.w * (.8 + .2 * u), 1, a.flip); continue; }
      a.fly = null; a.t = 0; a.x = a.x2; a.y = a.y2; }
    const S = SPR.SEQ[a.seqN || a.n]; let acc = 0, f = -1, last = 0, fi = 0;
    for (let j = 0; j < S.seq.length; j++) { acc += S.seq[j][1]; if (a.t < acc) { f = S.seq[j][0]; fi = j; last = acc; break; } }
    if (f < 0) { SPR.list.splice(i, 1); continue; }
    if (!a.hitDone && fi >= S.hit) { a.hitDone = 1; try { a.onHit && a.onHit(); } catch (e) {} }
    const fade = fi === S.seq.length - 1 ? Math.max(0, (last - a.t) / S.seq[fi][1]) : 1;
    sprDraw(ctx, a.n, f, a.x, a.y, a.w, fade, a.flip, S.glow);
  }
  for (const [k, p] of SPR.live) { if (now - p.seenT > 120) { SPR.live.delete(k); continue; } p.age += dt / 60;   // 게임 발사체(파도)
    const f = p.age < .07 ? 1 : 2 + (Math.floor(p.age / .12) % 2); sprDraw(ctx, 'wave', f, p.x, p.y, p.w, 1, p.flip); }
}
const sprBusy = () => SPR.list.length + SPR.live.size > 0;
// 기술 이름·타입·종류 → 그림 이펙트 (k: 바꿀 종류)
const sprKind = (name, type, k) => { const n = String(name || ''), t = String(type || '').toUpperCase();
  if (t === 'GROUND' && k === 'pulse') return { k: 'target', spr: 'quake' };
  if (t === 'ELECTRIC' && (k === 'delayed' || k === 'pulse')) return { k: 'target', spr: 'thunder' };
  if (t === 'ROCK' && /스톤샤워|스톤에지|돌떨구기|암석봉인|떨어뜨리기|다이아스톰|운석/.test(n)) return { k: 'target', spr: 'rock' };
  if (t === 'WATER' && /파도|탁류|해수|근원의파동|물의파동|웨이브/.test(n)) return { k: 'projectile', spr: 'wave' };
  return null; };
// ===================== ⑤ 각성 기운 (9Z) — ★1~2 하늘색 테두리 · ★3~4 보라 + 번개 파지직 · ★5~6 금색 + 번개 많이 + 금빛 기운 =====================
const AWC = ['', '#7dd3fc', '#7dd3fc', '#c084fc', '#c084fc', '#fbbf24', '#fbbf24'];
function zig(ctx, x1, y1, x2, y2, col, w){ ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); for (let i = 1; i < 6; i++) { const u = i / 6; ctx.lineTo(x1 + (x2 - x1) * u + (Math.random() - .5) * 14, y1 + (y2 - y1) * u + (Math.random() - .5) * 14); } ctx.lineTo(x2, y2); ctx.stroke(); }
function auraAt(ctx, x, y, r, aw, t){ aw = Math.min(6, aw | 0); if (!aw) return; const col = AWC[aw];
  ctx.save(); ctx.globalCompositeOperation = 'source-over';
  if (aw >= 5) { ctx.globalAlpha = .22; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r * 2, 0, 7); ctx.fill(); }
  ctx.globalAlpha = .9; ctx.strokeStyle = col; ctx.lineWidth = 2 + aw * .6; ctx.beginPath(); ctx.arc(x, y, r + 4 + Math.sin(t / 50) * 1.5, 0, 7); ctx.stroke();
  if (aw >= 3) for (let k = 0; k < (aw >= 5 ? 4 : 2); k++) { const q = Math.random() * 6.28, r1 = r + 4, r2 = r + 16 + Math.random() * 12; zig(ctx, x + Math.cos(q) * r1, y + Math.sin(q) * r1, x + Math.cos(q + .4) * r2, y + Math.sin(q + .4) * r2, col, 1.8); }
  ctx.restore(); }
const CRK = [];   // 맞는 자리 번개 파지직 (근접·그림 이펙트·턴제)
function crkRender(ctx, dt){ for (let i = CRK.length - 1; i >= 0; i--) { const c = CRK[i]; c.t += dt / 60; if (c.t > c.d) { CRK.splice(i, 1); continue; }
  const col = AWC[c.aw], n = c.aw >= 5 ? 5 : c.aw >= 3 ? 3 : 1; ctx.save(); ctx.globalAlpha = 1 - c.t / c.d;
  ctx.strokeStyle = col; ctx.lineWidth = 3 + c.aw * .5; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * (1 + c.t / c.d * .4), 0, 7); ctx.stroke();
  if (c.aw >= 3) for (let k = 0; k < n; k++) { const q = Math.random() * 6.28, r1 = c.r * .5, r2 = c.r * (1.1 + Math.random() * .5); zig(ctx, c.x + Math.cos(q) * r1, c.y + Math.sin(q) * r1, c.x + Math.cos(q + .5) * r2, c.y + Math.sin(q + .5) * r2, col, 2.2); }
  if (c.aw >= 5) { ctx.globalAlpha *= .25; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 1.4, 0, 7); ctx.fill(); }
  ctx.restore(); } }
window.BEAMFX = {
  engine: BEAM.E, TYPE_SPECS: BEAM.S, countOf, meleeMode, _P: PROJ, _M: MEL,
  live(key, type, x1, y1, x2, y2, full, k, aw) {
    const E = BEAM.E; let b = LIVE.get(key);
    if (!b || E.beams.indexOf(b) < 0) {
      const spec = tid(BEAM.S, type);
      b = { spec, x1, y1, x2, y2, phase: 'fire', live: 1, fade: 8, k: 1, fireTimer: 1, maxFire: 1, impactTriggered: false };
      E.beams.push(b); LIVE.set(key, b);
      for (let i = 0; i < 10; i++) { const a = Math.random() * 6.283, d = 40 + Math.random() * 40;
        E.particles.push({ x: x1 + Math.cos(a) * d, y: y1 + Math.sin(a) * d, vx: -Math.cos(a) * d / 8, vy: -Math.sin(a) * d / 8, r: 2.5 + Math.random() * 3, color: i % 2 ? spec.cCore : spec.cMid, shape: 'orb', gravity: 0, drag: .95, rot: a, vRot: .1, life: 8, maxLife: 8, blend: spec.blend }); }
    }
    b.x1 = x1; b.y1 = y1; b.x2 = x2; b.y2 = y2; b.seen = 1; b.fade = 8; b.aw = aw | 0; b.k = k == null ? 1 : k; if (full) b.full = 1;
  },
  hit(type, x, y, ang) { try { BEAM.E._spawnImpact(tid(BEAM.S, type), x, y, ang || 0); } catch (e) {} },
  // 게임 발사체 그리기: key=게임 발사체 객체 · r=판정 반지름
  proj(key, type, x, y, ang, r, sp, mel, aw) {
    const E = PROJ.E; let p = E.live.get(key);
    if (!p) { const spec = tid(PROJ.S, type); p = { spec, x, y, vx: 0, vy: 0, angle: ang, rot: ang, r: 14, trail: [] }; E.live.set(key, p);
      for (let i = 0; i < 6; i++) { const a = ang + (Math.random() - .5) * .9, s = 2 + Math.random() * 5; E.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 2.5 + Math.random() * 2.5, color: spec.cCore, life: 12, maxLife: 12, blend: spec.blend }); } }
    const v = (sp || 430) / 60; p.vx = Math.cos(ang) * v; p.vy = Math.sin(ang) * v; p.x = x; p.y = y; p.angle = ang; p.r = Math.max(14, Math.min(32, (r || 14) * 1.4)) * (mel ? 1.25 : 1); p.mel = mel || 0; p.aw = aw | 0; p.seenT = performance.now();
  },
  pimpact(type, x, y, s) { try { PROJ.E._spawnImpact(tid(PROJ.S, type), x, y, s || 1); } catch (e) {} },
  // 턴제: 연사 (원본 fireBurst 그대로)
  burst(type, mode, x1, y1, x2, y2, n) { try { PROJ.E.fireBurst(tid(PROJ.S, type).id, mode || 'projectile', x1, y1, x2, y2, n || 1); } catch (e) {} },
  // 9V 턴제: 근접 기술을 날려 보냄 (도착하면 그 자리에서 베기·할퀴기·주먹·깨물기 터짐). 날아가는 시간(ms) 돌려줌
  meleeShot(type, mode, x1, y1, x2, y2, n, sc, gap) {
    const E = PROJ.E, spec = tid(PROJ.S, type), ang = Math.atan2(y2 - y1, x2 - x1), dist = Math.max(80, Math.hypot(x2 - x1, y2 - y1)), sp = 15.5, life = Math.max(10, Math.ceil(dist / sp)), fly = life * 16.667;
    n = n || 1; gap = gap || 155;
    for (let i = 0; i < n; i++) setTimeout(() => { const a = ang + (n > 1 ? (Math.random() - .5) * .14 : 0);
      E.projectiles.push({ spec, x: x1, y: y1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, angle: a, rot: a, r: 26 * (sc || .8), trail: [], life, maxLife: life, mel: mode || 'slash' });
      setTimeout(() => { try { const M = MEL.E; M.config.scale = sc || .7; M.fireBurst(tid(MEL.S, type).id, mode || 'slash', x1, y1, x1 + Math.cos(a) * dist, y1 + Math.sin(a) * dist, (mode || 'slash') === 'slash' ? 2 : 1); } catch (e) {} }, fly);
    }, i * gap);
    return fly;
  },
  AWC, crackle(x, y, r, aw, d) { aw = Math.min(6, aw | 0); if (aw > 0) CRK.push({ x, y, r: r || 60, aw, t: 0, d: d || .45 }); },
  sprKind,
  // 9W 그림 이펙트: 상대 발밑(x,y)에서 터짐. w=폭(월드 단위). onHit=맞는 칸에서 부름
  sprite(n, x, y, w, onHit) { SPR.list.push({ n, x, y, w: w || 240, t: 0, onHit }); },
  // 파도: (x1,y1)→(x2,y2)로 날아가 부서짐 (턴제)
  waveShot(x1, y1, x2, y2, w, T, onHit) { SPR.list.push({ n: 'wave', seqN: 'wave', w: w || 200, t: 0, flip: x2 < x1, fly: { x1, y1, x2, y2, T: T || .5 }, x2, y2, onHit }); },
  // 파도: 게임 발사체 따라 그리기 (실시간)
  waveLive(key, x, y, ang, w) { let p = SPR.live.get(key); if (!p) { p = { age: 0 }; SPR.live.set(key, p); } p.x = x; p.y = y; p.w = w; p.flip = Math.cos(ang) < 0; p.seenT = performance.now(); },
  waveCrash(x, y, w, flip) { SPR.list.push({ n: 'wave', seqN: 'wave', x, y, w: w || 200, t: 0, flip }); },
  // 9V-5 지진: 상대 발밑에서 땅이 터짐 — 빔 엔진 '땅' 충격(바위 파편·충격파) + 발사체 엔진 땅 충격 + 근접 엔진 충격파
  quake(type, x, y, sc) { try { sc = sc || 1; SPR.list.push({ n: 'quake', x, y: y + 30 * sc, w: 280 * sc, t: 0, onHit: () => { try { const bs = BEAM.S.find(s => s.id === 'ground'); BEAM.E._spawnImpact(bs, x, y, -Math.PI / 2); } catch (e) {} } }); } catch (e) {} },
  // 근접: mode 'slash'|'claw'|'punch'|'bite' · n 연타 · sc 크기
  melee(type, mode, x1, y1, x2, y2, n, sc) { try { const E = MEL.E; E.config.scale = sc || .6; E.fireBurst(tid(MEL.S, type).id, mode || 'slash', x1, y1, x2, y2, n || 1); } catch (e) {} },
  render(ctx) {
    const [n, dt] = dtNow(); let sk = 0;
    try { if (sprBusy()) sprRender(ctx, dt); if (CRK.length) crkRender(ctx, dt); } catch (e) { console.warn('SPRFX', e); }
    try { if (busyB()) { renderWorld(BEAM.E, ctx, n, dt); sk = Math.max(sk, BEAM.E.shake); } } catch (e) { console.warn('BEAMFX', e); }
    try { if (busyP()) { renderWorld(PROJ.E, ctx, n, dt); sk = Math.max(sk, PROJ.E.shake * .6); } } catch (e) { console.warn('PROJFX', e); }
    try { if (busyM()) { renderWorld(MEL.E, ctx, n, dt); sk = Math.max(sk, MEL.E.shake * .6); } } catch (e) { console.warn('MELEEFX', e); }
    for (const [k, b] of LIVE) if (BEAM.E.beams.indexOf(b) < 0) LIVE.delete(k);
    return sk;
  },
  get busy() { return busyB() || busyP() || busyM() || sprBusy() || CRK.length > 0; },
  clear() { for (const E of [BEAM.E, PROJ.E, MEL.E]) { for (const k of ['beams', 'particles', 'shockwaves', 'projectiles', 'effects']) if (E[k]) E[k].length = 0; E.shake = 0; } PROJ.E.live.clear(); LIVE.clear(); SPR.list.length = 0; SPR.live.clear(); CRK.length = 0; }
};
})();
