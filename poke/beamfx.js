/* 9T 빔 이펙트 엔진 (사용자가 준 'HDR 블룸 18속성 빔 공용 엔진'을 실시간 전투에 연결)
   - 원본 클래스·18속성 설정은 그대로, 게임 카메라 변환 대응(updateAndRenderWorld)과 '살아 있는 빔'(b.live) 따라 그리기만 덧붙임
   - 실시간 전투(rtbattle.js · rtteam.js · rtbrawl.js)의 빔 기술(k==='beam')이 쓸 때 window.BEAMFX.live(...) → render(...) */
(function(){
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
const LIVE = new Map(); let last = 0;
const TID = t => { t = String(t || 'normal').toLowerCase(); return TYPE_SPECS.some(s => s.id === t) ? t : 'normal'; };
window.BEAMFX = {
  engine: beamEngine, TYPE_SPECS,
  // key: 빔 쏘는 포켓몬(객체) · type: 'FIRE' 같은 게임 타입 · 시작점→끝점(월드 좌표) · full: 끝까지 뻗었는지 · k: 굵기(0~1)
  live(key, type, x1, y1, x2, y2, full, k) {
    let b = LIVE.get(key);
    if (!b || beamEngine.beams.indexOf(b) < 0) {
      const spec = TYPE_SPECS.find(s => s.id === TID(type));
      b = { spec, x1, y1, x2, y2, phase: 'fire', live: 1, fade: 8, k: 1, fireTimer: 1, maxFire: 1, impactTriggered: false };
      beamEngine.beams.push(b); LIVE.set(key, b);
      for (let i = 0; i < 10; i++) { const a = Math.random() * 6.283, d = 40 + Math.random() * 40;   // 쏘는 순간 모이는 빛
        beamEngine.particles.push({ x: x1 + Math.cos(a) * d, y: y1 + Math.sin(a) * d, vx: -Math.cos(a) * d / 8, vy: -Math.sin(a) * d / 8, r: 2.5 + Math.random() * 3, color: i % 2 ? spec.cCore : spec.cMid, shape: 'orb', gravity: 0, drag: .95, rot: a, vRot: .1, life: 8, maxLife: 8, blend: spec.blend }); }
    }
    b.x1 = x1; b.y1 = y1; b.x2 = x2; b.y2 = y2; b.seen = 1; b.fade = 8; b.k = k == null ? 1 : k; if (full) b.full = 1;
  },
  hit(type, x, y, ang) { try { const spec = TYPE_SPECS.find(s => s.id === TID(type)); beamEngine._spawnImpact(spec, x, y, ang || 0); } catch (e) {} },
  render(ctx) {
    const n = performance.now(), dt = last ? Math.min(4, (n - last) / 16.667) : 1; last = n;
    if (!beamEngine.busy) return 0;
    try { beamEngine.updateAndRenderWorld(ctx, n, dt); } catch (e) { console.warn('BEAMFX', e); }
    for (const [k, b] of LIVE) if (beamEngine.beams.indexOf(b) < 0) LIVE.delete(k);
    return beamEngine.shake;
  },
  clear() { beamEngine.beams.length = 0; beamEngine.particles.length = 0; beamEngine.shockwaves.length = 0; beamEngine.shake = 0; LIVE.clear(); }
};
})();
