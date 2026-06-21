import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated as A, Easing, PanResponder } from 'react-native';
import { Zap, ChevronRight, Flame } from 'lucide-react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';

const { width: SW } = Dimensions.get('window');
const GW = Math.min(SW - 32, 380);
const GH = 480;
const VP_X = GW / 2;
const VP_Y = GH * 0.30;
const TW_BOT = GW * 0.46;
const TW_HOR = 10;

function tHalf(z: number) { return TW_HOR + z * (TW_BOT - TW_HOR); }
function sY(z: number) { return VP_Y + z * (GH - VP_Y); }
function lX(lane: number, z: number) { return VP_X + (lane - 1) * tHalf(z) * (2 / 3); }

const PLAYER_LANE_X = [lX(0,1), lX(1,1), lX(2,1)];
const PLAYER_Y = GH - 90;
const INIT_SPD = 0.009;
const SPAWN_INTERVAL = 110;

type Lane = 0|1|2;
type OT = 'barrier'|'wall'|'train';
type Obs = { id:number; z:number; lane:Lane; type:OT };
type Props = { onClose:()=>void; onPlayAgain?:()=>void };



const BLDGS = [
  {side:'L',dx:0,w:38,h:100},{side:'L',dx:44,w:28,h:70},{side:'L',dx:80,w:44,h:120},
  {side:'R',dx:0,w:40,h:90},{side:'R',dx:46,w:30,h:65},{side:'R',dx:82,w:48,h:110},
];

function ObstacleView({obs}:{obs:Obs}) {
  const sc = 0.12 + obs.z * 0.88;
  const cx = lX(obs.lane, obs.z);
  const sy = sY(obs.z);
  const bw = 46*sc, bh = 58*sc;
  const [c1,c2] = obs.type==='barrier'?['#FF6B35','#CC3300']:obs.type==='wall'?['#546E7A','#2E3B43']:['#B0BEC5','#546E7A'];
  return (
    <View style={{position:'absolute',left:cx-bw/2,top:sy-bh,width:bw,height:bh,
      backgroundColor:c1,borderRadius:4*sc,borderWidth:Math.max(1,1.5*sc),borderColor:c2,overflow:'hidden'}}>
      {obs.type==='train'&&<><View style={{position:'absolute',top:4*sc,left:3*sc,right:3*sc,height:10*sc,backgroundColor:'#1A2A3A',borderRadius:2}}/><View style={{position:'absolute',top:18*sc,left:3*sc,right:3*sc,height:10*sc,backgroundColor:'#1A2A3A',borderRadius:2}}/><View style={{position:'absolute',bottom:3*sc,left:5*sc,width:8*sc,height:8*sc,borderRadius:4*sc,backgroundColor:'#FF4444'}}/><View style={{position:'absolute',bottom:3*sc,right:5*sc,width:8*sc,height:8*sc,borderRadius:4*sc,backgroundColor:'#FF4444'}}/></>}
      {obs.type==='barrier'&&<><View style={{position:'absolute',top:8*sc,left:0,right:0,height:5*sc,backgroundColor:'#FFD700'}}/><View style={{position:'absolute',top:0,bottom:0,left:bw/2-2*sc,width:4*sc,backgroundColor:c2}}/></>}
      {obs.type==='wall'&&<>{[0,1,2].map(r=>[0,1].map(c=><View key={`${r}${c}`} style={{position:'absolute',left:c*22*sc+3*sc,top:r*16*sc+5*sc,width:18*sc,height:11*sc,backgroundColor:'#3E5260',borderRadius:2}}/>))}</>}
    </View>
  );
}

function Runner({runAnim}:{runAnim:A.Value}) {
  const l1=runAnim.interpolate({inputRange:[0,1],outputRange:['-22deg','22deg']});
  const l2=runAnim.interpolate({inputRange:[0,1],outputRange:['22deg','-22deg']});
  const a1=runAnim.interpolate({inputRange:[0,1],outputRange:['-18deg','18deg']});
  const a2=runAnim.interpolate({inputRange:[0,1],outputRange:['18deg','-18deg']});
  return (
    <View style={{width:34,height:62,alignItems:'center'}}>
      <View style={{width:18,height:18,borderRadius:9,backgroundColor:'#F4A460',borderWidth:1.5,borderColor:'#C07830'}}>
        <View style={{position:'absolute',top:0,left:0,right:0,height:8,backgroundColor:'#2A1408',borderTopLeftRadius:9,borderTopRightRadius:9}}/>
      </View>
      <View style={{width:30,height:18,backgroundColor:'#FF6B35',borderRadius:4,marginTop:1,borderWidth:1,borderColor:'#CC3300'}}>
        <View style={{position:'absolute',top:4,left:6,right:6,height:2,backgroundColor:'rgba(255,255,255,0.3)',borderRadius:1}}/>
        <View style={{position:'absolute',top:9,left:6,right:6,height:2,backgroundColor:'rgba(255,255,255,0.3)',borderRadius:1}}/>
      </View>
      <A.View style={[{position:'absolute',top:22,left:-1,width:7,height:16,backgroundColor:'#E05A25',borderRadius:3},{transform:[{rotate:a1}]}]}/>
      <A.View style={[{position:'absolute',top:22,right:-1,width:7,height:16,backgroundColor:'#E05A25',borderRadius:3},{transform:[{rotate:a2}]}]}/>
      <View style={{width:22,height:7,backgroundColor:'#1A2E4A',borderRadius:2}}/>
      <View style={{flexDirection:'row',gap:3,marginTop:1}}>
        <A.View style={[{width:9,height:20,backgroundColor:'#1A2E4A',borderRadius:3},{transform:[{rotate:l1}]}]}>
          <View style={{position:'absolute',bottom:0,left:0,right:0,height:6,backgroundColor:'#EEE',borderRadius:2}}/>
        </A.View>
        <A.View style={[{width:9,height:20,backgroundColor:'#1A2E4A',borderRadius:3},{transform:[{rotate:l2}]}]}>
          <View style={{position:'absolute',bottom:0,left:0,right:0,height:6,backgroundColor:'#EEE',borderRadius:2}}/>
        </A.View>
      </View>
    </View>
  );
}

export default function MetroRush({onClose,onPlayAgain}:Props) {
  const {endGameSession}=useAuth(); const {isExpired}=useTournament();
  const [phase,setPhase]=useState<'ready'|'playing'|'done'>('ready');
  const [score,setScore]=useState(0);
  const [obsState, setObsState] = useState([
    { active: false, lane: 1 as Lane, type: 'barrier' as OT },
    { active: false, lane: 1 as Lane, type: 'barrier' as OT },
    { active: false, lane: 1 as Lane, type: 'barrier' as OT },
    { active: false, lane: 1 as Lane, type: 'barrier' as OT },
  ]);
  const [flash,setFlash]=useState(false);
  const [curLane,setCurLane]=useState<Lane>(1);

  const laneRef=useRef<Lane>(1);
  const scoreRef=useRef(0); const tickRef=useRef(0);
  const spdRef=useRef(INIT_SPD);
  const loopRef=useRef<number|null>(null); const activeRef=useRef(false);
  const jumpingRef=useRef(false);
  const roadZRef=useRef(0);

  const obsStateRef = useRef(obsState);
  useEffect(() => {
    obsStateRef.current = obsState;
  }, [obsState]);

  // Static pool of 4 obstacles using Animated.Value
  const obsPool = useRef([
    { id: 0, zAnim: new A.Value(-1), zVal: -1 },
    { id: 1, zAnim: new A.Value(-1), zVal: -1 },
    { id: 2, zAnim: new A.Value(-1), zVal: -1 },
    { id: 3, zAnim: new A.Value(-1), zVal: -1 },
  ]).current;

  const playerX=useRef(new A.Value(PLAYER_LANE_X[1])).current;
  const jumpY=useRef(new A.Value(0)).current;
  const runAnim=useRef(new A.Value(0)).current;
  const glowAnim=useRef(new A.Value(0)).current;
  const resultScale=useRef(new A.Value(0)).current;

  useEffect(()=>{
    if(phase!=='ready') return;
    const a=A.loop(A.sequence([
      A.timing(glowAnim,{toValue:1,duration:1600,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
      A.timing(glowAnim,{toValue:0,duration:1600,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
    ]));
    a.start();
    return ()=>a.stop();
  },[phase]);

  useEffect(()=>{
    if(phase==='playing'){
      A.loop(A.timing(runAnim,{toValue:1,duration:340,easing:Easing.linear,useNativeDriver:true})).start();
    } else { runAnim.stopAnimation(); }
    if(phase==='done'){ A.spring(resultScale,{toValue:1,friction:4,tension:60,useNativeDriver:true}).start(); }
    else { resultScale.setValue(0); }
  },[phase]);

  const switchLane=useCallback((dir:-1|1)=>{
    const next=Math.max(0,Math.min(2,laneRef.current+dir)) as Lane;
    if(next===laneRef.current) return;
    laneRef.current=next; setCurLane(next);
    A.spring(playerX,{toValue:PLAYER_LANE_X[next],friction:9,tension:140,useNativeDriver:true}).start();
  },[]);

  const jump=useCallback(()=>{
    if(jumpingRef.current) return; jumpingRef.current=true;
    A.sequence([
      A.timing(jumpY,{toValue:-60,duration:220,easing:Easing.out(Easing.quad),useNativeDriver:true}),
      A.timing(jumpY,{toValue:0,duration:220,easing:Easing.in(Easing.quad),useNativeDriver:true}),
    ]).start(()=>{jumpingRef.current=false;});
  },[]);

  const pan=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:()=>true,
    onPanResponderRelease:(_,gs)=>{
      if(!activeRef.current) return;
      const ax=Math.abs(gs.dx),ay=Math.abs(gs.dy);
      if(ax>ay){ gs.dx>25?switchLane(1):switchLane(-1); }
      else if(gs.dy<-20){ jump(); }
    },
  })).current;

  const endGame=useCallback(()=>{
    activeRef.current=false;
    if(loopRef.current) cancelAnimationFrame(loopRef.current);
    setFlash(true); setTimeout(()=>setFlash(false),300); setPhase('done');
    endGameSession(scoreRef.current);
  },[endGameSession]);
  const frameSkipMR = useRef(0);
  const gameLoop=useCallback(()=>{
    if(!activeRef.current) return;

    // Throttle to ~30fps
    frameSkipMR.current = (frameSkipMR.current + 1) % 2;
    if(frameSkipMR.current !== 0) {
      loopRef.current=requestAnimationFrame(gameLoop);
      return;
    }

    tickRef.current++;
    if(tickRef.current%5===0){scoreRef.current++;setScore(scoreRef.current);spdRef.current=INIT_SPD+scoreRef.current*0.000055;}
    roadZRef.current = (roadZRef.current + spdRef.current * 1.5) % 1;

    if(tickRef.current%SPAWN_INTERVAL===0){
      const lane=Math.floor(Math.random()*3) as Lane;
      const types:OT[]=['barrier','wall','train'];
      const type = types[Math.floor(Math.random()*3)];
      
      const idx = obsPool.findIndex(o => o.zVal < 0);
      if (idx !== -1) {
        obsPool[idx].zVal = 0.02;
        obsPool[idx].zAnim.setValue(0.02);
        setObsState(prev => {
          const next = [...prev];
          next[idx] = { active: true, lane, type };
          return next;
        });
      }
    }

    let hit=false;
    const jv=(jumpY as any)._value??0;

    obsPool.forEach((o, idx) => {
      const stateObj = obsStateRef.current[idx];
      if (stateObj.active) {
        o.zVal += spdRef.current;
        o.zAnim.setValue(o.zVal);

        if (o.zVal > 0.85 && o.zVal < 1.05 && stateObj.lane === laneRef.current && jv > -30) {
          hit = true;
        }

        if (o.zVal > 1.06) {
          o.zVal = -1;
          o.zAnim.setValue(-1);
          setObsState(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], active: false };
            return next;
          });
        }
      }
    });

    if(hit){endGame();return;}
    loopRef.current=requestAnimationFrame(gameLoop);
  },[endGame]);

  const startGame=()=>{
    activeRef.current=true; laneRef.current=1; setCurLane(1);
    playerX.setValue(PLAYER_LANE_X[1]); jumpY.setValue(0);
    obsPool.forEach(o => {
      o.zVal = -1;
      o.zAnim.setValue(-1);
    });
    setObsState([
      { active: false, lane: 1, type: 'barrier' },
      { active: false, lane: 1, type: 'barrier' },
      { active: false, lane: 1, type: 'barrier' },
      { active: false, lane: 1, type: 'barrier' },
    ]);
    scoreRef.current=0; setScore(0);
    tickRef.current=0; spdRef.current=INIT_SPD;
    roadZRef.current=0;
    jumpingRef.current=false; setFlash(false); setPhase('playing');
    loopRef.current=requestAnimationFrame(gameLoop);
  };

  useEffect(()=>()=>{activeRef.current=false;if(loopRef.current)cancelAnimationFrame(loopRef.current);},[]);

  const titleOp=glowAnim.interpolate({inputRange:[0,1],outputRange:[0.5,1]});

  if(isExpired) return(
    <View style={s.c}><Text style={{color:colors.error,fontSize:16,fontWeight:'600'}}>Tournament ended!</Text>
    <TouchableOpacity style={s.ol} onPress={onClose}><Text style={s.olt}>Close</Text></TouchableOpacity></View>
  );

  if(phase==='ready') return(
    <View style={s.c}>
      <A.View style={{opacity:titleOp}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
          <Flame color="#FF6B35" size={26}/><Text style={s.title}>METRO RUSH</Text><Flame color="#FF6B35" size={26}/>
        </View>
      </A.View>
      <View style={s.card}>
        <Text style={s.cardHead}>How to Play</Text>
        <Text style={s.cardTx}><Text style={{color:'#FF6B35',fontWeight:'800'}}>Swipe LEFT / RIGHT</Text> to change lanes</Text>
        <Text style={s.cardTx}><Text style={{color:colors.neon,fontWeight:'800'}}>Swipe UP</Text> to jump over obstacles</Text>
        <Text style={s.cardTx}>Avoid barriers, walls and trains!</Text>
        <Text style={[s.cardTx,{color:colors.gold,marginTop:8}]}>⚡ Speed increases with distance!</Text>
      </View>
      <TouchableOpacity style={s.btn} onPress={startGame} activeOpacity={0.8}>
        <Text style={s.btnt}>START RUNNING</Text><ChevronRight color={colors.bgDeep} size={20}/>
      </TouchableOpacity>
      <TouchableOpacity style={s.ol} onPress={onClose}><Text style={s.olt}>Exit</Text></TouchableOpacity>
    </View>
  );

  if(phase==='done') return(
    <View style={s.c}>
      <A.View style={[s.rc,{transform:[{scale:resultScale}]}]}>
        <View style={s.crring}><Text style={{fontSize:38}}>🪦</Text></View>
        <Text style={s.rtitle}>WIPED OUT!</Text>
        <Text style={s.rscore}>{score}</Text>
        <Text style={s.rlbl}>METRES DASHED</Text>
        <View style={s.rstat}>
          <View style={s.si}><Text style={s.sn}>{spdRef.current.toFixed(2)}x</Text><Text style={s.sl}>SPEED</Text></View>
          <View style={s.sd}/><View style={s.si}><Text style={s.sn}>{obsPool.filter(o=>o.zVal>0).length}</Text><Text style={s.sl}>ON TRACK</Text></View>
        </View>
      </A.View>
      <TouchableOpacity style={s.btn} onPress={onPlayAgain||startGame} activeOpacity={0.8}>
        <Text style={s.btnt}>RUN AGAIN</Text><ChevronRight color={colors.bgDeep} size={20}/>
      </TouchableOpacity>
      <TouchableOpacity style={s.ol} onPress={onClose}><Text style={s.olt}>Exit</Text></TouchableOpacity>
    </View>
  );

  const offset = roadZRef.current;
  const numStrips = 12;
  const dynamicStrips = [];
  for (let i = -1; i < numStrips; i++) {
    const z0 = (i + offset) / numStrips;
    const z1 = (i + 1 + offset) / numStrips;
    const cz0 = Math.max(0, Math.min(1, z0));
    const cz1 = Math.max(0, Math.min(1, z1));
    if (cz1 <= cz0) continue;
    const zm = (cz0 + cz1) / 2;
    const y = sY(cz0);
    const h = sY(cz1) - sY(cz0);
    const w = tHalf(zm) * 2;
    const dark = (i % 2 === 0);
    dynamicStrips.push({ y, h, w, dark });
  }

  const numDividers = 8;
  const dynamicDividers = [];
  for (let i = 0; i < numDividers; i++) {
    const z = ((i + offset) % numDividers) / numDividers;
    if (z <= 0.02 || z >= 0.99) continue;
    dynamicDividers.push({
      y: sY(z) - 2,
      x1: lX(0, z) + tHalf(z) * (2 / 3) - 1,
      x2: lX(2, z) - tHalf(z) * (2 / 3) - 1,
      w: Math.max(1.5, 3.8 * z),
      h: Math.max(4, 22 * z),
    });
  }

  const numPillars = 4;
  const dynamicPillars = [];
  for (let i = 0; i < numPillars; i++) {
    const z = ((i + offset) % numPillars) / numPillars;
    if (z < 0.05 || z > 0.99) continue;
    const sc = 0.12 + z * 0.88;
    const sy = sY(z);
    const th = tHalf(z);
    const pw = 12 * sc;
    const ph = 80 * sc;
    const lx = VP_X - th - pw - 2;
    const rx = VP_X + th + 2;
    const ax = lx;
    const aw = rx + pw - lx;
    const ah = 6 * sc;
    const ay = sy - ph;
    dynamicPillars.push({ key: `p-${i}`, lx, rx, y: sy - ph, w: pw, h: ph, ax, aw, ah, ay, sc });
  }


  return(
    <View style={s.c}>
      <View style={s.hud}>
        <View style={{flexDirection:'row',alignItems:'baseline',gap:3}}>
          <Text style={s.hscore}>{score}</Text><Text style={s.hlbl}>M</Text>
        </View>
        <View style={s.sbadge}><Zap color="#FF6B35" size={11} fill="#FF6B35"/><Text style={s.stx}>{spdRef.current.toFixed(2)}x</Text></View>
        <View style={{flexDirection:'row',gap:6}}>
          {([0,1,2] as Lane[]).map(l=><View key={l} style={[s.lanedot,{backgroundColor:l===curLane?'#FF6B35':'#334'}]}/>)}
        </View>
      </View>

      <View style={[s.game,flash&&s.gflash]} {...pan.panHandlers}>
        {/* Sky */}
        <View style={s.sky}>
          <View style={s.moon}/>
          {[...Array(8)].map((_,i)=>(
            <View key={i} style={{position:'absolute',
              left:(i*97)%(GW+40)-20, top:(i*43)%((VP_Y)-10),
              width:i%4===0?2:1.5, height:i%4===0?2:1.5,
              borderRadius:2, backgroundColor:'#FFF', opacity:0.3+i%5*0.1}}/>
          ))}
          {BLDGS.map((b,i)=>{
            const left = b.side==='L' ? (VP_X - TW_BOT - b.dx - b.w - 4) : (VP_X + TW_BOT + b.dx + 4);
            return(
              <View key={i} style={{position:'absolute',bottom:0,left,width:b.w,height:b.h,
                backgroundColor:i%2===0?'#0A1525':'#081020',borderTopLeftRadius:4,borderTopRightRadius:4}}>
                {[...Array(Math.floor(b.h/22))].map((_,r)=>[...Array(Math.floor(b.w/15))].map((_,c)=>(
                  <View key={`${r}${c}`} style={{position:'absolute',top:5+r*20,left:3+c*13,
                    width:9,height:11,backgroundColor:(r*3+c)%3===0?'#FFD700':'transparent',opacity:0.55,borderRadius:1}}/>
                )))}
              </View>
            );
          })}
        </View>

        {/* Road strips */}
        {dynamicStrips.map((strip,i)=>(
          <View key={i} style={{position:'absolute',top:strip.y,
            left:VP_X-strip.w/2,width:strip.w,height:strip.h+1,
            backgroundColor:strip.dark?'#1C2030':'#202438'}}/>
        ))}

        {/* Lane dividers */}
        {dynamicDividers.map((d,i)=>(
          <React.Fragment key={i}>
            <View style={{position:'absolute',left:d.x1,top:d.y,width:d.w,height:d.h,backgroundColor:'rgba(255,255,255,0.18)',borderRadius:1}}/>
            <View style={{position:'absolute',left:d.x2,top:d.y,width:d.w,height:d.h,backgroundColor:'rgba(255,255,255,0.18)',borderRadius:1}}/>
          </React.Fragment>
        ))}

        {/* Road edges */}
        {dynamicStrips.map((strip,i)=>(
          <React.Fragment key={`e${i}`}>
            <View style={{position:'absolute',top:strip.y,left:VP_X-strip.w/2-3,width:3,height:strip.h+1,backgroundColor:'#FF6B35',opacity:0.5}}/>
            <View style={{position:'absolute',top:strip.y,left:VP_X+strip.w/2,width:3,height:strip.h+1,backgroundColor:'#FF6B35',opacity:0.5}}/>
          </React.Fragment>
        ))}

        {/* Side Pillars & Connecting Arches */}
        {dynamicPillars.map(p=>(
          <React.Fragment key={p.key}>
            {/* Left pillar */}
            <View style={{position:'absolute',left:p.lx,top:p.y,width:p.w,height:p.h,backgroundColor:'#4F5D73',borderColor:'#343E4F',borderWidth:Math.max(1,1.5*p.sc),borderRadius:2}}/>
            {/* Right pillar */}
            <View style={{position:'absolute',left:p.rx,top:p.y,width:p.w,height:p.h,backgroundColor:'#4F5D73',borderColor:'#343E4F',borderWidth:Math.max(1,1.5*p.sc),borderRadius:2}}/>
            {/* Connecting Overhead Arch */}
            <View style={{position:'absolute',left:p.ax,top:p.ay,width:p.aw,height:p.ah,backgroundColor:'#3A4454',borderRadius:2}}/>
          </React.Fragment>
        ))}

        {/* Obstacles - pool-based rendering */}
        {obsPool.map((p, idx) => {
          const st = obsState[idx];
          if (!st.active || p.zVal < 0) return null;
          const fakeObs = { id: p.id, z: p.zVal, lane: st.lane, type: st.type };
          return <ObstacleView key={p.id} obs={fakeObs}/>;
        })}

        {/* Player */}
        <A.View style={{position:'absolute',top:PLAYER_Y-31,
          transform:[{translateX:playerX},{translateX:-(34/2)},{translateY:jumpY}]}}>
          <View style={{position:'absolute',width:40,height:68,borderRadius:20,
            backgroundColor:'rgba(255,107,53,0.15)',top:-3,left:-3}}/>
          <Runner runAnim={runAnim}/>
          <View style={{width:30,height:6,borderRadius:15,backgroundColor:'rgba(0,0,0,0.35)',
            alignSelf:'center',marginTop:2}}/>
        </A.View>

        {/* Hint */}
        {tickRef.current<100&&(
          <View style={{position:'absolute',bottom:14,alignSelf:'center',
            backgroundColor:'rgba(255,107,53,0.15)',borderRadius:radius.full,
            paddingHorizontal:14,paddingVertical:5,borderWidth:1,borderColor:'rgba(255,107,53,0.3)'}}>
            <Text style={{color:'#FF6B35',fontSize:11,fontWeight:'800',letterSpacing:1}}>← SWIPE → TO DODGE</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s=StyleSheet.create({
  c:{flex:1,backgroundColor:colors.bg,alignItems:'center',justifyContent:'center',gap:14,padding:spacing.md},
  title:{color:'#FF6B35',fontSize:30,fontWeight:'900',letterSpacing:4,textShadowColor:'rgba(255,107,53,0.6)',textShadowOffset:{width:0,height:0},textShadowRadius:10},
  card:{backgroundColor:colors.bgCard,borderRadius:radius.lg,padding:18,borderWidth:1,borderColor:colors.border,width:Math.min(SW-64,340),alignItems:'center',gap:5},
  cardHead:{color:colors.textPrimary,fontSize:15,fontWeight:'800',marginBottom:4},
  cardTx:{color:colors.textSecondary,fontSize:13,textAlign:'center'},
  btn:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#FF6B35',paddingVertical:14,paddingHorizontal:32,borderRadius:radius.full,shadowColor:'#FF6B35',shadowOffset:{width:0,height:0},shadowOpacity:0.6,shadowRadius:12,elevation:8},
  btnt:{color:colors.bgDeep,fontSize:16,fontWeight:'900',letterSpacing:1},
  ol:{borderWidth:1.5,borderColor:colors.border,paddingVertical:10,paddingHorizontal:spacing.xl,borderRadius:radius.full},
  olt:{color:colors.textSecondary,fontSize:14,fontWeight:'600'},
  hud:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',width:GW,marginBottom:4},
  hscore:{color:'#FF6B35',fontSize:26,fontWeight:'900'},
  hlbl:{color:colors.textMuted,fontSize:11,fontWeight:'700'},
  sbadge:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'rgba(255,107,53,0.1)',borderRadius:radius.full,paddingHorizontal:8,paddingVertical:3,borderWidth:1,borderColor:'rgba(255,107,53,0.25)'},
  stx:{color:'#FF6B35',fontSize:10,fontWeight:'900',letterSpacing:0.5},
  lanedot:{width:10,height:10,borderRadius:5},
  game:{width:GW,height:GH,backgroundColor:'#040C18',borderRadius:radius.lg,borderWidth:2,borderColor:'#1A2E4A',overflow:'hidden',position:'relative'},
  gflash:{borderColor:colors.error,backgroundColor:'rgba(255,68,68,0.07)'},
  sky:{position:'absolute',top:0,left:0,right:0,height:VP_Y+10,backgroundColor:'#040C18',overflow:'hidden'},
  moon:{position:'absolute',top:14,right:22,width:22,height:22,borderRadius:11,backgroundColor:'#FFFDE0',shadowColor:'#FFFDE0',shadowOffset:{width:0,height:0},shadowOpacity:0.8,shadowRadius:8},
  rc:{backgroundColor:colors.bgCard,borderRadius:radius.xl,padding:26,alignItems:'center',gap:8,borderWidth:1,borderColor:colors.border,width:Math.min(SW-64,340),...shadow.card},
  crring:{width:80,height:80,borderRadius:40,backgroundColor:'rgba(255,107,53,0.1)',borderWidth:2,borderColor:'#FF6B35',alignItems:'center',justifyContent:'center',marginBottom:4},
  rtitle:{color:colors.textPrimary,fontSize:22,fontWeight:'900',letterSpacing:3},
  rscore:{color:'#FF6B35',fontSize:52,fontWeight:'900'},
  rlbl:{color:colors.textMuted,fontSize:11,fontWeight:'700',letterSpacing:2},
  rstat:{flexDirection:'row',alignItems:'center',gap:20,marginTop:4,backgroundColor:'rgba(0,0,0,0.2)',borderRadius:radius.md,paddingVertical:10,paddingHorizontal:24,borderWidth:1,borderColor:'#1A3A5C'},
  si:{alignItems:'center',gap:2}, sn:{color:colors.textPrimary,fontSize:18,fontWeight:'900'},
  sl:{color:colors.textMuted,fontSize:9,fontWeight:'800',letterSpacing:1},
  sd:{width:1,height:30,backgroundColor:colors.border},
});
