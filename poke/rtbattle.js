/* 레조넌스 실시간 전투 (6B) — 야생 1대1 시험 전투
 * 규칙 출처: 레조넌스_전투규칙_명세서.md (60틱 고정, 아레나 1200x760, 구르기 2충전, 기술 4개)
 * 기존 전투는 건드리지 않고 별도 화면(캔버스)에서 돌아감. 저장 데이터(HP·경험치)는 바꾸지 않음(시험 모드).
 * 사용: RTB.start({me,foe,getSpr,sprKey,drawPm,stOf,eff,RZM,mv,META,TCOL,nm}) -> Promise('win'|'lose'|'draw'|'quit')
 */
(function(){
'use strict';
if(!window.BEAMFX&&!document.getElementById('beamfxJs')){try{const sc=document.createElement('script');sc.id='beamfxJs';sc.src='beamfx.js';document.head.appendChild(sc)}catch(er){}}   // 9T 빔 엔진
const TICK=1/60, AW=1200, AH=760, WALL=18;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=Math.random;
const GR=['L','M','H','X'];
const gradeOf=p=>p<=50?0:p<=80?1:p<=110?2:3;
const MELEE_K={melee:1,leap:1,vanish:1,roll:1};
const WARN_T=3;   // 9BL 몬스터 근접기 장판 시간(초)
const ST_MELEE=[12,17,24,34], ST_RANGE=[10,14,21,30];
const WALK_ST=[.6,.35,0,0];            // 준비 중 걷기 배율
const REC=[12,16,22,30], REC_MV=[.5,.5,.25,0];
const TURN=[720,540,240,150], LOCK=[3,5,9,14];
const STUN=[8,13,20,28], KB=[20,42,70,110], HSTOP=[.05,.083,.117,.15];
const ACTIVE_MELEE=[4,5,6,8];
const dirRow=(dx,dy)=>{const a=Math.atan2(dy,dx);const o=((Math.round(a/(Math.PI/4))%8)+8)%8;return[2,1,0,7,6,5,4,3][o]};
const len=(x,y)=>Math.hypot(x,y);
const norm=(x,y)=>{const L=Math.hypot(x,y)||1;return{x:x/L,y:y/L}};
const angDiff=(a,b)=>{let d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d};
const stageMul=s=>s>=0?(2+s)/2:2/(2-s);
// ===== ② 특성 A단계 (2026-11-22) — 난이도 6 이상에서만(C.abils가 목록을 줄 때). 한 포켓몬이 가진 특성 전부가 동시에 적용 =====
const AB_NAME={"STENCH":"악취","DRIZZLE":"잔비","SPEEDBOOST":"가속","BATTLEARMOR":"전투무장","STURDY":"옹골참","DAMP":"습기","LIMBER":"유연","SANDVEIL":"모래숨기","STATIC":"정전기","VOLTABSORB":"축전","WATERABSORB":"저수","OBLIVIOUS":"둔감","CLOUDNINE":"날씨부정","COMPOUNDEYES":"복안","INSOMNIA":"불면","COLORCHANGE":"변색","IMMUNITY":"면역","FLASHFIRE":"타오르는불꽃","SHIELDDUST":"인분","OWNTEMPO":"마이페이스","SUCTIONCUPS":"흡반","INTIMIDATE":"위협","SHADOWTAG":"그림자밟기","ROUGHSKIN":"까칠한피부","WONDERGUARD":"불가사의부적","LEVITATE":"부유","EFFECTSPORE":"포자","SYNCHRONIZE":"싱크로","CLEARBODY":"클리어바디","NATURALCURE":"자연회복","LIGHTNINGROD":"피뢰침","SERENEGRACE":"하늘의은총","SWIFTSWIM":"쓱쓱","CHLOROPHYLL":"엽록소","ILLUMINATE":"발광","TRACE":"트레이스","HUGEPOWER":"천하장사","POISONPOINT":"독가시","INNERFOCUS":"정신력","MAGMAARMOR":"마그마의무장","WATERVEIL":"수의베일","MAGNETPULL":"자력","SOUNDPROOF":"방음","RAINDISH":"젖은접시","SANDSTREAM":"모래날림","PRESSURE":"프레셔","THICKFAT":"두꺼운지방","EARLYBIRD":"일찍기상","FLAMEBODY":"불꽃몸","RUNAWAY":"도주","KEENEYE":"날카로운눈","HYPERCUTTER":"괴력집게","PICKUP":"픽업","TRUANT":"게으름","HUSTLE":"의욕","CUTECHARM":"헤롱헤롱바디","PLUS":"플러스","MINUS":"마이너스","FORECAST":"기분파","STICKYHOLD":"점착","SHEDSKIN":"탈피","GUTS":"근성","MARVELSCALE":"이상한비늘","LIQUIDOOZE":"해감액","OVERGROW":"심록","BLAZE":"맹화","TORRENT":"급류","SWARM":"벌레의알림","ROCKHEAD":"돌머리","DROUGHT":"가뭄","ARENATRAP":"개미지옥","VITALSPIRIT":"의기양양","WHITESMOKE":"하얀연기","PUREPOWER":"순수한힘","SHELLARMOR":"조가비갑옷","AIRLOCK":"에어록","TANGLEDFEET":"갈지자걸음","MOTORDRIVE":"전기엔진","RIVALRY":"투쟁심","STEADFAST":"불굴의마음","SNOWCLOAK":"눈숨기","GLUTTONY":"먹보","ANGERPOINT":"분노의경혈","UNBURDEN":"곡예","HEATPROOF":"내열","SIMPLE":"단순","DRYSKIN":"건조피부","DOWNLOAD":"다운로드","IRONFIST":"철주먹","POISONHEAL":"포이즌힐","ADAPTABILITY":"적응력","SKILLLINK":"스킬링크","HYDRATION":"촉촉바디","SOLARPOWER":"선파워","QUICKFEET":"속보","NORMALIZE":"노말스킨","SNIPER":"스나이퍼","MAGICGUARD":"매직가드","NOGUARD":"노가드","STALL":"시간벌기","TECHNICIAN":"테크니션","LEAFGUARD":"리프가드","KLUTZ":"서투름","MOLDBREAKER":"틀깨기","SUPERLUCK":"대운","AFTERMATH":"유폭","ANTICIPATION":"위험예지","FOREWARN":"예지몽","UNAWARE":"천진","TINTEDLENS":"색안경","FILTER":"필터","SLOWSTART":"슬로스타트","SCRAPPY":"배짱","STORMDRAIN":"마중물","ICEBODY":"아이스바디","SOLIDROCK":"하드록","SNOWWARNING":"눈퍼뜨리기","HONEYGATHER":"꿀모으기","FRISK":"통찰","RECKLESS":"이판사판","MULTITYPE":"멀티타입","FLOWERGIFT":"플라워기프트","BADDREAMS":"나이트메어","PICKPOCKET":"나쁜손버릇","SHEERFORCE":"우격다짐","CONTRARY":"심술꾸러기","UNNERVE":"긴장감","DEFIANT":"오기","DEFEATIST":"무기력","CURSEDBODY":"저주받은바디","HEALER":"치유의마음","FRIENDGUARD":"프렌드가드","WEAKARMOR":"깨어진갑옷","HEAVYMETAL":"헤비메탈","LIGHTMETAL":"라이트메탈","MULTISCALE":"멀티스케일","TOXICBOOST":"독폭주","FLAREBOOST":"열폭주","HARVEST":"수확","TELEPATHY":"텔레파시","MOODY":"변덕쟁이","OVERCOAT":"방진","POISONTOUCH":"독수","REGENERATOR":"재생력","BIGPECKS":"부풀린가슴","SANDRUSH":"모래헤치기","WONDERSKIN":"미라클스킨","ANALYTIC":"애널라이즈","ILLUSION":"일루전","IMPOSTER":"괴짜","INFILTRATOR":"틈새포착","MUMMY":"미라","MOXIE":"자기과신","JUSTIFIED":"정의의마음","RATTLED":"주눅","MAGICBOUNCE":"매직미러","SAPSIPPER":"초식","PRANKSTER":"짓궂은마음","SANDFORCE":"모래의힘","IRONBARBS":"철가시","ZENMODE":"달마모드","VICTORYSTAR":"승리의별","TURBOBLAZE":"터보블레이즈","TERAVOLT":"테라볼티지","AROMAVEIL":"아로마베일","FLOWERVEIL":"플라워베일","CHEEKPOUCH":"볼주머니","PROTEAN":"변환자재","FURCOAT":"퍼코트","MAGICIAN":"매지션","BULLETPROOF":"방탄","COMPETITIVE":"승기","STRONGJAW":"옹골찬턱","REFRIGERATE":"프리즈스킨","SWEETVEIL":"스위트베일","STANCECHANGE":"배틀스위치","GALEWINGS":"질풍날개","MEGALAUNCHER":"메가런처","GRASSPELT":"풀모피","SYMBIOSIS":"공생","TOUGHCLAWS":"단단한발톱","PIXILATE":"페어리스킨","GOOEY":"미끈미끈","AERILATE":"스카이스킨","PARENTALBOND":"부자유친","DARKAURA":"다크오라","FAIRYAURA":"페어리오라","AURABREAK":"오라브레이크","PRIMORDIALSEA":"시작의바다","DESOLATELAND":"끝의대지","DELTASTREAM":"델타스트림","STAMINA":"지구력","WIMPOUT":"도망태세","EMERGENCYEXIT":"위기회피","WATERCOMPACTION":"꾸덕꾸덕굳기","MERCILESS":"무도한행동","SHIELDSDOWN":"리밋실드","STAKEOUT":"잠복","WATERBUBBLE":"수포","STEELWORKER":"강철술사","BERSERK":"발끈","SLUSHRUSH":"눈치우기","LONGREACH":"원격","LIQUIDVOICE":"촉촉보이스","TRIAGE":"힐링시프트","GALVANIZE":"일렉트릭스킨","SURGESURFER":"서핑테일","SCHOOLING":"어군","DISGUISE":"탈","BATTLEBOND":"유대변화","POWERCONSTRUCT":"스웜체인지","CORROSION":"부식","COMATOSE":"절대안깸","QUEENLYMAJESTY":"여왕의위엄","INNARDSOUT":"내용물분출","DANCER":"무희","BATTERY":"배터리","FLUFFY":"복슬복슬","DAZZLING":"비비드바디","SOULHEART":"소울하트","TANGLINGHAIR":"컬리헤어","RECEIVER":"리시버","POWEROFALCHEMY":"화학의힘","BEASTBOOST":"비스트부스트","RKSSYSTEM":"AR시스템","ELECTRICSURGE":"일렉트릭메이커","PSYCHICSURGE":"사이코메이커","MISTYSURGE":"미스트메이커","GRASSYSURGE":"그래스메이커","FULLMETALBODY":"메탈프로텍트","SHADOWSHIELD":"스펙터가드","PRISMARMOR":"프리즘아머","NEUROFORCE":"브레인포스","INTREPIDSWORD":"불요의검","DAUNTLESSSHIELD":"불굴의방패","LIBERO":"리베로","BALLFETCH":"볼줍기","COTTONDOWN":"솜털","PROPELLERTAIL":"스크루지느러미","MIRRORARMOR":"미러아머","GULPMISSILE":"그대로꿀꺽미사일","STALWART":"굳건한신념","STEAMENGINE":"증기기관","PUNKROCK":"펑크록","SANDSPIT":"모래뿜기","ICESCALES":"얼음인분","RIPEN":"숙성","ICEFACE":"아이스페이스","POWERSPOT":"파워스폿","MIMICRY":"의태","SCREENCLEANER":"배리어프리","STEELYSPIRIT":"강철정신","PERISHBODY":"멸망의바디","WANDERINGSPIRIT":"떠도는영혼","GORILLATACTICS":"무아지경","NEUTRALIZINGGAS":"화학변화가스","PASTELVEIL":"파스텔베일","HUNGERSWITCH":"꼬르륵스위치","QUICKDRAW":"퀵드로","UNSEENFIST":"보이지않는주먹","CURIOUSMEDICINE":"기묘한약","TRANSISTOR":"트랜지스터","DRAGONSMAW":"용의턱","CHILLINGNEIGH":"백의울음","GRIMNEIGH":"흑의울음","ASONECHILLINGNEIGH":"혼연일체","ASONEGRIMNEIGH":"혼연일체","ANGERSHELL":"분노의껍질","ARMORTAIL":"테일아머","BEADSOFRUIN":"재앙의구슬","COMMANDER":"사령탑","COSTAR":"협연","CUDCHEW":"되새김질","EARTHEATER":"흙먹기","ELECTROMORPHOSIS":"전기로바꾸기","GOODASGOLD":"황금몸","GUARDDOG":"파수견","HADRONENGINE":"하드론엔진","LINGERINGAROMA":"가시지않는향기","MYCELIUMMIGHT":"균사의힘","OPPORTUNIST":"편승","ORICHALCUMPULSE":"진홍빛고동","PROTOSYNTHESIS":"고대활성","PURIFYINGSALT":"정화의소금","QUARKDRIVE":"쿼크차지","ROCKYPAYLOAD":"바위나르기","SEEDSOWER":"넘치는씨","SHARPNESS":"예리함","SUPREMEOVERLORD":"총대장","SWORDOFRUIN":"재앙의검","TABLETSOFRUIN":"재앙의목간","THERMALEXCHANGE":"열교환","TOXICDEBRIS":"독치장","VESSELOFRUIN":"재앙의그릇","WELLBAKEDBODY":"노릇노릇바디","WINDPOWER":"풍력발전","WINDRIDER":"바람타기","ZEROTOHERO":"마이티체인지","SUPERSWEETSYRUP":"감미로운꿀","HOSPITALITY":"대접","TOXICCHAIN":"독사슬","MINDSEYE":"심안","EMBODYASPECT":"초상투영","EMBODYASPECT_1":"초상투영","EMBODYASPECT_2":"초상투영","EMBODYASPECT_3":"초상투영","POISONPUPPETEER":"독조종","TERASHIFT":"테라체인지","TERASHELL":"테라셸","TERAFORMZERO":"제로포밍","PIERCINGDRILL":"관통드릴","EELEVATE":"천정부지","DRAGONIZE":"드래곤스킨","MEGASOL":"메가솔라","SPICYSPRAY":"하바네로분출","FIREMANE":"불꽃의갈기","AURAGUARD":"파동의방호"};
const AB_ST=['burn','poison','paralysis','sleep','freeze'];
const abHas=(e,k)=>!!(e&&e.ab&&e.ab.length&&e.ab.includes(k));
const abStatus=e=>AB_ST.some(s=>e.ail&&e.ail[s]!=null);
const abNames=e=>(e&&e.ab||[]).map(k=>AB_NAME[k]||k).join('·');
// ===== ② 특성 H단계 (2026-11-22) — 코드 없는 특성 나머지 중 이 게임에서 뜻이 통하는 것 =====
// 내 포켓몬(side 0)만 특성이 있음. 값(×1.33·×1.3·×2·1/8 등)은 원작 기준으로 내가 정함.
// 배율은 abDmg · 무효화는 abGuard · 맞은 뒤는 abHAfter · 상태 막기는 abHBlock · 등장은 abHEnter · 주기는 abHUp
function abHTer(e,t){if(!wxOn())return false;const T=RZ3_TER[t],R=rz3();R.ter=t;R.tt=RZ3_TER_SEC;R.tx=e.x;R.ty=e.y;R.gt=RZ3_GRASS_EVERY;W.fx.push({k:'ring',sys:1,x:e.x,y:e.y,t:0,life:.8,r:180,c:T.c});return true}
function abHEnter(e,foe,k){
  const say=(t,c)=>floatTxt(e.x,e.y-135,t,c||'#ffe14a',true);
  if(k==='HADRONENGINE'){if(abHTer(e,'electric'))say('하드론엔진!','#ffe14a');return true}
  if(k==='ORICHALCUMPULSE'){if(wxSet('sun',WX_AB_SEC))say('진홍빛고동!','#ff9a4a');return true}
  if(k==='DESOLATELAND'){if(wxSet('sun',180))say('끝의대지!','#ff7a3a');return true}   // 원작은 있는 동안 계속 → 전투 길이만큼
  if(k==='PRIMORDIALSEA'){if(wxSet('rain',180))say('시작의바다!','#6aa8ff');return true}
  return false}
// 상태이상 막기: 정화의소금·절대안깸=전부 / 플라워베일=풀 타입 / 열교환=화상
function abHBlock(e,s){
  if(s!=='toxic'&&!AB_ST.includes(s))return false;
  if(abHas(e,'PURIFYINGSALT')||abHas(e,'COMATOSE'))return true;
  if(abHas(e,'FLOWERVEIL')&&e.types.includes('GRASS'))return true;
  if(s==='burn'&&abHas(e,'THERMALEXCHANGE'))return true;
  return false}
function abHUp(e){
  const tw=!!(W&&W.rz2&&W.rz2.tw>0);
  if(abHas(e,'WINDRIDER')){if(tw&&!e._wrT){e._wrT=1;floatTxt(e.x,e.y-135,'바람타기!','#b8d0ff',true);abStage(e,'atk',1,true)}if(!tw)e._wrT=0}   // 순풍이 켜질 때마다 공격 +1
  if(abHas(e,'BADDREAMS')){const f=foeOf(e);if(f&&f.hp>0&&f.ail&&f.ail.sleep!=null&&abEvery(e,'BADDREAMS',6))abChip(f,.125,'나이트메어')}}   // 잠든 상대 6초마다 1/8
function abHAfter(att,def,m,dmg,crit,hb){
  if(!(dmg>0))return;
  const ty=m.type,fl=(m.d&&m.d.fl)||[];
  const say=(x,t,c)=>floatTxt(x.x,x.y-130,t,c||'#ffe14a',true);
  if(def&&def.ab&&def.ab.length){
    if(def.hp>0){
      if(abHas(def,'COLORCHANGE')&&!m.typeless&&!def.tera&&!(def.types.length===1&&def.types[0]===ty)){def.types=[ty];say(def,'변색!','#ffb0ff')}
      if(abHas(def,'THERMALEXCHANGE')&&ty==='FIRE'){say(def,'열교환!','#ff9a4a');abStage(def,'atk',1,true)}
      if(abHas(def,'STEAMENGINE')&&(ty==='FIRE'||ty==='WATER')){say(def,'증기기관!','#ffd9a0');abStage(def,'spe',3,true)}
      if(abHas(def,'WATERCOMPACTION')&&ty==='WATER'){say(def,'꾸덕꾸덕굳기!','#9cf');abStage(def,'def',2,true)}
      if(abHas(def,'ELECTROMORPHOSIS')||(abHas(def,'WINDPOWER')&&fl.includes('Wind'))){def.chgE=1;say(def,'충전!','#ffe14a')}
      if(abHas(def,'COTTONDOWN')&&att.hp>0){say(def,'솜털!','#fff');abStage(att,'spe',-1,false)}
      if(abHas(def,'SANDSPIT')&&wxSet('sand',WX_AB_SEC))say(def,'모래뿜기!','#e6c27a');
      if(abHas(def,'SEEDSOWER')&&abHTer(def,'grassy'))say(def,'넘치는씨!','#7dff8a');
      if(abHas(def,'ANGERSHELL')&&hb>def.max*.5&&def.hp<=def.max*.5){say(def,'분노의껍질!','#ff6a4a');abStage(def,'atk',1,true);abStage(def,'spa',1,true);abStage(def,'spe',1,true);abStage(def,'def',-1,true);abStage(def,'spd',-1,true)}
    }else if(att.hp>0&&abHas(def,'INNARDSOUT')){abChip(att,Math.min(.6,hb/Math.max(1,def.max)),'내용물분출')}   // 쓰러질 때 받던 체력만큼 상대도 아픔
  }
  if(att&&att.ab&&att.ab.length&&att.hp>0&&def.hp<=0){
    if(abHas(att,'SOULHEART')||abHas(att,'GRIMNEIGH')||abHas(att,'ASONEGRIMNEIGH')){say(att,AB_NAME[abHas(att,'SOULHEART')?'SOULHEART':'GRIMNEIGH']+'!','#ffb347');abStage(att,'spa',1,true)}
    if(abHas(att,'CHILLINGNEIGH')||abHas(att,'ASONECHILLINGNEIGH')){say(att,'백의울음!','#ffb347');abStage(att,'atk',1,true)}
  }}


// ===== ② 특성 B단계 (2026-11-22) — 등장할 때(처음 나올 때·교대로 나올 때) 발동. 날씨·장(場) 특성은 ③에서 =====
const AB_NOINTIM=['OWNTEMPO','OBLIVIOUS','INNERFOCUS','SCRAPPY'];
const AB_NOTRACE=['TRACE','MULTITYPE','STANCECHANGE','FORECAST','DISGUISE','ILLUSION','POWEROFALCHEMY','RECEIVER','IMPOSTER','FLOWERGIFT','ZENMODE','COMMANDER','ICEFACE','HUNGERSWITCH','SCHOOLING','BATTLEBOND','POWERCONSTRUCT','RKSSYSTEM','SHIELDSDOWN','NEUTRALIZINGGAS','GULPMISSILE','WONDERGUARD','PROTOSYNTHESIS','QUARKDRIVE','TERASHIFT','TERASHELL','TERAFORMZERO','EMBODYASPECT','ZEROTOHERO'];
const AB_MOLD=['MOLDBREAKER','TERAVOLT','TURBOBLAZE'];
// 능력치 단계를 바꿀 때 특성이 끼어드는 곳(클리어바디·괴력집게 막기, 심술꾸러기 뒤집기, 단순 2배, 오기·승기 반응)
function abStage(e,k,n,self){   // self=true: 내가 내 단계를 바꿈(막기·오기 반응 없음, 심술꾸러기·단순은 적용)
  if(!e||e.hp<=0)return false;
  if(abHas(e,'CONTRARY'))n=-n;else if(abHas(e,'SIMPLE'))n*=2;
  if(!self&&n<0&&!e.side&&W&&W.rz3&&W.rz3.fx.mist>0){floatTxt(e.x,e.y-90,'흰안개가 막았다!','#e8f0ff');return false}   // ③ 3/3 흰안개: 내 능력치를 못 깎음
  if(!self&&n<0&&(abHas(e,'CLEARBODY')||abHas(e,'WHITESMOKE')||abHas(e,'FULLMETALBODY')||(k==='atk'&&abHas(e,'HYPERCUTTER'))||(k==='def'&&abHas(e,'BIGPECKS'))||(abHas(e,'FLOWERVEIL')&&e.types.includes('GRASS')))){floatTxt(e.x,e.y-90,'막았다!','#9cf');return false}
  addStage(e,k,n);
  if(!self&&n<0){if(abHas(e,'DEFIANT'))addStage(e,'atk',2);if(abHas(e,'COMPETITIVE'))addStage(e,'spa',2)}
  return true}
// 프레셔: 상대(프레셔 가진 쪽의 적)의 기술 쿨타임 ×1.15
function pressMul(e){try{if(!W||!W.me||!W.foe)return 1;const o=e===W.me?W.foe:e===W.foe?W.me:null;return(o&&abHas(o,'PRESSURE')?1.15:1)*(W.rz2?rz2Cd(e):1)}catch(er){return 1}}
// E단계 주기(upkeep) 특성 — 내 포켓몬(side 0)만 e.ab가 있으니 자연히 내 쪽만 작동. 원본 upkeepSec=6 · speedBoostSec=7(상한 2) · moodySec=10 · shedSkinChance=1/3 · poisonHeal=1/8
// (날씨가 필요한 선파워·건조피부·촉촉바디·아이스바디·젖은접시는 ③ 날씨 뒤, 수확은 열매 도구 뒤, 근성·이상한비늘·속보·무기력의 upkeep은 표시용이라 A단계 배율로 충분)
function abEvery(e,k,sec){e.abTm=e.abTm||{};e.abTm[k]=(e.abTm[k]||0)+TICK;if(e.abTm[k]>=sec){e.abTm[k]-=sec;return true}return false}
function abUpkeep(e){
  if(!e.ab||!e.ab.length||e.hp<=0)return;
  if(typeof abHUp==='function')abHUp(e);   // H: 바람타기·나이트메어
  if(abHas(e,'SPEEDBOOST')&&e.stg.spe<2&&abEvery(e,'SPEEDBOOST',7)){floatTxt(e.x,e.y-135,'가속!','#ffe14a',true);abStage(e,'spe',1,true)}
  if(abHas(e,'PICKUP')&&!e._pick&&e.hp>0&&e.hp<=e.max*.5){e._pick=1;const h=Math.max(1,Math.round((e.pctMax||e.max)*.125));e.hp=Math.min(e.max,e.hp+h);floatTxt(e.x,e.y-135,'픽업! +'+fmtN(h*kOf(e)),'#7dff8a',true)}   // F: 픽업 — 나올 때마다 한 번, 체력 절반 아래에서 1/8 회복(원본 pickupHeal·pickupHpFrac)
  if(abHas(e,'SHEDSKIN')&&abStatus(e)&&abEvery(e,'SHEDSKIN',6)&&rnd()<1/3){for(const k of AB_ST)delete e.ail[k];floatTxt(e.x,e.y-135,'탈피!','#9cf',true)}
  if(abHas(e,'POISONHEAL')&&e.ail&&e.ail.poison!=null&&e.hp<e.max&&abEvery(e,'POISONHEAL',6)){const h=Math.min(e.max-e.hp,Math.max(1,Math.round((e.pctMax||e.max)*.125)));e.hp+=h;floatTxt(e.x,e.y-80,'+'+fmtN(h*kOf(e)),'#7dff8a')}
  if(abHas(e,'MOODY')&&abEvery(e,'MOODY',10)){const K=['atk','def','spa','spd','spe'],up=K.filter(k=>e.stg[k]<3);if(up.length){const a=up[Math.floor(rnd()*up.length)%up.length],dn=K.filter(k=>k!==a&&e.stg[k]>-3),b=dn.length?dn[Math.floor(rnd()*dn.length)%dn.length]:null;floatTxt(e.x,e.y-135,'변덕쟁이!','#ffb347',true);abStage(e,a,2,true);if(b)abStage(e,b,-1,true)}}
  {const wk=W&&W.wx&&W.wx.k;   // ③ 날씨가 필요한 주기 특성 (이로운 것만: 선파워·건조피부의 날씨 피해는 사용자 방침상 뺌)
   if(wk==='rain'&&abHas(e,'DRYSKIN')&&e.hp<e.max&&abEvery(e,'DRYSKIN',6)){const h=Math.min(e.max-e.hp,Math.max(1,Math.round((e.pctMax||e.max)*.125)));e.hp+=h;floatTxt(e.x,e.y-80,'+'+fmtN(h*kOf(e)),'#7dff8a')}
   if(wk==='rain'&&abHas(e,'RAINDISH')&&e.hp<e.max&&abEvery(e,'RAINDISH',6)){const h=Math.min(e.max-e.hp,Math.max(1,Math.round((e.pctMax||e.max)*.0625)));e.hp+=h;floatTxt(e.x,e.y-80,'+'+fmtN(h*kOf(e)),'#7dff8a')}
   if(wk==='snow'&&abHas(e,'ICEBODY')&&e.hp<e.max&&abEvery(e,'ICEBODY',6)){const h=Math.min(e.max-e.hp,Math.max(1,Math.round((e.pctMax||e.max)*.0625)));e.hp+=h;floatTxt(e.x,e.y-80,'+'+fmtN(h*kOf(e)),'#7dff8a')}
   if(wk==='rain'&&abHas(e,'HYDRATION')&&abStatus(e)&&abEvery(e,'HYDRATION',6)){for(const k of AB_ST)delete e.ail[k];floatTxt(e.x,e.y-135,'촉촉바디!','#9cf')}}
}
function abEnterOne(e,foe,k){
  const say=(t,c)=>floatTxt(e.x,e.y-135,t,c||'#ffe14a',true);
  if(abHEnter(e,foe,k))return;   // H: 하드론엔진·진홍빛고동·끝의대지·시작의바다
  if(k==='DROUGHT'||k==='DRIZZLE'||k==='SANDSTREAM'||k==='SNOWWARNING'){   // ③ 날씨 특성: 가뭄·잔비·모래날림·눈퍼뜨리기 (20초)
    const wk={DROUGHT:'sun',DRIZZLE:'rain',SANDSTREAM:'sand',SNOWWARNING:'snow'}[k];
    if(wxSet(wk,WX_AB_SEC))say(AB_NAME[k]+'!');
    return;
  }
  if(k==='GRASSYSURGE'||k==='ELECTRICSURGE'||k==='MISTYSURGE'||k==='PSYCHICSURGE'){   // F: 장 메이커 — 등장 때 내 자리에 20초 장
    if(!wxOn())return;
    const t={GRASSYSURGE:'grassy',ELECTRICSURGE:'electric',MISTYSURGE:'misty',PSYCHICSURGE:'psychic'}[k],T=RZ3_TER[t],R=rz3();
    R.ter=t;R.tt=RZ3_TER_SEC;R.tx=e.x;R.ty=e.y;R.gt=RZ3_GRASS_EVERY;say(AB_NAME[k]+'!',T.c);W.fx.push({k:'ring',sys:1,x:e.x,y:e.y,t:0,life:.8,r:180,c:T.c});
    return;
  }
  if(k==='INTREPIDSWORD'){abStage(e,'atk',1,true);say('불요의검!','#ffb347');return}   // G
  if(k==='DAUNTLESSSHIELD'){abStage(e,'def',1,true);say('불굴의방패!','#7fb5ff');return}
  if(k==='INTIMIDATE'){
    if(!foe||foe.hp<=0)return;say('위협!','#ffb347');
    if(AB_NOINTIM.some(x=>abHas(foe,x))){floatTxt(foe.x,foe.y-90,'소용없다!','#9cf');return}
    if(abStage(foe,'atk',-1))foe.stgT=Math.max(foe.stgT,16);   // 원본 intimidateSec=16초
    if(abHas(foe,'RATTLED'))abStage(foe,'spe',1);
  }else if(k==='DOWNLOAD'){
    if(!foe||foe.hp<=0)return;say('다운로드!','#7fe3ff');
    const d=foe.st[2]*stageMul(foe.stg.def),sp=foe.st[4]*stageMul(foe.stg.spd);
    abStage(e,d<sp?'atk':'spa',1);
  }else if(k==='TRACE'){
    if(!foe)return;const t=(foe.ab||[]).find(x=>!AB_NOTRACE.includes(x));if(!t)return;
    const i=e.ab.indexOf('TRACE');if(i>=0)e.ab[i]=t;say('트레이스! '+(AB_NAME[t]||t),'#c9a0ff');abEnterOne(e,foe,t);
  }else if(k==='FOREWARN'){
    if(!foe)return;let b=null;for(const m of foe.moves){if(m&&(!b||(m.p||0)>(b.p||0)))b=m}
    if(b)say('예지몽! '+(foe.mon&&foe.mon.n!=null?'':'')+b.name,'#ffe14a');
  }else if(k==='ANTICIPATION'){
    if(!foe)return;const ty=e.tera?[e.tera]:e.types;
    if(foe.moves.some(m=>m&&m.p>0&&!m.typeless&&C.eff(m.type,ty)>=2))say('위험예지! 위험한 기술이 있다','#ff8a8a');
  }else if(k==='PRESSURE'){say('프레셔!','#ffb0ff')}
  else if(AB_MOLD.includes(k)){say((AB_NAME[k]||'틀깨기')+'!','#ffcf8a')}
}
function abEnter(e,foe){try{if(!e||!e.ab||!e.ab.length)return;for(const k of e.ab.slice())abEnterOne(e,foe,k)}catch(er){console.warn('abEnter',er)}}
// ===== ② 특성 D단계 (2026-11-22) — 무효화(guard)·흡수·상태 막기(blockStatus) =====
// 타입을 흡수하는 특성: 맞으면 피해 0 + 보너스(회복·능력치). 틀깨기 계열이 때리면 무시
function abGuard(att,def,m,e){
  if(!def||!def.ab||!def.ab.length)return false;
  if(AB_MOLD.some(k=>abHas(att,k)))return false;
  const ty=m.type,fl=(m.d&&m.d.fl)||[];
  const say=t=>floatTxt(def.x,def.y-95,t,'#9be7ff',true);
  const heal=()=>{const h=Math.min(def.max-def.hp,Math.round(def.max*.25));if(h>0){def.hp+=h;floatTxt(def.x,def.y-115,'+'+fmtN(h*kOf(def)),'#6f6')}};   // 원본 absorbHeal=.25
  if(abHas(def,'LEVITATE')&&ty==='GROUND'&&!(W.rz3&&rz3Grav(att))){say('부유!');return true}
  if(abHas(def,'VOLTABSORB')&&ty==='ELECTRIC'){say('축전!');heal();return true}
  if((abHas(def,'WATERABSORB')||abHas(def,'DRYSKIN'))&&ty==='WATER'){say(abHas(def,'WATERABSORB')?'저수!':'건조피부!');heal();return true}
  if(abHas(def,'FLASHFIRE')&&ty==='FIRE'){say('타오르는불꽃!');def.ffOn=1;return true}   // 이후 내 불꽃 기술 ×1.5
  if(abHas(def,'LIGHTNINGROD')&&ty==='ELECTRIC'){say('피뢰침!');abStage(def,'spa',1,true);return true}
  if(abHas(def,'STORMDRAIN')&&ty==='WATER'){say('마중물!');abStage(def,'spa',1,true);return true}
  if(abHas(def,'MOTORDRIVE')&&ty==='ELECTRIC'){say('전기엔진!');abStage(def,'spe',1,true);return true}
  if(abHas(def,'SAPSIPPER')&&ty==='GRASS'){say('초식!');abStage(def,'atk',1,true);return true}
  if(abHas(def,'WONDERGUARD')&&m.p>0&&e<2){say('불가사의부적!');return true}
  if(abHas(def,'SOUNDPROOF')&&fl.includes('Sound')){say('방음!');return true}
  if(abHas(def,'BULLETPROOF')&&fl.includes('Bullet')){say('방탄!');return true}
  if(abHas(def,'EARTHEATER')&&ty==='GROUND'&&!(W.rz3&&rz3Grav(att))){say('흙먹기!');heal();return true}
  if(abHas(def,'OVERCOAT')&&fl.includes('Powder')){say('방진!');return true}
  if(abHas(def,'WELLBAKEDBODY')&&ty==='FIRE'){say('노릇노릇바디!');abStage(def,'def',2,true);return true}   // H
  if(abHas(def,'WINDRIDER')&&fl.includes('Wind')){say('바람타기!');abStage(def,'atk',1,true);return true}   // H
  return false}
// 상태이상 막기: 상태 이름 → 막는 특성
const AB_BLOCK={paralysis:['LIMBER'],sleep:['INSOMNIA','VITALSPIRIT','SWEETVEIL'],poison:['IMMUNITY','PASTELVEIL'],toxic:['IMMUNITY','PASTELVEIL'],burn:['WATERVEIL','WATERBUBBLE'],freeze:['MAGMAARMOR'],confusion:['OWNTEMPO'],flinch:['INNERFOCUS']};
function abBlockSt(e,s){const l=AB_BLOCK[s];if(e&&e.ab&&e.ab.length&&abHBlock(e,s))return true;if(e&&e.ab&&e.ab.length&&abHas(e,'LEAFGUARD')&&W&&W.wx&&W.wx.k==='sun'&&(s==='burn'||s==='poison'||s==='toxic'||s==='paralysis'||s==='sleep'||s==='freeze'))return true;   /* F: 리프가드 — 쾌청일 때 상태이상 막음 */return !!(l&&e&&e.ab&&e.ab.length&&l.some(k=>abHas(e,k)))}
// ===== ② 특성 C단계 (2026-11-22) — 맞은 뒤(afterHit): 접촉 상태이상·반사 피해·능력치 반응·KO 보너스 =====
// att=때린 쪽, def=맞은 쪽, hb=맞기 전 체력. 다단 기술의 뒤 타(opt.chain)는 안 부름(원본 contactOncePerCast)
const AB_CONTACT_CH=.3;   // 원본 consts.contactChance
function abChip(e,frac,why){if(!e||e.hp<=0)return;const v=Math.max(1,Math.round((e.pctMax||e.max)*frac));e.hp=Math.max(0,e.hp-v);floatTxt(e.x,e.y-100,why+' -'+fmtN(v*kOf(e)),'#f88');e.flash=Math.max(e.flash||0,.1)}
function abAfterHit(att,def,m,dmg,crit,hb){
  if(!(dmg>0))return;
  const fl=(m.d&&m.d.fl)||[],contact=fl.includes('Contact'),ty=m.type;
  const dab=def&&def.ab&&def.ab.length,aab=att&&att.ab&&att.ab.length;
  if(dab){
    const alive=def.hp>0;
    if(alive&&contact&&att.hp>0){
      if(abHas(def,'STATIC'))setAil(att,'paralysis',AB_CONTACT_CH*100);
      if(abHas(def,'FLAMEBODY'))setAil(att,'burn',AB_CONTACT_CH*100);
      if(abHas(def,'POISONPOINT'))setAil(att,'poison',AB_CONTACT_CH*100);
      if(abHas(def,'EFFECTSPORE')&&!att.types.includes('GRASS')&&!abHas(att,'OVERCOAT')&&rnd()<AB_CONTACT_CH){const r=rnd();setAil(att,r<1/3?'poison':r<2/3?'paralysis':'sleep',100)}
      if(abHas(def,'ROUGHSKIN')||abHas(def,'IRONBARBS'))abChip(att,.0625,'까칠한 피부');
      if(abHas(def,'TANGLINGHAIR')||abHas(def,'GOOEY')){floatTxt(def.x,def.y-130,'끈적!','#ffe14a');abStage(att,'spe',-1,true)}
    }
    if(!alive&&contact&&att.hp>0&&abHas(def,'AFTERMATH')&&!abHas(att,'DAMP')&&!abHas(def,'DAMP'))abChip(att,.25,'유폭');
    if(alive&&abHas(def,'CURSEDBODY')&&rnd()<AB_CONTACT_CH){const i=att.moves.indexOf(m);if(i>=0){att.cd[i]=Math.max(att.cd[i],4);floatTxt(att.x,att.y-130,'저주받은바디!','#c9a0ff')}}   // 원본 disableSec=4
    if(alive){
      if(abHas(def,'JUSTIFIED')&&ty==='DARK')abStage(def,'atk',1,true);
      if(abHas(def,'RATTLED')&&(ty==='BUG'||ty==='DARK'||ty==='GHOST'))abStage(def,'spe',1,true);
      if(abHas(def,'STAMINA'))abStage(def,'def',1,true);
      if(abHas(def,'WEAKARMOR')&&m.phys){abStage(def,'def',-1,true);abStage(def,'spe',2,true)}   // 원본 weakArmorDef −1, weakArmorSpe +2
      if(abHas(def,'ANGERPOINT')&&crit){def.stg.atk=3;def.stgT=8;floatTxt(def.x,def.y-130,'분노의경혈!','#ff6a4a',true)}   // 원본 angerPoint +3(최대)
      if(abHas(def,'BERSERK')&&hb>def.max*.5&&def.hp<=def.max*.5)abStage(def,'spa',1,true);
    }
  }
  if(aab&&att.hp>0){
    if(def.hp<=0&&abHas(att,'MOXIE')){abStage(att,'atk',1,true);floatTxt(att.x,att.y-130,'자기과신!','#ffb347',true)}
    if(def.hp>0&&contact&&abHas(att,'POISONTOUCH'))setAil(def,'poison',AB_CONTACT_CH*100);
    if(def.hp<=0&&abHas(att,'BEASTBOOST')){abStage(att,m.phys?'atk':'spa',1,true);floatTxt(att.x,att.y-130,'비스트부스트!','#ffb347',true)}   // G: 쓰러뜨리면 방금 쓴 기술 쪽 능력 +1(원작은 가장 높은 능력치)
    if(def.hp>0&&abHas(att,'TOXICCHAIN'))setAil(def,'poison',30);
    if(def.hp>0&&abHas(att,'STENCH'))setAil(def,'flinch',10);   // 원본 flinchChance=.1
  }
  try{abHAfter(att,def,m,dmg,crit,hb)}catch(er){console.warn('abHAfter',er)}   // H
}
// 맞는 쪽·때리는 쪽 특성이 주는 피해 배율 (원본 consts.mul 값 그대로)
const AB_AURA=1.33,AB_RUIN=1/.75;   // 다크·페어리오라 ×1.33 · 재앙의 4종은 상대 능력치 ×0.75라서 내 피해 ×1.333 / 받는 피해 ×0.75
function abDmg(att,def,m,e,crit){
  let x=1;const a=att&&att.ab,d=def&&def.ab;
  if(a&&a.length){
    const ph=!!m.phys,fl=(m.d&&m.d.fl)||[],ef=(m.d&&m.d.ef)||[],hpF=att.hp/Math.max(1,att.max),st=abStatus(att),ty=m.type;
    if(ph&&(abHas(att,'HUGEPOWER')||abHas(att,'PUREPOWER')))x*=2;
    if(ph&&abHas(att,'GUTS')&&st){x*=1.5;if(att.ail.burn)x*=2}   // 근성: 화상 공격력 반감을 무시
    if(ph&&abHas(att,'HUSTLE'))x*=1.5;
    if(att.ffOn&&abHas(att,'FLASHFIRE')&&ty==='FIRE')x*=1.5;   // 타오르는불꽃: 불꽃을 먹은 뒤 내 불꽃 기술
    if(abHas(att,'DEFEATIST')&&hpF<=.5)x*=.5;
    if(abHas(att,'ADAPTABILITY')&&!att.tera&&att.types.includes(ty))x*=2/1.5;
    if(abHas(att,'TECHNICIAN')&&m.p>0&&m.p<=60)x*=1.5;
    if(abHas(att,'IRONFIST')&&fl.includes('Punching'))x*=1.2;
    if(abHas(att,'TOUGHCLAWS')&&fl.includes('Contact'))x*=1.3;
    if(abHas(att,'STRONGJAW')&&fl.includes('Biting'))x*=1.5;
    if(abHas(att,'MEGALAUNCHER')&&fl.includes('Pulse'))x*=1.5;
    if(abHas(att,'RECKLESS')&&ef.some(f=>f.op==='recoil'))x*=1.2;
    if(abHas(att,'SHEERFORCE')&&ef.some(f=>(f.op==='status'||(f.op==='stat'&&f.who!=='user'))&&f.chance!=null&&f.chance<100))x*=1.3;
    if(abHas(att,'SNIPER')&&crit)x*=1.5;
    // G(코드 없는 특성 중 배율형): 값은 원작 기준으로 내가 정함
    if(abHas(att,'DARKAURA')&&ty==='DARK')x*=AB_AURA;
    if(abHas(att,'FAIRYAURA')&&ty==='FAIRY')x*=AB_AURA;
    if((abHas(att,'STEELWORKER')||abHas(att,'STEELYSPIRIT'))&&ty==='STEEL')x*=1.5;
    if(abHas(att,'DRAGONSMAW')&&ty==='DRAGON')x*=1.5;
    if(abHas(att,'SHARPNESS')&&fl.includes('Slicing'))x*=1.5;
    if(abHas(att,'PUNKROCK')&&fl.includes('Sound'))x*=1.3;
    if(ph&&abHas(att,'TOXICBOOST')&&att.ail.poison)x*=1.5;
    if(!ph&&abHas(att,'FLAREBOOST')&&att.ail.burn)x*=1.5;
    if(ph&&abHas(att,'SWORDOFRUIN'))x*=AB_RUIN;
    if(!ph&&abHas(att,'BEADSOFRUIN'))x*=AB_RUIN;
    if(abHas(att,'ANALYTIC')&&def&&def.cast&&def.cast.phase==='recovery')x*=1.3;   // F: 애널라이즈 — 상대가 기술을 쓰고 쉬는 중일 때
    if(abHas(att,'PARENTALBOND')&&m.k!=='beam'&&!(m.hits>1)&&!(m.d&&m.d.fan>1))x*=1.25;   // F: 부자유친 — 한 방짜리 기술
    if(abHas(att,'TINTEDLENS')&&e>0&&e<1)x*=2;
    // H(코드 없는 특성 나머지): 값은 원작 기준으로 내가 정함
    if(abHas(att,'HADRONENGINE')&&!ph&&W&&W.rz3&&W.rz3.ter==='electric'&&W.rz3.tt>0&&rz3In(att))x*=1.33;   // 일렉트릭필드 안 특수 ×1.33
    if(abHas(att,'ORICHALCUMPULSE')&&ph&&W&&W.wx&&W.wx.k==='sun')x*=1.33;   // 쾌청일 때 물리 ×1.33
    if(abHas(att,'TRANSISTOR')&&ty==='ELECTRIC')x*=1.3;
    if(att.chgE&&ty==='ELECTRIC'&&(abHas(att,'ELECTROMORPHOSIS')||abHas(att,'WINDPOWER'))){x*=2;att.chgE=0;floatTxt(att.x,att.y-130,'충전 방전!','#ffe14a',true)}   // 전기로바꾸기·풍력발전: 충전 뒤 다음 전기 기술 ×2
    if(abHas(att,'NEUROFORCE')&&e>1)x*=1.25;
    if((abHas(att,'PROTEAN')||abHas(att,'LIBERO'))&&!m.typeless&&!att.tera&&!att.types.includes(ty))x*=1.5;   // 변환자재·리베로: 쓰는 기술 타입이 내 타입이 됨 → 자속 보너스
    if(hpF<=1/3){if(abHas(att,'BLAZE')&&ty==='FIRE')x*=1.5;if(abHas(att,'TORRENT')&&ty==='WATER')x*=1.5;if(abHas(att,'OVERGROW')&&ty==='GRASS')x*=1.5;if(abHas(att,'SWARM')&&ty==='BUG')x*=1.5}
  }
  if(d&&d.length&&!(a&&AB_MOLD.some(k=>abHas(att,k)))){   // 틀깨기·테라볼티지·터보블레이즈는 맞는 쪽 특성을 무시
    const ph=!!m.phys,fl=(m.d&&m.d.fl)||[],ty=m.type,full=def.hp>=def.max;
    if(abHas(def,'THICKFAT')&&(ty==='FIRE'||ty==='ICE'))x*=.5;
    if(abHas(def,'HEATPROOF')&&ty==='FIRE')x*=.5;
    if(abHas(def,'WATERBUBBLE')&&ty==='FIRE')x*=.5;
    if((abHas(def,'FILTER')||abHas(def,'SOLIDROCK')||abHas(def,'PRISMARMOR'))&&e>=2)x*=.75;
    if((abHas(def,'MULTISCALE')||abHas(def,'SHADOWSHIELD'))&&full)x*=.5;
    if(abHas(def,'FLUFFY')){if(fl.includes('Contact'))x*=.5;if(ty==='FIRE')x*=2}
    if(abHas(def,'ICESCALES')&&!ph)x*=.5;
    if(abHas(def,'DRYSKIN')&&ty==='FIRE')x*=1.25;
    if(ph&&abHas(def,'FURCOAT'))x*=.5;
    if(abHas(def,'PUNKROCK')&&fl.includes('Sound'))x*=.5;
    if(abHas(def,'TERASHELL')&&full&&e>.5)x*=.5/e;   // G: 테라셸 — 체력이 가득이면 효과가 굉장해도 '별로'(×0.5)로 받음
    if(ph&&abHas(def,'GRASSPELT')){try{if(W.rz3&&W.rz3.ter==='grassy'&&rz3In(def))x/=1.5}catch(er){}}   // G: 풀모피 — 그래스필드 안에서 물리 방어 ×1.5
    if(ph&&abHas(def,'TABLETSOFRUIN'))x/=AB_RUIN;
    if(!ph&&abHas(def,'VESSELOFRUIN'))x/=AB_RUIN;
    if(ph&&abHas(def,'MARVELSCALE')&&abStatus(def))x/=1.5;
    if(abHas(def,'PURIFYINGSALT')&&ty==='GHOST')x*=.5;   // H: 정화의소금
  }
  return x}

// ===== ② 특성 F단계 (2026-11-22) — 나머지 특성: 옹골참·대운·전투무장·조가비갑옷·복안·하늘의은총·불굴의마음·싱크로·일찍기상·재생력·픽업·서핑테일·스킨 4종·매직가드·돌머리·인분·해감액·천진·모래숨기·눈숨기·갈지자걸음·리프가드·짓궂은마음·퀵드로·매직미러·미라클스킨·장 4종 메이커·애널라이즈·부자유친·스킬링크 =====
// 내 포켓몬(side 0)만 특성이 있어 이로운 건 자연히 내 쪽만. 해로운 건 상대만(싱크로·해감액·매직미러는 상대가 받음). 도구·성별·도망 막기·무게가 필요한 특성은 이 게임에 없어서 뺌.
const AB_SKIN={AERILATE:'FLYING',PIXILATE:'FAIRY',REFRIGERATE:'ICE',GALVANIZE:'ELECTRIC',DRAGONIZE:'DRAGON'};
const AB_VEIL_EVA=.12,AB_TANGLED_EVA=.15;   // 원본 evadeMul .88(회피 12%)·tangledMul .85(15%)
const abMold=a=>AB_MOLD.some(k=>abHas(a,k));
function abSkin(att){for(const k in AB_SKIN)if(abHas(att,k))return AB_SKIN[k];return null}   // 노말 기술을 다른 타입으로 바꿈(위력 ×1.2)
function abNoCrit(def,att){return(abHas(def,'BATTLEARMOR')||abHas(def,'SHELLARMOR'))&&!abMold(att)}
// 옹골참: 한 번 나올 때마다 한 번, 쓰러질 공격을 체력 1로 버팀 · 즉사기는 안 통함 (원본 sturdyPerStay=true — 체력 가득 조건은 원본 표에 없어 넣지 않음)
function abSturdy(att,def,m,dmg){
  if(!abHas(def,'STURDY')||abMold(att)||def.hp<=0)return dmg;
  if(m.exec){floatTxt(def.x,def.y-110,'옹골참!','#ffe14a',true);return 0}
  if(dmg>=def.hp&&def.hp>1&&!def._sturdy){def._sturdy=1;floatTxt(def.x,def.y-125,'옹골참! 버텼다','#ffe14a',true);return def.hp-1}
  return dmg}
// 모래숨기·눈숨기(그 날씨일 때)·갈지자걸음(혼란일 때): 맞기 전에 피할 확률
function abEvade(def){let q=0;const wk=W&&W.wx&&W.wx.k;
  if(wk==='sand'&&abHas(def,'SANDVEIL'))q=Math.max(q,AB_VEIL_EVA);
  if(wk==='snow'&&abHas(def,'SNOWCLOAK'))q=Math.max(q,AB_VEIL_EVA);
  if(abHas(def,'TANGLEDFEET')&&def.ail&&def.ail.confusion!=null)q=Math.max(q,AB_TANGLED_EVA);
  return q}
// 기술 준비동작: 짓궂은마음(변화 기술 ×0.5) · 퀵드로(공격 기술 30% 확률로 ×0.5)
function abSu(e,m){let s=m.su;if(!e.ab||!e.ab.length||!(s>0))return s;
  if(m.st&&abHas(e,'PRANKSTER'))s*=.5;
  else if(!m.st&&abHas(e,'QUICKDRAW')&&rnd()<.3){s*=.5;floatTxt(e.x,e.y-135,'퀵드로!','#ffe14a',true)}
  return Math.max(1,Math.round(s))}
// 상태이상에 걸린 뒤: 일찍기상(잠 절반은 setAil에서) · 싱크로(내가 화상·독·마비에 걸리면 상대도 같은 상태이상)
function abAfterStatus(def,s){
  if(s==='sleep'&&abHas(def,'EARLYBIRD'))floatTxt(def.x,def.y-135,'일찍기상!','#ffe14a',true);
  if(abHas(def,'SYNCHRONIZE')&&!def.side&&(s==='burn'||s==='poison'||s==='paralysis')&&!def._syncing){
    const f=foeOf(def);if(f&&f.hp>0&&f.side===1){def._syncing=1;floatTxt(def.x,def.y-135,'싱크로!','#c9a0ff',true);try{setAil(f,s,100)}finally{def._syncing=0}}}}
// 상대(컴퓨터)가 나에게 거는 변화 기술 효과: 미라클스킨(50% 막음) · 매직미러(상대에게 되돌림)
function abFoeStatus(att,def,m,f){
  if(!att||!def||att.side!==1||def.side!==0||!def.ab||!def.ab.length||abMold(att))return false;
  if(abHas(def,'GOODASGOLD')){floatTxt(def.x,def.y-110,'황금몸!','#ffd23f',true);return true}   // H
  if(abHas(def,'WONDERSKIN')&&rnd()<.5){floatTxt(def.x,def.y-110,'미라클스킨!','#ffb0d8',true);return true}
  if(abHas(def,'MAGICBOUNCE')){floatTxt(def.x,def.y-110,'매직미러!','#c9a0ff',true);for(const s in f.stages)abStage(att,s,f.stages[s],false);return true}
  return false}
// 상대 기술의 부가효과(상태이상·능력치 깎기) 거르기: 변화 기술=미라클스킨·매직미러, 공격 기술=인분
function abEfFilter(att,def,m){
  const ef=m.d.ef||[];
  if(!def||!att||att===def||att.side!==1||def.side!==0||!def.ab||!def.ab.length||abMold(att))return ef;
  const tg=f=>f.op==='status'||(f.op==='stat'&&f.who!=='user');
  if(!ef.some(tg))return ef;
  if(m.st){
    if(abHas(def,'GOODASGOLD')){floatTxt(def.x,def.y-110,'황금몸!','#ffd23f',true);return ef.filter(f=>!tg(f))}   // H: 황금몸 — 상대 변화 기술 효과 무효
    if(abHas(def,'WONDERSKIN')&&rnd()<.5){floatTxt(def.x,def.y-110,'미라클스킨!','#ffb0d8',true);return ef.filter(f=>!tg(f))}
    if(abHas(def,'MAGICBOUNCE')){floatTxt(def.x,def.y-110,'매직미러!','#c9a0ff',true);
      const back=ef.filter(tg);try{applyEf(def,att,Object.assign({},m,{d:Object.assign({},m.d,{ef:back})}),true)}catch(er){}
      return ef.filter(f=>!tg(f))}
  }else if(abHas(def,'SHIELDDUST')){floatTxt(def.x,def.y-110,'인분!','#cfd8ea');return ef.filter(f=>!tg(f))}
  return ef}
// 해감액: 상대가 나한테 체력을 빨면 회복 대신 아파함
function abOoze(att,def,dmg,f){
  if(att.side!==1||!abHas(def,'LIQUIDOOZE')||abMold(att))return false;
  const h=Math.max(1,Math.round(dmg*(f.frac||.5)));att.hp=Math.max(0,att.hp-h);floatTxt(att.x,att.y-100,'해감액 -'+fmtN(h*kOf(att)),'#c6c');return true}
// 반동: 매직가드는 전부 안 받음 · 돌머리는 최대 체력 반동(발버둥) 말고 안 받음
const abNoRecoil=(att,f)=>!!(att&&att.ab&&att.ab.length&&(abHas(att,'MAGICGUARD')||(abHas(att,'ROCKHEAD')&&f.of!=='max')));

let C=null, W=null; // 게임 도구 / 현재 전투 상태

// ---------- 쿨타임 (6C-1: 레조넌스 원본 공식 그대로) ----------
// 원본: sessionEnv 의 기술 쿨타임 함수 + data 설정값. 시험 모드에서 맞춘 값.
// 6C-4: 원본 설정값 — 연속기(rampage)·다단 충전(charges)·PP·발버둥·몸 크기
const RAMP={min:2,max:3,firstT:17,followT:6,gapT:8,armor:2,confuseSec:3,cdMul:2,powerMul:.75};
const CHG={max5:5,cap:5,canon:3.1,gm5Melee:[1.19,1.5,1.19,1.19],gm5Shot:1.125,gmFixMelee:1.1,gmFixShot:1,
  rs:{furyswipes:1.9,cometpunch:1.9,tailslap:2.5,doubleslap:1.3,furyattack:1.3,armthrust:1.3,doublekick:2.3,dualchop:3,doublehit:2.6,geargrind:3.6,doubleironbash:4.2,dualwingbeat:3,surgingstrikes:2.1,tripledive:2.2,triplekick:2,tripleaxel:3.3,populationbomb:1.5,furycutter:1.8,pinmissile:2.2,bulletseed:2.2,iciclespear:2.2,rockblast:2.2,bonerush:2.2,scaleshot:2.2,spikecannon:1.8,barrage:1.5,watershuriken:1.8,twineedle:2.1,bonemerang:3.9,dragondarts:3.4,twinbeam:3.2,tachyoncutter:4.3}};
const PPMUL=2,STRUGGLE={n:'발버둥',t:'NORMAL',c:0,p:40,a:100,pp:0,pr:0,k:'melee',kd:'strike',sb:'',aim:'direction',ef:[{op:'recoil',frac:.25,of:'max'}],f:'Struggle'};
const SIZE={ref:30,refH:.4,exp:.7,rf:.3,min:24,max:380,rmin:12,rmax:110,refSize:61,kbRef:30,kbExp:.5,kbMin:.4,mvRef:60,mvExp:.2,mvMin:.9,mvMax:1.3,meleeShare:.5};
const szMul=(e,melee)=>{const x=Math.pow((e.size||57)/SIZE.mvRef,SIZE.mvExp*(melee?SIZE.meleeShare:1));return melee?clamp(x,1-(1-SIZE.mvMin)*SIZE.meleeShare,1+(SIZE.mvMax-1)*SIZE.meleeShare):clamp(x,SIZE.mvMin,SIZE.mvMax)};
const CD={base:.7,perPower:.07,min:3.5,max:16,
  kind:{melee:.85,projectile:1,beam:1.15,pulse:1.15,self:1,vanish:1.25,leap:1,roll:1,zone:1,delayed:1,target:1},
  quick:.75,status:8,boost:12,protect:13,heal:20,recharge:16,rechargeNonBeam:6,rollPowerMul:4,
  cadence:1.2,paraRate:.8,hasteBase:1.05,hastePerStat:.0013,hasteMin:.88,hasteMax:1.05};
const opsOf=d=>(d.ef||[]).map(x=>x.op);
const hitsOf=d=>{const m=(d.ef||[]).find(x=>x.op==='multiHit');if(!m)return 1;if(m.n!=null)return clamp(Math.round(m.n),1,5);return 3};
const isExecute=d=>(d.ef||[]).some(x=>x.op==='fixed'&&x.mode==='execute');
// 기술 하나의 쿨타임(초, 속도 보정 전) + 속도 보정을 받는지
function cooldownOf(d,k,p,st){
  const ops=opsOf(d);
  if(st){ // 변화 기술
    const guard=ops.includes('guard');
    const heal=(d.ef||[]).some(x=>x.op==='heal'&&x.who!=='replacement'&&!x.revive&&x.frac!=null);
    const boost=(d.ef||[]).some(x=>(x.op==='stat'&&x.who!=='target')||(x.op==='crit'&&x.who!=null))&&d.tg==='User';
    return{sec:guard?CD.protect:heal?CD.heal:boost?CD.boost:CD.status,hasted:true};
  }
  const recharge=ops.includes('recharge'),exec=isExecute(d),explosive=ops.includes('selfKO')&&(d.ef||[]).some(x=>x.op==='note'&&x.t==='explosive');
  if(recharge&&d.k!=='beam')return{sec:CD.rechargeNonBeam,hasted:false};
  if(recharge||exec||explosive)return{sec:CD.recharge,hasted:false};
  const hits=hitsOf(d);
  let ep=d.p>1?(hits>1?d.p*hits:d.p):(hits>1?60*hits:60);
  if(k==='roll')ep*=CD.rollPowerMul;
  const sec=clamp(CD.base+CD.perPower*ep,CD.min,CD.max)*(CD.kind[k]||1)*(d.pr>0?CD.quick:1);
  return{sec,hasted:true};
}
// 속도 능력치 -> 쿨타임 배율 (빠를수록 짧음, 0.88~1.05)
const hasteOf=spe=>clamp(CD.hasteBase-CD.hastePerStat*spe,CD.hasteMin,CD.hasteMax);

// ---------- 기술 정보 ----------
function moveInfo(id){
  let d=id==='struggle'?STRUGGLE:((C.RZM&&C.RZM[id])||(C.SGD&&C.SGD[id]));   // 7F: 직접 만든 전설 기술(sg_*)은 host가 준 SGD 정의
  if(!d){const g=C.mv(id)||{};d={n:g.name||id,t:g.type||'NORMAL',c:g.ph?0:1,p:g.pw||0,a:g.acc||100,pr:g.pri||0,k:g.ph?'melee':'projectile',kd:'',sb:'',aim:'direction',ef:[],f:''};}
  const st=d.c===2||!(d.p>0);
  const _mm=window.BEAMFX?BEAMFX.meleeMode(d.n,d.t):'',_qk=d.k==='pulse'&&d.t==='GROUND'&&!C.meleeClose;   // 9V-5: 땅 타입 퍼지는 기술(지진·땅고르기·땅가르기·매그니튜드)
  const _pvx=!!(C.net||C.pvp||C.meTeam),_bl=_pvx&&d.k==='melee';   // 9X: 사람끼리 대전이면 근접 기술은 못 날림 → 순간이동해서 붙어 때리고, 맞으면 경직
  const _sk=window.BEAMFX&&BEAMFX.sprKind&&!C.meleeClose&&!_bl?BEAMFX.sprKind(d.n,d.t,d.k):null;   // 9W: 그림 이펙트 기술(지진·번개·바위 떨어뜨리기 → 상대 몸에서, 파도 → 날아감)
  const k=_bl?'target':_sk?_sk.k:_qk?'target':(d.k==='melee'&&!C.meleeClose)?((_mm==='slash'||_mm==='bite'||_mm==='claw')?'target':'projectile'):d.k, exec=isExecute(d),   // 베기·할퀴기·깨물기·지진은 상대 몸에서 바로 터짐(target), 주먹만 날아감   // 9V-4: 베기 기술은 상대 몸에서 바로 X자로 터짐(target), 나머지 근접은 날아감   // 9V: 붙어서 때리는 기술도 날아가는 기술로
   _k0=d.k, fx=(d.ef||[]).find(x=>x.op==='fixed'&&x.mode!=='execute')||null;
  const p=st?0:exec?200:d.p<=1?60:d.p, g=gradeOf(p); // 즉사기=위력200, 위력1짜리(고정피해 등)=기본 60
  const melee=!!MELEE_K[k];
  let su=(melee?ST_MELEE:ST_RANGE)[g];
  if(k==='self'){const e=(d.ef||[]).map(x=>x.op).join(',');su=/guard/.test(e)?4:/heal/.test(e)?36:48;}
  if(st&&k!=='self')su=Math.min(su,14);
  if(d.a>0&&d.a<100)su+=Math.min(24,(100-d.a)*.4);
  if(d.pr>0)su=4;
  const cdi=cooldownOf(d,k,p,st);
  const cd=cdi.sec;
  const mh=(d.ef||[]).find(x=>x.op==='multiHit')||null,li=(d.ef||[]).find(x=>x.op==='lockIn')||null;
  const o={id,d,name:d.n,type:d.t,p,st,k,kd:d.kd,g,melee,su:Math.round(su),cd,hasted:cdi.hasted,phys:d.c===0,exec,fx,selfko:opsOf(d).includes('selfKO'),rech:opsOf(d).includes('recharge'),hits:hitsOf(d),mh};if(_k0==='melee'&&k==='target'&&_mm==='slash')o.sl=1;   // 9Y: 베기 = 그어지는 획 수만큼 여러 번 맞음
if(_bl)o.blink=1;if(_sk){o.spr=_sk.spr;if(_sk.spr==='wave')o.mel=1}if(_qk)o.quake=1;if(_k0==='melee'&&k==='projectile')o.mel=1;
  // 6C-4 다단 기술 = 충전(charges): 한 번 누르면 한 대, 충전이 하나씩 다시 참 (원본 multiHit.charges)
  if(mh&&!st){const five=mh.n==null&&mh.min!=null,n=five?0:Math.round(mh.n||0);
    if(five||n>=2){const mx=five?CHG.max5:Math.min(CHG.cap,n),typ=five?CHG.canon:n;
      const gm=five?(melee?CHG.gm5Melee[g]:CHG.gm5Shot):(melee?CHG.gmFixMelee:CHG.gmFixShot);
      o.chg={max:mx,per:CHG.rs[id]!=null?CHG.rs[id]:Math.max(.8,cd/typ*gm)}}}
  if(li&&li.mode==='rampage'&&melee)o.ramp=1;            // 6C-4 연속기(역린·난동부리기·꽃잎댄스·분노의붕격)
  if(li&&li.mode==='roll'&&li.powerDoublesPerHit)o.rollUp=li.maxMult||8;   // 6C-4 구르기·아이스볼: 맞힐 때마다 위력 2배(최대 8배)
  if(o.ramp)o.su=RAMP.firstT;
  o.ppMax=id==='struggle'?0:Math.max(1,(d.pp||10)*PPMUL);   // 6C-4 PP(원본 pp.maxMul 2)
  if(id==='struggle'){o.cd=2.5;o.typeless=1}
  return o;
}

// ---------- 6E: 기존 기술 이펙트(SKFX·FX2·VFX) 연결 ----------
// 그림만 재생함. 데미지·판정은 전부 위 규칙 그대로(이펙트는 판정에 영향 없음). 이펙트는 상대 위·내 포켓몬 아래에 그려 내 몸을 가리지 않음
const fxOn=()=>!!(C&&C.fxe&&C.fxe.FX2&&C.fxe.VFX&&C.fxe.SKFX&&C.fxe.MV);
const fxS=m=>50+m.g*7;                      // 이펙트 크기 기준(너무 크지 않게)
function fxActor(e){return{ox:0,oy:0,lift:0,sq:1,trail:0,st:'idle',t:0,blink:0,vx:0,vy:0,m:e.mon,S:null,get ax(){return e.x},get ay(){return e.y}}}
function skillFx(e,m,a,b,opt){
  if(!fxOn()||!m)return;opt=opt||{};
  try{
    const key=m.id,now=W.time;
    if(!opt.force&&e._fxK===key&&now-(e._fxT||0)<.4)return;   // 같은 기술 연속 재생 방지(구르기·연타)
    e._fxK=key;e._fxT=now;
    if(NFX()&&(!opt.force||m.k==='target')&&/^(melee|roll|target|vanish)$/.test(m.k)){const _ht=HT(e,m);if(_ht.aw)BEAMFX.crackle(b.x,b.y-30,(e.r||40)*1.6,_ht.aw,.5);if(m.spr&&m.spr!=='wave'&&m.spr!=='quake'){BEAMFX.sprite(m.spr,b.x,b.y+30,m.spr==='thunder'?380:340);return}if(m.quake){BEAMFX.quake(m.type,b.x,b.y-10,Math.max(.9,Math.min(1.4,(e.r||40)/36)));return}const mm=BEAMFX.meleeMode(m.name,m.type),n=mm==='slash'?1+_ht.n:Math.min(3,_ht.n),sz=mm==='slash'?Math.max(1.15,Math.min(1.6,(e.r||40)/30)):mm==='punch'?Math.max(.55,Math.min(1,(e.r||40)/48)):Math.max(1,Math.min(1.4,(e.r||40)/34));BEAMFX.melee(m.type,mm,a.x,a.y-30,b.x,b.y-30,n,sz);return}   // 9U
    const F=C.fxe,S=opt.S||fxS(m),g=C.mv(m.id)||{id:m.id,name:m.name,type:m.type,pw:m.p};
    const tg=foeOf(e);
    const x={A:fxActor(e),B:fxActor(tg),fa:{x:a.x,y:a.y},fb:{x:b.x,y:b.y},S,d:b.x>=a.x?1:-1,a:{x:a.x,y:a.y-S*.6},b:{x:b.x,y:b.y-S*.55},pose:()=>{},hit:()=>{}};
    const id=F.MV.pick(g.id||m.id,g.type||m.type);
    Promise.resolve(F.SKFX.run(x,id,g,1,e.side===0,1)).catch(()=>{});
  }catch(err){}
}
// 6E-2: 발사체에 기존 이펙트 그림을 입혀 날아가게 함 (판정·속도는 그대로, 그림만 따라다님)
const PSKIN={FIRE:['pa2d/ember',{row:2,sc:26,fps:12}],WATER:['pa2d/pulsoagua',{row:0,sc:22,fps:12}],GRASS:['grass/energy_ball_sheet',{sc:14,fps:12}],
  ELECTRIC:['electric/thunder_wave_sheet',{sc:30,fps:14}],ICE:['pa2d/aurasphere',{row:2,sc:14,fps:12,blend:'lighter',filter:'hue-rotate(110deg)'}],
  PSYCHIC:['psychic/hypnosis_wave_sheet',{sc:10,fps:10}],GHOST:['pa2d/shadowball',{row:1,sc:20,fps:12}],DARK:['pa2d/shadowball',{row:1,sc:20,fps:12,filter:'saturate(0) brightness(.45)'}],
  FIGHTING:['pa2d/aurasphere',{row:2,sc:14,fps:12,blend:'lighter'}],FAIRY:['fairy/moonblast_sheet',{sc:12,fps:10,blend:'lighter'}],ROCK:['pa2d/roca',{row:1,sc:22,fps:8}],
  GROUND:['pa2d/lodo',{row:0,sc:30,fps:12}],POISON:['pa2d/lodo',{row:0,sc:30,fps:12,filter:'hue-rotate(250deg)'}],FLYING:['pa2d/aeroanillo',{sc:30,fps:14}],
  DRAGON:['polished-20/dracometeor',{sc:30,fps:10}],BUG:['pa2d/cuchilla',{row:0,sc:16,fps:20}],STEEL:['pa2d/cuchilla',{row:0,sc:16,fps:20,filter:'saturate(0)'}],NORMAL:['pa2d/cuchilla',{row:0,sc:16,fps:20,filter:'saturate(.2) brightness(1.3)'}]};
// 9U: 유도 · 기술 레벨
//  HOM: 내 포켓몬이 '야생·트레이너·보스(사람 아닌 상대)'에게 쏠 때만 유도 (친구 대전·난투전·상대가 나에게 쏠 땐 유도 없음)
const HOM=e=>!!e&&e.side===0&&!C.pvp&&!C.net&&!C.meTeam&&!C.noHome;
const MLV=(e,m)=>{try{return e&&e.side===0&&C.mlvOf?((C.mlvOf(e.mon,m.id)|0)||1):1}catch(er){return 1}};
const NFX=()=>!!(window.BEAMFX&&fxOn());
const SHX=e=>{try{return !!(e&&e.mon&&typeof rarM==='function'&&rarM(e.mon)>=7)}catch(er){return false}};   // 9BN 그림 효과는 불멸 이상만
// 9Z: 타수·각성 — 보통 기술은 환생 횟수만큼 타수(0회 1 · 1회 2 · 2회 3 · 3회+ 4), 각성 ★마다 기운(테두리·번개)
//     전설 기술(sg_*)은 많이 쓸수록 오르는 기술 레벨로 타수·기운 (난투전은 모두 1타·기운 없음)
const HT=(e,m)=>{try{if(!e||!m||e.side!==0||C.net||!C.hitTier)return{n:1,aw:0};e._ht=e._ht||{};return e._ht[m.id]||(e._ht[m.id]=C.hitTier(e.mon,m.id))}catch(er){return{n:1,aw:0}}};
function projSkin(p,m){
  if(!fxOn())return null;
  try{const d=PSKIN[m.type]||PSKIN.NORMAL,S=fxS(m)*(m.p>=110?1.25:1);
    return C.fxe.VFX.anim(d[0],{loop:true,x:p.x,y:p.y-24,rot:Math.atan2(p.dy,p.dx),row:d[1].row||0,scale:S/d[1].sc,fps:d[1].fps,blend:d[1].blend,filter:d[1].filter})}catch(e){return null}
}
function fxShake(g){if(!fxOn())return;try{C.fxe.FX2.hit([3,5,8,11][g]||3,0)}catch(e){}}

// ---------- 개체 ----------
function mkEnt(mon,S,side,hp0){
  const s=C.stOf(mon);
  // 6C-4 몸 크기: 원본 sizing.power — 크기 = 30×(키/0.4m)^0.7 (24~380), 몸 반지름 = 크기×0.3 (12~110), 그림도 크기에 비례
  let size=57;try{if(C.bodySize){const b=+C.bodySize(mon);if(b>0)size=clamp(b,SIZE.min,SIZE.max)}}catch(er){}
  let sc=2,vis=110;
  try{const A=S&&S.meta&&S.meta.anims&&(S.meta.anims.idle);if(A){const tgtPx=clamp(200*Math.pow(size/SIZE.refSize,.6),160,400);/* 폰에서 작은 포켓몬도 잘 보이게 최소 100px(판정 반지름은 원본 그대로) */sc=clamp(tgtPx/Math.max(A.w,A.h),.5,6);vis=A.h*sc}}catch(e){}
  const e={mon,S,side,x:side?970:230,y:380,vx:0,vy:0,kx:0,ky:0,face:{x:side?-1:1,y:0},
    st:s,hp:s[0],max:s[0],lv:Math.min(100,mon.lv||50),types:(C.META[mon.n]||{types:['NORMAL']}).types,
    sc,vis,size,r:Math.round(clamp(SIZE.rf*size,SIZE.rmin,SIZE.rmax)),spd:clamp(128+.65*s[5],125,250),
    moves:(mon.moves||[]).slice(0,4).map(moveInfo),cd:[0,0,0,0],cdMax:[1,1,1,1],
    rc:2,rollT:0,rdx:0,rdy:0,inv:0,stun:0,cast:null,buf:null,
    stg:{atk:0,def:0,spa:0,spd:0,spe:0},stgT:0,
    ail:{},hidden:false,protect:0,critWin:0,anim:'idle',at:0,row:side?6:2,blink:0,hold:0,beam:null,counter:0,flash:0};
  e.haste=hasteOf(s[5]);
  e.ab=[];try{if(C.abils&&!C.net&&!C.pvp&&!C.meTeam&&!side)e.ab=C.abils(mon)||[]}catch(er){e.ab=[]}   // 사용자 결정(2026-11-22): 특성은 내 포켓몬(side 0)만 — 컴퓨터(상대)는 특성 없이 당하기만 함
  //   // ② 특성(난이도 6 이상, 사람끼리 대전 제외)
  // 9AD 거대 월드보스(카오스·이터널): 보스는 화면 높이 72%까지 커지고(화면 밖으로 안 나감) 내 포켓몬은 70%
  if(C.giant){try{const A=S&&S.meta&&S.meta.anims&&S.meta.anims.idle;
    if(side===1&&A){const gv=Math.max(1.3,Math.min(AH*.72/Math.max(1,A.h*sc),AW*.42/Math.max(1,A.w*sc)));e.sc0=sc;e.gK=gv;e.gT=0;e.giant=1;e.gw=A.w*sc*gv;e.gh=A.h*sc*gv;e.r=Math.round(Math.min(e.r*1.6,SIZE.rmax*1.4))}
    else if(side===0){e.sc*=.7;e.vis*=.7}}catch(er){}}
  try{e.K=C.numK?clamp(+C.numK(mon)||1,1,1e12):1}catch(er){e.K=1}   // 9G: 천상계 ×100 · 월드보스 억 단위 위해 상한 1조   // 7D 숫자 배율
  try{e.critX=C.critOf?C.critOf(mon)||{c:0,d:0}:{c:0,d:0}}catch(er){e.critX={c:0,d:0}}
  // 8F: 장비(출결 캐릭터 장비 · 스타포스 강화 · 큐브 옵션) — 내 포켓몬에게 모든 새 전투에서 (예전엔 월드보스에서만)
  e.hm=1;e.gear=null;try{const g=C.gearOf?C.gearOf(mon):null;if(g){e.gear=g;e.hm=1+((g.hp||0)+((g.aA&&g.aA.hp)||0))/100;e.max=Math.round(e.max*e.hm);e.hp=e.max;e.critX={c:Math.min(.75,(e.critX?e.critX.c:0)+(g.crt||0)/100),d:(e.critX?e.critX.d:0)+(g.cdm||0)/100}}}catch(er){}
  // 9F 초월 능력(위 등급은 아래 등급 능력도 가짐) — 각성 단계 e.aw(0~6)
  //  불멸: 쓰러지면 1번 부활(체력 50%) · 각성하면 부활 뒤 무적 10초 + 각성마다 3초
  //  태초: 들어오고 1초 뒤 분신 소환(같이 공격) 20초 + 각성마다 5초
  //  만제: 20초 동안 데미지 +30% 버프, 재사용 30초 − 각성마다 3초 (자동) · 파티 공격 +30%는 host(rtDmgMul)
  e.pctMax=(C.bossNoFrac&&side===1&&C.bossBase)?Math.max(1,C.bossBase):0;   // 9H: 월드보스는 '최대 체력의 몇 %' 효과(독·화상·장판·회복)를 원래 체력 기준으로
  e.tier=0;try{e.tier=C.tierOf?(+C.tierOf(mon)||0):0}catch(er){}e.aw=Math.max(0,Math.min(6,(window.awEffMon&&mon?awEffMon(mon):(mon&&mon.aw))|0));
  e.undying=e.tier>=7;e.sh=0;e.shMax=0;e.cloneDur=e.tier>=8?20+5*e.aw:0;e.cloneUsed=0;e.life=0;
  e.zb=e.tier>=9?{cd:1,on:0,cdMax:Math.max(3,30-3*e.aw)}:null;
  if(e.tier>=6&&window.TFX)try{e.eng=TFX.eng()}catch(er){}
  if(side===1&&C.bossLook){e.vt=C.bossLook;if(!e.eng&&window.TFX)try{e.eng=TFX.eng()}catch(er){}}   // 9AF 월보 외형만 불멸·태초
  if(side===1&&!e.vt&&!C.net&&!C.pvp&&!C.meTeam){try{const df=typeof DIFF==='function'?DIFF():0,lk=df>=7?8:df===6?7:0;if(lk>e.tier){e.vt=lk;if(!e.eng&&window.TFX)e.eng=TFX.eng()}}catch(er){}}   // 9AM 천계 적 = 불멸 모습 · 천상계 = 태초 모습 (모습만)
  {const h0=hp0!=null?hp0:(side?C.foeHp:C.meHp);if(h0!=null&&isFinite(h0))e.hp=clamp(h0*e.hm,1,e.max)}   // 6F-2: 지금 체력에서 시작(없으면 가득) · 저장된 체력은 장비 전 값   // 6F-2: 지금 체력에서 시작(없으면 가득)
  // 속도가 빠르면 준비동작이 줄어듦 (원본 speed.windupCut: 속도 50~150 구간, 최대 60%, 17틱 아래로는 안 줄임)
  e.moves.forEach(m=>{if(m.st||m.p<=0||m.k==='self'||m.selfko||m.su<=17)return;
    m.su=Math.max(1,Math.round(m.su-.6*clamp((s[5]-50)/100,0,1)*(m.su-17)))});
  if(e.ab&&e.ab.length&&abHas(e,'COMPOUNDEYES'))e.moves.forEach(m=>{const a=m&&m.d&&m.d.a;if(a>0&&a<100)m.su=Math.max(1,m.su-Math.round(.4*(Math.min(100,a*1.3)-a)))});   // F: 복안 — 명중 ×1.3이면 낮은 명중 때문에 길어지는 준비동작이 줄어듦
  if(side===1)e.moves.forEach(m=>{if(m.su>0)m.su=Math.round(m.su*1.4)});   // 9J: 상대 준비동작 40% 길게(보고 피할 시간)
  e.moves.forEach((m,i)=>{e.cdMax[i]=m.cd*(m.hasted?e.haste:1)});
  e.ch=[0,0,0,0];e.chT=[0,0,0,0];e.pp=[0,0,0,0];
  e.moves.forEach((m,i)=>{if(m.chg){m.chg.per*=(m.hasted?e.haste:1);e.ch[i]=m.chg.max;e.cdMax[i]=m.chg.per}e.pp[i]=m.ppMax});
  return e;
}
const foeOf=e=>e.side?W.me:W.foe;   // 6F-4b: 교대로 W.me가 바뀌어도 이미 나간 공격이 제 상대를 찾도록 side 기준
const spdOf=e=>{let v=rz2Raw(e);if(e.ail.paralysis)v*=.6;if(e.ab&&e.ab.length&&abHas(e,'QUICKFEET')&&abStatus(e))v*=1.5;   /* ② 속보 */if(e.gxMul)v*=e.gxMul;   /* 1/3: 체육관 바닥(웅덩이·모래늪) */if(W&&W.wx&&e.ab&&e.ab.length)v*=wxSpeed(e);if(W&&W.rz3&&e.ab&&e.ab.length&&abHas(e,'SURGESURFER')&&W.rz3.ter==='electric'&&W.rz3.tt>0&&rz3In(e))v*=1.3;   /* F: 서핑테일 — 일렉트릭필드 안(날씨 속도 특성과 같은 ×1.3) */   /* ③ 날씨 특성 */if(W&&W.rz2){if(!e.side&&W.rz2.tw>0)v*=1.3;if(e.hzSlow>0)v*=.7}   /* ③ 2/2: 순풍(내 쪽 ×1.3) · 끈적네트(상대 ×0.7) */return clamp(v,60,320)};

// ---------- 데미지 ----------
function floatTxt(x,y,t,col,big){W.fx.push({k:'txt',x,y,t:0,life:.9,s:t,c:col||'#fff',big:!!big})}
// 6E-3: 데미지 숫자(통통 튀며 떠오름) · 충격파 · 불꽃 · 화면 번쩍 · 반전 (sjdhdhbd.html 방식)
// 7D: 숫자 배율 — 진행(레벨·환생)에 따라 체력·데미지 숫자만 같이 커짐(승패 밸런스는 그대로). 1만↑ '만', 1억↑ '억'
function fmtN(v){v=Math.max(0,Math.round(v));if(v<1e5)return v.toLocaleString('en-US');if(v<1e8){const q=v/1e4;return (q<1e3?q.toFixed(q<100?1:0):Math.round(q).toLocaleString('en-US'))+'만'}const q=v/1e8;return (q<100?q.toFixed(2):Math.round(q).toLocaleString('en-US'))+'억'}
const kOf=e=>(e&&e.K)||1;

// ---------- 7H: 도트 데미지 스킨 (사용자가 준 PIXEL UNIT DAMAGE SKIN ENGINE 6종 · 억/만 배지 · 크리티컬 별) ----------
const PXG = { '0': [ "..1111..", ".11..11.", "11....11", "11...111", "11..1111", "11.11.11", "1111..11", "111...11", "11....11", ".11..11.", "..1111.." ], '1': [ "...111..", "..1111..", ".11.11..", "11..11..", "....11..", "....11..", "....11..", "....11..", "....11..", "....11..", ".1111111" ], '2': [ ".111111.", "11....11", "......11", "......11", ".....11.", "...111..", ".111....", "11......", "11......", "11....11", "11111111" ], '3': [ ".111111.", "11....11", "......11", "......11", "..11111.", "......11", "......11", "......11", "......11", "11....11", ".111111." ], '4': [ "....111.", "...1111.", "..11.11.", ".11..11.", "11...11.", "11...11.", "11111111", ".....11.", ".....11.", ".....11.", "....1111" ], '5': [ "11111111", "11......", "11......", "1111111.", "......11", "......11", "......11", "......11", "......11", "11....11", ".111111." ], '6': [ "..11111.", ".11...11", "11......", "11......", "1111111.", "11....11", "11....11", "11....11", "11....11", ".11..11.", "..1111.." ], '7': [ "11111111", "11....11", ".....11.", "....11..", "....11..", "...11...", "...11...", "..11....", "..11....", "..11....", "..11...." ], '8': [ ".111111.", "11....11", "11....11", "11....11", ".111111.", "11....11", "11....11", "11....11", "11....11", "11....11", ".111111." ], '9': [ "..1111..", ".11..11.", "11....11", "11....11", ".1111111", "......11", "......11", "......11", "......11", "11...11.", ".11111.." ], '억': [ ".1111..11.", "11..11.11.", "11..11.11.", "11..11111.", ".1111..11.", ".......11.", ".11111111.", ".......11.", ".......11.", ".......11.", ".......11." ], '만': [ "11111..11.", "11..11.11.", "11..11.111", "11..11.11.", "11111..11.", ".......11.", "..11......", "..11......", "..11......", "..11111111", "..11111111" ], 'CRIT_STAR': [ ".....1.....", "....111....", ".1..111..1.", "..1111111..", "...11111...", "11111111111", "...11111...", "..1111111..", ".1..111..1.", "....111....", ".....1....." ] };
const PXSK = [ { id: "maple_classic", name: "1. 메이플 오리지널", numTop: "#fff200", numMid: "#ff9f1a", numBot: "#ff3838", outline: "#1e0900", eokBg: "#ff1e42", eokTxt: "#ffffff", manBg: "#ff7f00", manTxt: "#ffffff", critColor: "#ffea00", critSpark: "#ff3838" }, { id: "sekiro_ink", name: "2. 불사베기 칠흑혈참", numTop: "#ff1e42", numMid: "#99001a", numBot: "#1a0206", outline: "#ff4d6d", eokBg: "#080103", eokTxt: "#ff1e42", manBg: "#2b040c", manTxt: "#ff8fa3", critColor: "#ff1e42", critSpark: "#ffffff" }, { id: "xenon_cyber", name: "3. 제논 플라즈마 블루", numTop: "#ffffff", numMid: "#00f0ff", numBot: "#0066ff", outline: "#00194d", eokBg: "#00f0ff", eokTxt: "#040814", manBg: "#0052d4", manTxt: "#ffffff", critColor: "#00f0ff", critSpark: "#ffffff" }, { id: "royal_gold", name: "4. 황제 르네상스 골드", numTop: "#ffffff", numMid: "#ffd700", numBot: "#d97706", outline: "#291500", eokBg: "#ffd700", eokTxt: "#1f0f00", manBg: "#f59e0b", manTxt: "#1f0f00", critColor: "#ffd700", critSpark: "#ffffff" }, { id: "emerald_dragon", name: "5. 청룡 비취 에메랄드", numTop: "#e0fff4", numMid: "#00ff9d", numBot: "#008f5a", outline: "#022417", eokBg: "#00ff9d", eokTxt: "#022417", manBg: "#059669", manTxt: "#ffffff", critColor: "#00ff9d", critSpark: "#ffd700" }, { id: "haki_purple", name: "6. 패왕색 흑섬 보라", numTop: "#f3e5f5", numMid: "#d500f9", numBot: "#651fff", outline: "#090014", eokBg: "#aa00ff", eokTxt: "#ffffff", manBg: "#4a0072", manTxt: "#ea80fc", critColor: "#ff1744", critSpark: "#d500f9" } ];
const PXC={};
function pxGlyph(ch,skin,unit){const key=skin.id+'_'+ch+'_'+(unit||'n');if(PXC[key])return PXC[key];const M=PXG[ch];if(!M)return null;const R=M.length,Cn=M[0].length,px=3,pad=6;
  const o=document.createElement('canvas');o.width=Cn*px+pad*2;o.height=R*px+pad*2;const g=o.getContext('2d');
  if(unit==='eok'||unit==='man'){g.fillStyle='#ffffff';g.fillRect(0,0,o.width,o.height);g.fillStyle=unit==='eok'?skin.eokBg:skin.manBg;g.fillRect(px,px,o.width-px*2,o.height-px*2)}
  else if(ch!=='CRIT_STAR'){g.fillStyle=skin.outline;for(let r=0;r<R;r++)for(let c=0;c<Cn;c++)if(M[r][c]==='1')g.fillRect(pad+c*px-px,pad+r*px-px,px*3,px*3)}
  for(let r=0;r<R;r++)for(let c=0;c<Cn;c++)if(M[r][c]==='1'){g.fillStyle=unit==='eok'?skin.eokTxt:unit==='man'?skin.manTxt:ch==='CRIT_STAR'?((r>=4&&r<=6&&c>=4&&c<=6)?'#ffffff':skin.critColor):r<=2?skin.numTop:r<=6?skin.numMid:skin.numBot;g.fillRect(pad+c*px,pad+r*px,px,px)}
  return PXC[key]=o}
// 7I: 숫자 짧게 — 10만 미만은 그대로(4만5678) · 10만~1억은 만까지(175만) · 1억~10억은 억+만(9억8765만) · 10억 이상은 억만(123억)
function pxTokens(num){const n=Math.floor(Math.max(1,num)),eok=Math.floor(n/1e8),man=n>=1e9?0:Math.floor(n%1e8/1e4),rest=n>=1e5?0:n%1e4,L=[];
  if(eok>0){String(eok).split('').forEach(ch=>L.push({ch,u:null}));L.push({ch:'억',u:'eok'})}
  if(man>0){String(man).split('').forEach(ch=>L.push({ch,u:null}));L.push({ch:'만',u:'man'})}
  if((rest>0&&n<1e5)||!L.length)String(rest||n).split('').forEach(ch=>L.push({ch,u:null}));return L}
function pxDraw(cx,f){const skin=PXSK[f.sk]||PXSK[0],u=f.t/f.life,ratio=1-u;let s;
  if(f.crit){s=u<.12?.6+u/.12*.78:u<.24?1.38-(u-.12)/.12*.38:1}else s=u<.1?.7+u/.1*.3:1;
  f.cs=(f.cs||0)+((f.ts||0)-(f.cs||0))*.24;
  cx.save();cx.imageSmoothingEnabled=false;cx.globalAlpha=ratio<.25?ratio/.25:1;const k=s*(f.fin?.6:.48);   /* 7H-2: 사용자 요청 — 숫자가 길어서 전체 크기를 60%로 */const sp=f.tk.map(t=>pxGlyph(t.ch,skin,t.u)).filter(Boolean),gap=2;const tw=sp.reduce((a,q)=>a+q.width+gap,-gap);
  const hw=(tw/2+(f.crit?40:4))*k,fx0=clamp(f.x,WALL+hw,AW-WALL-hw);   /* 경기장 밖으로 잘리지 않게 */
  cx.translate(Math.round(fx0),Math.round(f.y-u*40+f.cs));cx.scale(k,k);let dx=-Math.round(tw/2);
  if(f.crit){const st=pxGlyph('CRIT_STAR',skin),ss=Math.floor(f.t*60/4)%2===0?1.15:.9;cx.save();cx.translate(dx-24,0);cx.scale(ss,ss);cx.drawImage(st,-Math.round(st.width/2),-Math.round(st.height/2));cx.restore();
    cx.fillStyle=skin.outline;cx.fillRect(dx-4,-36,76,14);cx.fillStyle=skin.critColor;cx.font='900 11px monospace';cx.textAlign='left';cx.fillText('CRITICAL!',dx,-25)}
  for(const q of sp){cx.drawImage(q,dx,-Math.round(q.height/2));dx+=q.width+gap}
  cx.restore()}
function dmgPop(x,y,txt,col,fin,val,crit,sk){
  if(val!=null){for(const q of W.fx)if(q.k==='dmg'&&q.tk&&Math.abs(q.x-x)<160&&Math.abs(q.y-y)<140)q.ts=(q.ts||0)-28;   // 먼저 뜬 숫자는 위로 밀어 겹치지 않게
    W.fx.push({k:'dmg',x:x,y:y,t:0,life:.95,tk:pxTokens(val),crit:!!crit,sk:sk|0,fin:!!fin||!!crit,ts:0,cs:0});
    if(crit){const sk0=PXSK[sk|0]||PXSK[0];for(let i=0;i<14;i++){const a=i/14*Math.PI*2+rnd()*.3,v=180+rnd()*360;W.fx.push({k:'psq',x:x,y:y-35,vx:Math.cos(a)*v,vy:Math.sin(a)*v-90,z:rnd()>.5?6:4,c:i%2?sk0.critSpark:sk0.critColor,t:0,life:.4})}}
    return}
  W.fx.push({k:'dmg',x:x+(rnd()-.5)*56,y:y+(rnd()-.5)*24,t:0,life:fin?.95:.75,s:txt,c:col||'#fff',sc:fin?1.35:1})}
function hitFx(def,col,fin){
  W.fx.push({k:'shock',sys:1,x:def.x,y:def.y-20,t:0,life:fin?.34:.22,r:fin?120:70,c:fin?'#ffffff':col,w:fin?9:5});
  const n=fin?22:10,P=[];for(let i=0;i<n;i++){const a=rnd()*Math.PI*2,v=(fin?170:110)*(.5+rnd()*.7);P.push({vx:Math.cos(a)*v,vy:Math.sin(a)*v-30,z:(fin?5:3.5)*(.6+rnd()*.7)})}
  W.fx.push({k:'spk',sys:1,x:def.x,y:def.y-24,t:0,life:fin?.55:.4,c:col,P});
  W.shk=Math.max(W.shk||0,fin?20:9);W.flashA=Math.max(W.flashA||0,fin?.35:.14);W.flashC=col;
  /* 9R: 막타 화면 뒤집힘(검게 번쩍) 없앰 — 정신없다는 요청 */
}
// ===== ③ 날씨 1/2 (2026-11-22) — 난이도 6 이상(C.wxOn)에서만 · 사람끼리 대전 제외 · 쉬움~종말(0~5)은 없음 =====
// 사용자 방침: 해로운 건 상대(컴퓨터)만, 이로운 건 내 포켓몬만. 4종: 쾌청(sun)·비(rain)·모래바람(sand)·설경(snow)
// 원본 값: 날씨 기술 30초(rzmoves ef.dur) · 특성으로 켜면 20초(consts.weatherSec) · 선파워 ×1.5 · 모래의힘 ×1.3 · 젖은접시·아이스바디 1/16 · 건조피부 비 1/8
// 이 게임에서 정한 값(원본 표에 없음): 모래바람·설경 상대 피해 초당 1.5% · 날씨 특성 이동 속도 ×1.3 · 불꽃/물 ×1.5/×0.5 · 바위(모래)·얼음(설경) 방어 ×1.5
const WX_NAME={sun:'쾌청',rain:'비',sand:'모래바람',snow:'설경'},WX_ICON={sun:'☀',rain:'🌧',sand:'🌪',snow:'❄'};
const WX_COL={sun:'#ffb347',rain:'#7fb8ff',sand:'#d8bc85',snow:'#bfefff'};
const WX_START={sun:'햇살이 강해졌다!',rain:'비가 내리기 시작했다!',sand:'모래바람이 불기 시작했다!',snow:'눈이 내리기 시작했다!'};
const WX_END={sun:'햇살이 원래대로 돌아왔다',rain:'비가 그쳤다',sand:'모래바람이 잦아들었다',snow:'눈이 그쳤다'};
const WX_SEC=30,WX_AB_SEC=20,WX_CHIP=.015,WX_SPD=1.3;
const WX_MAP={sun:'sun',rain:'rain',sand:'sand',sandstorm:'sand',snow:'snow',hail:'snow'};
function wxOn(){try{return !!(W&&!W.tut&&C&&C.wxOn&&!C.net&&!C.pvp&&!C.meTeam&&C.wxOn())}catch(er){return false}}
function wxSet(k,sec){
  if(!wxOn()||!WX_NAME[k])return false;
  if(W.wx&&W.wx.k===k){W.wx.t=Math.max(W.wx.t,sec);W.wx.t0=Math.max(W.wx.t0,sec);return true}
  W.wx={k,t:sec,t0:sec};
  const m=W.me||W.foe;if(m){floatTxt(m.x,m.y-160,WX_ICON[k]+' '+WX_START[k],WX_COL[k],true);W.fx.push({k:'ring',sys:1,x:m.x,y:m.y,t:0,life:.6,r:130,c:WX_COL[k]})}
  return true;
}
// 날씨 기술(rzmoves의 ef.op==='weather') — 내가 쓸 때만 바뀜 (상대가 쓰면 아무 일 없음)
function wxMove(e,f){
  if(e.side||!wxOn())return;
  const k=WX_MAP[String(f.w||'').toLowerCase()];if(!k)return;
  const sec=parseFloat(f.dur)||WX_SEC;
  wxSet(k,sec);
}
// 날씨 때문에 준비 동작이 짧아지는 기술(원본 noCharge): 쾌청=솔라빔·솔라블레이드 · 비=전기쇼트 → 내 쪽만, 준비 17틱까지 줄어듦
// (원본 noChargeWindupSec 값은 자료에 없어서 속도 단축 바닥값 17틱을 씀)
const WX_NOCHG={sun:['solarbeam','solarblade'],rain:['electroshot']},WX_NOCHG_T=17;
// 비 오면 내 허리케인이 빨리 떨어짐(원본 weatherFall rain delaySec .22). 쾌청에서 느려지는 쪽은 내게 해로워서 뺌
function wxFall(e,m,t){
  try{if(!e.side&&W&&W.wx&&W.wx.k==='rain'&&wxOn()&&m&&m.id&&String(m.id).toLowerCase()==='hurricane'){
    floatTxt(e.x,e.y-135,'바로 떨어진다!','#6ab0ff',true);return .22}}catch(er){}
  return t}
function wxSu(e,m,su){
  try{const w=W&&W.wx&&W.wx.k;if(e.side||!w||!(su>WX_NOCHG_T)||!wxOn())return su;
    const a=WX_NOCHG[w];if(a&&m&&m.id&&a.indexOf(String(m.id).toLowerCase())>=0){
      if(!e._wxNc||e._wxNc<(W.t||0)-1){e._wxNc=(W.t||0);floatTxt(e.x,e.y-135,'바로 발사!','#ffe14a',true)}
      return WX_NOCHG_T}}catch(er){}
  return su}
// 날씨가 데미지에 주는 배율: 내 쪽 이로움만 / 상대 쪽 해로움만
function wxMul(att,def,m){
  const w=W&&W.wx&&W.wx.k;if(!w)return 1;
  const t=m.type;let x=1;
  if(!att.side){
    if(w==='sun'&&t==='FIRE')x*=1.5;
    if(w==='rain'&&t==='WATER')x*=1.5;
    if(w==='sun'&&!m.phys&&abHas(att,'SOLARPOWER'))x*=1.5;
    if(w==='sand'&&abHas(att,'SANDFORCE')&&(t==='ROCK'||t==='GROUND'||t==='STEEL'))x*=1.3;
  }else{
    if(w==='sun'&&t==='WATER')x*=.5;
    if(w==='rain'&&t==='FIRE')x*=.5;
  }
  if(!def.side){
    const ty=def.tera?[def.tera]:(def.types||[]);
    if(w==='sand'&&!m.phys&&ty.includes('ROCK'))x/=1.5;
    if(w==='snow'&&m.phys&&ty.includes('ICE'))x/=1.5;
  }
  return x;
}
// 이동 속도: 날씨 특성(쓱쓱·엽록소·모래헤치기·눈치우기)이 맞는 날씨일 때 — 내 포켓몬만 (e.ab는 내 쪽만 있음)
function wxSpeed(e){
  const w=W&&W.wx&&W.wx.k;if(!w||!e.ab||!e.ab.length)return 1;
  return((w==='rain'&&abHas(e,'SWIFTSWIM'))||(w==='sun'&&abHas(e,'CHLOROPHYLL'))||(w==='sand'&&abHas(e,'SANDRUSH'))||(w==='snow'&&abHas(e,'SLUSHRUSH')))?WX_SPD:1;
}
// 날씨 시간 · 상대 지속 피해(1초마다) — 매 틱 한 번
function wxTick(){
  const w=W.wx;if(!w)return;
  w.t-=TICK;
  if(w.t<=0){const m=W.me||W.foe;if(m)floatTxt(m.x,m.y-160,WX_END[w.k],'#cfd8ea',true);W.wx=null;return}
  if(W.tick%60===0&&(w.k==='sand'||w.k==='snow')){
    const f=W.foe;
    if(f&&f.hp>0&&!f.hidden){
      const ty=f.tera?[f.tera]:(f.types||[]);
      const safe=w.k==='sand'?ty.some(t=>t==='ROCK'||t==='GROUND'||t==='STEEL'):ty.includes('ICE');
      if(!safe){const d=Math.max(1,Math.round((f.pctMax||f.max)*WX_CHIP));f.hp=Math.max(0,f.hp-d);floatTxt(f.x,f.y-60,fmtN(d*kOf(f)),WX_COL[w.k])}
    }
  }
}
// 그림: 날씨 알갱이 + 위쪽 작은 표지 (몸 위에 덮음)
function wxDraw(cx){
  const w=W.wx;if(!w)return;
  const T=W.time,col=WX_COL[w.k];
  cx.save();
  const fade=Math.min(1,w.t/1.2,(w.t0-w.t)/.6+.2);cx.globalAlpha=Math.max(0,fade);
  if(w.k==='sun'){
    const g=cx.createRadialGradient(AW*.82,-40,20,AW*.82,-40,AW*.9);g.addColorStop(0,'rgba(255,214,120,.30)');g.addColorStop(1,'rgba(255,214,120,0)');
    cx.fillStyle=g;cx.fillRect(0,0,AW,AH);
    cx.strokeStyle='rgba(255,230,160,.10)';cx.lineWidth=26;
    for(let i=0;i<5;i++){cx.beginPath();cx.moveTo(AW*.82-i*150,-20);cx.lineTo(AW*.82-i*330-200,AH);cx.stroke()}
  }else if(w.k==='rain'){
    cx.fillStyle='rgba(30,60,120,.10)';cx.fillRect(0,0,AW,AH);
    cx.strokeStyle='rgba(170,210,255,.55)';cx.lineWidth=1.6;cx.beginPath();
    for(let i=0;i<70;i++){const sp=620+(i%5)*70,x=((i*173.7)%(AW+200))-100+((T*sp*.28)%60),y=((i*97.3+T*sp)%(AH+80))-40;cx.moveTo(x,y);cx.lineTo(x-9,y+26)}
    cx.stroke();
  }else if(w.k==='sand'){
    cx.fillStyle='rgba(180,140,70,.16)';cx.fillRect(0,0,AW,AH);
    cx.fillStyle='rgba(230,200,140,.5)';
    for(let i=0;i<60;i++){const sp=300+(i%7)*60,x=((i*131.3-T*sp)%(AW+120)+AW+120)%(AW+120)-60,y=((i*89.7+Math.sin(T*2+i)*18)%AH+AH)%AH;cx.fillRect(x,y,4+(i%3)*2,2)}
  }else{
    cx.fillStyle='rgba(200,230,255,.08)';cx.fillRect(0,0,AW,AH);
    cx.fillStyle='rgba(255,255,255,.85)';
    for(let i=0;i<55;i++){const sp=70+(i%6)*18,x=((i*163.1+Math.sin(T*1.3+i)*40)%AW+AW)%AW,y=((i*71.9+T*sp)%(AH+20))-10;cx.beginPath();cx.arc(x,y,1.6+(i%3)*.8,0,7);cx.fill()}
  }
  cx.globalAlpha=1;
  const lab=WX_ICON[w.k]+' '+WX_NAME[w.k]+' '+Math.ceil(w.t)+'초';
  cx.font='bold 14px sans-serif';cx.textAlign='center';
  const tw=cx.measureText(lab).width+20;
  cx.fillStyle='rgba(8,14,30,.62)';cx.fillRect(AW/2-tw/2,8,tw,24);
  cx.strokeStyle=col;cx.lineWidth=1.5;cx.strokeRect(AW/2-tw/2,8,tw,24);
  cx.fillStyle=col;cx.fillText(lab,AW/2,25);
  cx.restore();
}
// ===== ③ 날씨 2/2: 함정·벽·순풍·트릭룸·대타·멸망의노래·길동무 (천계 이상 · 해로운 건 상대만, 이로운 건 내 쪽만) =====
// 켜짐 조건은 날씨와 같음(wxOn). 상대(컴퓨터)가 이 기술을 쓰면 아무 일 없음. 원본 표에 없는 값(벽 ×0.5, 함정 반지름 90·유지 60초)은 아래 상수에서 바꿔요.
const RZ_WALL_MUL=.5,RZ_WALL_SEC=25,RZ_HZ_R=90,RZ_HZ_LIFE=60,RZ_HZ_REARM=6,RZ_HZ_STAND=.5,RZ_HZ_CAP=8;
const RZ_WALL_NAME={reflect:'리플렉터',lightScreen:'빛의장막',auroraVeil:'오로라베일'};
const RZ_WALL_COL={reflect:'#8fd0ff',lightScreen:'#ffe58a',auroraVeil:'#c8f2ff'};
const RZ_HZ_MAX={stealthRock:1,spikes:3,toxicSpikes:2,stickyWeb:1};
const RZ_HZ_NAME={stealthRock:'스텔스록',spikes:'압정뿌리기',toxicSpikes:'독압정',stickyWeb:'끈적끈적네트'};
function rz2(){return W.rz2||(W.rz2={hz:[],wl:{},tw:0,tr:0,trSw:0,pe:null})}
// 이 기술에 2/2 효과가 있나
function rz2Has(m){return(m.d.ef||[]).some(f=>f.op==='hazard'||(f.op==='field'&&(f.f==='tailwind'||f.f==='trickRoom'||RZ_WALL_NAME[f.f]))||(f.op==='shield'&&!f.on)||(f.op==='overTime'&&f.what==='perish')||(f.op==='counter'&&f.mode==='destinyBond'))}
// 트릭룸 중에는 나와 상대의 속도를 서로 바꿔요(내가 더 느릴 때만 켜지므로 내가 빨라지고 상대가 느려짐)
function rz2Raw(e){let v=e.spd*stageMul(e.stg.spe);const R=W&&W.rz2;if(R&&R.tr>0&&R.trSw){const o=e.side?W.me:W.foe;if(o&&o.spd)v=o.spd*stageMul(o.stg.spe)}return v}
// 쿨타임 배율: 순풍(내 쪽 ×0.85) · 트릭룸(속도 바꿈에 맞춰 쿨타임도 바꿈)
function rz2Cd(e){const R=W&&W.rz2;if(!R)return 1;let r=1;if(!e.side&&R.tw>0)r*=.85;if(R.tr>0&&R.trSw){const o=e.side?W.me:W.foe;if(o&&o.haste&&e.haste)r*=clamp(o.haste/e.haste,.8,1.1)}return r}
// 내 쪽 벽: 상대가 나를 때릴 때 피해 ×0.5 (리플렉터=물리, 빛의장막=특수, 오로라베일=둘 다)
function rz2Wall(att,def,m){const R=W&&W.rz2;if(!R||def.side||!att.side)return 1;const w=R.wl;return(m.phys?(w.reflect>0||w.auroraVeil>0):(w.lightScreen>0||w.auroraVeil>0))?RZ_WALL_MUL:1}
function rz2Hazard(k,x,y){
  const R=rz2();let h=R.hz.find(z=>z.k===k&&len(z.x-x,z.y-y)<RZ_HZ_R*1.6);
  if(h){if(h.layers<RZ_HZ_MAX[k]){h.layers++;floatTxt(h.x,h.y-40,RZ_HZ_NAME[k]+' '+h.layers+'겹','#e0c88a')}h.life=RZ_HZ_LIFE;return h}
  h={k,x,y,r:RZ_HZ_R,layers:1,life:RZ_HZ_LIFE,cd:0,in:0};R.hz.push(h);if(R.hz.length>RZ_HZ_CAP)R.hz.shift();
  floatTxt(x,y-40,RZ_HZ_NAME[k],'#e0c88a',true);return h;
}
// 자리(zone) 모양 기술: 스텔스록·압정·독압정·끈적네트 · 순풍 · 트릭룸 — 내가 쓸 때만
function rz2Zone(e,m,c,u,tgt){
  if(e.side||!wxOn())return;
  const R=rz2();
  for(const f of m.d.ef||[]){
    if(f.op==='hazard'&&RZ_HZ_MAX[f.h]){
      const d=c&&c.dist!=null?clamp(c.dist,40,230):Math.min(230,tgt&&tgt.hp>0?len(tgt.x-e.x,tgt.y-e.y):230);
      rz2Hazard(f.h,clamp(e.x+u.x*d,WALL,AW-WALL),clamp(e.y+u.y*d,WALL,AH-WALL));
    }else if(f.op==='field'&&f.f==='tailwind'){
      R.tw=parseFloat(f.dur)||16;floatTxt(e.x,e.y-130,'💨 순풍 — 빨라져요','#b8d0ff',true);W.fx.push({k:'ring',sys:1,x:e.x,y:e.y,t:0,life:.6,r:120,c:'#b8d0ff'});
    }else if(f.op==='field'&&f.f==='trickRoom'){
      const foe=W.foe;
      if(R.tr>0){floatTxt(e.x,e.y-130,'이미 트릭룸이에요','#cfd8ea');continue}
      if(!foe||foe.hp<=0)continue;
      if(!(e.spd*stageMul(e.stg.spe)<foe.spd*stageMul(foe.stg.spe))){floatTxt(e.x,e.y-130,'이미 내가 더 빨라요','#cfd8ea');continue}   // 내가 느릴 때만 켜짐
      R.tr=parseFloat(f.dur)||20;R.trSw=1;floatTxt(e.x,e.y-130,'🌀 트릭룸 — 느린 쪽이 빨라져요','#d9a8ff',true);W.fx.push({k:'ring',sys:1,x:e.x,y:e.y,t:0,life:.8,r:160,c:'#d9a8ff'});
    }
  }
}
// 나 자신에게 쓰는 기술(self): 벽 · 대타 · 멸망의노래 · 길동무 — 내가 쓸 때만
function rz2Self(e,f,m){
  if(e.side||!wxOn())return;
  const R=rz2();
  if(f.op==='field'&&RZ_WALL_NAME[f.f]){
    if(f.f==='auroraVeil'&&!(W.wx&&W.wx.k==='snow')){floatTxt(e.x,e.y-130,'설경일 때만 써요','#cfd8ea');return}
    R.wl[f.f]=parseFloat(f.dur)||RZ_WALL_SEC;floatTxt(e.x,e.y-130,'🛡 '+RZ_WALL_NAME[f.f],RZ_WALL_COL[f.f],true);
    W.fx.push({k:'ring',sys:1,x:e.x,y:e.y,t:0,life:.6,r:110,c:RZ_WALL_COL[f.f]});
  }else if(f.op==='shield'&&!f.on){
    const cost=Math.round(e.max*.25);
    if(e.sub>0){floatTxt(e.x,e.y-130,'이미 대타가 있어요','#cfd8ea');return}
    if(e.hp<=cost+1){floatTxt(e.x,e.y-130,'체력이 모자라요','#f88');return}
    e.hp-=cost;e.sub=Math.round(e.max*.25);e.subT=parseFloat(f.dur)||20;floatTxt(e.x,e.y-130,'🪆 대타!','#ffe9a0',true);
    W.fx.push({k:'ring',sys:1,x:e.x,y:e.y,t:0,life:.6,r:90,c:'#ffe9a0'});
  }else if(f.op==='overTime'&&f.what==='perish'){
    const foe=W.foe;if(!foe||foe.hp<=0)return;
    if(C.bossWarn||C.bossHit){floatTxt(foe.x,foe.y-130,'이 상대한텐 안 통해요','#cfd8ea');return}   // 월드보스엔 안 통함(원본도 레이드는 제외)
    if(R.pe&&R.pe.o===foe)return;
    R.pe={o:foe,t:parseFloat(f.after)||12};floatTxt(foe.x,foe.y-140,'☠ 멸망의 노래','#d9a8ff',true);
  }else if(f.op==='counter'&&f.mode==='destinyBond'){
    e.dbT=parseFloat(f.window)||4;floatTxt(e.x,e.y-130,'🔗 길동무','#d9a8ff',true);
  }
}
// 매 틱 한 번: 시간 · 함정 닿음 · 멸망의노래
function rz2Tick(){
  const R=W.rz2;if(!R)return;
  for(const k in R.wl){R.wl[k]-=TICK;if(R.wl[k]<=0){delete R.wl[k];const m=W.me;if(m)floatTxt(m.x,m.y-120,RZ_WALL_NAME[k]+' 끝','#cfd8ea')}}
  if(R.tw>0)R.tw=Math.max(0,R.tw-TICK);
  if(R.tr>0){R.tr-=TICK;if(R.tr<=0){R.tr=0;R.trSw=0;const m=W.me;if(m)floatTxt(m.x,m.y-120,'트릭룸 끝','#cfd8ea')}}
  for(const e of[W.me,W.foe]){if(!e)continue;
    if(e.subT>0){e.subT-=TICK;if(e.subT<=0&&e.sub>0){e.sub=0;floatTxt(e.x,e.y-110,'대타 사라짐','#cfd8ea')}}
    if(e.dbT>0)e.dbT=Math.max(0,e.dbT-TICK);
    if(e.hzSlow>0)e.hzSlow=Math.max(0,e.hzSlow-TICK)}
  if(R.pe){const p=R.pe,o=p.o;
    if(o!==W.foe||o.hp<=0){R.pe=null}
    else{const b=Math.ceil(p.t);p.t-=TICK;const a=Math.ceil(Math.max(0,p.t));
      if(a!==b&&a>0&&a<=5)floatTxt(o.x,o.y-140,'☠ '+a,'#d9a8ff',true);
      if(p.t<=0){R.pe=null;o.hp=0;o.flash=.4;floatTxt(o.x,o.y-100,'멸망!','#d9a8ff',true)}}}
  const f=W.foe;if(!f||f.hp<=0||f.hidden||!R.hz.length)return;
  const ty=f.tera?[f.tera]:(f.types||[]);
  for(let i=R.hz.length-1;i>=0;i--){const h=R.hz[i];
    h.life-=TICK;if(h.life<=0){R.hz.splice(i,1);continue}
    if(h.cd>0)h.cd-=TICK;
    const near=len(f.x-h.x,f.y-h.y)<h.r+f.r*.5;
    if(!near){h.in=0;continue}
    const first=!h.in;h.in=1;if(h.cd>0)continue;
    if(h.k!=='stealthRock'&&ty.includes('FLYING'))continue;   // 날아다니는 상대는 바닥 함정을 안 밟음
    let fr=0;
    if(h.k==='stealthRock')fr=Math.min(1/6,1/8*C.eff('ROCK',ty));
    else if(h.k==='spikes')fr=[1/8,1/6,1/4][h.layers-1]||1/8;
    else if(h.k==='toxicSpikes'){
      if(ty.includes('POISON')){R.hz.splice(i,1);floatTxt(f.x,f.y-90,'독압정을 먹었다','#d9a8ff');continue}   // 독 타입이 밟으면 함정이 사라짐
      if(ty.includes('STEEL'))continue;
      fr=[1/12,1/8][h.layers-1]||1/12;if(h.layers>=2)setAil(f,'poison',100);
    }else if(h.k==='stickyWeb'){f.hzSlow=4;floatTxt(f.x,f.y-90,'끈적끈적!','#e8f0ff')}
    h.cd=RZ_HZ_REARM;
    if(fr>0){fr*=first?1:RZ_HZ_STAND;const d=Math.max(1,Math.round((f.pctMax||f.max)*fr));f.hp=Math.max(0,f.hp-d);f.flash=Math.max(f.flash||0,.1);floatTxt(f.x,f.y-60,fmtN(d*kOf(f)),'#e0c88a')}
  }
}
// 그림: 바닥 함정 · 내 쪽 벽 · 대타 막대 · 위쪽 왼쪽에 남은 시간 표지
function rz2Draw(cx){
  const R=W.rz2||(W.rz3?rz2():null);if(!R)return;
  cx.save();
  for(const h of R.hz){
    cx.globalAlpha=Math.min(1,h.life/3)*.9;
    cx.strokeStyle='rgba(224,200,138,.35)';cx.lineWidth=2;cx.setLineDash([6,6]);cx.beginPath();cx.arc(h.x,h.y,h.r,0,7);cx.stroke();cx.setLineDash([]);
    if(h.k==='stealthRock'){cx.fillStyle='#8d8878';for(let i=0;i<6;i++){const a=i*1.05+.3,x=h.x+Math.cos(a)*h.r*.55,y=h.y+Math.sin(a)*h.r*.4;cx.beginPath();cx.moveTo(x,y-11);cx.lineTo(x+9,y+4);cx.lineTo(x-9,y+6);cx.closePath();cx.fill()}}
    else if(h.k==='stickyWeb'){cx.strokeStyle='#f0f4ff';cx.lineWidth=1.5;cx.beginPath();for(let i=0;i<8;i++){const a=i*.785;cx.moveTo(h.x,h.y);cx.lineTo(h.x+Math.cos(a)*h.r*.8,h.y+Math.sin(a)*h.r*.55)}cx.stroke();cx.beginPath();cx.ellipse(h.x,h.y,h.r*.45,h.r*.3,0,0,7);cx.stroke();cx.beginPath();cx.ellipse(h.x,h.y,h.r*.75,h.r*.5,0,0,7);cx.stroke()}
    else{cx.fillStyle=h.k==='toxicSpikes'?'#b070d8':'#c9c9d4';const n=2+h.layers*2;for(let i=0;i<n;i++){const a=i*(6.28/n)+.4,x=h.x+Math.cos(a)*h.r*.5,y=h.y+Math.sin(a)*h.r*.35;cx.beginPath();cx.moveTo(x,y-10);cx.lineTo(x+5,y+5);cx.lineTo(x-5,y+5);cx.closePath();cx.fill()}}
  }
  cx.globalAlpha=1;
  const me=W.me;
  if(me&&me.hp>0){
    let i=0;for(const k in R.wl){const T=W.time;cx.strokeStyle=RZ_WALL_COL[k];cx.globalAlpha=.55;cx.lineWidth=3;cx.setLineDash([10,8]);cx.lineDashOffset=-T*30;cx.beginPath();cx.arc(me.x,me.y-me.r*.3,me.r+34+i*9,0,7);cx.stroke();i++}
    cx.setLineDash([]);cx.globalAlpha=1;
    if(me.sub>0){const w=70,p=Math.max(0,Math.min(1,me.sub/(me.max*.25)));cx.fillStyle='rgba(8,14,30,.7)';cx.fillRect(me.x-w/2,me.y+me.r+8,w,7);cx.fillStyle='#ffe9a0';cx.fillRect(me.x-w/2,me.y+me.r+8,w*p,7)}
  }
  const L=[];
  for(const k in R.wl)L.push(['🛡 '+RZ_WALL_NAME[k]+' '+Math.ceil(R.wl[k])+'초',RZ_WALL_COL[k]]);
  if(R.tw>0)L.push(['💨 순풍 '+Math.ceil(R.tw)+'초','#b8d0ff']);
  if(R.tr>0)L.push(['🌀 트릭룸 '+Math.ceil(R.tr)+'초','#d9a8ff']);
  if(me&&me.sub>0)L.push(['🪆 대타 '+Math.ceil(me.subT)+'초','#ffe9a0']);
  if(me&&me.dbT>0)L.push(['🔗 길동무 '+Math.ceil(me.dbT)+'초','#d9a8ff']);
  if(R.pe)L.push(['☠ 멸망 '+Math.ceil(R.pe.t)+'초','#d9a8ff']);
  try{for(const l of rz3Labels())L.push(l)}catch(er){}   // ③ 3/3 표지
  cx.font='bold 13px sans-serif';cx.textAlign='left';
  L.forEach((l,i)=>{const y=44+i*24,tw=cx.measureText(l[0]).width+16;cx.fillStyle='rgba(8,14,30,.62)';cx.fillRect(10,y,tw,21);cx.strokeStyle=l[1];cx.lineWidth=1.5;cx.strokeRect(10,y,tw,21);cx.fillStyle=l[1];cx.fillText(l[0],18,y+15)});
  cx.restore();
}
// ===== ③ 날씨 3/3 — 장 4종 · 신비의부적 · 흰안개 · 행운의주문 · 중력 · 원더룸 · 물놀이 · 흙놀이 (천계 이상, 내가 쓸 때만 — 상대가 쓰면 아무 일 없음)
// 원본(replay·sessionEnv)에서 읽은 것: 장 20초(terrainSec) · 장은 필드 절반 넓이 원 안에서만 · 장 기술 ×(boostMul) · 미스트 안에서 드래곤 약해짐 · 그래스 회복 · 일렉트릭 잠 막음 · 미스트 상태이상 막음 · 사이코 선공기 막음. 원본 값 표(boostMul·회복량·부적 지속 등)는 이 자료에 없어서 아래 상수는 내가 정함.
const RZ3_TER_SEC=20,RZ3_TER_R=380,RZ3_TER_MUL=1.3,RZ3_GRASS_FR=1/16,RZ3_GRASS_EVERY=6,RZ3_MISTY_DRAGON=.5,RZ3_SPORT_MUL=.5;
const RZ3_SEC={safeguard:25,mist:25,luckyChant:25,gravity:20,wonderRoom:20,waterSport:20,mudSport:20};
const RZ3_NAME={safeguard:'신비의부적',mist:'흰안개',luckyChant:'행운의주문',gravity:'중력',wonderRoom:'원더룸',waterSport:'물놀이',mudSport:'흙놀이'};
const RZ3_COL={safeguard:'#ffb0d8',mist:'#e8f0ff',luckyChant:'#ffe58a',gravity:'#b07aff',wonderRoom:'#a98bff',waterSport:'#6fb8ff',mudSport:'#c9a070'};
const RZ3_TER={grassy:{n:'그래스필드',c:'#59d46a',t:'GRASS'},electric:{n:'일렉트릭필드',c:'#ffe23d',t:'ELECTRIC'},misty:{n:'미스트필드',c:'#ff9ad8',t:null},psychic:{n:'사이코필드',c:'#c46bff',t:'PSYCHIC'}};
const RZ3_ID={grassyterrain:'terrain:grassy',electricterrain:'terrain:electric',mistyterrain:'terrain:misty',psychicterrain:'terrain:psychic',safeguard:'safeguard',mist:'mist',luckychant:'luckyChant',gravity:'gravity',wonderroom:'wonderRoom',watersport:'waterSport',mudsport:'mudSport'};
function rz3(){return W.rz3||(W.rz3={ter:null,tt:0,tx:0,ty:0,gt:RZ3_GRASS_EVERY,fx:{}})}
// 이 기술의 3/3 효과 목록 [[키,효과표],…] — 효과표에서 못 찾으면 기술 이름표(id)로도 찾음
function rz3Keys(m){
  const r=[];
  for(const f of (m.d&&m.d.ef)||[]){
    if(f.op==='terrain'){const t=f.t||f.terrain||f.v;if(RZ3_TER[t])r.push(['terrain:'+t,f])}
    else{const n=f.op==='field'?f.f:f.op;if(RZ3_SEC[n])r.push([n,f])}
  }
  if(!r.length&&m.id&&RZ3_ID[String(m.id).toLowerCase()])r.push([RZ3_ID[String(m.id).toLowerCase()],{}]);
  return r;
}
function rz3Has(m){try{return rz3Keys(m).length>0}catch(er){return false}}
// 내가 쓸 때만 켜짐
function rz3Eff(e,m){
  if(e.side||!wxOn())return;
  const R=rz3();
  for(const[k,f]of rz3Keys(m)){
    const dur=parseFloat(f.dur||f.durationSec);
    if(k.startsWith('terrain:')){
      const t=k.slice(8),T=RZ3_TER[t];
      if(R.ter===t&&R.tt>0){floatTxt(e.x,e.y-130,'이미 '+T.n+'예요','#cfd8ea');continue}
      R.ter=t;R.tt=dur||RZ3_TER_SEC;R.tx=e.x;R.ty=e.y;R.gt=RZ3_GRASS_EVERY;
      floatTxt(e.x,e.y-130,'🌐 '+T.n,T.c,true);W.fx.push({k:'ring',sys:1,x:e.x,y:e.y,t:0,life:.8,r:180,c:T.c});
    }else{
      R.fx[k]=dur||RZ3_SEC[k];
      floatTxt(e.x,e.y-130,'✨ '+RZ3_NAME[k],RZ3_COL[k],true);W.fx.push({k:'ring',sys:1,x:e.x,y:e.y,t:0,life:.6,r:110,c:RZ3_COL[k]});
    }
  }
}
// 땅에 서 있나(날아다니거나 부유 중이면 장 효과 못 받음 — 중력이 켜져 있으면 모두 땅에 있음)
function rz3Grounded(e){
  const R=W&&W.rz3;if(R&&R.fx.gravity>0)return true;
  const ty=e.tera?[e.tera]:(e.types||[]);
  return !(ty.includes('FLYING')||abHas(e,'LEVITATE'));
}
function rz3In(e){const R=W&&W.rz3;return !!(R&&R.ter&&R.tt>0&&e&&rz3Grounded(e)&&len(e.x-R.tx,e.y-R.ty)<RZ3_TER_R)}
// 피해 배율: 내 기술이 장 타입과 같으면 ×1.3(내가 장 안에 있을 때) · 상대가 나를 때릴 때 미스트 안 드래곤 ×0.5 · 물놀이(불꽃)·흙놀이(전기)는 상대 기술 ×0.5
function rz3Mul(att,def,m){
  const R=W&&W.rz3;if(!R||m.typeless)return 1;
  let x=1;
  if(!att.side){
    const T=R.ter&&R.tt>0?RZ3_TER[R.ter]:null;
    if(T&&T.t&&m.type===T.t&&rz3In(att))x*=RZ3_TER_MUL;
  }else if(!def.side){
    if(R.ter==='misty'&&R.tt>0&&m.type==='DRAGON'&&rz3In(def))x*=RZ3_MISTY_DRAGON;
    if(R.fx.waterSport>0&&m.type==='FIRE')x*=RZ3_SPORT_MUL;
    if(R.fx.mudSport>0&&m.type==='ELECTRIC')x*=RZ3_SPORT_MUL;
  }
  return x;
}
// 중력: 내 땅 기술이 날아다니는·부유 상대에게도 들어감
function rz3Grav(att){const R=W&&W.rz3;return !!(R&&R.fx.gravity>0&&!att.side)}
// 원더룸: 상대의 방어와 특수방어를 맞바꿔요(내 기술이 맞을 때만)
function rz3Wonder(att,def){const R=W&&W.rz3;return !!(R&&R.fx.wonderRoom>0&&!att.side&&def.side)}
// 행운의주문: 상대가 나를 칠 때 급소 없음
function rz3Lucky(def){const R=W&&W.rz3;return !!(R&&R.fx.luckyChant>0&&!def.side)}
// 사이코필드: 장 안의 나에게 상대의 선공 기술이 안 통함
function rz3Prio(att,def,m){const R=W&&W.rz3;return !!(R&&R.ter==='psychic'&&R.tt>0&&att.side&&!def.side&&((m.d&&m.d.pr)|0)>0&&rz3In(def))}
// 상태이상 막기(내 쪽만): 신비의부적 · 미스트필드 · 일렉트릭필드(잠). 막으면 글자를 돌려줘요
function rz3BlockSt(def,s){
  const R=W&&W.rz3;if(!R||def.side||s==='flinch')return null;
  if(R.fx.safeguard>0)return '신비의부적이 막았다!';
  if(R.ter==='misty'&&R.tt>0&&rz3In(def))return '미스트필드가 막았다!';
  if(R.ter==='electric'&&R.tt>0&&s==='sleep'&&rz3In(def))return '일렉트릭필드가 막았다!';
  return null;
}
function rz3Tick(){
  const R=W.rz3;if(!R)return;
  for(const k in R.fx){R.fx[k]-=TICK;if(R.fx[k]<=0){delete R.fx[k];const m=W.me;if(m)floatTxt(m.x,m.y-120,RZ3_NAME[k]+' 끝','#cfd8ea')}}
  if(R.ter){R.tt-=TICK;
    if(R.tt<=0){const T=RZ3_TER[R.ter];R.ter=null;R.tt=0;const m=W.me;if(m)floatTxt(m.x,m.y-120,T.n+' 끝','#cfd8ea')}
    else if(R.ter==='grassy'){R.gt-=TICK;
      if(R.gt<=0){R.gt=RZ3_GRASS_EVERY;const me=W.me;
        if(me&&me.hp>0&&me.hp<me.max&&rz3In(me)){const h=Math.min(me.max-me.hp,Math.max(1,Math.round((me.pctMax||me.max)*RZ3_GRASS_FR)));me.hp+=h;floatTxt(me.x,me.y-100,'+'+fmtN(h*kOf(me)),'#6f6')}}}}
}
function rz3Labels(){
  const R=W.rz3,L=[];if(!R)return L;
  if(R.ter&&R.tt>0){const T=RZ3_TER[R.ter];L.push(['🌐 '+T.n+' '+Math.ceil(R.tt)+'초',T.c])}
  for(const k in R.fx)L.push(['✨ '+RZ3_NAME[k]+' '+Math.ceil(R.fx[k])+'초',RZ3_COL[k]]);
  return L;
}
// 그림: 장은 바닥에 큰 원(안쪽만 효과) · 내 몸 둘레 점선 원은 신비의부적·흰안개·행운의주문
function rz3Draw(cx){
  const R=W.rz3;if(!R)return;
  cx.save();
  if(R.ter&&R.tt>0){const T=RZ3_TER[R.ter],a=Math.min(1,R.tt/3);
    cx.globalAlpha=.1*a;cx.fillStyle=T.c;cx.beginPath();cx.arc(R.tx,R.ty,RZ3_TER_R,0,7);cx.fill();
    cx.globalAlpha=.55*a;cx.strokeStyle=T.c;cx.lineWidth=4;cx.setLineDash([14,10]);cx.lineDashOffset=-W.time*24;cx.beginPath();cx.arc(R.tx,R.ty,RZ3_TER_R,0,7);cx.stroke();cx.setLineDash([])}
  const me=W.me;
  if(me&&me.hp>0){let i=0;
    for(const k of['safeguard','mist','luckyChant']){if(!(R.fx[k]>0))continue;
      cx.globalAlpha=.55;cx.strokeStyle=RZ3_COL[k];cx.lineWidth=3;cx.setLineDash([4,8]);cx.lineDashOffset=W.time*30;cx.beginPath();cx.arc(me.x,me.y-me.r*.3,me.r+60+i*9,0,7);cx.stroke();i++}
    cx.setLineDash([])}
  cx.restore();
}
function dealDamage(att,def,mi,opt){
  if(W&&W.tut)return 0;   // 9BA: 구르기 연습 중엔 아무도 안 다침
  opt=opt||{};
  if(def.hp<=0)return 0;
  let m=att.moves[mi]||opt.mi;
  if(att.ab&&att.ab.length&&m&&!m.typeless&&m.type!=='NORMAL'&&abHas(att,'NORMALIZE')){m=Object.assign({},m,{type:'NORMAL'});opt._skin=1}   // G: 노말스킨 — 모든 기술이 노말 타입이 되고 ×1.2
  if(att.ab&&att.ab.length&&m&&m.type==='NORMAL'&&!m.typeless){const _sk=abSkin(att);if(_sk){m=Object.assign({},m,{type:_sk});opt._skin=1}}   // F: 스카이·페어리·프리즈·일렉트릭스킨 — 노말 기술이 그 타입이 되고 ×1.2
  if(def.hidden){return 0}
  if(def.protect>0){floatTxt(def.x,def.y-60,'막았다!','#9be7ff');W.fx.push({k:'ring',sys:1,x:def.x,y:def.y,t:0,life:.3,r:70,c:'#9be7ff'});return 0}
  if(def.rollT>0){
    const t=14-def.rollT; // 지난 틱 (0~13)
    if(t>=1&&t<=10){
      if(t<=4&&!def.perfect){def.perfect=1;def.rc=Math.min(2,def.rc+1);def.critWin=1;floatTxt(def.x,def.y-70,'완벽 회피!','#ffe14a',true);W.hitstop=Math.max(W.hitstop,.08)}
      return 0}
  }
  if(def.inv>0){return 0}
  if(W.rz3&&rz3Prio(att,def,m)){floatTxt(def.x,def.y-70,'사이코필드가 막았다!','#c46bff');return 0}
  if(def.ab&&def.ab.length&&att.side&&!abMold(att)&&((m.d&&m.d.pr)|0)>0){const _pk=['ARMORTAIL','QUEENLYMAJESTY','DAZZLING'].find(k=>abHas(def,k));if(_pk){floatTxt(def.x,def.y-70,AB_NAME[_pk]+'! 선공을 막았다','#ffb0ff',true);return 0}}   // H: 테일아머·여왕의위엄·비비드바디   // ③ 3/3: 사이코필드 안의 나에게 선공 기술 안 통함
  {let _ev=def.gear&&def.gear.eva>0?Math.min(.5,def.gear.eva/100):0;if(def.ab&&def.ab.length&&!abMold(att)){const _q=abEvade(def);if(_q>0)_ev=1-(1-_ev)*(1-_q)}if(_ev>0&&rnd()<_ev){floatTxt(def.x,def.y-70,'회피!','#9be7ff');return 0}}   // 8F 장비 회피 (+F 모래숨기·눈숨기·갈지자걸음)
  const _wr=W.rz3&&rz3Wonder(att,def),_pd=_wr?!m.phys:m.phys;   // ③ 3/3 원더룸: 상대 방어↔특수방어 맞바꿈
  const A=m.phys?att.st[1]:att.st[3], D=_pd?def.st[2]:def.st[4];
  let Am=stageMul(m.phys?att.stg.atk:att.stg.spa), Dm=stageMul(_pd?def.stg.def:def.stg.spd);
  if(def.ab&&def.ab.length&&abHas(def,'UNAWARE')&&!abMold(att))Am=1;   // F: 천진 — 맞을 땐 상대의 공격 단계를 무시
  if(att.ab&&att.ab.length&&abHas(att,'UNAWARE'))Dm=1;   // F: 천진 — 때릴 땐 상대의 방어 단계를 무시
  let e=m.typeless?1:C.eff(m.type,def.tera?[def.tera]:def.types);   // 9BC 테라스탈: 맞는 쪽은 테라 타입 하나로
  if(e===0&&att.ab&&att.ab.length&&(abHas(att,'SCRAPPY')||abHas(att,'MINDSEYE'))&&!m.typeless&&(m.type==='NORMAL'||m.type==='FIGHTING')){const _t0=def.tera?[def.tera]:def.types,_t=_t0.filter(x=>x!=='GHOST');if(_t.length!==_t0.length)e=_t.length?C.eff(m.type,_t):1}   // H: 배짱·심안 — 노말·격투가 고스트에도 들어감
  if(e===0&&m.type==='GROUND'&&W.rz3&&rz3Grav(att)){const _t=(def.tera?[def.tera]:def.types).filter(x=>x!=='FLYING');e=C.eff('GROUND',_t.length?_t:['NORMAL'])}   // ③ 3/3 중력: 날아다니는 상대에게도 땅 기술
  if(def.ab&&def.ab.length){try{if(abGuard(att,def,m,e))return 0}catch(er){}}   // ② 특성 D: 부유·흡수·방음·방진·불가사의부적
  const stab=att.tera&&att.tera===m.type?(att.types.includes(m.type)?2:1.5):att.types.includes(m.type)?1.5:1;
  const cx0=att.critX||{c:0,d:0};   // 7G: 크리티컬 확률·데미지 보너스(접두사·먹이 아이템·내 캐릭터 접두사)
  const crit=!(W.rz3&&rz3Lucky(def))&&!(def.ab&&def.ab.length&&abNoCrit(def,att))&&((att.ab&&att.ab.length&&abHas(att,'MERCILESS')&&def.ail&&def.ail.poison!=null)||rnd()<(att.critWin>0?.5:(att.ab&&att.ab.length&&abHas(att,'SUPERLUCK')?1/8:1/24)+cx0.c));   // H: 무도한행동 — 독인 상대엔 항상 급소   // F: 대운=급소 단계 +1(1/24→1/8) · 전투무장·조가비갑옷=급소 안 맞음   // ③ 3/3 행운의주문: 내가 맞을 땐 급소 없음
  let power=m.p*(opt.pm||1)*(opt._skin?1.2:1);
  const _ign=Math.min(.9,((att.gear&&att.gear.aA&&att.gear.aA.ign)||0)/100);   // 9BZ 아티팩트 방어력 무시
  let base=((2*att.lv/5+2)*power*(A*Am)/Math.max(1,D*Dm*(1-_ign))/50+2);
  let dmg=base*.52*stab*e*(.85+rnd()*.15)*(crit?1.5*(1+cx0.d):1)*(m.melee&&m.phys?1.15:1)*(att.zb&&att.zb.on>0?1.3:1);   // 9F 만제 버프
  if(att.ail.burn&&m.phys)dmg*=.5;
  if(opt.mult)dmg*=opt.mult;
  if(att.gmx)dmg*=1.6;if(def.gmx)dmg*=.55;   // 거다이맥스: 공격 ×1.6 · 받는 피해 ×0.55
  if(att.gxPow&&(att.gxPow.all||att.gxPow.t===m.type))dmg*=att.gxPow.m;   // 1/3: 체육관 물웅덩이 안 물 기술 ×1.25 (3/3: all=모든 기술)
  if(def.gxTake>0&&def.gxTake!==1)dmg*=def.gxTake;   // 3/3: 받는 피해 배율(광석·강철 판)
  if(att.gxMelT>0&&m.melee&&!opt.chain){dmg*=1.3;att.gxMelT=0}   // 3/3: 로프 반동 뒤 다음 근접 ×1.3
  if(att.gxChgT>0&&m.type==='ELECTRIC'){dmg*=1.3;att.gxChgT=0}   // 3/3: 등대 충전 뒤 다음 전기 기술 ×1.3
  if(att.gear&&att.gear.atk)dmg*=1+att.gear.atk/100;{const _dd=((def.gear&&def.gear.def)||0)+((def.gear&&def.gear.aA&&def.gear.aA.def)||0);if(_dd)dmg*=1-Math.min(.6,_dd*(1-_ign)/100)}   // 8F 장비 공격력·방어력 (+아티팩트 방어력, 방어력 무시는 그만큼 깎아요)
  if(att.gear&&att.gear.aA){const q=att.gear.aA;dmg*=(1+(q.tatk||0)/100)*(1+(q.tdmg||0)/100)*(1+(q.elem||0)/100)*(1+(q.aB||0)/100)}   // 9BZ 아티팩트: 총공격력·총데미지·모든속성·보스/일반 공격력
  if((att.ab&&att.ab.length)||(def.ab&&def.ab.length)){try{const _ab=abDmg(att,def,m,e,crit);if(_ab!==1)dmg*=_ab}catch(er){}}   // ② 특성 A: 배율형
  if(W.wx){try{const _wx=wxMul(att,def,m);if(_wx!==1)dmg*=_wx}catch(er){}}   // ③ 날씨 1/2: 내 쪽 이로움 · 상대 쪽 해로움
  if(W.rz2){try{const _wl=rz2Wall(att,def,m);if(_wl!==1)dmg*=_wl}catch(er){}}
  if(W.rz3){try{const _r3=rz3Mul(att,def,m);if(_r3!==1)dmg*=_r3}catch(er){}}   // ③ 3/3: 장 기술 ×1.3 · 미스트 드래곤 · 물놀이·흙놀이   // ③ 2/2: 내 쪽 벽(리플렉터·빛의장막·오로라베일)
  if(C.dmgMul){try{dmg*=+C.dmgMul(att.mon,def.mon,m.id)||1}catch(er){}}   // 7D: 기술 레벨 +8%/레벨 · 난이도별 상대 데미지(예전 전투 DDMG)
  if(m.exec&&def.lv>att.lv)dmg*=.5;               // 즉사기: 상대 레벨이 높으면 절반
  let fixedDmg=null;
  if(m.fx){const f=m.fx;
    fixedDmg=f.mode==='flat'?(f.value||0):f.mode==='level'?att.lv:f.mode==='levelRandom'?Math.floor(att.lv*(.5+rnd())):
      f.mode==='fracTargetHp'?def.hp*(f.value||.5):f.mode==='userCurrentHp'?att.hp:f.mode==='targetHpMinusUserHp'?Math.max(0,def.hp-att.hp):
      f.mode==='leaveAtLeast1Hp'?Math.min(dmg,def.hp-1):null}
  if(fixedDmg!=null&&C.bossNoFrac&&def.side===1&&m.fx&&/^(fracTargetHp|targetHpMinusUserHp|leaveAtLeast1Hp)$/.test(m.fx.mode))fixedDmg=null;   // 9H: 월드보스엔 '체력 절반' 같은 비율 기술이 안 통함(보통 데미지로)
  if(fixedDmg!=null)dmg=fixedDmg;
  if(opt.fixed)dmg=opt.fixed;
  if(C.bossHit&&att.side===1&&fixedDmg==null&&!opt.fixed&&dmg>0)dmg=def.max*C.bossHit*clamp((m.p||60)/90,.6,1.5)*Math.min(2,e)*(.85+rnd()*.15)*(crit?1.4:1);   // 9H: 월드보스 공격 = 내 포켓몬 최대 체력의 몇 % (싸움 길이를 일정하게)
  const capped=fixedDmg!=null||opt.fixed?dmg:Math.min(dmg,def.max*.6);
  const rawD=capped;dmg=Math.max(e===0?0:1,Math.round(capped));
  if(e===0)dmg=0;
  if(def.sub>0&&dmg>0){const a=Math.min(def.sub,dmg);def.sub-=a;dmg-=a;if(def.sub<=0){def.sub=0;def.subT=0;floatTxt(def.x,def.y-115,'대타 사라짐','#ffe9a0')}if(dmg<=0){floatTxt(def.x,def.y-70,'대타!','#ffe9a0');def.flash=.08;return 0}}   // ③ 2/2: 내 대타(체력 1/4짜리 방패)
  if(def.sh>0&&dmg>0){const a=Math.min(def.sh,dmg);def.sh-=a;dmg-=a;if(def.sh<=0){def.sh=0;floatTxt(def.x,def.y-115,'보호막 깨짐','#ffe9a0')}if(dmg<=0){floatTxt(def.x,def.y-70,'보호막!','#ffe9a0');def.flash=.08;return 0}}   // 9B 태초 보호막
  if(def.ab&&def.ab.length&&dmg>=0)dmg=abSturdy(att,def,m,dmg);   // F: 옹골참
  const _hb=def.hp;def.hp=Math.max(0,def.hp-dmg);
  if(def.hp<=0&&def.dbT>0&&!def.side&&att.side===1&&att.hp>0&&!C.bossHit&&!C.bossWarn){att.hp=0;att.flash=.4;def.dbT=0;floatTxt(att.x,att.y-100,'🔗 길동무!','#d9a8ff',true)}   // ③ 2/2: 길동무(내가 쓰러지면 때린 상대도 같이)
  if(dmg>0&&att.gear&&att.gear.aA&&att.gear.aA.vamp&&att.hp>0){const _vh=Math.min(att.max-att.hp,att.max*.05,Math.round(Math.min(dmg,_hb)*att.gear.aA.vamp/100));if(_vh>0){att.hp+=_vh;floatTxt(att.x,att.y-100,'+'+fmtN(_vh*kOf(att)),'#6f6')}}   // 9BZ 아티팩트 흡혈
  if(def.hp<=0&&def.undying&&!def._ud){def._ud=1;def.hp=Math.round(def.max*.5);const s=def.aw>0?10+3*(def.aw-1):1;def.inv=Math.max(def.inv||0,Math.round(s*60));def.invMax=def.inv;cancelCast&&def.cast&&cancelCast(def,true);floatTxt(def.x,def.y-125,'불멸 부활!'+(def.aw>0?' 무적 '+s+'초':''),'#8fb4ff',true);W.hitstop=Math.max(W.hitstop||0,.15);try{W.fx.push({k:'ring',sys:1,x:def.x,y:def.y,t:0,life:.5,r:110,c:'#8fb4ff'})}catch(er){}}   // 9B 불멸: 한 번 버팀
  def.flash=.15;
  if(dmg>0&&m.melee&&!opt.chain&&W.gx&&window.GYMFX&&GYMFX.melee){try{GYMFX.melee(W.gx,att,def)}catch(er){}}   // 3/3: 링에서 근접으로 때리면 상대가 날아감
  if(dmg>0){
    try{window.PKS&&PKS.hit(m,e,crit,!att.side)}catch(er){}
    W._dp={dmg,raw:Math.max(rawD,dmg>0?1:0),e,crit,col:e>1?'#ffb030':crit?'#ffe14a':(C.TCOL[m.type]||'#fff')};
    if(e>1)floatTxt(def.x,def.y-95,'효과 굉장!','#ffb030');
    if(e<1&&e>0)floatTxt(def.x,def.y-95,'별로…','#9bb');
  } else {floatTxt(def.x,def.y-70,'효과 없음','#9bb');try{if(att.side===0&&att===W.me)W._noEffTick=W.tick}catch(er){}}   // 내 공격이 「효과 없음」이면 → 자동 교체 쪽에 알려요
  if(att.critWin>0&&crit)att.critWin=0;
  // 다단 기술: 첫 타가 맞으면 나머지 타를 간격(근접 8틱·원거리 6틱)으로 이어서 침
  if(dmg>0&&m.hits>1&&!opt.chain&&!opt.mult&&m.mh&&!m.chg){const mh=m.mh;let n=m.hits;
    if(mh.n==null&&mh.min!=null){const dist=mh.dist||[.35,.35,.15,.15];let r=rnd(),i=0;for(;i<dist.length-1&&r>dist[i];i++)r-=dist[i];n=mh.min+i;if(att.ab&&att.ab.length&&abHas(att,'SKILLLINK'))n=mh.min+dist.length-1}
    if(n>1){W.chain.push({o:att,mi:att.moves.indexOf(m)>=0?mi:mi,n:n-1,t:m.melee?8:6,iv:m.melee?8:6,melee:m.melee});W._more=1}}
  // 6C-4 흡수(드레인): 준 데미지의 절반 회복 · 반동: 준 데미지의 일부(발버둥은 최대 체력 1/4)를 받음
  if(dmg>0&&att.hp>0)for(const f of (m.d.ef||[])){
    if(f.op==='drain'&&def.ab&&def.ab.length&&abOoze(att,def,dmg,f)){}
    else if(f.op==='drain'){const h=Math.min(att.max-att.hp,Math.max(1,Math.round(dmg*(f.frac||.5))));if(h>0){att.hp+=h;floatTxt(att.x,att.y-100,'+'+fmtN(h*kOf(att)),'#6f6')}}
    if(f.op==='recoil'&&!abNoRecoil(att,f)){const rc=Math.max(1,Math.round(f.of==='max'?(att.pctMax||att.max)*(f.frac||.25):dmg*(f.frac||.25)));   /* 9AA: 월드보스가 PP 바닥나 발버둥 치면 10억의 1/4씩 자기 피를 깎아 죽던 버그 → 원래 체력 기준 */att.hp=Math.max(0,att.hp-rc);floatTxt(att.x,att.y-100,'반동 '+fmtN(rc*kOf(att)),'#f88')}}
  // 자폭기: 쓰면 기절
  if(m.selfko&&att.hp>0&&!att._ko&&!(C.bossNoFrac&&att.side===1)){att._ko=1;att.hp=0;floatTxt(att.x,att.y-90,'쓰러졌다','#f88')}
  if(dmg>0&&!opt.chain&&((def.ab&&def.ab.length)||(att.ab&&att.ab.length))){try{abAfterHit(att,def,m,dmg,crit,_hb)}catch(er){}}   // ② 특성 C: 맞은 뒤
  // 6E-3: 마지막 타(또는 치명타·효과 굉장)는 크게, 중간 타는 작게
  const fin=(opt.chain?!!opt.last:!W._more)||crit||e>1;W._more=0;
  if(dmg>0&&W._dp){const q=W._dp;W._dp=null;
    {let sk=0;try{sk=C.dmgSkin?C.dmgSkin(att.mon,m.id)|0:0}catch(er){}dmgPop(def.x,def.y-62,null,q.col,fin,Math.max(1,Math.round((fixedDmg!=null||opt.fixed?q.dmg:q.raw)*kOf(def))),crit,sk)}
    hitFx(def,C.TCOL[m.type]||'#fff',fin);
    W.hitstop=Math.max(W.hitstop,fin?Math.max(HSTOP[m.g],.1):HSTOP[m.g]*.6)}
  else W.hitstop=Math.max(W.hitstop,HSTOP[m.g]);
  if(dmg>0){fxShake(m.g);if(!opt.chain&&(m.k==='melee'||m.k==='roll'||m.k==='target'||m.k==='vanish'))skillFx(att,m,{x:att.x,y:att.y},{x:def.x,y:def.y})}
  if(dmg>0&&!opt.chain&&NFX()&&BEAMFX.sheetHit&&SHX(att)){try{BEAMFX.sheetHit(m.name,def.x,def.y-(def.r||40)*.6,clamp((def.r||40)*5,200,320),att.x>def.x)}catch(er){}}   // 9BM 그림 효과: 맞는 쪽
  // 경직·넉백·끊기
  const dirv=norm(def.x-att.x,def.y-att.y);
  const kb=KB[m.g]*(def.r>SIZE.kbRef?Math.max(SIZE.kbMin,Math.pow(SIZE.kbRef/def.r,SIZE.kbExp)):1);   // 6C-4 큰 몸은 덜 밀림(원본 knockbackResist)
  const rampArmor=def.cast&&(def.cast.mv.ramp||def.cast.ramp)&&m.g<=RAMP.armor;   // 6C-4 연속기 중엔 M급 이하 공격에 안 끊김
  const interrupt=!rampArmor&&def.cast&&def.cast.phase==='startup'&&(def.cast.mv.g>=3?m.g>=2:m.g>=1);
  const buffBreak=def.cast&&def.cast.mv.k==='self'&&def.cast.phase==='startup'&&m.g>=1;
  const beamBreak=def.cast&&def.cast.mv.k==='beam'&&def.cast.phase==='active'&&m.g>=2;
  const dc=def.cast;
  if(dc&&dc.phase==='startup'&&!interrupt&&!buffBreak){def.kx+=dirv.x*kb*2;def.ky+=dirv.y*kb*2}   // 버팀: 끊기지 않고 조금만 밀림
  else if(dc&&dc.phase==='active'&&dc.mv.k==='beam'&&!beamBreak){def.kx+=dirv.x*kb;def.ky+=dirv.y*kb}
  else if(rampArmor){def.kx+=dirv.x*kb;def.ky+=dirv.y*kb}
  else{
    if(dc)cancelCast(def,!!(interrupt||buffBreak||beamBreak));
    const mine=def.side===0;   // 9J: 내 포켓몬은 맞아도 덜 굳고 덜 밀려요(조작이 안 막히게)
    def.stun=Math.max(def.stun,mine?Math.round(STUN[m.g]*.3):STUN[m.g]);if(opt.blink)def.stun=Math.max(def.stun,30);   // 9X: 순간이동 근접에 맞으면 0.5초 경직
    def.kx+=dirv.x*kb*(mine?4:8);def.ky+=dirv.y*kb*(mine?4:8);
  }
  def.sleepWake=1; if(def.ail.sleep){delete def.ail.sleep}
  if(att.counterT>0)att.counterT=0;
  // 부가효과
  if(dmg>0&&m.d.ef)applyEf(att,def,m,true);
  W.fx.push({k:'burst',x:def.x,y:def.y-20,t:0,life:.25,r:30+m.g*14,c:C.TCOL[m.type]||'#fff'});
  return dmg;
}
function cancelCast(e,hurt){
  if(!e.cast)return;
  const i=e.cast.mi;
  if(hurt&&i>=0&&!(e.cast.mv&&e.cast.mv.chg))e.cd[i]=e.cdMax[i]*.5;
  if(e.ramp){e.ramp=null}   // 연속기가 끊기면 혼란 없이 끝
  e.cast=null;e.beam=null;e.hidden=false;
}
// 6C-4 PP: 모든 기술 PP가 0이면 첫 칸이 발버둥(위력 40·쿨 2.5초·무속성·최대 체력 1/4 반동)
function ppOut(e,i){floatTxt(e.x,e.y-120,e.moves[i].name+' PP 없음','#f88');
  if(e.moves.every((m,j)=>!m||(m.ppMax>0&&e.pp[j]<=0))){e.moves[0]=moveInfo('struggle');e.cdMax[0]=2.5;e.cd[0]=Math.max(e.cd[0],.5);e.pp[0]=0;e.ch[0]=0;
    floatTxt(e.x,e.y-140,'발버둥!','#ffd23f');if(e===W.me)setTimeout(()=>{try{setMoveBtns()}catch(er){}},0)}}
function addStage(e,k,n){e.stg[k]=clamp(e.stg[k]+n,-3,3);e.stgT=8;floatTxt(e.x,e.y-90,({atk:'공격',def:'방어',spa:'특공',spd:'특방',spe:'스피드'}[k]||k)+(n>0?' ▲':' ▼'),n>0?'#8f8':'#f88')}
function setAil(def,s,chance){
  if(chance!=null&&rnd()*100>=chance)return;
  if(def.sub>0&&s!=='flinch'){floatTxt(def.x,def.y-110,'대타가 막았다','#ffe9a0');return}   // ③ 2/2: 대타가 있으면 상태이상 안 걸림
  if(W&&W.rz3){const _b=rz3BlockSt(def,s);if(_b){floatTxt(def.x,def.y-110,_b,'#ffb0d8');return}}   // ③ 3/3: 신비의부적·미스트필드·일렉트릭필드(잠)
  const T={burn:8,poison:8,toxic:12,paralysis:6,sleep:2.5,freeze:2,confusion:3,flinch:0};
  if(!(s in T))return;
  if(def.ab&&def.ab.length&&abBlockSt(def,s)){floatTxt(def.x,def.y-110,'막았다!','#9be7ff');return}   // ② 특성 D: 상태이상 막기
  const IMM={burn:'FIRE',poison:'POISON',toxic:'POISON',paralysis:'ELECTRIC',freeze:'ICE'};
  if(IMM[s]&&def.types.includes(IMM[s]))return;
  if(s==='toxic')s='poison';
  if(s==='flinch'){def.stun=Math.max(def.stun,def.side===0?4:10);if(def.ab&&def.ab.length&&abHas(def,'STEADFAST')){floatTxt(def.x,def.y-135,'불굴의마음!','#ffe14a',true);abStage(def,'spe',1,true)}return}   // F: 불굴의마음 — 풀죽으면 스피드 ▲
  if(def.ail[s]!=null||def.ailImm&&def.ailImm[s]>0)return;
  const _du=(s==='sleep'&&def.ab&&def.ab.length&&abHas(def,'EARLYBIRD'))?T[s]/2:T[s];   // F: 일찍기상 — 잠드는 시간 절반
  def.ail[s]=_du==null?3:_du;
  floatTxt(def.x,def.y-110,({burn:'화상',poison:'독',paralysis:'마비',sleep:'잠듦',freeze:'얼음',confusion:'혼란'})[s]||s,'#f9a');
  if(s==='sleep'||s==='freeze'){def.stun=Math.max(def.stun,Math.round(_du*60));cancelCast(def,false)}
  if(def.ab&&def.ab.length){try{abAfterStatus(def,s)}catch(er){}}   // F: 싱크로·일찍기상 글자
}
function applyEf(att,def,m,hit){
  const _cm=att.ab&&att.ab.length&&abHas(att,'SERENEGRACE')?2:1;   // F: 하늘의은총 — 부가효과 확률 ×2
  const _ef=def&&def.ab&&def.ab.length?abEfFilter(att,def,m):(m.d.ef||[]);   // F: 상대가 나에게 거는 효과 거르기(미라클스킨·매직미러·인분)
  for(const f of _ef){
    if(f.op==='status'&&hit&&m.k!=='self'){
      const ss=String(f.s||'').split('|');setAil(def,ss[Math.floor(rnd()*ss.length)],f.chance==null?100:Math.min(100,f.chance*_cm))}
    else if(f.op==='stat'){
      const who=f.who==='user'?att:def;
      if(f.who!=='user'&&!hit)continue;
      if(f.chance!=null&&rnd()*100>=Math.min(100,f.chance*_cm))continue;
      for(const k in f.stages)abStage(who,k,f.stages[k],who===att);
    }
    else if(f.op==='heal'&&f.who==='user'){att.hp=Math.min(att.max,att.hp+Math.round((att.pctMax||att.max)*(f.frac||.5)));floatTxt(att.x,att.y-90,'회복','#8f8')}
    else if(f.op==='drain'&&hit){}
    else if(f.op==='recoil'&&hit){}
  }
}

// ---------- 기술 사용 ----------
function canCast(e,i){
  const m=e.moves[i];
  if(m&&m.ppMax>0&&e.pp&&e.pp[i]<=0)return false;   // PP 다 씀
  return m&&(m.chg?e.ch[i]>=1:e.cd[i]<=0)&&!e.cast&&e.stun<=0&&e.rollT<=0&&!(e.swapT>0)&&e.hp>0&&!e.ail.sleep&&!e.ail.freeze&&!W.over;
}
function startCast(e,i,aimDir,dist){
  const m=e.moves[i];
  const cast={mi:i,mv:m,phase:'startup',t:0,su:wxSu(e,m,abSu(e,m)),aim:Math.atan2(aimDir.y,aimDir.x),want:Math.atan2(aimDir.y,aimDir.x),dist:dist};
  e.cast=cast;
  if(m.chg){if(e.ch[i]>=m.chg.max)e.chT[i]=m.chg.per;e.ch[i]=Math.max(0,e.ch[i]-1);e.cd[i]=e.ch[i]>=1?0:e.chT[i]}
  else e.cd[i]=e.cdMax[i]*(m.ramp?RAMP.cdMul:1)*pressMul(e); // 쏘는 순간부터 쿨타임 (연속기는 ×2)
  if(m.ppMax>0&&e.pp){e.pp[i]=Math.max(0,e.pp[i]-1);if(e.pp[i]<=0)ppOut(e,i)}
  if(!e.side&&C.onUse){try{const up=C.onUse(e.mon,m.id);if(up)floatTxt(e.x,e.y-130,'⬆ '+m.name+' Lv.'+up,'#ffd23f',true)}catch(er){}}   // 7G 기술 레벨 올리기
  if(m.ramp){cast.pm=RAMP.powerMul;e.ramp={mi:i,left:(RAMP.min-1)+(rnd()<.5?1:0)}}   // 연속기: 2~3번, 한 번 위력 ×0.75
  e.anim=m.melee?'attack':'shoot';e.at=0;
  try{window.PKS&&PKS.cast(m,!e.side)}catch(er){}
  W.fx.push({k:'callout',x:e.x,y:e.y-120,t:0,life:.9,s:m.name,c:C.TCOL[m.type]||'#fff'});
}
function phaseTo(e,ph,ticks){e.cast.phase=ph;e.cast.t=0;e.cast.len=ticks}
function castMoveMul(e){
  if(!e.cast)return 1;
  const c=e.cast,g=c.mv.g;
  if(c.phase==='startup')return WALK_ST[g];
  if(c.phase==='recovery')return c.rooted?0:REC_MV[g];
  if(c.mv.k==='beam')return .6;
  if(c.mv.k==='vanish')return 0;
  return 0;
}
function updateCast(e){
  const c=e.cast;if(!c)return;
  const m=c.mv,g=m.g,tgt=foeOf(e);
  c.t++;
  if(c.phase==='startup'){
    // 조준 잠금 전까지 회전
    if(c.t<=LOCK[g]){
      const d=angDiff(c.aim,c.want),st=TURN[g]*Math.PI/180*TICK;c.aim+=clamp(d,-st,st)}
    if(c.t>=c.su){fire(e,c)}
  } else if(c.phase==='active'){
    activeTick(e,c,tgt);
  } else if(c.phase==='recovery'){
    if(c.t>=c.len){e.cast=null;e.anim='idle';rampNext(e)}
  }
}
// 6C-4 연속기: 다음 타를 짧은 준비(6틱)로 상대 쪽에 자동으로 이어서 침 · 다 치면 3초 혼란
function rampNext(e){const r=e.ramp;if(!r)return;
  if(r.left>0&&e.hp>0&&e.stun<=0&&foeOf(e).hp>0&&!W.over){r.left--;const m=e.moves[r.mi];if(!m){e.ramp=null;return}const t=foeOf(e),a=Math.atan2(t.y-e.y,t.x-e.x);
    e.cast={mi:r.mi,mv:m,phase:'startup',t:0,su:RAMP.followT,aim:a,want:a,pm:RAMP.powerMul,ramp:1};e.anim='attack';e.at=0;return}
  e.ramp=null;if(e.hp>0&&!e.ail.confusion){e.ail.confusion=RAMP.confuseSec;floatTxt(e.x,e.y-110,'지쳐서 혼란','#f9a')}}
function toRecovery(e,c){phaseTo(e,'recovery',c.mv.rech?150:(e.ramp&&e.ramp.left>0)?RAMP.gapT:REC[c.mv.g]);c.rooted=!!c.mv.rech;e.anim='idle'}
function aimVec(c){return{x:Math.cos(c.aim),y:Math.sin(c.aim)}}
function circleHit(e,c,cx,cy,rad,tgt,opt){
  if(tgt.hp<=0)return false;
  if(len(tgt.x-cx,tgt.y-cy)<=rad*(e.side?1:1.45)+tgt.r*(e.side?.9:1.2)){dealDamage(e,tgt,c.mi,opt);return true}
  return false;
}
function fire(e,c){
  const m=c.mv,k=m.k,g=m.g,u=aimVec(c),tgt=foeOf(e),heavy=m.p>=110;
  c.hit=false;
  e.face={x:u.x,y:u.y};e.row=dirRow(u.x,u.y);
  if(NFX()&&BEAMFX.sheetCast&&!m.st&&SHX(e)){try{BEAMFX.sheetCast(m.name,e.x+u.x*(e.r||40)*.8,e.y-(e.r||40)*.6+u.y*(e.r||40)*.5,clamp((e.r||40)*4,160,260),u.x<0)}catch(er){}}   // 9BM 그림 효과: 쓰는 쪽(모으기)
  // 9BL 상대(몬스터)가 쓰는 근접·몸에 바로 맞는 기술: 3초 동안 바닥에 장판이 먼저 떠요 → 장판 밖으로 피하면 안 맞아요 (사람끼리 대전은 그대로)
  if(!C.bossWarn&&!(C.net||C.pvp||C.meTeam)&&e.side===1&&!m.st&&k!=='self'&&(m.p||0)>0&&tgt.hp>0&&/^(target|melee|leap|vanish|roll)$/.test(k)){
    const r=Math.round(clamp(62+(m.p||60)*.35,80,130));
    W.delays.push({o:e,mi:c.mi,x:tgt.x,y:tgt.y,t:WARN_T,T:WARN_T,r,col:C.TCOL[m.type]||'#ff4a3a',boss:1,tgt});
    floatTxt(tgt.x,tgt.y-r*.4,'⚠ 피해요!','#ff5050',true);toRecovery(e,c);return}
  if(C.bossWarn&&e.side===1&&!m.st&&k!=='self'&&(m.p||0)>0&&tgt.hp>0){   // 9AF 월드보스: 3초 뒤 터지는 장판 (근접기는 보스 둘레, 나머지는 내 자리)
    const big=!!m.melee,r=big?Math.round(e.r+150):Math.round(clamp(70+(m.p||60)*.55,95,160));
    W.delays.push({o:e,mi:c.mi,x:big?e.x:tgt.x,y:big?e.y:tgt.y,t:3,T:3,r,col:C.TCOL[m.type]||'#ff4a3a',boss:1,tgt});
    floatTxt(big?e.x:tgt.x,(big?e.y:tgt.y)-r*.4,'⚠ 피해요!','#ff5050',true);toRecovery(e,c);return}
  if(m.st||k==='self'){
    // 변화기술
    const ef=m.d.ef||[];const names=ef.map(x=>x.op).join(',');
    if(k==='self'){
      if(/guard/.test(names)){e.protect=36/60;floatTxt(e.x,e.y-90,'방어!','#9be7ff')}
      for(const f of ef){
        if(f.op==='stat'&&(f.who==='user'||!f.who))for(const s in f.stages)abStage(e,s,f.stages[s],true);
        if(f.op==='heal'&&f.who==='user'){const fr=e.healRep>0?.25:.5;e.hp=Math.min(e.max,e.hp+Math.round((e.pctMax||e.max)*fr));e.healRep=30;floatTxt(e.x,e.y-90,'회복','#8f8')}
        if(f.op==='stat'&&f.who==='target'&&m.d.tg!=='User'){if(abFoeStatus(e,tgt,m,f))continue;for(const s in f.stages)abStage(tgt,s,f.stages[s],false)}
        if(f.op==='counter'&&f.mode!=='destinyBond'){e.counterT=1.7}
        if(f.op==='weather')wxMove(e,f);   // ③ 날씨 기술 (내가 쓸 때만)
        try{rz2Self(e,f,m)}catch(er){console.warn('rz2Self',er)}   // ③ 2/2: 벽·대타·멸망의노래·길동무 (내가 쓸 때만)
      }
      try{rz3Eff(e,m)}catch(er){console.warn('rz3Eff',er)}   // ③ 3/3: 신비의부적·흰안개·행운의주문·중력·원더룸·물놀이·흙놀이·장 4종 (내가 쓸 때만)
      W.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.5,r:60,c:C.TCOL[m.type]||'#fff'});skillFx(e,m,{x:e.x,y:e.y},{x:e.x,y:e.y},{force:1});
      c.phase='active';c.t=0;c.len=1;toRecovery(e,c);return;
    }
  }
  if(k==='melee'){
    c.dash=120*(heavy?1.5:1);c.moved=0;c.len=Math.max(ACTIVE_MELEE[g],8);phaseTo(e,'active',c.len);c.dir=u;c.reach=(70+(heavy?20:0)+10)*szMul(e,1);c.half=(heavy?65:50)*Math.PI/180;
    W.fx.push({k:'slash',x:e.x,y:e.y,t:0,life:.25,a:c.aim,c:C.TCOL[m.type]||'#fff',r:c.reach+e.r});
  } else if(k==='leap'){
    let d=c.dist!=null?clamp(c.dist,30,175):tgt.hp>0?clamp(len(tgt.x-e.x,tgt.y-e.y),30,175):105;
    c.tx=e.x+u.x*d;c.ty=e.y+u.y*d;c.sx=e.x;c.sy=e.y;phaseTo(e,'active',20);
  } else if(k==='roll'){
    phaseTo(e,'active',180);c.spd=350;c.hitCd=0;c.dir=u;
  } else if(k==='vanish'){
    const T=clamp(.35+m.p/120,.35,1.6);phaseTo(e,'active',Math.round(T*60));e.hidden=true;c.dir=u;
  } else if(k==='projectile'){
    const special=!m.phys;
    const nF=Math.max(1,m.d.fan|0);   // 7F: fan=여러 발을 부채꼴로 한 번에(한 발 위력은 나눔)
    const nB=window.BEAMFX?HT(e,m).n:1,bpm=(1+.2*(nB-1))/nB,pmA=(nF>1?1.6/nF:1)*bpm;   // 9U: 기술 레벨이 오르면 여러 발 (Lv.3·5·7마다 1발 더, 한 발 위력은 나눔 + 조금 보너스)
    for(let bj=0;bj<nB;bj++)for(let fj=0;fj<nF;fj++){const fa=c.aim+(fj-(nF-1)/2)*.22+(bj?(rnd()-.5)*.14:0),fu={x:Math.cos(fa),y:Math.sin(fa)};
    W.proj.push({o:e,mi:c.mi,pm:pmA===1?0:pmA,wait:bj*7,mel:m.mel?(m.spr==='wave'?'wave':window.BEAMFX?BEAMFX.meleeMode(m.name,m.type):'slash'):0,x:e.x+fu.x*e.r,y:e.y+fu.y*e.r,dx:fu.x,dy:fu.y,sp:(special?480:430)*(e.side?.75:1.05)*(m.d.sb==='bolt'?1.1:/^homing/.test(m.d.sb||'')?.85:1),r:(m.st?16:heavy?20:13)*(e.side?1:1.35)*(m.d.sb==='bolt'?1.25:1)*szMul(e,0),range:690,tr:0,col:C.TCOL[m.type]||'#fff',st:m.st,
      hm:HOM(e)?(/^homing/.test(m.d.sb||'')?75:45):0,hr:/^homing/.test(m.d.sb||'')?220:130});
    {const P=W.proj[W.proj.length-1];P.fxa=NFX()?null:projSkin(P,m);P.aw=HT(e,m).aw}}
    toRecovery(e,c);
  } else if(k==='beam'){
    const T=clamp(m.p/150,1.1,1.8);phaseTo(e,'active',Math.round(T*60));c.L=0;c.maxL=clamp(360+m.p*1.5,360,690);
    c.dmgMul=Math.min(1,12/(T*60))*1.25;
    if(!(window.BEAMFX&&fxOn()))/* 9T: 새 빔 엔진이 있으면 예전 빔 그림은 안 씀 */{const bl=c.maxL*.85;skillFx(e,m,{x:e.x,y:e.y},{x:clamp(e.x+u.x*bl,WALL,AW-WALL),y:clamp(e.y+u.y*bl,WALL,AH-WALL)},{force:1})}
  } else if(k==='pulse'){
    const cone=m.kd==='cone';const R=205*szMul(e,0);
    W.fx.push({k:cone?'cone':'ring',x:e.x,y:e.y,a:c.aim,t:0,life:.35,r:R,c:C.TCOL[m.type]||'#fff'});
    skillFx(e,m,{x:e.x,y:e.y},cone?{x:e.x+u.x*R*.6,y:e.y+u.y*R*.6}:{x:e.x,y:e.y},{force:1});
    let hit=false;
    if(tgt.hp>0){
      const dx=tgt.x-e.x,dy=tgt.y-e.y,d=len(dx,dy);
      if(d<=R+tgt.r){
        if(!cone||Math.abs(angDiff(c.aim,Math.atan2(dy,dx)))<=(e.side?65:95)*Math.PI/180||d<e.r+tgt.r+(e.side?18:40)){hit=true;dealDamage(e,tgt,c.mi)}}}
    if(hit&&m.st)applyEf(e,tgt,m,true);
    toRecovery(e,c);
  } else if(k==='zone'&&(rz2Has(m)||rz3Has(m))){
    if(rz2Has(m)){try{rz2Zone(e,m,c,u,tgt)}catch(er){console.warn('rz2Zone',er)}}
    try{rz3Eff(e,m)}catch(er){console.warn('rz3Eff',er)}   // ③ 3/3: 장·중력·원더룸 등이 zone 모양이면 여기서   // ③ 2/2: 스텔스록·압정·독압정·순풍·트릭룸 (내가 쓸 때만, 상대가 쓰면 아무 일 없음)
    W.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.5,r:60,c:C.TCOL[m.type]||'#fff'});toRecovery(e,c);return;
  } else if(k==='zone'&&(m.d.ef||[]).some(f=>f.op==='weather')){
    for(const f of m.d.ef)if(f.op==='weather')wxMove(e,f);   // ③ 설경(zone 모양 날씨 기술)
    W.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.5,r:60,c:C.TCOL[m.type]||'#fff'});toRecovery(e,c);return;
  } else if(k==='zone'){
    const d=c.dist!=null?clamp(c.dist,40,230):Math.min(230,tgt.hp>0?len(tgt.x-e.x,tgt.y-e.y):230);
    W.zones=W.zones.filter(z=>z.o!==e||false);
    W.zones.push({o:e,mi:c.mi,x:clamp(e.x+u.x*d,WALL,AW-WALL),y:clamp(e.y+u.y*d,WALL,AH-WALL),r:e.side?62:110,life:25,tick:1.5,col:C.TCOL[m.type]||'#fff',st:m.st});
    {const z=W.zones[W.zones.length-1];skillFx(e,m,{x:e.x,y:e.y},{x:z.x,y:z.y},{force:1})}
    toRecovery(e,c);
  } else if(k==='delayed'){
    W.delays.push({o:e,mi:c.mi,x:tgt.x,y:tgt.y,t:wxFall(e,m,2.2),r:e.side?58:88,col:C.TCOL[m.type]||'#fff',lock:false,tgt});
    toRecovery(e,c);
  } else if(k==='target'){
    if(tgt.hp>0&&len(tgt.x-e.x,tgt.y-e.y)<=550+tgt.r){
      if(m.blink){const d0=norm(tgt.x-e.x,tgt.y-e.y),x0=e.x,y0=e.y,gap=e.r*.6+tgt.r*.6+18,nx=tgt.x-d0.x*gap,ny=tgt.y-d0.y*gap;   // 9X 순간이동: 지나간 길에 잔상 7개
        for(let i=0;i<7;i++){const u=i/6;W.fx.push({k:'ghost',o:e,x:x0+(nx-x0)*u,y:y0+(ny-y0)*u,t:0,life:.28+u*.14,a:.25+u*.35})}
        e.x=nx;e.y=ny;e.face=d0;e.row=dirRow(d0.x,d0.y);e.kx=0;e.ky=0}
      else W.fx.push({k:'beamline',x:e.x,y:e.y,x2:tgt.x,y2:tgt.y,t:0,life:.25,c:C.TCOL[m.type]||'#fff'});
      skillFx(e,m,{x:e.x,y:e.y},{x:tgt.x,y:tgt.y},{force:1});
      if(m.sl){const n=1+HT(e,m).n,pm=(1+.2*(n-1))/n;const d1=dealDamage(e,tgt,c.mi,{pm,blink:m.blink?1:0});if(d1>0&&n>1){W.chain.push({o:e,mi:c.mi,n:n-1,t:8,iv:8,melee:false,pm,sl:1,bl:m.blink?1:0});W._more=1}}   // 9Y 베기 다단: X 획마다 한 대씩
      else dealDamage(e,tgt,c.mi,m.blink?{blink:1}:undefined);if(m.st)applyEf(e,tgt,m,true)}
    toRecovery(e,c);
  } else {toRecovery(e,c)}
}
function activeTick(e,c,tgt){
  const m=c.mv,k=m.k;
  if(k==='melee'){
    const step=c.dash/c.len;
    const nx=e.x+c.dir.x*step,ny=e.y+c.dir.y*step;
    e.x=nx;e.y=ny;
    if(!c.hit&&tgt.hp>0){
      const dx=tgt.x-e.x,dy=tgt.y-e.y,d=len(dx,dy);
      if(d<=c.reach*(e.side?1.05:1.45)+tgt.r*(e.side?.95:1.2)&&(Math.abs(angDiff(c.aim,Math.atan2(dy,dx)))<=c.half+(e.side?.15:.5)||d<e.r+tgt.r+(e.side?18:40))){
        c.hit=true;dealDamage(e,tgt,c.mi,c.pm?{pm:c.pm}:undefined);if(m.st)applyEf(e,tgt,m,true)}}
    if(c.t>=c.len)toRecovery(e,c);
  } else if(k==='leap'){
    const p=c.t/20;e.x=c.sx+(c.tx-c.sx)*p;e.y=c.sy+(c.ty-c.sy)*p;e.lift=Math.sin(p*Math.PI)*48;
    if(c.t>=20){e.lift=0;W.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.3,r:34+e.r,c:C.TCOL[m.type]||'#fff'});skillFx(e,m,{x:e.x,y:e.y},{x:e.x,y:e.y},{force:1});circleHit(e,c,e.x,e.y,34+e.r*.3,tgt);toRecovery(e,c)}
  } else if(k==='roll'){
    c.spd=Math.min(700,350*(1+Math.floor(c.t/22)*.14));
    if(tgt.hp>0){const dd=norm(tgt.x-e.x,tgt.y-e.y);const a=Math.atan2(c.dir.y,c.dir.x),b=Math.atan2(dd.y,dd.x);const na=a+clamp(angDiff(a,b),-3*TICK,3*TICK);c.dir={x:Math.cos(na),y:Math.sin(na)}}
    e.x+=c.dir.x*c.spd*TICK;e.y+=c.dir.y*c.spd*TICK;e.row=dirRow(c.dir.x,c.dir.y);
    c.hitCd--;
    if(c.hitCd<=0&&tgt.hp>0&&len(tgt.x-e.x,tgt.y-e.y)<=e.r+tgt.r+22){c.hitCd=33;let pm=1;if(m.rollUp){const rc=e.rollCh&&W.time-e.rollCh.t<6&&e.rollCh.id===m.id?e.rollCh.n+1:0;e.rollCh={n:rc,t:W.time,id:m.id};pm=Math.min(m.rollUp,Math.pow(2,rc))}   // 6초 안에 또 맞히면 계속 2배(최대 8배)
    dealDamage(e,tgt,c.mi,{pm});if(m.rollUp&&pm>1)floatTxt(e.x,e.y-100,'위력 ×'+pm,'#ffd23f')}
    if(m.rollUp){   // 6C-4 구르기·아이스볼: 벽에 튕기며 3초 동안 계속 굴러서 여러 번 맞힘(맞힐 때마다 위력 2배)
      if(e.x<WALL+e.r||e.x>AW-WALL-e.r){c.dir={x:-c.dir.x,y:c.dir.y};e.x=clamp(e.x,WALL+e.r,AW-WALL-e.r)}
      if(e.y<WALL+e.r||e.y>AH-WALL-e.r){c.dir={x:c.dir.x,y:-c.dir.y};e.y=clamp(e.y,WALL+e.r,AH-WALL-e.r)}}
    else if(e.x<WALL+e.r||e.x>AW-WALL-e.r||e.y<WALL+e.r||e.y>AH-WALL-e.r)c.t=Math.max(c.t,c.len-1);
    if(c.t>=c.len)toRecovery(e,c);
  } else if(k==='vanish'){
    if(tgt.hp>0){const dd=norm(tgt.x-e.x,tgt.y-e.y);e.x+=dd.x*spdOf(e)*2*TICK;e.y+=dd.y*spdOf(e)*2*TICK}
    if(c.t>=c.len){e.hidden=false;W.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.3,r:56,c:C.TCOL[m.type]||'#fff'});circleHit(e,c,e.x,e.y,56,tgt);toRecovery(e,c);c.len=18}
  } else if(k==='beam'){
    // 천천히 조준 회전
    if(tgt.hp>0&&HOM(e)){const want=Math.atan2(tgt.y-e.y,tgt.x-e.x);c.aim+=clamp(angDiff(c.aim,want),-1.1*TICK,1.1*TICK)}   // 9U: 내 빔(야생·트레이너 상대)만 천천히 따라감 — 상대 빔은 쏜 방향 그대로
    c.L=Math.min(c.maxL,c.L+1100*TICK);
    e.row=dirRow(Math.cos(c.aim),Math.sin(c.aim));
    e.beam={a:c.aim,L:c.L,col:C.TCOL[m.type]||'#fff',type:m.type,full:c.L>=c.maxL-1,aw:HT(e,m).aw};
    if(c.t%12===0&&tgt.hp>0){
      const u=aimVec(c);const dx=tgt.x-e.x,dy=tgt.y-e.y;const al=dx*u.x+dy*u.y,pe=Math.abs(-dx*u.y+dy*u.x);
      if(al>=0&&al<=c.L+tgt.r&&pe<=tgt.r*1.1+32*szMul(e,0)){dealDamage(e,tgt,c.mi,{mult:c.dmgMul||.25,pm:1})}}
    if(c.t>=c.len){e.beam=null;toRecovery(e,c)}
  } else {toRecovery(e,c)}
}

// ---------- 진행 ----------
function update(){
  const me=W.me,foe=W.foe;
  W.tick++;
  if(W.hitstop>0){W.hitstop-=TICK;return}
  W.time+=TICK;
  if(W.swCd>0)W.swCd=Math.max(0,W.swCd-TICK);   // 6F-4b: 교체 쿨타임
  if(W.itCd>0)W.itCd=Math.max(0,W.itCd-TICK);   // 6F-4c: 약 쿨타임
  try{autoSwapChk()}catch(er){}
  if(autoNow())autoMe(me,foe);else playerInput(me);
  updBall();
  aiUpdate(foe,W.ai,me);
  for(const e of [me,foe]){
    if(e.hp<=0)continue;
    e.at+=TICK;
    e.flash=Math.max(0,e.flash-TICK);e.critWin=Math.max(0,e.critWin-TICK);e.protect=Math.max(0,e.protect-TICK);e.counterT=Math.max(0,(e.counterT||0)-TICK);
    e.healRep=Math.max(0,(e.healRep||0)-TICK);
    if(e.gmx)gmTick(e);
    if(e.inv>0)e.inv--;   // 9F: 무적 시간 줄어듦(전엔 안 줄어서 불멸 뒤 계속 무적이던 버그)
    e.life+=TICK;
    if(e.cloneDur>0&&!e.cloneUsed&&e.life>1){e.cloneUsed=1;W.clones.push({o:e,t:e.cloneDur,t0:e.cloneDur,cd:.6,ang:rnd()*6,x:e.x,y:e.y});floatTxt(e.x,e.y-115,'분신 소환! '+e.cloneDur+'초','#ffe14a',true);W.fx.push({k:'ring',sys:1,x:e.x,y:e.y,t:0,life:.45,r:100,c:'#ffe14a'})}
    if(e.zb){if(e.zb.on>0)e.zb.on=Math.max(0,e.zb.on-TICK);e.zb.cd-=TICK;if(e.zb.cd<=0){e.zb.on=20;e.zb.cd=e.zb.cdMax;floatTxt(e.x,e.y-120,'만제의 위엄! 데미지 +30%','#ff4060',true);W.fx.push({k:'ring',sys:1,x:e.x,y:e.y,t:0,life:.5,r:120,c:'#ff2040'})}}
    if(e.swapT>0)e.swapT--;   // 6F-4b: 교체 직후 잠깐 무방비(행동 불가, 무적 아님)
    {const dm=e.moves.map((m,j)=>m&&!m.st?j:-1).filter(j=>j>=0);
     const allCool=dm.length>0&&dm.every(j=>e.cd[j]>0); // 공격기가 전부 쿨타임 중이면 빨리 돈다
     for(let i=0;i<4;i++){const m=e.moves[i];const r=(e.ail.paralysis?CD.paraRate:1)*(allCool&&m&&!m.st?CD.cadence:1);
       if(m&&m.chg){if(e.ch[i]<m.chg.max){e.chT[i]-=TICK*r;if(e.chT[i]<=0){e.ch[i]++;e.chT[i]=e.ch[i]<m.chg.max?m.chg.per:0}}e.cd[i]=e.ch[i]>=1?0:Math.max(0,e.chT[i])}
       else e.cd[i]=Math.max(0,e.cd[i]-TICK*r)}}
    // 구르기 충전
    if(e.rc<2)e.rc=Math.min(2,e.rc+TICK/3.2*(e.gxRc||1));   /* 2/3: 회피 훈련 */
    abUpkeep(e);   // E단계: 가속·탈피·포이즌힐·변덕쟁이
    // 상태이상
    for(const s in e.ail){e.ail[s]-=TICK;
      if(s==='burn'&&W.tick%60===0&&!abHas(e,'MAGICGUARD')){const d=Math.max(1,Math.round((e.pctMax||e.max)*.01));e.hp=Math.max(0,e.hp-d);floatTxt(e.x,e.y-60,fmtN(d*kOf(e)),'#f84')}
      if(s==='poison'&&W.tick%60===0&&!abHas(e,'POISONHEAL')&&!abHas(e,'MAGICGUARD')){const d=Math.max(1,Math.round((e.pctMax||e.max)*.015));e.hp=Math.max(0,e.hp-d);floatTxt(e.x,e.y-60,fmtN(d*kOf(e)),'#c6c')}
      if(e.ail[s]<=0){delete e.ail[s];e.ailImm=e.ailImm||{};if(s==='burn')e.ailImm.burn=6;if(s==='paralysis')e.ailImm.paralysis=8}}
    if(e.ailImm)for(const s in e.ailImm)e.ailImm[s]-=TICK;
    if(e.stgT>0){e.stgT-=TICK;if(e.stgT<=0){for(const k in e.stg)e.stg[k]-=Math.sign(e.stg[k]);e.stgT=8}}
    // 구르기
    if(e.rollT>0){e.rollT--;e.x+=e.rdx*(150/14)*(e.gxRoll||1);e.y+=e.rdy*(150/14)*(e.gxRoll||1);   /* 2/3: 구름 발판 */if(e.rollT===0)e.perfect=0;e.anim='walk'}
    else{
      if(e.stun>0){e.stun--;e.anim='hurt';if(e.stun===0)e.anim='idle'}
      else{
        if(e.cast)updateCast(e);
        else tryBuffered(e);
      }
    }
    // 이동 (입력 속도)
    if(e.rollT<=0&&e.stun<=0&&!(e.swapT>0)&&!(e.cast&&e.cast.phase==='active'&&e.cast.mv.k!=='beam')){
      const mul=castMoveMul(e);
      const target=e.wish||{x:0,y:0};
      const sp=spdOf(e)*mul;
      const tx=target.x*sp,ty=target.y*sp;
      const ax=(Math.abs(tx)>Math.abs(e.vx)||Math.sign(tx)!==Math.sign(e.vx)&&tx!==0)?2600:3500;
      e.vx+=clamp(tx-e.vx,-ax*TICK,ax*TICK);e.vy+=clamp(ty-e.vy,-ax*TICK,ax*TICK);
      e.x+=e.vx*TICK;e.y+=e.vy*TICK;
      if(!e.cast&&len(e.vx,e.vy)>20){e.anim='walk';e.row=dirRow(e.vx,e.vy)}
      else if(!e.cast&&e.stun<=0)e.anim='idle';
    }
    // 넉백
    e.x+=e.kx*TICK;e.y+=e.ky*TICK;const dec=Math.exp(-8*TICK);e.kx*=dec;e.ky*=dec;
    // 혼란/자해는 생략
  }
  // 몸 겹침 밀어내기
  if(me.hp>0&&foe.hp>0&&!me.hidden&&!foe.hidden&&!(me.cast&&me.cast.mv.k==='roll'||foe.cast&&foe.cast.mv.k==='roll')){
    const dx=foe.x-me.x,dy=foe.y-me.y,d=len(dx,dy)||1,ov=me.r+foe.r-d;
    if(ov>0&&me.rollT<=0&&foe.rollT<=0){const n=norm(dx,dy);const push=Math.min(190*TICK,ov/2+1);me.x-=n.x*push;me.y-=n.y*push;foe.x+=n.x*push;foe.y+=n.y*push}
  }
  for(const e of [me,foe]){e.x=clamp(e.x,WALL+e.r*.5,AW-WALL-e.r*.5);e.y=clamp(e.y,WALL+e.r*.5,AH-WALL-e.r*.5)}
  if(foe.giant){const g=foe;if(g.gT<1.6){g.gT+=TICK;const u=Math.min(1,g.gT/1.6),k=1+(g.gK-1)*(u<1?(1-Math.pow(1-u,3)):1);g.sc=g.sc0*k;g.vis=g.gh/g.gK*k;W.qk=Math.max(W.qk||0,.5);
      if(!g._gm){g._gm=1;floatTxt(g.x,g.y-120,'거대화!!','#ff4060',true)}}
    const hw=g.gw*.5*Math.min(1,g.sc/(g.sc0*g.gK)),hh=g.gh*.5*Math.min(1,g.sc/(g.sc0*g.gK));
    g.x=clamp(g.x,WALL+hw*.8,AW-WALL-hw*.8);g.y=clamp(g.y,WALL+hh+18,AH-WALL-hh*.75+18)}
  // 발사체
  for(const p of W.proj){
    const tgt=foeOf(p.o);
    if(p.wait>0){p.wait--;const o=p.o;p.x=o.x+p.dx*o.r;p.y=o.y+p.dy*o.r;if(o.hp<=0)p.dead=1;continue}   // 9U: 연사 — 차례가 올 때까지 손에서 대기
    if(p.hm>0&&tgt.hp>0){p.hm--;const a=Math.atan2(p.dy,p.dx),w=angDiff(a,Math.atan2(tgt.y-p.y,tgt.x-p.x)),mx=(p.hr||200)*Math.PI/180*TICK,na=a+clamp(w,-mx,mx);p.dx=Math.cos(na);p.dy=Math.sin(na)}  // 유도: 초당 200도, 1초
    const st=p.sp*TICK;p.x+=p.dx*st;p.y+=p.dy*st;p.tr+=st;
    if(p.fxa){p.fxa.x=p.x;p.fxa.y=p.y-24;p.fxa.rot=Math.atan2(p.dy,p.dx)}
    if(tgt.hp>0&&len(tgt.x-p.x,tgt.y-p.y)<=p.r*(p.o.side?1.05:1.5)+tgt.r*(p.o.side?.85:1.2)){   // 9E 판정 넓힘
      const d=dealDamage(p.o,tgt,p.mi,p.pm?{pm:p.pm}:undefined);if(p.st)applyEf(p.o,tgt,p.o.moves[p.mi],true);
      p.dead=1;if(NFX()&&p.mel==='wave'){BEAMFX.waveCrash(p.x,p.y+10,200,p.dx<0)}else if(NFX()){if(p.mel)BEAMFX.melee((p.o.moves[p.mi]||{}).type,p.mel,p.x-p.dx*60,p.y-24-p.dy*60,p.x,p.y-24,p.mel==='slash'?2:1,.7);else BEAMFX.pimpact((p.o.moves[p.mi]||{}).type,p.x,p.y-24,1)}else{W.fx.push({k:'burst',x:p.x,y:p.y,t:0,life:.25,r:p.r*2.2,c:p.col});skillFx(p.o,p.o.moves[p.mi],{x:p.x,y:p.y},{x:p.x,y:p.y},{force:1})}
    } else if(p.tr>p.range||p.x<WALL||p.x>AW-WALL||p.y<WALL||p.y>AH-WALL){p.dead=1;if(NFX())BEAMFX.pimpact((p.o.moves[p.mi]||{}).type,p.x,p.y-24,.55);else W.fx.push({k:'burst',x:p.x,y:p.y,t:0,life:.2,r:p.r*1.5,c:p.col})}
  }
  // 9F 태초 분신: 주인 옆을 돌며 가장 센 기술을 60% 위력으로 쏨 (주인이 나가거나 쓰러지면 사라짐)
  for(const c of W.clones){c.t-=TICK;const o=c.o;if(o.hp<=0||(o!==W.me&&o!==W.foe)){c.t=0;continue}
    const tg=foeOf(o);c.ang+=TICK*1.3;const tx=o.x+Math.cos(c.ang)*95,ty=o.y+Math.sin(c.ang)*55;c.x+=(tx-c.x)*.12;c.y+=(ty-c.y)*.12;
    c.cd-=TICK;if(c.cd<=0&&tg.hp>0&&!tg.hidden){c.cd=1.3;let mi=-1,bp=0;o.moves.forEach((m,j)=>{if(m&&!m.st&&(m.p||0)>bp){bp=m.p;mi=j}});
      if(mi>=0){const n=norm(tg.x-c.x,tg.y-c.y);W.proj.push({o,mi,pm:.6,x:c.x,y:c.y,dx:n.x,dy:n.y,sp:540,r:15,range:900,tr:0,col:C.TCOL[o.moves[mi].type]||'#ffe14a',st:0,clone:1})}}}
  W.clones=W.clones.filter(c=>c.t>0);
  // 발사체끼리 충돌 (반지름 비 1.5 이상이면 큰 쪽이 압도, 아니면 상쇄)
  for(let i=0;i<W.proj.length;i++)for(let j=i+1;j<W.proj.length;j++){
    const a=W.proj[i],b=W.proj[j];if(a.dead||b.dead||a.o===b.o)continue;
    if(len(a.x-b.x,a.y-b.y)<=a.r+b.r){const ra=a.r/b.r;if(ra>=1.5)b.dead=1;else if(ra<=1/1.5)a.dead=1;else{a.dead=b.dead=1}
      W.fx.push({k:'burst',x:(a.x+b.x)/2,y:(a.y+b.y)/2,t:0,life:.25,r:30,c:'#fff'})}
  }
  W.proj=W.proj.filter(p=>{if(p.dead&&p.fxa){try{C.fxe.VFX.stop(p.fxa)}catch(e){}}return !p.dead});
  // 장판
  for(const z of W.zones){z.life-=TICK;z.tick-=TICK;
    if(z.tick<=0){z.tick=1.5;const t=foeOf(z.o);if(t.hp>0&&len(t.x-z.x,t.y-z.y)<=z.r*(z.o.side?1:1.15)+t.r*.9&&!t.hidden){const d=Math.max(1,Math.round((t.pctMax||t.max)*.0625));t.hp=Math.max(0,t.hp-d);floatTxt(t.x,t.y-70,fmtN(d*kOf(t)),z.col);if(z.st)applyEf(z.o,t,z.o.moves[z.mi],true)}}}
  W.zones=W.zones.filter(z=>z.life>0);
  // 내려찍기
  for(const d of W.delays){d.t-=TICK;
    if(!d.boss&&d.t>.5&&d.tgt.hp>0){d.x=d.tgt.x;d.y=d.tgt.y}
    if(d.t<=0){d.dead=1;W.fx.push({k:'ring',x:d.x,y:d.y,t:0,life:.35,r:d.r,c:d.col});skillFx(d.o,d.o.moves[d.mi],{x:d.x,y:d.y},{x:d.x,y:d.y},{force:1});const t=foeOf(d.o);if(t.hp>0&&len(t.x-d.x,t.y-d.y)<=(d.boss?d.r+t.r*.5:d.r*(d.o.side?1:1.15)+t.r*.9))dealDamage(d.o,t,d.mi);else if(d.boss&&t.hp>0)floatTxt(t.x,t.y-80,'피했다!','#9fe8ff')}}
  W.delays=W.delays.filter(d=>!d.dead);
  for(const h of W.chain){const t=foeOf(h.o);
    if(h.o.hp<=0||t.hp<=0||h.o.stun>0||h.o.hidden){h.dead=1;continue}
    h.t--;if(h.t>0)continue;
    const m=h.o.moves[h.mi];
    if(!h.melee||len(t.x-h.o.x,t.y-h.o.y)<=h.o.r+t.r+140){dealDamage(h.o,t,h.mi,{chain:1,last:h.n<=1,pm:h.pm,blink:h.bl});if(m&&!h.melee&&!h.sl)W.fx.push({k:'burst',x:t.x,y:t.y-20,t:0,life:.2,r:24,c:C.TCOL[m.type]||'#fff'})}
    h.n--;h.t=h.iv;if(h.n<=0)h.dead=1}
  W.chain=W.chain.filter(h=>!h.dead);
  if(W.gx){try{GYMFX.tick(W.gx,W)}catch(er){console.warn('gymfx tick',er);W.gx=null}}   // 1/3: 체육관 장치
  if(W.wx){try{wxTick()}catch(er){console.warn('wx tick',er);W.wx=null}}   // ③ 날씨
  if(W.rz2){try{rz2Tick()}catch(er){console.warn('rz2 tick',er);W.rz2=null}}
  if(W.rz3){try{rz3Tick()}catch(er){console.warn('rz3 tick',er);W.rz3=null}}   // ③ 3/3: 장·부적·흰안개·행운의주문·중력·원더룸·놀이   // ③ 2/2: 함정·벽·순풍·트릭룸·대타·멸망의노래·길동무
  // 효과 시간
  for(const f of W.fx)f.t+=TICK;W.fx=W.fx.filter(f=>f.t<f.life);
  // 승패
  if(!W.over&&(!W.ball||me.hp<=0)){
    if(foe.hp<=0&&me.hp>0&&C.saveFoe){let _sv=false;try{_sv=C.saveFoe()}catch(er){}if(_sv){foe.hp=1;if(!W._svMsg){W._svMsg=1;floatTxt(foe.x,foe.y-100,'겨우 버티고 있다! 볼을 던지자!','#ffe08a',true)}}}   // 잡기 의뢰 · 전설 이상: 쓰러지지 않고 1로 버텨서 꼭 잡을 수 있게
    if(foe.hp<=0&&me.hp<=0)finish('draw');else if(foe.hp<=0)finish('win');else if(me.hp<=0)finish('lose');
    else if(W.time>=(C.maxTime||180)){if(C.noTimeLimit)finish('draw');else finish(me.hp/me.max>=foe.hp/foe.max?(me.hp/me.max===foe.hp/foe.max?'draw':'win'):'lose')}
  }
}
function finish(r){W.over=r;W.overT=0;if(r==='win'||r==='lose')try{window.PKS&&PKS.ko(r==='win'?W.foe:W.me)}catch(er){}
  (r==='win'?[W.foe]:[W.me]).forEach(e=>{e.anim='hurt';e.at=0})}

// ---------- 6F-1: 실시간 포획 (레조넌스 방식: 전투 중 볼을 던짐) ----------
// C.balls():[{k,e,n,count}] · C.takeBall(k):볼 정보(없으면 null, 실제 모드는 가방에서 1개 차감) · C.catchP(foe,it,hpRatio):0~1
const ballList=()=>{try{return C.balls?C.balls():[]}catch(e){return[]}};
function tryThrow(){
  if(!W||W.over||W.ball||(W.ballCd||0)>0||!C.balls)return;
  const me=W.me,foe=W.foe;if(me.hp<=0||foe.hp<=0||me.stun>0||me.swapT>0||me.cast||me.rollT>0)return;
  if(C.blockBall){let bm=null;try{bm=C.blockBall()}catch(e){}if(bm){floatTxt(me.x,me.y-90,bm,'#f88');W.ballCd=1;return}}   // 6F-2
  const L=ballList();if(!L.length){floatTxt(me.x,me.y-90,'볼이 없어요','#f88');W.ballCd=.6;return}
  const sel=L[Math.min(W.ballSel||0,L.length-1)];
  const it=C.takeBall(sel.k);if(!it){floatTxt(me.x,me.y-90,'볼이 없어요','#f88');W.ballCd=.6;return}
  const p=Math.max(0,Math.min(1,C.catchP(C.foe,it,Math.max(0,foe.hp/foe.max)))),sh=Math.pow(p,.25);
  let n=0;for(;n<3;n++){if(rnd()>sh)break}
  const ok=n>=3&&rnd()<sh;
  me.anim='shoot';me.at=0;me.row=dirRow(foe.x-me.x,foe.y-me.y);
  W.ball={ph:'fly',t:0,x0:me.x,y0:me.y-34,x:me.x,y:me.y-34,rot:0,it,n,ok,k:0,col:it.col||'#e33'};
}
function updBall(){
  const B=W.ball;if(W.ballCd>0)W.ballCd-=TICK;if(!B)return;
  const foe=W.foe;B.t+=TICK;
  if(B.ph==='fly'){const u=Math.min(1,B.t/.45);B.x=B.x0+(foe.x-B.x0)*u;B.y=B.y0+(foe.y-34-B.y0)*u-Math.sin(u*Math.PI)*80;B.rot=u*10;
    if(u>=1){B.ph='in';B.t=0;if(foe.cast)cancelCast(foe,true);foe.capt=1;foe.hidden=true;foe.wish={x:0,y:0};
      W.proj=W.proj.filter(q=>q.o!==foe);W.fx.push({k:'burst',sys:1,x:foe.x,y:foe.y-20,t:0,life:.25,r:60,c:'#fff'});W.flashA=Math.max(W.flashA||0,.4);W.flashC='#fff'}}
  else if(B.ph==='in'){B.x=foe.x;B.y=foe.y-34+Math.min(34,B.t*140);B.rot=0;if(B.t>=.4){B.ph='shake';B.t=0;B.k=0}}
  else if(B.ph==='shake'){
    if(B.k>=B.n){B.ph='res';B.t=0;B.rot=0;return}
    const u=Math.min(1,B.t/.6);B.rot=Math.sin(u*Math.PI*2)*.5;
    if(B.t>=.6){B.t=0;B.k++;B.rot=0;floatTxt(B.x,B.y-30,'…','#fff')}}
  else if(B.ph==='res'){if(B.t<.35)return;
    if(B.ok){W.over='catch';W.overT=0;floatTxt(B.x,B.y-40,'잡았다!','#ffe14a',true);W.fx.push({k:'shock',sys:1,x:B.x,y:B.y,t:0,life:.4,r:110,w:8,c:'#ffe14a'});W.ball.ph='done'}
    else{foe.capt=0;foe.hidden=false;foe.stun=Math.max(foe.stun,30);foe.anim='idle';
      W.fx.push({k:'burst',sys:1,x:foe.x,y:foe.y-20,t:0,life:.25,r:60,c:'#fff'});
      floatTxt(foe.x,foe.y-90,['안 돼! 나와 버렸다!','아쉽다! 조금만 더!','으앗! 잡은 줄 알았는데!'][Math.min(2,B.n)],'#fff');
      W.ball=null;W.ballCd=1.4}}
}

// ---------- 입력 ----------
const IN={keys:{},stick:{on:0,id:null,sx:0,sy:0,x:0,y:0},press:[],roll:0,btn:[null,null,null,null],hold:{}};
function playerInput(me){
  if(me.hp<=0)return;
  let mx=0,my=0;
  const k=IN.keys;
  if(k.ArrowLeft)mx-=1;if(k.ArrowRight)mx+=1;if(k.ArrowUp)my-=1;if(k.ArrowDown)my+=1;
  if(IN.stick.on){mx+=IN.stick.x;my+=IN.stick.y}
  const L=len(mx,my);
  me.wish=L>.15?{x:mx/Math.min(1,L)*Math.min(1,L),y:my/Math.min(1,L)*Math.min(1,L)}:{x:0,y:0};
  if(L>1){me.wish={x:mx/L,y:my/L}}
  if(IN.roll){IN.roll=0;if(IN.rollDir){me.wish={x:IN.rollDir.x,y:IN.rollDir.y};IN.rollDir=null}doRoll(me)}
  while(IN.press.length){const p=IN.press.shift();me.buf={i:p.i,aim:p.aim,dist:p.dist,t:9}}
}
function doRoll(e){
  if(e.rollT>0||e.rc<1||e.stun>0||e.swapT>0||e.hp<=0)return;
  if(e.cast&&e.cast.phase!=='recovery')return;
  let d=e.wish&&len(e.wish.x,e.wish.y)>.2?norm(e.wish.x,e.wish.y):(e.face||{x:1,y:0});
  e.cast=null;e.beam=null;e.hidden=false;
  e.rollT=14;e.rdx=d.x;e.rdy=d.y;e.rc-=1;e.perfect=0;e.row=dirRow(d.x,d.y);
  W.fx.push({k:'ring',sys:1,x:e.x,y:e.y,t:0,life:.2,r:40,c:'#ffffff'});
  if(W.tut&&e===W.me){e.rc=2;tutRoll()}
}
function aimFor(e,manual){
  const f=foeOf(e);
  const toF=(f.hp>0&&!f.gxHide)?norm(f.x-e.x,f.y-e.y):e.face;   // 3/3: 조명 밖 고스트는 자동조준에 안 잡힘
  if(manual)return manual;
  if(e===W.me&&e.wish&&len(e.wish.x,e.wish.y)>.4){
    const a=Math.atan2(e.wish.y,e.wish.x),b=Math.atan2(toF.y,toF.x);
    if(Math.abs(angDiff(b,a))>35*Math.PI/180)return norm(e.wish.x,e.wish.y);
  }
  return toF;
}
function tryBuffered(e){
  if(!e.buf)return;
  e.buf.t--;
  if(e.buf.t<=0){e.buf=null;return}
  if(canCast(e,e.buf.i)){const b=e.buf;e.buf=null;startCast(e,b.i,aimFor(e,b.aim),b.dist)}
}

// ---------- AI (야생 단계) ----------
// ---------- AI (6D: 레조넌스 단계별 값) ----------
// 단계: W 야생 / T1 쉬움 / T2 / G4 보통 / T4 어려움 / T5 최고 / REF 기준. 값은 원본 ai.tiers 그대로(rzsim.json)
const AI_T={"W":{"rtMeanSec":0.48,"rtSdSec":0.11,"rtFloorT":18,"thinkSec":0.3,"aimSdDeg":9,"lead":0.15,"leadNoise":0.3,"dodgeShot":0.15,"dodgeMelee":0.05,"dodgeArea":0.25,"dodgeBeam":0.2,"dodgeSdSec":0.1,"sidestepP":0.2,"hesitationsPer10Sec":1.2,"hesitationSec":0.8,"tokenRegenPerSec":0.35,"tokenCap":2,"postPauseSec":0.9,"pressMinSec":3,"pressMaxSec":5,"resetMinSec":3,"resetMaxSec":4.5,"burstMax":1},"T1":{"rtMeanSec":0.42,"rtSdSec":0.09,"rtFloorT":17,"thinkSec":0.25,"aimSdDeg":7,"lead":0.35,"leadNoise":0.25,"dodgeShot":0.3,"dodgeMelee":0.15,"dodgeArea":0.4,"dodgeBeam":0.35,"dodgeSdSec":0.085,"sidestepP":0.3,"hesitationsPer10Sec":0.9,"hesitationSec":0.7,"tokenRegenPerSec":0.45,"tokenCap":3,"postPauseSec":0.7,"pressMinSec":4,"pressMaxSec":6,"resetMinSec":2.5,"resetMaxSec":3.5,"burstMax":1},"T2":{"rtMeanSec":0.36,"rtSdSec":0.07,"rtFloorT":15,"thinkSec":0.2,"aimSdDeg":5,"lead":0.6,"leadNoise":0.2,"dodgeShot":0.5,"dodgeMelee":0.3,"dodgeArea":0.6,"dodgeBeam":0.55,"dodgeSdSec":0.065,"sidestepP":0.4,"hesitationsPer10Sec":0.6,"hesitationSec":0.5,"tokenRegenPerSec":0.6,"tokenCap":3,"postPauseSec":0.5,"pressMinSec":5,"pressMaxSec":7,"resetMinSec":2,"resetMaxSec":3,"burstMax":2},"G4":{"rtMeanSec":0.3171,"rtSdSec":0.0557,"rtFloorT":14,"thinkSec":0.1524,"aimSdDeg":3.5714,"lead":0.7929,"leadNoise":0.15,"dodgeShot":0.6514,"dodgeMelee":0.4429,"dodgeArea":0.7429,"dodgeBeam":0.6929,"dodgeSdSec":0.0507,"sidestepP":0.5429,"hesitationsPer10Sec":0.3357,"hesitationSec":0.4,"tokenRegenPerSec":0.7643,"tokenCap":4,"postPauseSec":0.3571,"pressMinSec":5,"pressMaxSec":8,"resetMinSec":1.6286,"resetMaxSec":2.2857,"burstMax":2},"T4":{"rtMeanSec":0.28,"rtSdSec":0.045,"rtFloorT":13,"thinkSec":0.117,"aimSdDeg":2.5,"lead":0.9,"leadNoise":0.12,"dodgeShot":0.8,"dodgeMelee":0.6,"dodgeArea":0.85,"dodgeBeam":0.8,"dodgeSdSec":0.04,"sidestepP":0.65,"hesitationsPer10Sec":0.2,"hesitationSec":0.35,"tokenRegenPerSec":0.95,"tokenCap":5,"postPauseSec":0.25,"pressMinSec":6,"pressMaxSec":9,"resetMinSec":1.2,"resetMaxSec":1.8,"burstMax":3},"T5":{"rtMeanSec":0.26,"rtSdSec":0.04,"rtFloorT":12,"thinkSec":0.1,"aimSdDeg":2,"lead":0.95,"leadNoise":0.1,"dodgeShot":0.85,"dodgeMelee":0.65,"dodgeArea":0.9,"dodgeBeam":0.85,"dodgeSdSec":0.035,"sidestepP":0.7,"hesitationsPer10Sec":0.15,"hesitationSec":0.3,"tokenRegenPerSec":1.05,"tokenCap":5,"postPauseSec":0.2,"pressMinSec":6,"pressMaxSec":10,"resetMinSec":1,"resetMaxSec":1.6,"burstMax":3},"REF":{"rtMeanSec":0.25,"rtSdSec":0.03,"rtFloorT":12,"thinkSec":0.083,"aimSdDeg":1.5,"lead":1,"leadNoise":0.05,"dodgeShot":1,"dodgeMelee":1,"dodgeArea":1,"dodgeBeam":1,"dodgeSdSec":0.025,"sidestepP":1,"hesitationsPer10Sec":0,"hesitationSec":0,"tokenRegenPerSec":99999,"tokenCap":99999,"postPauseSec":0,"pressMinSec":99999,"pressMaxSec":99999,"resetMinSec":0,"resetMaxSec":0,"burstMax":4}};
// 9J: 컴퓨터를 아이들 눈높이로 한 번 더 낮춤 — 늦게 반응 · 덜 정확 · 거의 안 피함 · 덜 자주 공격 (내 자동 AI 'ME'는 원래 T4 그대로)
AI_T.ME=JSON.parse(JSON.stringify(AI_T.T4));
for(const k in AI_T){if(k==='ME')continue;const t=AI_T[k];t.rtMeanSec+=.22;t.rtFloorT+=8;t.thinkSec+=.15;t.aimSdDeg+=8;t.lead*=.35;t.leadNoise+=.15;
  for(const q of ['dodgeShot','dodgeMelee','dodgeArea','dodgeBeam'])t[q]*=.3;t.sidestepP*=.4;t.hesitationsPer10Sec+=1.2;t.hesitationSec+=.3;
  t.tokenRegenPerSec=Math.min(t.tokenRegenPerSec*.65,.7);t.tokenCap=Math.min(t.tokenCap,3);t.postPauseSec+=.5;t.burstMax=Math.min(t.burstMax,2)}
const AI_PLAIN={melee:'m',leap:'m',vanish:'m',roll:'m',projectile:'s',beam:'b',pulse:'a',delayed:'a',zone:'a',target:'a'};
const gauss=()=>(rnd()+rnd()+rnd()+rnd()-2)*1.732;
const tokCost=m=>m.st?.5:m.p<=60?.5:m.p<=90?.75:1;
const rr=(a,b)=>a+rnd()*(b-a);
function aiUpdate(a,ai0,p0){
  if(W&&W.tut){a.wish={x:0,y:0};return}
  if(a.capt){a.wish={x:0,y:0};return}
  const ai=ai0||W.ai,T=ai.T,p=p0||W.me;
  if(a.hp<=0){a.wish={x:0,y:0};return}
  const d=len(p.x-a.x,p.y-a.y),to=norm(p.x-a.x,p.y-a.y);
  const low=a.hp<a.max*.3;
  // 기력(토큰): 공격할 때 쓰고 천천히 차오름 (체력이 낮으면 1.3배)
  ai.tok=Math.min(T.tokenCap,ai.tok+T.tokenRegenPerSec*TICK*(low?1.3:1));
  // 망설임: 가끔 멈칫
  if(ai.hes>0)ai.hes-=TICK;else if(rnd()<T.hesitationsPer10Sec/10*TICK)ai.hes=T.hesitationSec;
  // 압박/후퇴 번갈아
  ai.pt-=TICK;if(ai.pt<=0){ai.phase=ai.phase==='press'?'reset':'press';ai.pt=ai.phase==='press'?rr(T.pressMinSec,T.pressMaxSec):rr(T.resetMinSec,T.resetMaxSec);if(ai.pt<=0)ai.phase='press'}
  // 회피: 위협을 본 뒤 반응시간(평균±표준편차, 최소 floor틱)이 지나면 단계별 확률로 구르기, 아니면 옆걸음
  const tc=p.cast&&(p.cast.phase==='startup'||p.cast.phase==='active')&&p.cast.mv.p>0?p.cast.mv.k:null;
  const shot=W.proj.some(q=>q.o===p&&len(q.x-a.x,q.y-a.y)<220);
  const threat=tc||shot;
  if(threat&&!ai.sawT){ai.sawT=Math.max(T.rtFloorT/60,T.rtMeanSec+gauss()*T.rtSdSec);ai.kind=tc?(AI_PLAIN[tc]||'s'):'s'}
  if(!threat)ai.sawT=0;
  if(ai.sawT>0){ai.sawT-=TICK;if(ai.sawT<=0&&!a.cast){
    const pr={m:T.dodgeMelee,s:T.dodgeShot,b:T.dodgeBeam,a:T.dodgeArea}[ai.kind]+(low?.1:0);
    if(a.rc>=1&&rnd()<pr){const s=rnd()<.5?1:-1;a.wish={x:-to.y*s,y:to.x*s};doRoll(a)}
    else if(rnd()<T.sidestepP){ai.side=.5;ai.s=rnd()<.5?1:-1}}}
  // 이동
  ai.t-=TICK;if(ai.t<=0){ai.t=rr(1.2,3);ai.s=rnd()<.5?1:-1}
  const range=ai.range||250;
  if(!a.cast&&a.stun<=0&&a.rollT<=0){
    let wx=0,wy=0;
    if(ai.side>0){ai.side-=TICK;wx=-to.y*ai.s;wy=to.x*ai.s}
    else if(ai.phase==='reset'){const far=Math.min(range*1.7,520);if(d<far){wx=-to.x*.9-to.y*ai.s*.4;wy=-to.y*.9+to.x*ai.s*.4}else{wx=-to.y*ai.s*.6;wy=to.x*ai.s*.6}}
    else if(d>range){wx=to.x;wy=to.y}else if(d<range*.5){wx=-to.x*.6;wy=-to.y*.6}else{wx=-to.y*ai.s*.6;wy=to.x*ai.s*.6}
    const hm=ai.hes>0?.3:1;a.wish={x:wx*hm,y:wy*hm};
  } else a.wish={x:0,y:0};
  // 공격
  ai.cd=Math.max(0,ai.cd-TICK);
  if(ai.cd<=0&&ai.hes<=0&&!a.cast&&a.stun<=0&&a.rollT<=0&&!ai.noAtk){
    const opts=[];
    a.moves.forEach((m,i)=>{if(!canCast(a,i))return;
      const cost=tokCost(m)*(ai.burst>0?.5:1);if(ai.tok<cost)return;
      const R=m.k==='melee'?180:m.k==='leap'?220:m.k==='pulse'?205:m.k==='beam'?400:m.k==='projectile'?500:m.k==='delayed'?500:m.k==='target'?500:m.k==='zone'?230:m.k==='vanish'?300:m.k==='roll'?350:9999;
      if(m.k==='self'){if(m.d.ef&&m.d.ef.some(x=>x.op==='heal')&&a.hp<a.max*.5)opts.push([i,5,cost]);else if(rnd()<.15)opts.push([i,1,cost]);return}
      if(m.p<=0&&rnd()<.5)return;
      if(d<=R)opts.push([i,2+m.p/50,cost]);
    });
    if(opts.length&&(ai.phase==='press'||rnd()<.3)){
      let tot=opts.reduce((s,o)=>s+o[1],0),r=rnd()*tot,pk=opts[0];for(const o of opts){r-=o[1];if(r<=0){pk=o;break}}
      const m=a.moves[pk[0]];
      // 조준: 상대가 움직이는 방향을 단계별 비율(lead)만큼 앞질러 겨냥 + 단계별 오차
      const sp=m.k==='projectile'?(m.phys?430:480):0;
      const tt=sp?d/sp:0,ld=T.lead*(1+gauss()*.25);
      const px=p.x+(p.vx||0)*tt*ld,py=p.y+(p.vy||0)*tt*ld;
      const base=Math.atan2(py-a.y,px-a.x)+gauss()*T.aimSdDeg*Math.PI/180;
      startCast(a,pk[0],{x:Math.cos(base),y:Math.sin(base)});
      ai.tok-=pk[2];ai.burst++;
      if(ai.burst<T.burstMax&&ai.tok>=.5)ai.cd=.15;
      else{ai.burst=0;ai.cd=(T.postPauseSec||.5)*rr(.7,1.3)}
    }
  }
}

// ---------- 7A: 자동전투(AUTO) — 내 포켓몬도 AI가 조종 · 화면을 만지면 2.5초 동안 직접 조작 ----------
const MAN_SEC=2.5;
function touchedNow(){return IN.stick.on||IN.press.length>0||IN.roll||Object.keys(IN.hold).length>0||Object.values(IN.keys).some(Boolean)}
function autoNow(){if(!W||!W.autoOn||W.tut)return false;if(touchedNow())W.manT=W.time;return W.manT==null||W.time-W.manT>MAN_SEC}
function aiRange(e){const b=e.moves.filter(m=>m&&m.p>0).sort((x,y)=>y.p-x.p)[0];return b?(b.k==='melee'?120:b.k==='pulse'?150:b.k==='leap'?170:300):240}
function mkAi(tier){const AT=AI_T[tier]||AI_T.G4;return{T:AT,tier,sawT:0,t:0,s:1,cd:1.2,range:240,tok:Math.min(AT.tokenCap,2),hes:0,burst:0,side:0,phase:'press',pt:rr(AT.pressMinSec,AT.pressMaxSec)}}
function autoMe(me,foe){
  if(me.hp<=0){me.wish={x:0,y:0};return}
  if(!W.teraUsed&&W.time>1.2)teraGo();
  if(W.time>1.2&&gmCan(me))gmGo(me);   // 거다이맥스: 자동 전투는 2번 다 알아서 변신   // 9BC 자동 전투는 알아서 테라스탈
  const ai=W.aiMe;if(ai.uid!==me.mon.uid){ai.uid=me.mon.uid;ai.range=aiRange(me)}   // 교대하면 사거리 다시 계산
  // 잡고 싶은 포켓몬이면(host가 볼 종류를 알려 줌) 체력을 깎다가 낮아지면 공격을 멈추고 볼을 던짐
  let bk=null;if(C.autoBall&&!W.ball&&foe.hp>0){try{bk=C.autoBall()}catch(e){}}
  const ratio=foe.max?foe.hp/foe.max:1;
  // 9AZ: 잡힐 만큼 체력이 낮을 때만 던져요 (등급이 높을수록 더 낮게). 그 전엔 계속 공격, 잡을 체력이면 공격 멈춤
  const cat=C.catchAt?C.catchAt():.45,late=W.time>60?cat+.1:cat;
  ai.noAtk=!!(bk||W.ball)&&ratio<=cat;
  if(bk&&(ratio<=late||bk==='master')&&!(W.ballCd>0)&&!me.cast&&me.rollT<=0&&me.stun<=0){
    const L=ballList(),j=L.findIndex(x=>x.k===bk);if(j>=0){W.ballSel=j;tryThrow()}}
  // 체력 25% 아래면 약(제일 센 것부터, 한 전투 2번까지)
  if(me.hp<me.max*.25&&(W.autoHeal||0)<2&&!(W.itCd>0)&&C.useItem){const L=itemList();const it=L[L.length-1];if(it&&useItemNow(it.k))W.autoHeal=(W.autoHeal||0)+1}
  aiUpdate(me,ai,foe);
  if(C.bossWarn||!(C.net||C.pvp||C.meTeam)){let ax=0,ay=0;for(const d of W.delays){if(!d.boss)continue;const dx=me.x-d.x,dy=me.y-d.y,L=len(dx,dy);if(L<d.r+me.r+30){const n=L>1?{x:dx/L,y:dy/L}:{x:d.x<AW/2?1:-1,y:0};ax+=n.x;ay+=n.y}}
    if(ax||ay){const L=len(ax,ay)||1;me.wish={x:ax/L,y:ay/L}}}   // 9AF 자동: 장판 밖으로
}

// ---------- 그리기 ----------
// ---------- 9BC 테라스탈 (배틀마다 1번 · 가진 기술 중 제일 센 기술 타입으로 바뀜 · 그 타입 기술이 더 세짐) ----------
function teraInfo(e){let I=null;try{I=C.teraInfo&&C.teraInfo(e.mon)}catch(er){}
  if(!I){let b=null,bp=-1;for(const m of e.moves||[])if(m&&(m.p||0)>bp){bp=m.p||0;b=m.t}const T=b||(e.types&&e.types[0])||'NORMAL';I={T,n:T,c:(C.TCOL&&C.TCOL[T])||'#c8a0ff'}}
  return I}
function teraGo(){if(!W||W.teraUsed||W.over||!C.teraOk||C.net||C.pvp)return;try{if(!C.teraOk())return}catch(er){return}
  const me=W.me;if(!me||me.hp<=0)return;const I=teraInfo(me);W.teraUsed=1;me.tera=I.T;me.teraC=I.c;me.teraAt=performance.now();W.hitstop=Math.max(W.hitstop||0,.2);
  try{floatTxt(me.x,me.y-(me.vis||110)-30,'💎 테라스탈! '+I.n,'#ffffff',true)}catch(er){}
  if(W.tBtn)W.tBtn.style.display='none'}
function teraUi(){const b=W&&W.tBtn;if(!b)return;const me=W.me,ok=!W.teraUsed&&me&&me.hp>0&&!W.over&&!W.tut;b.style.display=ok?'flex':'none';
  if(ok&&b._tk!==me.mon.uid){b._tk=me.mon.uid;const I=teraInfo(me);b.style.background=I.c;b._n.textContent=I.n;b._n.style.display='block'}}
function teraFront(e,ty){const cx=W.ctx,vs=e.vis||110,k=performance.now()/1000,top=ty-vs*.5,C2=e.teraC||'#c8a0ff';cx.save();cx.globalAlpha=.92;cx.fillStyle='#fff8c8';cx.strokeStyle=C2;cx.lineWidth=3;
  cx.beginPath();cx.moveTo(e.x-26,top);cx.lineTo(e.x-30,top-26);cx.lineTo(e.x-14,top-12);cx.lineTo(e.x,top-34);cx.lineTo(e.x+14,top-12);cx.lineTo(e.x+30,top-26);cx.lineTo(e.x+26,top);cx.closePath();cx.fill();cx.stroke();
  for(let i=0;i<6;i++){const a=k*1.4+i*1.047,r=vs*.45,px=e.x+Math.cos(a)*r,py=ty-vs*.25+Math.sin(a)*r*.5;cx.fillStyle=i%2?'#ffffff':C2;cx.beginPath();cx.moveTo(px,py-9);cx.lineTo(px+6,py);cx.lineTo(px,py+9);cx.lineTo(px-6,py);cx.closePath();cx.fill()}
  const u=(performance.now()-(e.teraAt||0))/900;if(u>=0&&u<1){cx.globalAlpha=1-u;cx.strokeStyle='#ffffff';cx.lineWidth=8*(1-u)+2;cx.beginPath();cx.arc(e.x,ty-vs*.25,vs*(.3+u*1.5),0,7);cx.stroke();cx.strokeStyle=C2;cx.lineWidth=4;cx.beginPath();cx.arc(e.x,ty-vs*.25,vs*(.2+u*1.1),0,7);cx.stroke()}
  cx.restore()}
// ---------- 거다이맥스 (배틀 전체에서 2번 · 내 거다이맥스 포켓몬만 · 몸이 커지고 16초 동안 공격 ×1.6 · 받는 피해 ×0.55 · 변신 직후 제일 센 기술을 자동 발사) ----------
const GM_MAX=2,GM_DUR=16;
const gmS=()=>W.gm||(W.gm=(C&&C.gmS)||{n:0});
function gmCan(e){try{return !!(W&&!W.over&&!W.tut&&!C.net&&!C.pvp&&C.gmOk&&e&&e===W.me&&e.hp>0&&!e.gmx&&gmS().n<GM_MAX&&C.gmOk(e.mon))}catch(er){return false}}
function gmGo(e){e=e||(W&&W.me);if(!gmCan(e))return;gmS().n++;
  e.gmx={t:GM_DUR,fire:.9,tries:0,sc:e.sc,vis:e.vis,r:e.r};e.gmxAt=performance.now();
  e.sc*=1.5;e.vis*=1.5;e.r=Math.round(e.r*1.25);e.inv=Math.max(e.inv||0,75);W.hitstop=Math.max(W.hitstop||0,.25);
  try{floatTxt(e.x,e.y-(e.vis||110)-30,'🌋 거다이맥스!','#ff6a5a',true)}catch(er){}
  try{W.fx.push({k:'ring',sys:1,x:e.x,y:e.y,t:0,life:.7,r:220,c:'#ff4a3a'})}catch(er){}
  if(W.gBtn)W.gBtn.style.display='none'}
function gmEnd(e){const g=e.gmx;if(!g)return;e.sc=g.sc;e.vis=g.vis;e.r=g.r;e.gmx=null;try{floatTxt(e.x,e.y-(e.vis||110)-20,'거다이맥스 끝','#cfd8ea',true)}catch(er){}}
function gmFire(e){const foe=e===W.me?W.foe:W.me;if(!foe||foe.hp<=0)return true;
  let bi=-1,bs=-1;e.moves.forEach((m,i)=>{if(!m||!(m.p>0)||!canCast(e,i))return;const s=m.p*(m.typeless?1:C.eff(m.type,foe.tera?[foe.tera]:foe.types));if(s>bs){bs=s;bi=i}});
  if(bi<0)return false;const dx=foe.x-e.x,dy=foe.y-e.y,L=len(dx,dy)||1;startCast(e,bi,{x:dx/L,y:dy/L},L);return true}
function gmTick(e){const g=e.gmx;if(!g)return;g.t-=TICK;
  if(g.fire>0){g.fire-=TICK;if(g.fire<=0){if(gmFire(e)||++g.tries>=5)g.fire=0;else g.fire=.3}}
  if(g.t<=0)gmEnd(e)}
function gmUi(){const b=W&&W.gBtn;if(!b)return;const ok=gmCan(W.me);b.style.display=ok?'flex':'none';if(ok){b._n.textContent=String(GM_MAX-gmS().n);b._n.style.display='block'}}
function gmDraw(e,ty){const cx=W.ctx,vs=e.vis||110,k=performance.now()/1000,gy=ty-vs*.3;cx.save();
  cx.globalAlpha=.45+.15*Math.sin(k*5);const g=cx.createRadialGradient(e.x,gy,vs*.1,e.x,gy,vs*.8);g.addColorStop(0,'rgba(255,90,60,.9)');g.addColorStop(.6,'rgba(200,30,40,.45)');g.addColorStop(1,'rgba(120,0,40,0)');cx.fillStyle=g;cx.beginPath();cx.ellipse(e.x,gy,vs*.8,vs*.7,0,0,7);cx.fill();
  const u=(performance.now()-(e.gmxAt||0))/1000;if(u>=0&&u<1){cx.globalAlpha=1-u;cx.strokeStyle='#ffffff';cx.lineWidth=10*(1-u)+2;cx.beginPath();cx.arc(e.x,gy,vs*(.3+u*1.3),0,7);cx.stroke();cx.strokeStyle='#ff4a3a';cx.lineWidth=5;cx.beginPath();cx.arc(e.x,gy,vs*(.2+u*1),0,7);cx.stroke()}
  cx.restore()}
// ===== 렉 줄이기: 프레임이 계속 느리면 화면 크기(해상도)를 한 단계씩 낮춤 (이펙트 엔진들도 같이 가벼워짐) =====
let _shP=null;
function noShadowOn(){if(_shP)return;try{const d=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,'shadowBlur');if(!d||!d.set)return;_shP=d;Object.defineProperty(CanvasRenderingContext2D.prototype,'shadowBlur',{configurable:true,enumerable:d.enumerable,get(){return d.get.call(this)},set(v){d.set.call(this,window.__rtNoShadow?0:v)}})}catch(er){}}
function autoQ(raw){
  if(!W||document.hidden||W.paused){W&&(W.qs=0);return}
  W.qn=(W.qn||0)+1;if(W.qn<90)return;                    // 시작 직후 1.5초는 건너뜀(그림 불러오는 중)
  if(raw>400){return}                                        // 탭 전환 등 큰 끊김은 무시
  W.qe=W.qe==null?raw:W.qe*.9+raw*.1;                        // 프레임 간격 평균(ms)
  if(W.qe>24&&(W.q||1)>.55){W.qs=(W.qs||0)+1}else W.qs=Math.max(0,(W.qs||0)-2);
  if(W.qs>=40){W.qs=0;W.qe=null;W.qn=30;W.q=Math.max(.55,Math.round((W.q||1)*.8*100)/100);
    try{W.rs()}catch(er){}
    if(W.q<.85){window.__rtNoShadow=1;noShadowOn()}          // 품질이 내려가면 번짐(그림자) 효과도 끔
    try{localStorage.setItem('pka-rtq',String(W.q))}catch(er){}}
}
function render(){try{teraUi()}catch(er){}try{gmUi()}catch(er){}
  const cv=W.cv,cx=W.ctx,Wd=cv.width,Hd=cv.height;
  const land=Wd>=Hd;
  let viewW=land?AW:Math.min(AW,Math.max(620,Wd/Hd*520));
  let sc=Wd/viewW; if(AH*sc>Hd&&land)sc=Hd/AH;
  const viewH=Hd/sc;
  const me=W.me,foe=W.foe;
  let tx=(me.x*.6+foe.x*.4),ty=(me.y*.6+foe.y*.4);
  const vw=Wd/sc;
  if(foe.giant&&vw<AW&&foe.gw<vw){tx=clamp(tx,foe.x+foe.gw*.5-vw/2+20,foe.x-foe.gw*.5+vw/2-20)}tx=vw>=AW?AW/2:clamp(tx,vw/2,AW-vw/2);ty=viewH>=AH?AH/2:clamp(ty,viewH/2,AH-viewH/2);
  W.cam=W.cam||{x:tx,y:ty};W.cam.x+=(tx-W.cam.x)*.12;W.cam.y+=(ty-W.cam.y)*.12;if(W.qk>0){W.qk-=1/60;W.cam.x+=(Math.random()-.5)*W.qk*28;W.cam.y+=(Math.random()-.5)*W.qk*28}
  cx.setTransform(1,0,0,1,0,0);
  cx.fillStyle='#0b1220';cx.fillRect(0,0,Wd,Hd);
  let shx=0,shy=0;if(fxOn()){try{const q=C.fxe.FX2.shakeXY();shx=q[0]*.5;shy=q[1]*.5}catch(er){}}
  if(W.shk>.3){shx+=(Math.random()-.5)*W.shk*sc*.6;shy+=(Math.random()-.5)*W.shk*sc*.6;W.shk*=.82}else W.shk=0;
  if(W.inv>0){cv.style.filter='invert(1) contrast(1.6)';W.inv--}else if(cv.style.filter)cv.style.filter='';
  cx.setTransform(sc,0,0,sc,Wd/2-W.cam.x*sc+shx,Hd/2-W.cam.y*sc+shy);
  // 바닥
  // 7B: 전투 배경 = 게임의 장소 배경 그림(풀숲·숲·동굴·바다·체육관…). 그림이 없거나 아직 안 받아졌으면 예전 초록 바닥
  let bim=null;try{bim=W.gx&&W.gx.img&&W.gx.img.complete&&W.gx.img.naturalWidth?W.gx.img:(C.bg?C.bg():null)}catch(er){}
  if(bim&&bim.complete&&bim.naturalWidth){
    const pad=60,BW=AW+pad*2,BH=AH+pad*2,k=Math.max(BW/bim.naturalWidth,BH/bim.naturalHeight);
    cx.drawImage(bim,-pad+(BW-bim.naturalWidth*k)/2,-pad+(BH-bim.naturalHeight*k)/2,bim.naturalWidth*k,bim.naturalHeight*k);
    cx.fillStyle='rgba(10,8,20,.18)';cx.fillRect(-pad,-pad,BW,BH);   // 포켓몬·이펙트가 잘 보이게 살짝 어둡게
  }else{
    const g=cx.createLinearGradient(0,0,0,AH);g.addColorStop(0,'#5e8f55');g.addColorStop(1,'#487244');
    cx.fillStyle=g;cx.fillRect(0,0,AW,AH);
    cx.strokeStyle='rgba(255,255,255,.07)';cx.lineWidth=2;
    for(let x=0;x<=AW;x+=100){cx.beginPath();cx.moveTo(x,0);cx.lineTo(x,AH);cx.stroke()}
    for(let y=0;y<=AH;y+=100){cx.beginPath();cx.moveTo(0,y);cx.lineTo(AW,y);cx.stroke()}}
  cx.strokeStyle='#e8f0d8';cx.lineWidth=6;cx.strokeRect(WALL-3,WALL-3,AW-WALL*2+6,AH-WALL*2+6);
  if(W.gx){try{GYMFX.draw(W.gx,cx,W)}catch(er){}}   // 1/3: 체육관 장치(포켓몬 아래)
  // 장판/예고
  for(const z of W.zones){const pul=.3+.08*Math.sin(W.time*4);cx.globalAlpha=pul;cx.fillStyle=z.col;cx.beginPath();cx.arc(z.x,z.y,z.r,0,7);cx.fill();cx.globalAlpha=.9;cx.strokeStyle='#fff';cx.lineWidth=3;cx.setLineDash([14,8]);cx.stroke();cx.setLineDash([]);
    cx.font='bold 14px sans-serif';cx.textAlign='center';cx.lineWidth=3;cx.strokeStyle='#000';cx.fillStyle='#fff';const tl=Math.ceil(z.life)+'초';cx.strokeText(tl,z.x,z.y+5);cx.fillText(tl,z.x,z.y+5);cx.globalAlpha=1}
  for(const d of W.delays){if(d.boss){const u=1-d.t/d.T;cx.globalAlpha=.22;cx.fillStyle='#ff2a2a';cx.beginPath();cx.arc(d.x,d.y,d.r,0,7);cx.fill();cx.globalAlpha=.45+(d.t<.6?.35*Math.sin(W.time*30):0);cx.beginPath();cx.arc(d.x,d.y,d.r*u,0,7);cx.fill();cx.globalAlpha=1;cx.strokeStyle='#ff3030';cx.lineWidth=5;cx.setLineDash([14,8]);cx.beginPath();cx.arc(d.x,d.y,d.r,0,7);cx.stroke();cx.setLineDash([]);cx.font='900 30px sans-serif';cx.textAlign='center';cx.lineWidth=5;cx.strokeStyle='#000';cx.fillStyle='#fff';const tl=Math.ceil(d.t);cx.strokeText(tl,d.x,d.y+10);cx.fillText(tl,d.x,d.y+10);continue}const al=d.t>.5?.25:.35+.3*Math.sin(W.time*30);cx.globalAlpha=al;cx.fillStyle='#ff4a3a';cx.beginPath();cx.arc(d.x,d.y,d.r,0,7);cx.fill();cx.globalAlpha=1;cx.strokeStyle='#fff';cx.lineWidth=3;cx.stroke()}
  // 내가 누르고 있는 기술의 사용 범위 미리보기
  if(window.BEAMFX&&fxOn()){const sk=BEAMFX.render(cx);if(sk>1)W.shk=Math.max(W.shk||0,sk*.5)}
  drawPreview(cx);
  // 개체
  if(fxOn()){try{C.fxe.VFX.drawGround(cx)}catch(er){}}
  const ents=fxOn()?[foe,me]:[me,foe].sort((a,b)=>a.y-b.y);   // 이펙트가 켜져 있으면 내 포켓몬을 맨 위에 그려 가리지 않게
  for(const e of ents){
    if(fxOn()&&e===me){cx.globalAlpha=1;try{C.fxe.VFX.draw(cx);C.fxe.FX2.draw(cx)}catch(er){}}
    if(e.hp<=0&&W.over&&W.overT>.8&&e!==me&&e!==foe)continue;
    cx.globalAlpha=e.capt?0:e.hidden?.25:(e.hp<=0?Math.max(.15,1-W.overT*.8):1);
    cx.fillStyle='rgba(0,0,0,.3)';cx.beginPath();cx.ellipse(e.x,e.y+6,e.r*.9,e.r*.4,0,0,7);cx.fill();
    // 조준 예고 (준비 중, 내 것만)
    if(e.cast&&e.cast.phase==='startup'&&e===me){const c=e.cast;cx.globalAlpha=.25;cx.strokeStyle='#fff';cx.lineWidth=3;cx.setLineDash([10,8]);cx.beginPath();cx.moveTo(e.x,e.y);cx.lineTo(e.x+Math.cos(c.aim)*220,e.y+Math.sin(c.aim)*220);cx.stroke();cx.setLineDash([]);cx.globalAlpha=1}
    if(e.cast&&e.cast.phase==='startup'&&e!==me){const c=e.cast;cx.globalAlpha=.3;cx.strokeStyle='#ff6a5a';cx.lineWidth=4;cx.beginPath();cx.moveTo(e.x,e.y);cx.lineTo(e.x+Math.cos(c.aim)*200,e.y+Math.sin(c.aim)*200);cx.stroke();cx.globalAlpha=1}
    if(e.beam&&window.BEAMFX&&fxOn()){const b=e.beam,ox=e.x,oy=e.y-(e.lift||0)-20;BEAMFX.live(e,b.type,ox,oy,ox+Math.cos(b.a)*b.L,oy+Math.sin(b.a)*b.L,b.full,1,b.aw)}   // 9T: 사용자 빔 엔진(18속성 블룸)
    else if(e.beam){const b=e.beam;cx.save();cx.translate(e.x,e.y-(e.lift||0)-20);cx.rotate(b.a);const gg=cx.createLinearGradient(0,0,b.L,0);gg.addColorStop(0,'#fff');gg.addColorStop(1,b.col);cx.globalAlpha=fxOn()?.14:.85;cx.fillStyle=gg;cx.fillRect(0,-18,b.L,36);cx.globalAlpha=fxOn()?.2:.9;cx.fillStyle='#fff';cx.fillRect(0,-6,b.L,12);cx.restore();cx.globalAlpha=1}
    const st=e.anim;
    const VT=e.vt||e.tier,TR=e.eng&&VT>=6&&window.TFX&&!(C.tfxOff&&C.tfxOff())&&!e.capt&&!e.hidden&&e.hp>0,ty=e.y-(e.lift||0)-18,tms=performance.now();   // 9B 등급 기운
    if(TR){const a0=cx.globalAlpha;try{TFX.back(e.eng,cx,e.S,e.x,ty,e.sc,VT,tms)}catch(er){}cx.globalAlpha=a0}
    if(e.gmx){try{gmDraw(e,ty)}catch(er){}}
    if(e.tera){const vs=e.vis||110,gy=ty-vs*.2,k=(performance.now()%1600)/1600;cx.save();cx.globalAlpha=.6+.2*Math.sin(k*6.283);const g=cx.createRadialGradient(e.x,gy,6,e.x,gy,vs*.85);g.addColorStop(0,'#ffffff');g.addColorStop(.4,e.teraC||'#c8a0ff');g.addColorStop(1,'rgba(0,0,0,0)');cx.fillStyle=g;cx.beginPath();cx.arc(e.x,gy,vs*.85,0,7);cx.fill();cx.restore()}   // 9BC 테라스탈 보석 빛
    try{C.drawPm(cx,TR?TFX.spr(e.S,VT):e.S,st,e.row,e.at,e.x,ty,e.sc,{loop:!(st==='attack'||st==='hurt'||st==='shoot'),white:e.flash>0,alpha:cx.globalAlpha})}catch(er){cx.fillStyle='#fff';cx.beginPath();cx.arc(e.x,e.y-30,30,0,7);cx.fill()}
    if(TR){try{TFX.front(e.eng,cx,e.S,e.x,ty,e.sc,VT,tms)}catch(er){}}
    if(e.tera)teraFront(e,ty);
    cx.globalAlpha=1;
    if(e.inv>0&&e.invMax>60){cx.strokeStyle='#ffe14a';cx.lineWidth=4;cx.globalAlpha=.45+.35*Math.sin(W.time*12);cx.beginPath();cx.ellipse(e.x,e.y-30,e.r+20,e.r+20,0,0,7);cx.stroke();cx.globalAlpha=1}   // 9F 불멸 무적
    if(e.protect>0){cx.strokeStyle='#9be7ff';cx.lineWidth=4;cx.globalAlpha=.8;cx.beginPath();cx.ellipse(e.x,e.y-30,e.r+14,e.r+14,0,0,7);cx.stroke();cx.globalAlpha=1}
    // 머리 위 작은 HP바
    const bw=90,bx=e.x-bw/2,by=e.y-18-clamp((e.vis||110)*.78,40,150)-12;
    cx.fillStyle='rgba(0,0,0,.55)';cx.fillRect(bx-2,by-2,bw+4,10);
    const rr=Math.max(0,e.hp/e.max);cx.fillStyle=rr>.5?'#3be06a':rr>.2?'#ffc83a':'#ff4a3a';cx.fillRect(bx,by,bw*rr,6);
    if(e.zb&&e.zb.on>0){cx.font='bold 13px sans-serif';cx.textAlign='center';cx.fillStyle='#ff4060';cx.fillText('⚡ 데미지 +30% '+Math.ceil(e.zb.on)+'초',bx+bw/2,by-6)}   // 9F 만제 버프
    if(e.inv>0&&e.invMax>60){cx.font='bold 13px sans-serif';cx.textAlign='center';cx.fillStyle='#ffe14a';cx.fillText('무적 '+Math.ceil(e.inv/60)+'초',bx+bw/2,by-(e.zb&&e.zb.on>0?20:6))}
  }
  if(W.gx&&GYMFX.over){try{GYMFX.over(W.gx,cx,W)}catch(er){}}   // 2/3: 어두운 도장(몸 위에 덮기)
  if(W.wx){try{wxDraw(cx)}catch(er){}}   // ③ 날씨 그림
  if(W.rz3){try{rz3Draw(cx)}catch(er){}}   // ③ 3/3 그림
  if(W.rz2||W.rz3){try{rz2Draw(cx)}catch(er){}}   // ③ 2/2 그림
  // 발사체
  for(const c of W.clones){const o=c.o;const a=Math.min(1,c.t)*(.5+.12*Math.sin(W.time*10));cx.globalAlpha=a;   // 9F 태초 분신 그리기
    try{const S=window.TFX?TFX.spr(o.S,o.tier):o.S;C.drawPm(cx,S,'idle',o.row,o.at,c.x,c.y-18,o.sc*.85,{loop:true,alpha:a})}catch(er){}
    cx.globalAlpha=a*.8;cx.strokeStyle='#ffe14a';cx.lineWidth=2;cx.beginPath();cx.ellipse(c.x,c.y,26,9,0,0,7);cx.stroke();
    cx.globalAlpha=1;cx.font='bold 12px sans-serif';cx.textAlign='center';cx.fillStyle='#ffe14a';cx.fillText('분신 '+Math.ceil(c.t)+'초',c.x,c.y+22)}
  for(const p of W.proj){if(p.wait>0)continue;if(NFX()&&p.mel==='wave'){BEAMFX.waveLive(p,p.x,p.y+10,Math.atan2(p.dy,p.dx),170);continue}if(NFX()){BEAMFX.proj(p,(p.o.moves[p.mi]||{}).type,p.x,p.y-24,Math.atan2(p.dy,p.dx),p.r,p.sp,p.mel,p.aw);continue}cx.globalAlpha=p.fxa?.3:.9;cx.fillStyle=p.col;cx.beginPath();cx.arc(p.x,p.y-24,p.r,0,7);cx.fill();cx.fillStyle='#fff';cx.beginPath();cx.arc(p.x,p.y-24,p.r*.5,0,7);cx.fill();cx.globalAlpha=1}
  // 볼(6F-1)
  if(W.ball&&W.ball.ph!=='done'||W.over==='catch'&&W.ball){const B=W.ball;cx.save();cx.translate(B.x,B.y);cx.rotate(B.rot||0);
    cx.fillStyle=B.col;cx.beginPath();cx.arc(0,0,16,Math.PI,0);cx.fill();cx.fillStyle='#fff';cx.beginPath();cx.arc(0,0,16,0,Math.PI);cx.fill();
    cx.strokeStyle='#222';cx.lineWidth=3;cx.beginPath();cx.arc(0,0,16,0,7);cx.moveTo(-16,0);cx.lineTo(16,0);cx.stroke();
    cx.fillStyle='#fff';cx.beginPath();cx.arc(0,0,5,0,7);cx.fill();cx.stroke();cx.restore()}
  // 효과
  for(const f of W.fx){if(fxOn()&&(f.k==='burst'||f.k==='cone'||f.k==='slash'||f.k==='beamline'||(f.k==='ring'&&!f.sys)))continue;const u=f.t/f.life;cx.save();cx.globalAlpha=Math.max(0,1-u);
    if(f.k==='dmg'&&f.tk){pxDraw(cx,f)}
    else if(f.k==='psq'){cx.globalAlpha=Math.max(0,1-f.t/f.life);cx.fillStyle=f.c;cx.fillRect(Math.round(f.x+f.vx*f.t),Math.round(f.y+f.vy*f.t+400*f.t*f.t),f.z,f.z)}
    else if(f.k==='dmg'){const e0=1-Math.pow(1-Math.min(1,u*1.6),3),pop=1+.55*Math.max(0,1-u*7);cx.globalAlpha=Math.min(1,(1-u)*4);
      cx.font='italic 900 '+Math.round(30*f.sc*pop)+'px sans-serif';cx.textAlign='center';cx.lineJoin='round';cx.lineWidth=6;cx.strokeStyle='#000';cx.fillStyle='#fff';if(!W.q||W.q>=.99){cx.shadowColor=f.c;cx.shadowBlur=14}
      const y=f.y-e0*46;cx.strokeText(f.s,f.x,y);cx.fillText(f.s,f.x,y)}
    else if(f.k==='shock'){cx.globalAlpha=Math.max(0,1-u);cx.strokeStyle=f.c;cx.lineWidth=Math.max(1,f.w*(1-u));const R=f.r*(.2+.8*Math.sqrt(u));cx.beginPath();cx.ellipse(f.x,f.y,R,R*.7,0,0,7);cx.stroke()}
    else if(f.k==='spk'){cx.globalAlpha=Math.max(0,1-u);cx.fillStyle=f.c;for(const q of f.P){const px=f.x+q.vx*f.t,py=f.y+q.vy*f.t+260*f.t*f.t;cx.beginPath();cx.arc(px,py,q.z*(1-u*.6),0,7);cx.fill()}}
    else if(f.k==='txt'){cx.font=(f.big?'bold 34px':'bold 24px')+' sans-serif';cx.textAlign='center';cx.lineWidth=5;cx.strokeStyle='#000';cx.fillStyle=f.c;const y=f.y-u*40;cx.strokeText(f.s,f.x,y);cx.fillText(f.s,f.x,y)}
    else if(f.k==='callout'){cx.font='bold 22px sans-serif';cx.textAlign='center';cx.lineWidth=4;cx.strokeStyle='#000';cx.fillStyle=f.c;const y=f.y-u*14;cx.strokeText(f.s,f.x,y);cx.fillText(f.s,f.x,y)}
    else if(f.k==='burst'){cx.fillStyle=f.c;cx.beginPath();cx.arc(f.x,f.y,f.r*(.4+u*.8),0,7);cx.fill()}
    else if(f.k==='ring'){cx.strokeStyle=f.c;cx.lineWidth=8;cx.beginPath();cx.ellipse(f.x,f.y,f.r*(.3+u*.7),f.r*(.3+u*.7)*.7,0,0,7);cx.stroke()}
    else if(f.k==='cone'){cx.fillStyle=f.c;cx.beginPath();cx.moveTo(f.x,f.y);cx.arc(f.x,f.y,f.r*(.4+u*.6),f.a-Math.PI/3,f.a+Math.PI/3);cx.closePath();cx.fill()}
    else if(f.k==='slash'){cx.strokeStyle=f.c;cx.lineWidth=14;cx.beginPath();cx.arc(f.x,f.y,f.r*.8,f.a-.9+u*.5,f.a+.9+u*.5);cx.stroke()}
    else if(f.k==='ghost'){const o=f.o;cx.globalAlpha=Math.max(0,(1-u))*f.a;try{const S=window.TFX?TFX.spr(o.S,o.tier):o.S;C.drawPm(cx,S,'idle',o.row,o.at,f.x,f.y-18,o.sc,{loop:true,white:true,alpha:cx.globalAlpha})}catch(er){}}
    else if(f.k==='beamline'){cx.strokeStyle=f.c;cx.lineWidth=10;cx.beginPath();cx.moveTo(f.x,f.y-20);cx.lineTo(f.x2,f.y2-20);cx.stroke()}
    cx.restore()}
  // ---- 화면 고정 HUD ----
  cx.setTransform(1,0,0,1,0,0);
  if(W.flashA>.01){cx.save();cx.globalAlpha=W.flashA*.3;cx.fillStyle=W.flashC||'#fff';cx.fillRect(0,0,Wd,Hd);cx.restore();W.flashA*=.82}
  hud(cx,Wd,Hd);
}
function hud(cx,Wd,Hd){
  const me=W.me,foe=W.foe,u=Math.max(.62,Math.min(Wd,Hd*1.6)/700*(window.PKHS||.66));
  const PKN=C.net?6:((W.ents&&W.ents.length)?Math.max(W.ents.filter(q=>q.side===0).length,W.ents.filter(q=>q.side===1).length):1);
  const bar=(x,y,w,e,right)=>{
    cx.fillStyle='rgba(0,0,0,.55)';cx.fillRect(x,y,w,(window.PKHX?PKHX.h(PKN):46)*u);
    cx.fillStyle='#fff';cx.font='bold '+(15*u)+'px sans-serif';cx.textAlign=right?'right':'left';
    cx.fillText(C.nm(e.mon)+'  Lv.'+(C.dLv?C.dLv(e.mon):e.mon.lv),right?x+w-8*u:x+8*u,y+18*u);
    cx.fillStyle='#222';cx.fillRect(x+8*u,y+26*u,w-16*u,10*u);
    const r=Math.max(0,e.hp/e.max);cx.fillStyle=r>.5?'#3be06a':r>.2?'#ffc83a':'#ff4a3a';cx.fillRect(x+8*u,y+26*u,(w-16*u)*r,10*u);
    {cx.fillStyle='#fff';cx.font='bold '+(11*u)+'px sans-serif';cx.textAlign=right?'left':'right';cx.fillText(fmtN(Math.ceil(e.hp)*kOf(e))+' / '+fmtN(e.max*kOf(e)),right?x+8*u:x+w-8*u,y+44*u)}
    // 상태
    const ss=Object.keys(e.ail).map(s=>({burn:'화',poison:'독',paralysis:'마',sleep:'잠',freeze:'얼',confusion:'혼'})[s]||s).join('');
    if(ss){cx.fillStyle='#f9a';cx.textAlign=right?'left':'right';cx.fillText(ss,right?x+8*u:x+w-8*u,y+18*u)}
    try{window.PKHX&&PKHX.draw(cx,x,y+46*u,w,e,right,u,PKN)}catch(er){}
  };
  const bw=Math.min(Wd*.42,300*u);
  bar(8*u,8*u,bw,me,false);bar(Wd-bw-8*u,8*u,bw,foe,true);
  cx.fillStyle='rgba(0,0,0,.5)';cx.font='bold '+(16*u)+'px sans-serif';cx.textAlign='center';
  const left=Math.max(0,Math.ceil(180-W.time));cx.fillStyle='#fff';cx.fillText(Math.floor(left/60)+':'+String(left%60).padStart(2,'0'),Wd/2,24*u);
  // 구르기 충전
  cx.font='bold '+(13*u)+'px sans-serif';cx.textAlign='left';cx.fillStyle='#fff';
  // 버튼은 DOM으로 따로 그림 (렉 줄이기: 3프레임에 한 번만 갱신)
  W.ub=(W.ub||0)+1;if(W.ub%3===1)updBtns();
  if(W.over){
    cx.fillStyle='rgba(0,0,0,.55)';cx.fillRect(0,0,Wd,Hd);
    cx.fillStyle='#fff';cx.textAlign='center';cx.font='bold '+(44*u)+'px sans-serif';
    cx.fillText(W.over==='win'?'승리!':W.over==='catch'?'포획 성공!':W.over==='lose'?(C.loseTxt||'패배…'):(C.drawTxt||'무승부'),Wd/2,Hd/2-10*u);
    cx.font=(16*u)+'px sans-serif';cx.fillText(C.endHint||'화면을 누르면 돌아가요 (시험 전투라 저장에는 영향 없음)',Wd/2,Hd/2+26*u);
  }
}

// ---------- 조준 미리보기 (버튼을 누른 채 끌면 방향·범위가 바닥에 보임) ----------
const DRAG_MIN=12, DRAG_FULL=110;
// 누르고 있는 버튼의 조준: 끌었으면 그 방향(manual), 안 끌었으면 자동 조준(상대 쪽)
function holdAim(h){
  const dx=h.x-h.sx,dy=h.y-h.sy,L=Math.hypot(dx,dy),m=W.me.moves[h.i];
  if(L>DRAG_MIN){
    const f=clamp((L-DRAG_MIN)/(DRAG_FULL-DRAG_MIN),0,1);
    let dist=null;
    if(m&&m.k==='zone')dist=40+f*190;else if(m&&m.k==='leap')dist=30+f*145;
    return{dir:norm(dx,dy),manual:true,dist,f};
  }
  return{dir:aimFor(W.me,null),manual:false,dist:null,f:0};
}
function drawPreview(cx){
  const me=W.me,foe=W.foe;if(!me||me.hp<=0)return;
  for(const id in IN.hold){
    const h=IN.hold[id],m=me.moves[h.i];if(!m)continue;
    const a=holdAim(h),u=a.dir,ang=Math.atan2(u.y,u.x),col=C.TCOL[m.type]||'#fff',heavy=m.p>=110;
    const ox=me.x,oy=me.y;
    cx.save();
    cx.lineWidth=3;cx.strokeStyle=col;cx.fillStyle='rgba(255,255,255,.2)';
    cx.setLineDash(a.manual?[]:[12,8]);
    const rectP=(L,w)=>{cx.save();cx.translate(ox,oy);cx.rotate(ang);cx.beginPath();cx.rect(0,-w,L,w*2);cx.fill();cx.stroke();cx.restore()};
    const circ=(x,y,r)=>{cx.beginPath();cx.arc(x,y,r,0,7);cx.fill();cx.stroke()};
    const sector=(r,half)=>{cx.beginPath();cx.moveTo(ox,oy);cx.arc(ox,oy,r,ang-half,ang+half);cx.closePath();cx.fill();cx.stroke()};
    const k=m.k;
    if(m.st&&k==='self'||k==='self'){circ(ox,oy,70)}
    else if(k==='melee'){const reach=70+(heavy?20:0)+10+me.r,half=(heavy?65:50)*Math.PI/180;sector(reach+(heavy?180:120)*.5,half);
      cx.setLineDash([]);cx.beginPath();cx.moveTo(ox,oy);cx.lineTo(ox+u.x*120*(heavy?1.5:1),oy+u.y*120*(heavy?1.5:1));cx.stroke()}
    else if(k==='leap'){const d=a.dist!=null?a.dist:(foe.hp>0?clamp(len(foe.x-me.x,foe.y-me.y),30,175):105);
      rectP(d,6);circ(clamp(ox+u.x*d,WALL,AW-WALL),clamp(oy+u.y*d,WALL,AH-WALL),34+me.r*.3)}
    else if(k==='roll'){rectP(330,me.r*.9)}
    else if(k==='vanish'){circ(ox,oy,56)}
    else if(k==='projectile'){const r=(m.st?16:heavy?20:13)*(m.d.sb==='bolt'?1.25:1);rectP(690,r)}
    else if(k==='beam'){rectP(clamp(360+m.p*1.5,360,690),18)}
    else if(k==='pulse'){if(m.kd==='cone')sector(205,60*Math.PI/180);else circ(ox,oy,205)}
    else if(k==='zone'){const d=a.dist!=null?a.dist:Math.min(230,foe.hp>0?len(foe.x-me.x,foe.y-me.y):230);
      cx.setLineDash([]);cx.beginPath();cx.moveTo(ox,oy);cx.lineTo(clamp(ox+u.x*d,WALL,AW-WALL),clamp(oy+u.y*d,WALL,AH-WALL));cx.stroke();
      cx.setLineDash(a.manual?[]:[12,8]);circ(clamp(ox+u.x*d,WALL,AW-WALL),clamp(oy+u.y*d,WALL,AH-WALL),62)}
    else if(k==='delayed'){circ(foe.x,foe.y,58)}
    else if(k==='target'){cx.globalAlpha=.6;cx.beginPath();cx.arc(ox,oy,550,0,7);cx.stroke();cx.globalAlpha=1;
      if(foe.hp>0){cx.setLineDash([]);cx.beginPath();cx.moveTo(ox,oy);cx.lineTo(foe.x,foe.y);cx.stroke()}}
    else{rectP(300,14)}
    // 방향 화살표 + 안내
    cx.setLineDash([]);cx.fillStyle=col;cx.beginPath();const ax=ox+u.x*90,ay=oy+u.y*90;
    cx.moveTo(ax+u.x*16,ay+u.y*16);cx.lineTo(ax-u.y*10,ay+u.x*10);cx.lineTo(ax+u.y*10,ay-u.x*10);cx.closePath();cx.fill();
    cx.font='bold 20px sans-serif';cx.textAlign='center';cx.lineWidth=4;cx.strokeStyle='#000';cx.fillStyle='#fff';
    const tx=a.manual?'손 떼면 이 방향으로 발사':'끌어서 조준 · 그냥 떼면 자동 조준';
    cx.strokeText(tx,me.x,me.y-me.r*2.2-44);cx.fillText(tx,me.x,me.y-me.r*2.2-44);
    cx.restore();
  }
}

// ---------- 6F-4a/4b: 파티 패널(일시정지) + 실제 교체 ----------
const SW_CD=5,SW_VULN=36;   // 교체 쿨타임 5초 · 교체 직후 무방비 36틱(0.6초)
function closeParty(){if(!W||!W.pp)return;W.pp.remove();W.pp=null;W.paused=0}
// ---------- 6F-4c: 전투 중 회복 아이템 (패널·일시정지 · 가방 1개 차감은 host의 C.useItem) ----------
// C.items():[{k,e,n,count,heal}] · C.useItem(k):{heal:number,cure?:1} (없으면 null, 실제 모드는 가방에서 1개 차감)
const IT_CD=4;   // 약 쓴 뒤 다시 쓰려면 4초
const itemList=()=>{try{return C.items?C.items()||[]:[]}catch(e){return[]}};
function closeItems(){if(!W||!W.ip)return;W.ip.remove();W.ip=null;W.paused=0}
function useItemNow(k){
  if(!W||W.over||W.ball||(W.itCd||0)>0||!C.useItem)return false;
  const me=W.me;if(me.hp<=0)return false;
  const hurt=me.hp<me.max-.5,ail=Object.keys(me.ail||{}).length>0;
  const it=itemList().find(x=>x.k===k);if(!it)return false;
  if(!hurt&&!(it.cure&&ail)){floatTxt(me.x,me.y-90,'체력이 가득이에요','#fff');return false}
  let r=null;try{r=C.useItem(k)}catch(e){}
  if(!r){floatTxt(me.x,me.y-90,'쓸 수 없어요','#f88');return false}
  if(r.deny){floatTxt(me.x,me.y-90,r.deny,'#f88');return false}   // 9D 물약 제한
  let got=0;if(r.pct>0||r.heal>0){const b0=me.hp;me.hp=Math.min(me.max,me.hp+(r.pct>0?me.max*r.pct/100:r.heal*(me.hm||1)));got=Math.round(me.hp-b0)}
  if(r.cure)me.ail={};
  W.itCd=IT_CD;
  floatTxt(me.x,me.y-90,got>0?'+'+fmtN(got*kOf(me)):'회복!','#6f6',true);
  W.fx.push({k:'ring',sys:1,x:me.x,y:me.y,t:0,life:.35,r:60,c:'#6fff8a'});
  try{C.sfx&&C.sfx('heal')}catch(e){}
  return true}
function openItems(){
  if(!W||W.over||W.pp||W.ip||W.ball||!C.items)return;
  W.paused=1;IN.stick={on:0,id:null,sx:0,sy:0,x:0,y:0};IN.hold={};IN.press=[];IN.roll=0;
  try{W.ui.jb.style.display='none'}catch(e){}
  const ip=document.createElement('div');
  ip.style.cssText='position:absolute;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;pointer-events:auto;z-index:5;font-family:sans-serif';
  ip.addEventListener('pointerdown',ev=>ev.stopPropagation());
  const box=document.createElement('div');box.style.cssText='width:min(92vw,360px);max-height:86vh;overflow:auto;background:#1c2230;border:2px solid #56627f;border-radius:14px;padding:12px;color:#fff';
  const h=document.createElement('div');h.style.cssText='font-weight:bold;font-size:16px;margin-bottom:2px';h.textContent='회복 아이템';box.appendChild(h);
  const me=W.me;const sub=document.createElement('div');sub.style.cssText='font-size:12px;opacity:.75;margin-bottom:8px';
  sub.textContent=(W.itCd>0?'쿨타임 '+Math.ceil(W.itCd)+'초 남았어요. ':'')+'싸우는 중인 포켓몬에게 써요 ('+fmtN(me.hp*kOf(me))+'/'+fmtN(me.max*kOf(me))+'). 쓰면 '+IT_CD+'초 동안 못 써요.'+(()=>{try{const n=C.potLeft&&C.potLeft();return n==null?'':' · 이번 전투 물약 '+n+'번 남음'}catch(e){return''}})();box.appendChild(sub);
  const L=itemList();
  if(!L.length){const n=document.createElement('div');n.style.cssText='padding:12px;text-align:center;opacity:.7';n.textContent='쓸 수 있는 회복 아이템이 없어요';box.appendChild(n)}
  for(const it of L){
    const can=!(W.itCd>0)&&it.count!==0;
    const row=document.createElement('div');
    row.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:8px 10px;margin:4px 0;border-radius:8px;background:'+(can?'#34476b':'#2b3347')+';opacity:'+(can?1:.55)+';'+(can?'cursor:pointer;border:1px solid #7fa6e8':'border:1px solid transparent');
    const l=document.createElement('div');l.innerHTML='<span style="display:inline-block;width:22px;vertical-align:middle">'+(it.e||'')+'</span> <b>'+it.n+'</b>';
    const r=document.createElement('div');r.style.cssText='font-size:12px;text-align:right';r.textContent=(it.pct?'+'+it.pct+'% · ':it.heal?'+'+it.heal+' · ':'')+'×'+it.count;
    row.appendChild(l);row.appendChild(r);box.appendChild(row);
    if(can)row.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();if(useItemNow(it.k))closeItems()});
  }
  const cl=document.createElement('div');cl.textContent='닫기 (전투 계속)';cl.style.cssText='margin-top:8px;text-align:center;padding:10px;border-radius:8px;background:#3b6ea5;font-weight:bold';
  cl.addEventListener('pointerdown',ev=>{ev.stopPropagation();closeItems()});box.appendChild(cl);
  ip.appendChild(box);W.root.appendChild(ip);W.ip=ip;
}
const partyHp=q=>{const h=W.hpBy&&W.hpBy[q.uid];return h!=null?h:q.hp};
function setMoveBtns(){
  const U=W.ui;if(!U)return;
  for(let i=0;i<4;i++){const m=W.me.moves[i],b=U.btns[i];b._t.textContent=m?m.name:'-';b.style.background=m?(C.TCOL[m.type]||'#456'):'#333';b.style.opacity=1;b._cd.style.height='0'}
}
async function doSwitch(uid){
  const w=W;
  if(!w||w.over||w.swapping||(w.swCd||0)>0||!C.pickMon)return;
  const old=w.me;if(!old||old.hp<=0||uid===old.mon.uid)return;
  let pk=null;try{pk=C.pickMon(uid)}catch(e){}
  if(!pk||!pk.mon)return;
  const h=w.hpBy[uid]!=null?w.hpBy[uid]:pk.hp;if(!(h>0))return;
  w.swapping=1;
  let S=null;try{S=await C.getSpr(C.sprKey(pk.mon))}catch(e){}
  if(W!==w||w.stopped||w.over){w.swapping=0;return}
  if(old.ab&&old.ab.includes('REGENERATOR')&&old.hp>0){old.hp=Math.min(old.max,old.hp+Math.round((old.pctMax||old.max)/3));floatTxt(old.x,old.y-100,'재생력!','#7dff8a',true)}   // F: 재생력 — 나갈 때 최대 체력 1/3 회복
  w.hpBy[old.mon.uid]=old.hp/(old.hm||1);                       // 나가는 포켓몬의 지금 체력 기억
  const ne=mkEnt(pk.mon,S,0,h);
  ne.x=old.x;ne.y=old.y;ne.face=old.face;ne.row=old.row;ne.rc=old.rc;ne.vx=ne.vy=0;
  ne.swapT=SW_VULN;ne.flash=SW_VULN/60;             // 잠깐 무방비(깜박임)
  for(let i=0;i<4;i++)ne.cd[i]=Math.min(ne.cdMax[i],1.5);   // 쿨타임 초기화 꼼수 방지
  w.chain=w.chain.filter(c=>c.o!==old);w.clones=w.clones.filter(c=>c.o!==old);             // 나간 포켓몬의 연타·분신은 끊김
  w.proj=w.proj.filter(p=>{if(p.o!==old)return true;try{if(p.fxa)C.fxe.VFX.stop(p.fxa)}catch(er){}return false});w.zones=w.zones.filter(z=>z.o!==old);w.delays=w.delays.filter(d=>d.o!==old);   // 9E: 나간 포켓몬 기술 그림이 멈춰 남지 않게
  w.delays.forEach(d=>{if(d.tgt===old)d.tgt=ne});   // 상대의 내려찍기 조준은 새 포켓몬을 따라감
  w.me=ne;try{abEnter(ne,w.foe);w.abUpd&&w.abUpd()}catch(er){}
  try{window.PKS&&PKS.cry(ne.mon,.8,150)}catch(er){}
  if(!w.used.includes(uid))w.used.push(uid);
  w.swCd=SW_CD;w.swapping=0;
  w.fx.push({k:'ring',sys:1,x:ne.x,y:ne.y,t:0,life:.35,r:60,c:'#ffffff'});
  floatTxt(ne.x,ne.y-80,'교대!','#9be7ff',true);
  setMoveBtns();closeParty();
}
// ---------- 상성이 안 맞아 공격이 하나도 안 들어가면(효과 없음) 들어가는 포켓몬으로 알아서 교체 ----------
// 설정의 「상성이 안 맞으면 자동 교체」 스위치(pk-patch.js)로 끌 수 있어요. 공격기술이 아예 없는 포켓몬은 상성 문제가 아니라서 그대로 둬요.
let _asTick=0;
function pkHurts(moves,foe){const dm=moves.filter(m=>m&&(m.p>0||m.fx||m.exec));if(!dm.length)return true;const ft=foe.tera?[foe.tera]:foe.types;return dm.some(m=>m.typeless||C.eff(m.type,ft)>0)}
function autoSwapChk(){
  const w=W;
  if(!w||w.over||w.paused||w.swapping||w.tut||w.pp||w.ip||w.ball||(w.swCd||0)>0||!C.pickMon||!C.party||C.noAutoSwap)return;
  if(window.PKS&&PKS.swapOn&&!PKS.swapOn())return;
  if(w.tick-_asTick<30)return;_asTick=w.tick;
  const me=w.me,foe=w.foe;
  if(!me||!foe||me.hp<=0||foe.hp<=0||me.cast||me.stun>0||me.swapT>0||foe.hidden||foe.capt)return;
  const forced=W._noEffTick!=null&&w.tick-W._noEffTick<=180;   // 「효과 없음」이 실제로 떴으면 기술 타입 계산과 상관없이 교체
  if(!forced&&pkHurts(me.moves,foe))return;
  W._noEffTick=null;
  let L=[];try{L=C.party()||[]}catch(er){}
  let best=null,bs=0;
  for(const q of L){
    if(q.uid===me.mon.uid)continue;
    let pk=null;try{pk=C.pickMon(q.uid)}catch(er){}
    if(!pk||!pk.mon)continue;
    const h=w.hpBy[q.uid]!=null?w.hpBy[q.uid]:pk.hp;if(!(h>0))continue;
    const ty=(C.META[pk.mon.n]||{types:['NORMAL']}).types,ft=foe.tera?[foe.tera]:foe.types;
    let s=0;
    for(const id of (pk.mon.moves||[]).slice(0,4)){let m=null;try{m=moveInfo(id)}catch(er){}if(!m||!(m.p>0))continue;const e=m.typeless?1:C.eff(m.type,ft);if(e<=0)continue;s=Math.max(s,m.p*e*(ty.includes(m.type)?1.5:1))}
    if(s>bs){bs=s;best=q}
  }
  if(!best)return;
  floatTxt(me.x,me.y-110,forced?'효과 없음! 교체':'상성이 안 맞아요! 교체','#9be7ff',true);
  doSwitch(best.uid);
}
function openParty(){
  if(!W||W.over||W.pp||W.ip||W.ball)return;
  W.paused=1;IN.stick={on:0,id:null,sx:0,sy:0,x:0,y:0};IN.hold={};IN.press=[];IN.roll=0;
  try{W.ui.jb.style.display='none'}catch(e){}
  const pp=document.createElement('div');
  pp.style.cssText='position:absolute;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;pointer-events:auto;z-index:5;font-family:sans-serif';
  pp.addEventListener('pointerdown',ev=>ev.stopPropagation());
  const box=document.createElement('div');box.style.cssText='width:min(92vw,360px);max-height:86vh;overflow:auto;background:#1c2230;border:2px solid #56627f;border-radius:14px;padding:12px;color:#fff';
  const h=document.createElement('div');h.style.cssText='font-weight:bold;font-size:16px;margin-bottom:2px';h.textContent='포켓몬 교대';box.appendChild(h);
  const sub=document.createElement('div');sub.style.cssText='font-size:12px;opacity:.75;margin-bottom:8px';
  sub.textContent=C.pickMon?(W.swCd>0?'교체 쿨타임 '+Math.ceil(W.swCd)+'초 남았어요.':'바꿀 포켓몬을 누르세요. 바꾸는 동안 잠깐 무방비예요.'):'전투는 멈춰 있어요. (보기만)';box.appendChild(sub);
  let L=[];try{L=C.party()||[]}catch(e){}
  const curUid=W.me.mon.uid;
  for(const q of L){
    const row=document.createElement('div');const cur=q.uid===curUid;
    const hp=cur?Math.max(0,Math.round(W.me.hp)):Math.round(partyHp(q)),mx=cur?Math.round(W.me.max):q.max,dead=hp<=0;
    const can=!!C.pickMon&&!cur&&!dead&&!(W.swCd>0);
    row.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:8px 10px;margin:4px 0;border-radius:8px;background:'+(cur?'#2a4a2a':can?'#34476b':'#2b3347')+';opacity:'+(dead?.5:1)+';'+(can?'cursor:pointer;border:1px solid #7fa6e8':'border:1px solid transparent');
    const l=document.createElement('div');l.innerHTML='<b>'+q.name+'</b> Lv.'+q.lv;
    const r=document.createElement('div');r.style.cssText='font-size:12px;text-align:right';
    const kk=kOf(W.me),hs=fmtN(hp*kk)+'/'+fmtN(mx*kk);r.textContent=cur?'싸우는 중 '+hs:(dead?'기절':hs+(can?' · 교체':''));
    row.appendChild(l);row.appendChild(r);box.appendChild(row);
    if(can)row.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();doSwitch(q.uid)});
  }
  const cl=document.createElement('div');cl.textContent='닫기 (전투 계속)';cl.style.cssText='margin-top:8px;text-align:center;padding:10px;border-radius:8px;background:#3b6ea5;font-weight:bold';
  cl.addEventListener('pointerdown',ev=>{ev.stopPropagation();closeParty()});box.appendChild(cl);
  pp.appendChild(box);W.root.appendChild(pp);W.pp=pp;
}

// ---------- DOM(조작 UI) ----------
function buildUI(){
  const root=document.createElement('div');root.id='rtbRoot';
  root.style.cssText='position:fixed;inset:0;z-index:99999;background:#000;touch-action:none;user-select:none;-webkit-user-select:none';
  const cv=document.createElement('canvas');cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block';root.appendChild(cv);
  const ui=document.createElement('div');ui.style.cssText='position:absolute;inset:0;pointer-events:none';root.appendChild(ui);
  // 조이스틱 표시
  const jb=document.createElement('div');jb.style.cssText='position:absolute;width:120px;height:120px;border-radius:50%;border:3px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);display:none;transform:translate(-50%,-50%)';
  const jk=document.createElement('div');jk.style.cssText='position:absolute;width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.55);left:50%;top:50%;transform:translate(-50%,-50%)';jb.appendChild(jk);ui.appendChild(jb);
  // 기술 4개 + 구르기
  const btns=[],mk=(label,bg)=>{const b=document.createElement('div');b.style.cssText='position:absolute;width:70px;height:70px;border-radius:50%;pointer-events:auto;display:flex;align-items:center;justify-content:center;text-align:center;font:bold 12px sans-serif;color:#fff;background:'+bg+';border:3px solid rgba(255,255,255,.6);overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.5)';const t=document.createElement('span');t.style.cssText='position:relative;z-index:2;text-shadow:0 1px 3px #000;padding:0 4px;line-height:1.1';t.textContent=label;const cd=document.createElement('i');cd.style.cssText='position:absolute;left:0;right:0;bottom:0;height:0;background:rgba(0,0,0,.65);z-index:1';b.appendChild(cd);b.appendChild(t);ui.appendChild(b);b._cd=cd;b._t=t;return b};
  for(let i=0;i<4;i++){const m=W.me.moves[i];const b=mk(m?m.name:'-',m?(C.TCOL[m.type]||'#456'):'#333');btns.push(b)}
  // 배치: 2x2 + 구르기
  const place=(b,r,bt)=>{b.style.right=r+'px';b.style.bottom=bt+'px'};
  place(btns[0],12,12);place(btns[1],118,10);place(btns[2],104,98);place(btns[3],28,118);/* 9BA B배치: 큰 기본기 + 둘러싸기 */btns.forEach((b,i)=>{const z=i?68:92;b.style.width=b.style.height=z+'px'});
  const rb=mk('🌀','#37506e');place(rb,198,28);rb.style.width=rb.style.height='62px';
  const rcnt=document.createElement('div');rcnt.style.cssText='position:absolute;right:198px;bottom:96px;width:62px;text-align:center;color:#fff;font:bold 12px sans-serif;text-shadow:0 1px 3px #000';ui.appendChild(rcnt);
  let bb=null,bsw=null;
  if(C.balls){
    bb=mk('⚪','#5a3a3a');place(bb,198,128);bb.style.width=bb.style.height='58px';bb.style.fontSize='11px';
    bsw=document.createElement('div');bsw.textContent='🔄';bsw.style.cssText='position:absolute;right:262px;bottom:136px;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;font:16px sans-serif;display:none;align-items:center;justify-content:center;pointer-events:auto;border:2px solid rgba(255,255,255,.5)';ui.appendChild(bsw);
    bb.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();tryThrow()});
    bsw.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();W.ballSel=((W.ballSel||0)+1)%Math.max(1,ballList().length)});
  }
  // 9R: 나가기 · 교대 · 약 버튼을 크고 알아보기 쉽게 (게임 버튼 모양, 왼쪽 아래 한 줄)
  const SB=(ic,lb,bg)=>{const b=document.createElement('div');b.style.cssText='position:absolute;bottom:calc(10px + env(safe-area-inset-bottom));width:66px;height:58px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;pointer-events:auto;cursor:pointer;user-select:none;-webkit-user-select:none;background:'+bg+';border:3px solid #0a0d18;box-shadow:0 4px 0 #0a0d18,inset 0 0 0 2px rgba(255,255,255,.35),inset 0 -6px 0 rgba(0,0,0,.18);color:#fff;font:900 14px "Galmuri11",sans-serif;text-shadow:0 2px 0 #0a0d18;z-index:3';
    const i=document.createElement('div');i.textContent=ic;i.style.cssText='font-size:24px;line-height:26px';const t=document.createElement('div');t.textContent=lb;t.style.cssText='font-size:13px;line-height:15px;white-space:nowrap';
    const n=document.createElement('div');n.style.cssText='position:absolute;right:-8px;top:-10px;min-width:22px;padding:1px 5px;background:#ffd23f;color:#1c2550;border:2px solid #0a0d18;font:900 11px "Galmuri11",sans-serif;text-shadow:none;display:none;text-align:center';
    b.append(i,t,n);b._i=i;b._t=t;b._n=n;b._lb=lb;
    b.addEventListener('pointerdown',()=>{b.style.transform='translateY(3px)';b.style.boxShadow='0 1px 0 #0a0d18,inset 0 0 0 2px rgba(255,255,255,.35)'});
    const up=()=>{b.style.transform='';b.style.boxShadow='0 4px 0 #0a0d18,inset 0 0 0 2px rgba(255,255,255,.35),inset 0 -6px 0 rgba(0,0,0,.18)'};b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('pointerleave',up);
    ui.appendChild(b);return b};
  let sx=10;const place2=b=>{b.style.left='calc('+sx+'px + env(safe-area-inset-left))';sx+=72};
  const qb=SB('🏃',C.noQuit?'도망 불가':'나가기',C.noQuit?'#59607a':'#c0392b');place2(qb);W.qBtn=qb;
  // 6F-4a: 교대 버튼 + 파티 보기 패널(전투 일시정지). 실제 교체는 6F-4b
  if(C.party&&C.party().length>1){
    const sw=SB('🔄','교대','#2f6fd6');place2(sw);
    sw.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();openParty()});W.swBtn=sw;
  }
  // 6F-4c: 회복 아이템 버튼
  if(C.items&&C.useItem){
    const ib=SB('🧪','약','#1f9a55');place2(ib);
    ib.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();openItems()});W.itBtn=ib;
  }
  // 9BC: 테라스탈 버튼 (배틀마다 1번 · 기본 설정이 꺼져 있으면 안 보여요)
  try{if(C.teraOk&&C.teraOk()&&!C.net&&!C.pvp){const tb=SB('💎','테라스탈','#7a3fd0');place2(tb);tb.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();teraGo()});W.tBtn=tb;tb.style.display='none'}}catch(er){}
  try{if(C.gmOk&&!C.net&&!C.pvp){const gb=SB('🌋','거다이맥스','#c0392b');place2(gb);gb.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();gmGo(W.me)});W.gBtn=gb;gb.style.display='none'}}catch(er){}
  document.body.appendChild(root);
  W.root=root;W.cv=cv;W.ctx=cv.getContext('2d');W.ui={jb,jk,btns,rb,rcnt,bb,bsw};
  // 9BA: 구르기 버튼 대신 화면 아무 데나 쓱 밀면 그 방향으로 구르기 · 볼 버튼은 왼쪽 아래 줄로
  rb.style.display='none';
  rcnt.style.cssText='position:absolute;left:calc(10px + env(safe-area-inset-left));bottom:calc(82px + env(safe-area-inset-bottom));padding:3px 8px;background:rgba(10,13,24,.75);border:2px solid #ffd23f;color:#fff;font:900 12px "Galmuri11",sans-serif;pointer-events:none;white-space:nowrap';
  if(bb){bb.style.right='auto';bb.style.left='calc('+sx+'px + env(safe-area-inset-left))';bb.style.bottom='calc(10px + env(safe-area-inset-bottom))';bb.style.width=bb.style.height='58px';
    if(bsw){bsw.style.right='auto';bsw.style.left='calc('+(sx+40)+'px + env(safe-area-inset-left))';bsw.style.bottom='calc(56px + env(safe-area-inset-bottom))'}}
  {const SW={};const free=t=>t===cv||t===root||t===ui||jb.contains(t);
   root.addEventListener('pointerdown',ev=>{SW[ev.pointerId]={x:ev.clientX,y:ev.clientY,t:performance.now(),ok:free(ev.target)}},true);
   const end=ev=>{const s0=SW[ev.pointerId];delete SW[ev.pointerId];if(!s0||!s0.ok||W.over||W.paused)return;const dx=ev.clientX-s0.x,dy=ev.clientY-s0.y,d=Math.hypot(dx,dy),dt=performance.now()-s0.t;
     if(d>55&&dt<260){IN.rollDir={x:dx/d,y:dy/d};IN.roll=1}};
   root.addEventListener('pointerup',end,true);root.addEventListener('pointercancel',ev=>{delete SW[ev.pointerId]},true)}
  // 포인터
  const bindBtn=(b,i)=>{
    b.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();try{b.setPointerCapture(ev.pointerId)}catch(e){}
      if(i>=0)IN.hold[ev.pointerId]={i,sx:ev.clientX,sy:ev.clientY,x:ev.clientX,y:ev.clientY}});
    b.addEventListener('pointermove',ev=>{const h=IN.hold[ev.pointerId];if(h){h.x=ev.clientX;h.y=ev.clientY}});
    b.addEventListener('pointerup',ev=>{ev.preventDefault();
      if(i===-1){IN.roll=1;return}
      const h=IN.hold[ev.pointerId];delete IN.hold[ev.pointerId];if(!h)return;
      h.x=ev.clientX;h.y=ev.clientY;const a=holdAim(h);
      IN.press.push({i,aim:a.manual?a.dir:null,dist:a.manual?a.dist:null})});
    b.addEventListener('pointercancel',ev=>{delete IN.hold[ev.pointerId]});
  };
  btns.forEach((b,i)=>bindBtn(b,i));bindBtn(rb,-1);
  qb.addEventListener('pointerdown',ev=>{ev.stopPropagation();ev.preventDefault();if(W.over)return;if(C.noQuit){floatTxt(W.me.x,W.me.y-110,'트레이너 전투는 도망칠 수 없어요!','#ffd23f',true);return}setTimeout(()=>{if(W&&!W.over&&confirm(C.quitText||'전투에서 나갈까요?'))stop('quit')},30)});   // 6F-3: 트레이너 전투는 도망 금지 (9R: 숨기지 않고 '도망 불가'로 보여 줌)
  // 조이스틱 (화면 왼쪽 아무 데나)
  root.addEventListener('pointerdown',ev=>{
    if(W.over&&W.overT>.8){stop(W.over);return}
    if(ev.clientX>innerWidth*.55||IN.stick.on)return;
    IN.stick={on:1,id:ev.pointerId,sx:ev.clientX,sy:ev.clientY,x:0,y:0};
    jb.style.display='block';jb.style.left=ev.clientX+'px';jb.style.top=ev.clientY+'px';jk.style.left='50%';jk.style.top='50%'});
  root.addEventListener('pointermove',ev=>{
    if(!IN.stick.on||ev.pointerId!==IN.stick.id)return;
    let dx=ev.clientX-IN.stick.sx,dy=ev.clientY-IN.stick.sy;const R=55,L=Math.hypot(dx,dy);
    const k=Math.min(1,L/R);IN.stick.x=L?dx/L*k:0;IN.stick.y=L?dy/L*k:0;
    const sx=L>R?dx/L*R:dx,sy=L>R?dy/L*R:dy;jk.style.left=(50+sx/120*100)+'%';jk.style.top=(50+sy/120*100)+'%'});
  const up=ev=>{if(IN.stick.on&&ev.pointerId===IN.stick.id){IN.stick={on:0,id:null,sx:0,sy:0,x:0,y:0};jb.style.display='none'}};
  root.addEventListener('pointerup',up);root.addEventListener('pointercancel',up);
  // 키보드
  W.kd=e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(W.pp&&k!=='Escape'&&k!=='p')return;IN.keys[k]=1;
    if(k===' '){IN.roll=1;e.preventDefault()}
    const mk={q:0,w:1,e:2,r:3,'1':0,'2':1,'3':2,'4':3};
    if(k in mk&&!e.repeat)IN.press.push({i:mk[k],aim:null})
    if(k==='b'&&!e.repeat)tryThrow();
    if(k==='n'&&!e.repeat&&C.balls)W.ballSel=((W.ballSel||0)+1)%Math.max(1,ballList().length);
    if(k==='Escape'&&W.ip){closeItems();return}
    if(k==='i'&&!e.repeat&&C.items&&C.useItem){W.ip?closeItems():openItems();return}
    if(k==='Escape'&&W.pp){closeParty();return}
    if(k==='p'&&!e.repeat&&C.party&&C.party().length>1){W.pp?closeParty():openParty();return}
    if(k==='Escape'&&!W.over&&!C.noQuit)stop('quit')};
  W.ku=e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;IN.keys[k]=0};
  addEventListener('keydown',W.kd);addEventListener('keyup',W.ku);
  W.rs=()=>{const dpr=Math.min(1.5,devicePixelRatio||1)*(W.q||1);cv.width=Math.max(320,Math.round(innerWidth*dpr));cv.height=Math.max(180,Math.round(innerHeight*dpr))};   // 렉 줄이기: 기본 1.5배까지, 느리면 자동으로 더 낮춤
  W.rs();addEventListener('resize',W.rs);
}
// ---------- 10A: 왼쪽 교대 목록 (초상화 · 이름 · 한계돌파 별 · 각성 별 · 눌러서 바로 교체) ----------
function updPartyCol(){
  const w=W;if(!w||!w.root||w.over||!C.party||!C.pickMon)return;
  let col=w.pcol;
  if(!col){
    let L0=[];try{L0=C.party()||[]}catch(e){}
    if(L0.length<2)return;
    const ui=w.root.children[1];if(!ui)return;
    col=document.createElement('div');
    col.style.cssText='position:absolute;left:calc(6px + env(safe-area-inset-left));top:calc(64px + env(safe-area-inset-top));display:flex;flex-direction:column;gap:3px;pointer-events:none;z-index:3';
    ui.appendChild(col);w.pcol=col;col._sig='';
  }
  let L=[];try{L=C.party()||[]}catch(e){}
  const cur=w.me&&w.me.mon?w.me.mon.uid:null,cd=(w.swCd||0)>0;
  const rows=L.filter(q=>q.uid!==cur);
  let sig=(cd?'c':'n');
  for(const q of rows){let hp=0;try{hp=partyHp(q)}catch(e){}sig+='|'+q.uid+':'+(hp>0?Math.ceil(10*hp/Math.max(1,q.max)):0)}
  if(sig===col._sig)return;col._sig=sig;
  col.textContent='';
  for(const q of rows){
    let hp=0;try{hp=partyHp(q)}catch(e){}
    const dead=!(hp>0),can=!dead&&!cd;
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:5px;width:122px;padding:3px 5px;background:rgba(10,13,24,.8);border:2px solid '+(can?'#7fa6e8':'#3a4260')+';opacity:'+(dead?.45:cd?.65:1)+';pointer-events:auto;cursor:'+(can?'pointer':'default')+';font-family:"Galmuri11",sans-serif;box-sizing:border-box';
    const im=document.createElement('img');im.src=q.face||'';im.style.cssText='width:32px;height:32px;object-fit:contain;image-rendering:pixelated;flex:none';row.appendChild(im);
    const inf=document.createElement('div');inf.style.cssText='min-width:0;flex:1;display:flex;flex-direction:column;gap:1px';
    const nm=document.createElement('div');nm.textContent=q.name;nm.style.cssText='font:700 10px "Galmuri11",sans-serif;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';inf.appendChild(nm);
    const bar=document.createElement('div');bar.style.cssText='height:3px;background:#222';const bi=document.createElement('i');bi.style.cssText='display:block;height:100%;background:#3be06a;width:'+Math.max(0,Math.min(100,hp/Math.max(1,q.max)*100))+'%';bar.appendChild(bi);inf.appendChild(bar);
    const s1=document.createElement('div');s1.style.cssText='--sz:9px;line-height:0;height:11px;display:flex;align-items:center';s1.innerHTML=q.lbS||'';inf.appendChild(s1);   // 한계돌파+각성 통합 별 한 줄
    if(q.awS){const s2=document.createElement('div');s2.style.cssText='--sz:7px;line-height:0;height:9px;display:flex;align-items:center';s2.innerHTML=q.awS;inf.appendChild(s2)}
    row.appendChild(inf);
    row.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();if(can)doSwitch(q.uid)});
    col.appendChild(row);
  }
}
function updSide(){try{updPartyCol()}catch(er){}try{   // 9R: 교대·약 버튼에 남은 시간·개수 표시
  const sw=W.swBtn,ib=W.itBtn;
  if(sw){const c=W.swCd>0;sw.style.filter=c?'grayscale(.8) brightness(.75)':'';sw._t.textContent=c?Math.ceil(W.swCd)+'초':'교대'}
  if(ib){const c=W.itCd>0;let left=null;try{left=C.potLeft?C.potLeft():null}catch(e){}
    ib.style.filter=c||left===0?'grayscale(.8) brightness(.75)':'';ib._t.textContent=c?Math.ceil(W.itCd)+'초':'약';
    let tot=0,inf=0;for(const x of itemList()){if(x.count==='∞')inf=1;else tot+=(+x.count||0)}if(left!=null&&!inf)tot=Math.min(tot,left);
    const tx=inf?'∞':String(tot);if(ib._n.textContent!==tx){ib._n.textContent=tx}ib._n.style.display='block'}
}catch(e){}}
function updBtns(){updSide();
  const me=W.me,U=W.ui;if(!U)return;
  for(let i=0;i<4;i++){const b=U.btns[i],m=me.moves[i];if(!m)continue;const r=Math.min(1,me.cd[i]/me.cdMax[i]);b._cd.style.height=(r*100)+'%';b.style.opacity=canCast(me,i)?1:.75;
    // 6C-4 충전 개수(다단 기술)·PP 표시
    if(!b._n){b._n=document.createElement('b');b._n.style.cssText='position:absolute;z-index:3;left:0;right:0;bottom:3px;text-align:center;font:bold 10px sans-serif;color:#fff;text-shadow:0 1px 2px #000;pointer-events:none';b.appendChild(b._n)}
    const tx=(m.chg?'×'+me.ch[i]+' · ':'')+(m.ppMax>0?'PP '+me.pp[i]:m.id==='struggle'?'발버둥':'');if(b._n._t!==tx){b._n._t=tx;b._n.textContent=tx;b._n.style.color=m.ppMax>0&&me.pp[i]<=3?'#ff8a8a':'#fff'}}
  if(U.bb){const L=ballList(),sel=L[Math.min(W.ballSel||0,L.length-1)];
    const tx=sel?(sel.e||'⚪')+'\n'+(sel.count!=null?sel.count:''):'볼\n0';if(U.bb._tx!==tx){U.bb._tx=tx;U.bb.style.whiteSpace='pre';U.bb.innerHTML=tx.replace('\n','<br>');if(U.bb._cd)U.bb.insertBefore(U.bb._cd,U.bb.firstChild)}
    U.bb.style.opacity=(W.ball||W.ballCd>0||!sel)?.5:1;U.bsw.style.display=L.length>1?'flex':'none'}
  U.rb._cd.style.height=(me.rc>=1?0:(1-(me.rc%1))*100)+'%';U.rcnt.textContent='💨 구르기 '+Math.floor(me.rc)+'/2 · 화면을 쓱!';
}

// ---------- 실행 ----------
function stop(r){
  if(!W||W.stopped)return;W.stopped=1;window.__rtNoShadow=0;try{window.BEAMFX&&BEAMFX.clear()}catch(er){}cancelAnimationFrame(W.raf);
  removeEventListener('keydown',W.kd);removeEventListener('keyup',W.ku);removeEventListener('resize',W.rs);
  try{for(const p of W.proj)if(p.fxa)C.fxe.VFX.stop(p.fxa)}catch(er){}   // 9E: 날아가던 기술 그림(돌·소용돌이)이 다음 전투에 남던 문제
  if(fxOn()){try{for(let i=0;i<4;i++){C.fxe.VFX.update(3)}C.fxe.FX2.clear();C.fxe.VFX.clear&&C.fxe.VFX.clear()}catch(er){}}
  W.root.remove();IN.keys={};IN.stick={on:0,id:null,sx:0,sy:0,x:0,y:0};IN.press=[];IN.hold={};IN.roll=0;
  try{const hpBy=Object.assign({},W.hpBy);hpBy[W.me.mon.uid]=W.me.hp/(W.me.hm||1);window.RTB.last={r,meHp:W.me.hp/(W.me.hm||1),meMax:W.me.max/(W.me.hm||1),foeHp:W.foe.hp,foeMax:W.foe.max,time:W.time,meUid:W.me.mon.uid,hpBy,used:W.used.slice()}}catch(er){}   // 6F-2: 진짜 전투가 체력을 되받아 감
  const res=W.res;W=null;res(r);
}
// ===== 9BA 구르기 연습 (처음 한 번, 건너뛰기 없음) =====
const TUTN=3;
function tutStart(){W.tut={n:0};const o=document.createElement('div');o.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:30;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:calc(88px + env(safe-area-inset-top))';
  o.innerHTML='<style>@keyframes tutsw{0%{transform:translateX(-70px);opacity:0}15%{opacity:1}70%{transform:translateX(70px);opacity:1}100%{transform:translateX(70px);opacity:0}}@keyframes tutpop{0%{transform:scale(.6)}60%{transform:scale(1.15)}100%{transform:scale(1)}}</style>'+
   '<div style="background:rgba(10,13,24,.88);border:4px solid #ffd23f;box-shadow:0 5px 0 #000;padding:10px 18px;text-align:center;color:#fff;font:900 16px Galmuri11,sans-serif;max-width:86vw"><div style="color:#ffd23f;font-size:20px;margin-bottom:4px">💨 구르기 연습</div>화면 아무 데나 손가락으로 <b style="color:#7dff8a">쓱!</b> 밀면 그 방향으로 굴러요<br><small style="opacity:.85">구르는 순간엔 공격을 피할 수 있어요 · 전투 전에 꼭 연습해요</small>'+
   '<div class="tutc" style="margin-top:6px;font-size:22px;color:#ffd23f">0 / '+TUTN+'</div></div>'+
   '<div style="position:relative;width:200px;height:70px;margin-top:10px"><div style="position:absolute;left:50%;top:6px;margin-left:-26px;width:52px;height:52px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#ffe9a8);border:4px solid #1c2550;box-shadow:0 0 18px #ffd23f;animation:tutsw 1.2s ease-in-out infinite"></div></div>';
  W.root.appendChild(o);W.tutEl=o}
function tutRoll(){if(!W.tut)return;W.tut.n++;const c=W.tutEl&&W.tutEl.querySelector('.tutc');if(c){c.textContent=W.tut.n+' / '+TUTN;c.style.animation='none';void c.offsetWidth;c.style.animation='tutpop .3s'}
  try{C.sfx&&C.sfx('tap')}catch(e){}
  if(W.tut.n>=TUTN){const el=W.tutEl;W.tut=null;if(c)c.innerHTML='완벽해요! 이제 싸워요! ⚔';try{C.sfx&&C.sfx('badge')}catch(e){}try{C.onRollTut&&C.onRollTut()}catch(e){}setTimeout(()=>{try{el.remove()}catch(e){}},1300)}}
async function start(ctx){
  if(W)return 'quit';
  C=ctx;
  const [S1,S2]=await Promise.all([C.getSpr(C.sprKey(C.me)),C.getSpr(C.sprKey(C.foe))]);
  W={tick:0,time:0,hitstop:0,proj:[],zones:[],delays:[],chain:[],fx:[],clones:[],over:null,overT:0,hpBy:{},used:[C.me.uid],swCd:0,itCd:0};
  W.q=1;try{const sq=parseFloat(localStorage.getItem('pka-rtq'));if(sq>=.5&&sq<=1)W.q=sq}catch(er){}   // 렉 줄이기: 이 폰에서 배운 화면 품질
  try{C.fxe&&C.fxe.VFX.clear&&C.fxe.VFX.clear();C.fxe&&C.fxe.FX2.clear()}catch(er){}   // 9E: 지난 전투 그림 지우고 시작
  W.me=mkEnt(C.me,S1,0);W.foe=mkEnt(C.foe,S2,1);
  W.gx=null;try{if(C.gx&&window.GYMFX)W.gx=GYMFX.make(C.gx,{floatTxt,setAil,fmtN,kOf,cancelCast,rnd})}catch(er){console.warn('gymfx',er);W.gx=null}   // 1/3: 체육관 경기장 장치
  const AT=AI_T[C.aiTier]||AI_T.W;
  W.ai={T:AT,tier:AI_T[C.aiTier]?C.aiTier:'W',sawT:0,t:0,s:1,cd:1.2,range:240,tok:Math.min(AT.tokenCap,2),hes:0,burst:0,side:0,phase:'press',pt:rr(AT.pressMinSec,AT.pressMaxSec)};
  // AI 기본 사거리: 가진 기술 중 위력 높은 기술 기준
  const best=W.foe.moves.filter(m=>m.p>0).sort((a,b)=>b.p-a.p)[0];
  if(best)W.ai.range=best.k==='melee'?120:best.k==='pulse'?150:best.k==='leap'?170:300;
  W.autoOn=!!C.autoMe;try{if(!C.autoMe&&localStorage.getItem('pka-rtauto')==='1')W.autoOn=true}catch(er){}   // 9O: 전투 안 자동 버튼(한 번 켜면 다음 전투도 켜짐)
  W.aiMe=mkAi('ME');W.aiMe.uid=W.me.mon.uid;W.aiMe.range=aiRange(W.me);
  try{window.PKS&&(PKS.cry(C.foe,.85,250),PKS.cry(C.me,.85,1150))}catch(er){}
  buildUI();
  if(W.q<.85){window.__rtNoShadow=1;noShadowOn()}
  if(C.rollTut)tutStart();
  {W.fast=false;try{W.fast=(C.fast&&C.fast())||localStorage.getItem('pka-rtfast')==='1'}catch(er){}   // 9O: 전투 안 ⏩ 2배속 버튼
   const fb=document.createElement('div');fb.style.cssText='position:absolute;left:calc(50% + 82px);top:calc(44px + env(safe-area-inset-top));transform:translateX(-50%);padding:6px 12px;color:#fff;font:900 14px "Galmuri11",sans-serif;border:3px solid #0a0d18;box-shadow:0 3px 0 #0a0d18,inset 0 0 0 2px #56627f;pointer-events:auto;cursor:pointer;user-select:none;z-index:4;white-space:nowrap';
   const up=()=>{fb.textContent=W.fast?'⏩ 2배속 ON':'⏩ 2배속';fb.style.background=W.fast?'#e8a020':'#2a3256'};up();
   fb.addEventListener('pointerdown',ev=>{ev.stopPropagation();ev.preventDefault();W.fast=!W.fast;try{localStorage.setItem('pka-rtfast',W.fast?'1':'0');C.setFast&&C.setFast(W.fast)}catch(er){}up()});W.root.appendChild(fb);W.fastBtn=fb}
  {const ab=document.createElement('div');ab.style.cssText='position:absolute;left:50%;top:calc(44px + env(safe-area-inset-top));transform:translateX(-50%);padding:6px 14px;background:#2a3256;color:#fff;font:900 14px "Galmuri11",sans-serif;border:3px solid #0a0d18;box-shadow:0 3px 0 #0a0d18,inset 0 0 0 2px #56627f;pointer-events:auto;cursor:pointer;user-select:none;z-index:4;white-space:nowrap';
   const upd=()=>{ab.textContent=W.autoOn?'🤖 자동 ON':'🤖 자동 OFF';ab.style.background=W.autoOn?'#2bbf5a':'#2a3256';if(W.autoTag)W.autoTag.style.display=W.autoOn?'':'none'};
   ab.addEventListener('pointerdown',ev=>{ev.stopPropagation();ev.preventDefault();W.autoOn=!W.autoOn;W.manT=null;try{localStorage.setItem('pka-rtauto',W.autoOn?'1':'0')}catch(er){}upd()});W.root.appendChild(ab);W.autoBtn=ab;W.autoUpd=upd}
  {const t=document.createElement('div');t.style.cssText='position:absolute;left:50%;top:calc(8px + env(safe-area-inset-top));transform:translateX(-50%);padding:4px 12px;border-radius:8px;background:rgba(0,0,0,.55);color:#9bf0a8;font:bold 13px sans-serif;pointer-events:none;white-space:nowrap;border:2px solid #9bf0a8';W.root.appendChild(t);W.autoTag=t}
  {const t=document.createElement('div');t.style.cssText='position:absolute;left:6px;top:calc(8px + env(safe-area-inset-top));max-width:46vw;padding:3px 7px;border-radius:6px;background:rgba(0,0,0,.5);color:#cfe3ff;font:bold 11px "Galmuri11",sans-serif;line-height:1.35;pointer-events:none;z-index:4';
   const upd=()=>{if(!W||!W.me||!W.foe)return;const a=abNames(W.me),b=abNames(W.foe);t.innerHTML=(a?'🟦 내 특성 '+a:'')+(a&&b?'<br>':'')+(b?'🟥 상대 특성 '+b:'');t.style.display=(a||b)?'':'none'};upd();W.root.appendChild(t);W.abUpd=upd}   // ② 특성 이름 표시
  try{abEnter(W.me,W.foe);abEnter(W.foe,W.me);W.abUpd&&W.abUpd()}catch(er){}   // ② 특성 B: 등장 때 발동(위협·다운로드·트레이스 …)
  if(W.gx&&window.GYMFX&&GYMFX.info(C.gx)){const h=document.createElement('div');h.style.cssText='position:absolute;left:50%;top:calc(92px + env(safe-area-inset-top));transform:translateX(-50%);max-width:86vw;padding:6px 12px;background:rgba(10,13,24,.82);color:#ffe14a;font:900 13px "Galmuri11",sans-serif;border:3px solid #ffd23f;box-shadow:0 3px 0 #000;pointer-events:none;text-align:center;transition:opacity .8s;z-index:4';h.textContent='🏟 '+GYMFX.info(C.gx);W.root.appendChild(h);setTimeout(()=>{h.style.opacity='0'},7000);setTimeout(()=>{try{h.remove()}catch(er){}},8000)}
  return new Promise(res=>{
    W.res=res;let last=performance.now(),acc=0;
    const loop=now=>{
      if(!W||W.stopped)return;
      const raw=now-last;let dt=Math.min(.1,raw/1000);last=now;acc+=dt*(W.fast?2:1);let n=0;   // 9O: 2배속
      autoQ(raw);
      if(W.paused){acc=0}else while(acc>=TICK&&n<(W.fast?10:5)){update();acc-=TICK;n++;if(W.over)W.overT+=TICK}
      if(n>=(W.fast?10:5))acc=0;
      if(W.autoUpd&&W.autoBtn&&W.autoBtn._s!==W.autoOn){W.autoBtn._s=W.autoOn;W.autoUpd()}
      if(W.autoOn){if(W.over&&W.overT>1.6&&!W.pp&&!W.ip){stop(W.over);return}
        if(W.autoTag){const a=autoNow(),tx=a?'🤖 자동 전투 중 · 화면을 만지면 직접 조작':'✋ 직접 조작 중 · 손 떼면 자동';if(W.autoTag._t!==tx){W.autoTag._t=tx;W.autoTag.textContent=tx;W.autoTag.style.color=a?'#9bf0a8':'#ffd23f';W.autoTag.style.borderColor=a?'#9bf0a8':'#ffd23f'}}}
      if(fxOn()&&!W.paused){try{C.fxe.FX2.update(dt);C.fxe.VFX.update(dt)}catch(er){}}
      render();
      W.raf=requestAnimationFrame(loop)};
    W.raf=requestAnimationFrame(loop);
  });
}
window.RTB={_pop:(x,y,v,crit,sk)=>{if(W)dmgPop(x,y,null,'#fff',1,v,crit,sk)},start,_dbg:()=>W,_step:n=>{for(let i=0;i<n&&W&&!W.over;i++){update();}},_press:i=>IN.press.push({i,aim:null}),_stop:r=>stop(r||'quit')};
})();
