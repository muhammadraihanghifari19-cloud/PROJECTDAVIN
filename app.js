/* =========================================================
   FRAMELESS Â· Engine (standalone, mobile-first)
   ========================================================= */
(function () {
  "use strict";
  const SVGNS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);

  const svg = $("canvas");
  const layerPaths = $("layerPaths");
  const layerObjects = $("layerObjects");
  const btnPlay = $("btnPlay"), btnReset = $("btnReset"), btnExport = $("btnExport"), btnTheme = $("btnTheme");
  const scrubber = $("scrubber"), timeLabel = $("timeLabel");
  const stageHint = $("stageHint"), coordsEl = $("coords"), hintToast = $("hintToast");
  const statusObjects = $("statusObjects"), statusPoints = $("statusPoints");
  const scrim = $("scrim"), sheet = $("sheet"), btnSheet = $("btnSheet");

  /* ---- Controls dibuat sekali, lalu di-"mount" ke panel desktop ATAU sheet mobile ---- */
  // Kita buat satu set elemen kontrol dan taruh HTML-nya di kedua host via template string,
  // tapi untuk hindari duplikasi id, kita render per-host dan simpan referensi aktif.

  const state = { tool:"select", shape:"circle", points:[], objects:[], selectedId:null, playing:false, progress:0, rafId:null, lastTs:0 };
  let pathEl = null, uid = 1;

  const easings = {
    linear:(t)=>t, easeIn:(t)=>t*t, easeOut:(t)=>t*(2-t),
    easeInOut:(t)=>(t<0.5?2*t*t:-1+(4-2*t)*t),
    elastic:(t)=>{ if(t===0||t===1)return t; const p=0.3; return Math.pow(2,-10*t)*Math.sin(((t-p/4)*(2*Math.PI))/p)+1; },
    bounce:(t)=>{ const n1=7.5625,d1=2.75; if(t<1/d1)return n1*t*t; if(t<2/d1)return n1*(t-=1.5/d1)*t+0.75; if(t<2.5/d1)return n1*(t-=2.25/d1)*t+0.9375; return n1*(t-=2.625/d1)*t+0.984375; },
  };

  /* ===== Settings model (satu sumber kebenaran, UI disinkronkan) ===== */
  const settings = { duration:4, easing:"easeInOut", loop:true, orient:false, trail:true, objSize:28, objColor:"#F5F749" };

  function toSvgPoint(evt) {
    const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
    const ctm = svg.getScreenCTM(); if (!ctm) return { x:0, y:0 };
    const inv = pt.matrixTransform(ctm.inverse());
    return { x:Math.round(inv.x), y:Math.round(inv.y) };
  }
  function el(tag, attrs) { const n = document.createElementNS(SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; }

  function buildPathD(points) {
    if (points.length < 2) return "";
    if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i=0;i<points.length-1;i++) {
      const p0=points[i-1]||points[i], p1=points[i], p2=points[i+1], p3=points[i+2]||p2;
      const c1x=p1.x+(p2.x-p0.x)/6, c1y=p1.y+(p2.y-p0.y)/6, c2x=p2.x-(p3.x-p1.x)/6, c2y=p2.y-(p3.y-p1.y)/6;
      d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
    }
    return d;
  }
  function starPoints(r) { const pts=[]; for(let i=0;i<10;i++){const rad=(Math.PI/5)*i-Math.PI/2,rr=i%2===0?r:r*0.45;pts.push(`${(Math.cos(rad)*rr).toFixed(1)},${(Math.sin(rad)*rr).toFixed(1)}`);} return pts.join(" "); }
  function makeShapeEl(shape, size, color) {
    const r = size/2;
    switch (shape) {
      case "square": return el("rect",{x:-r,y:-r,width:size,height:size,rx:size*0.12,fill:color});
      case "triangle": return el("polygon",{points:`0,${-r} ${r},${r} ${-r},${r}`,fill:color});
      case "diamond": return el("polygon",{points:`0,${-r} ${r},0 0,${r} ${-r},0`,fill:color});
      case "star": return el("polygon",{points:starPoints(r),fill:color});
      case "ring": return el("circle",{cx:0,cy:0,r:r,fill:"none",stroke:color,"stroke-width":Math.max(3,size*0.18)});
      default: return el("circle",{cx:0,cy:0,r:r,fill:color});
    }
  }

  function renderPath() {
    layerPaths.innerHTML = ""; pathEl = null;
    const d = buildPathD(state.points);
    if (d) {
      if (settings.trail) layerPaths.appendChild(el("path",{d,class:"mp-trail",stroke:"var(--accent-4)","stroke-width":10}));
      pathEl = el("path",{d,class:"mp-path"}); layerPaths.appendChild(pathEl);
    }
    state.points.forEach((p,i)=>layerPaths.appendChild(el("circle",{cx:p.x,cy:p.y,r:9,class:"mp-node","data-i":i})));
    if (statusPoints) statusPoints.textContent = `Titik jalur: ${state.points.length}`;
  }

  function addObject(pt) {
    const obj = { id:uid++, shape:state.shape, size:settings.objSize, color:settings.objColor, start:0, home:{x:pt.x,y:pt.y} };
    state.objects.push(obj); state.selectedId = obj.id; renderObjects(); syncObjUI();
  }
  function renderObjects() {
    layerObjects.innerHTML = "";
    state.objects.forEach((obj)=>{
      const g = el("g",{class:"mp-obj","data-id":obj.id});
      g.appendChild(makeShapeEl(obj.shape,obj.size,obj.color));
      if (obj.id===state.selectedId) g.appendChild(el("circle",{cx:0,cy:0,r:obj.size/2+8,class:"sel-ring"}));
      obj.el = g; layerObjects.appendChild(g);
    });
    if (statusObjects) statusObjects.textContent = `Objek: ${state.objects.length}`;
    positionObjects(state.progress);
  }
  function positionObjects(globalT) {
    const hasPath = pathEl && state.points.length>=2;
    let totalLen = 0;
    if (hasPath) { try { totalLen = pathEl.getTotalLength(); } catch(e){ totalLen = 0; } }
    const easeFn = easings[settings.easing] || easings.linear;
    state.objects.forEach((obj)=>{
      if (!obj.el) return;
      if (hasPath && totalLen>0) {
        let t=(globalT+obj.start)%1; if(t<0)t+=1;
        const eased=Math.min(1,Math.max(0,easeFn(t)));
        const point=pathEl.getPointAtLength(eased*totalLen);
        let angle=0;
        if (settings.orient){ const ahead=pathEl.getPointAtLength(Math.min(totalLen,eased*totalLen+1)); angle=Math.atan2(ahead.y-point.y,ahead.x-point.x)*(180/Math.PI); }
        obj.el.setAttribute("transform",`translate(${point.x} ${point.y}) rotate(${angle})`);
      } else {
        obj.el.setAttribute("transform",`translate(${obj.home.x} ${obj.home.y})`);
      }
    });
  }

  function tick(ts) {
    if (!state.playing) return;
    if (!state.lastTs) state.lastTs = ts;
    const dt=(ts-state.lastTs)/1000; state.lastTs=ts;
    state.progress += dt/(settings.duration||4);
    if (state.progress>=1){ if(settings.loop) state.progress=state.progress%1; else { state.progress=1; stop(); } }
    syncScrubber(); positionObjects(state.progress);
    if (state.playing) state.rafId = requestAnimationFrame(tick);
  }
  function play() {
    if (state.objects.length===0 || state.points.length<2){ toast("Butuh minimal 1 objek & jalur 2+ titik untuk memutar."); return; }
    state.playing=true; state.lastTs=0; btnPlay.textContent="â¸"; state.rafId=requestAnimationFrame(tick);
  }
  function stop() { state.playing=false; btnPlay.textContent="â–¶"; if(state.rafId)cancelAnimationFrame(state.rafId); state.rafId=null; }
  function togglePlay(){ state.playing?stop():play(); }
  function resetAnim(){ stop(); state.progress=0; syncScrubber(); positionObjects(0); }
  function syncScrubber(){ scrubber.value=Math.round(state.progress*1000); timeLabel.textContent=Math.round(state.progress*100)+"%"; }

  function getSelected(){ return state.objects.find((o)=>o.id===state.selectedId)||null; }

  function setTool(tool) {
    state.tool = tool;
    document.querySelectorAll(".tool[data-tool]").forEach((b)=>b.classList.toggle("is-active", b.dataset.tool===tool));
    const labels={select:"Pilih",path:"Jalur",object:"Objek",erase:"Hapus"};
    stageHint.textContent = labels[tool]||tool;
    svg.style.cursor = tool==="select"?"default":"crosshair";
    const tips={ path:"Mode Jalur â€” tap di kanvas untuk menambah titik.", object:"Mode Objek â€” tap untuk menempel objek.", erase:"Mode Hapus â€” tap objek/titik untuk menghapus.", select:"Mode Pilih â€” tahan & geser objek atau titik." };
    toast(tips[tool]);
  }
  let toastTimer=null;
  function toast(msg){ hintToast.innerHTML=msg; hintToast.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>hintToast.classList.remove("show"),2200); }

  /* ===== Interaksi kanvas ===== */
  svg.addEventListener("click",(evt)=>{
    const pt=toSvgPoint(evt);
    if (state.tool==="path"){ state.points.push(pt); renderPath(); positionObjects(state.progress); }
    else if (state.tool==="object"){ addObject(pt); }
  });

  svg.addEventListener("pointerdown",(evt)=>{
    const objG=evt.target.closest(".mp-obj"), node=evt.target.closest(".mp-node");
    if (state.tool==="erase"){
      if (objG){ const id=parseInt(objG.dataset.id,10); state.objects=state.objects.filter((o)=>o.id!==id); if(state.selectedId===id)state.selectedId=null; renderObjects(); syncObjUI(); }
      else if (node){ const i=parseInt(node.dataset.i,10); state.points.splice(i,1); renderPath(); positionObjects(state.progress); }
      return;
    }
    if (state.tool==="select"){
      if (objG){ state.selectedId=parseInt(objG.dataset.id,10); renderObjects(); syncObjUI(); startDrag(evt,"obj"); }
      else if (node){ startDrag(evt,"node",parseInt(node.dataset.i,10)); }
      else { state.selectedId=null; renderObjects(); syncObjUI(); }
    }
  });

  function startDrag(evt, kind, index) {
    evt.preventDefault();
    const pid=evt.pointerId;
    try { svg.setPointerCapture(pid); } catch(e){}
    const o = kind==="obj" ? getSelected() : null;
    if (kind==="obj" && !o) return;
    const move=(e)=>{
      if (e.pointerId!==pid) return;
      const pt=toSvgPoint(e);
      if (kind==="obj"){ o.home={x:pt.x,y:pt.y}; positionObjects(state.progress); }
      else { if(state.points[index]){ state.points[index]=pt; renderPath(); positionObjects(state.progress); } }
    };
    const up=(e)=>{
      if (e.pointerId!==pid) return;
      svg.removeEventListener("pointermove",move);
      svg.removeEventListener("pointerup",up);
      svg.removeEventListener("pointercancel",up);
      try { svg.releasePointerCapture(pid); } catch(err){}
    };
    svg.addEventListener("pointermove",move);
    svg.addEventListener("pointerup",up);
    svg.addEventListener("pointercancel",up);
  }

  svg.addEventListener("pointermove",(evt)=>{ const pt=toSvgPoint(evt); coordsEl.textContent=`x:${pt.x} y:${pt.y}`; });

  /* ===== Tool buttons (mobile + desktop share data-tool) ===== */
  document.querySelectorAll(".tool[data-tool]").forEach((b)=>b.addEventListener("click",()=>setTool(b.dataset.tool)));

  /* ===== Transport ===== */
  btnPlay.addEventListener("click",togglePlay);
  btnReset.addEventListener("click",resetAnim);
  scrubber.addEventListener("input",()=>{ stop(); state.progress=parseInt(scrubber.value,10)/1000; timeLabel.textContent=Math.round(state.progress*100)+"%"; positionObjects(state.progress); });
  btnTheme.addEventListener("click",()=>{ document.body.classList.toggle("theme-solar"); buildPalettes(); renderPath(); renderObjects(); });

  btnExport.addEventListener("click",()=>{
    const data={ project:"FRAMELESS Motion Path Animation Studio", version:1, exportedAt:new Date().toISOString(),
      animation:{duration:settings.duration,easing:settings.easing,loop:settings.loop,orient:settings.orient,trail:settings.trail},
      path:state.points, objects:state.objects.map((o)=>({shape:o.shape,size:o.size,color:o.color,start:o.start,home:o.home})) };
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url; a.download="frameless-motion.json"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  });

  /* ===== Bottom sheet (mobile) ===== */
  function openSheet(){ sheet.classList.add("open"); scrim.classList.add("open"); }
  function closeSheet(){ sheet.classList.remove("open"); scrim.classList.remove("open"); }
  btnSheet.addEventListener("click",openSheet);
  scrim.addEventListener("click",closeSheet);
  document.querySelectorAll(".sheet__tab").forEach((t)=>t.addEventListener("click",()=>{
    const page=t.dataset.page;
    document.querySelectorAll(".sheet__tab").forEach((x)=>x.classList.toggle("is-active",x===t));
    document.querySelectorAll(".sheet__page").forEach((p)=>p.classList.toggle("is-active",p.dataset.page===page));
  }));
  // tutup sheet dengan swipe-down pada handle
  (function(){
    const grab=$("sheetGrab"); let startY=null;
    grab.addEventListener("pointerdown",(e)=>{ startY=e.clientY; });
    grab.addEventListener("pointerup",(e)=>{ if(startY!==null && e.clientY-startY>40) closeSheet(); startY=null; });
  })();

  /* ===== Build shape choosers (ada di rail desktop & sheet mobile) ===== */
  const SHAPES=[["circle","â—"],["square","â– "],["triangle","â–²"],["star","â˜…"],["ring","â—Ž"],["diamond","â—†"]];
  function buildShapeHosts(){
    document.querySelectorAll("[data-shapehost]").forEach((host)=>{
      host.innerHTML="";
      SHAPES.forEach(([name,glyph])=>{
        const b=document.createElement("button");
        b.className="shape"+(name===state.shape?" is-active":"");
        b.textContent=glyph; b.setAttribute("data-shape",name); b.setAttribute("aria-label",name);
        b.addEventListener("click",()=>{
          state.shape=name;
          document.querySelectorAll(".shape").forEach((s)=>s.classList.toggle("is-active",s.getAttribute("data-shape")===name));
          const o=getSelected(); if(o){ o.shape=name; renderObjects(); }
        });
        host.appendChild(b);
      });
    });
  }

  /* ===== Build control panels (anim / obj / design) untuk desktop & mobile ===== */
  function panelAnimHTML(sfx){ return `
    <div class="panel__title">Animasi</div>
    <label class="field"><span class="field__label">Durasi (detik)</span>
      <input type="range" min="0.5" max="12" step="0.1" data-bind="duration" />
      <output class="field__out" data-out="duration"></output></label>
    <label class="field"><span class="field__label">Easing</span>
      <select data-bind="easing">
        <option value="linear">Linear</option><option value="easeInOut">Ease In-Out</option>
        <option value="easeIn">Ease In</option><option value="easeOut">Ease Out</option>
        <option value="elastic">Elastic</option><option value="bounce">Bounce</option>
      </select></label>
    <label class="field field--check"><input type="checkbox" data-bind="loop" /><span>Ulang terus (loop)</span></label>
    <label class="field field--check"><input type="checkbox" data-bind="orient" /><span>Rotasi mengikuti arah jalur</span></label>
    <label class="field field--check"><input type="checkbox" data-bind="trail" /><span>Jejak gerak (motion trail)</span></label>`; }
  function panelObjHTML(){ return `
    <div class="panel__title">Objek Terpilih</div>
    <label class="field"><span class="field__label">Ukuran</span>
      <input type="range" min="8" max="90" step="1" data-bind="objSize" />
      <output class="field__out" data-out="objSize"></output></label>
    <label class="field"><span class="field__label">Warna</span>
      <input type="color" data-bind="objColor" /></label>
    <p class="panel__note" data-objnote>Tidak ada objek terpilih.</p>`; }
  function panelDesignHTML(){ return `
    <div class="panel__title">Design System</div>
    <div class="palette" data-palettehost></div>
    <div class="type-scale">
      <p class="ts ts--xl">Aa</p>
      <p class="ts ts--lg">Display Â· 2.618rem</p>
      <p class="ts ts--md">Judul Â· 1.618rem</p>
      <p class="ts ts--sm">Teks Â· 1rem Â· ratio Ï† (1.618)</p>
    </div>`; }

  function mountPanels(){
    document.querySelectorAll('[data-panelhost]').forEach((host)=>{
      const key=host.getAttribute("data-panelhost");
      if (key.startsWith("anim")) host.innerHTML=panelAnimHTML();
      else if (key.startsWith("obj")) host.innerHTML=panelObjHTML();
      else if (key.startsWith("design")) host.innerHTML=panelDesignHTML();
    });
    wireBindings();
    buildPalettes();
    syncAllBindings();
    syncObjUI();
  }

  /* ===== Two-way binding: semua kontrol dengan data-bind sinkron ke settings ===== */
  function wireBindings(){
    document.querySelectorAll("[data-bind]").forEach((input)=>{
      const key=input.getAttribute("data-bind");
      const evt=(input.type==="checkbox"||input.tagName==="SELECT")?"change":"input";
      input.addEventListener(evt,()=>{
        if (input.type==="checkbox") settings[key]=input.checked;
        else if (input.type==="range") settings[key]=parseFloat(input.value);
        else settings[key]=input.value;
        applySetting(key);
        syncBindingPeers(key, input);
      });
    });
  }
  function syncBindingPeers(key, source){
    document.querySelectorAll(`[data-bind="${key}"]`).forEach((input)=>{
      if (input===source) return;
      if (input.type==="checkbox") input.checked=settings[key];
      else input.value=settings[key];
    });
    document.querySelectorAll(`[data-out="${key}"]`).forEach((out)=>out.textContent=outText(key));
  }
  function syncAllBindings(){
    for (const key in settings){
      document.querySelectorAll(`[data-bind="${key}"]`).forEach((input)=>{
        if (input.type==="checkbox") input.checked=settings[key];
        else input.value=settings[key];
      });
      document.querySelectorAll(`[data-out="${key}"]`).forEach((out)=>out.textContent=outText(key));
    }
  }
  function outText(key){
    if (key==="duration") return parseFloat(settings.duration).toFixed(1)+"s";
    if (key==="objSize") return settings.objSize+"px";
    return settings[key];
  }
  function applySetting(key){
    if (key==="trail"){ renderPath(); positionObjects(state.progress); }
    else if (key==="orient"||key==="easing"){ positionObjects(state.progress); }
    else if (key==="objSize"){ const o=getSelected(); if(o){ o.size=settings.objSize; renderObjects(); } }
    else if (key==="objColor"){ const o=getSelected(); if(o){ o.color=settings.objColor; renderObjects(); } }
  }
  function syncObjUI(){
    const o=getSelected();
    document.querySelectorAll("[data-objnote]").forEach((n)=>{
      n.textContent = o ? `Terpilih: ${o.shape} Â· ukuran ${o.size}px` : "Tidak ada objek terpilih.";
    });
    if (o){
      settings.objSize=o.size; settings.objColor=o.color;
      syncBindingPeers("objSize"); syncBindingPeers("objColor");
    }
  }

  function buildPalettes(){
    const styles=getComputedStyle(document.body);
    const vals=["--accent","--accent-2","--accent-3","--accent-4"].map((v)=>styles.getPropertyValue(v).trim()||"#000");
    document.querySelectorAll("[data-palettehost]").forEach((host)=>{
      host.innerHTML="";
      vals.forEach((hex)=>{
        const sw=document.createElement("div");
        sw.className="swatch"; sw.style.background=hex; sw.setAttribute("data-hex",hex);
        sw.addEventListener("click",()=>{
          if (hex.length===7){ settings.objColor=hex; syncBindingPeers("objColor"); const o=getSelected(); if(o){ o.color=hex; renderObjects(); } }
        });
        host.appendChild(sw);
      });
    });
  }

  /* ===== Keyboard (desktop) ===== */
  window.addEventListener("keydown",(e)=>{
    if (["INPUT","SELECT","TEXTAREA"].includes(e.target.tagName)) return;
    const map={v:"select",p:"path",o:"object",e:"erase"};
    if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
    if (e.code==="Space"){ e.preventDefault(); togglePlay(); }
    if (e.key==="Delete"||e.key==="Backspace"){ const o=getSelected(); if(o){ state.objects=state.objects.filter((x)=>x.id!==o.id); state.selectedId=null; renderObjects(); syncObjUI(); } }
  });

  /* ===== viewBox adaptif: ikut rasio area kanvas supaya isi mengisi penuh =====
     Kita jaga TINGGI logis tetap (VBH), lalu LEBAR logis dihitung dari rasio layar.
     Dengan begini: di HP portrait kanvas jadi "tinggi" (bukan melar landscape),
     di desktop jadi "lebar". Bentuk objek tetap bulat karena skala x & y sama. */
  const VBH = 1000;                 // tinggi logis tetap
  let VBW = 1500;                   // lebar logis (dihitung ulang saat resize)
  const wrap = $("canvasWrap");

  function updateViewBox(){
    const rect = wrap.getBoundingClientRect();
    const ratio = (rect.width > 0 && rect.height > 0) ? (rect.width / rect.height) : 1.5;
    VBW = Math.round(VBH * ratio);
    svg.setAttribute("viewBox", `0 0 ${VBW} ${VBH}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  }

  /* ===== Demo awal (relatif terhadap VBW/VBH, jadi pas di portrait & landscape) ===== */
  function seedDemo(){
    const X = (fx) => Math.round(fx * VBW);
    const Y = (fy) => Math.round(fy * VBH);
    state.points = [
      { x:X(.12), y:Y(.72) }, { x:X(.30), y:Y(.28) }, { x:X(.50), y:Y(.66) },
      { x:X(.70), y:Y(.26) }, { x:X(.88), y:Y(.70) },
    ];
    renderPath();
    const c=["#F5F749","#FF4D6D","#4DE1FF"], s=["circle","star","diamond"];
    const base = Math.round(VBH * 0.03);   // ukuran objek proporsional
    for (let i=0;i<3;i++) state.objects.push({ id:uid++, shape:s[i], size:base+i*6, color:c[i], start:i/3, home:{x:X(.12),y:Y(.72)} });
    renderObjects();
  }

  /* saat ukuran layar berubah (rotasi HP / resize), sesuaikan viewBox */
  let resizeTimer=null;
  window.addEventListener("resize", ()=>{
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(()=>{ updateViewBox(); positionObjects(state.progress); }, 120);
  });

  function init(){
    buildShapeHosts();
    mountPanels();
    setTool("select");
    updateViewBox();     // tentukan viewBox dulu sebelum seed demo
    seedDemo();
    syncScrubber();
    setTimeout(play,400);
  }

  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);
  else init();
})();
