(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))a(r);new MutationObserver(r=>{for(const e of r)if(e.type==="childList")for(const l of e.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&a(l)}).observe(document,{childList:!0,subtree:!0});function n(r){const e={};return r.integrity&&(e.integrity=r.integrity),r.referrerPolicy&&(e.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?e.credentials="include":r.crossOrigin==="anonymous"?e.credentials="omit":e.credentials="same-origin",e}function a(r){if(r.ep)return;r.ep=!0;const e=n(r);fetch(r.href,e)}})();function B(o,t){if(o===t)return null;let n=0;const a=Math.min(o.length,t.length);for(;n<a&&o[n]===t[n];)n+=1;let r=o.length,e=t.length;for(;r>n&&e>n&&o[r-1]===t[e-1];)r-=1,e-=1;return{start:n,removedLen:r-n,insertedLen:e-n}}function G(o,t){if(!t)return{...o};const{start:n,removedLen:a,insertedLen:r}=t,e=r-a,l={};for(const[u,s]of Object.entries(o)){const f=Number(u);if(!(!Number.isFinite(f)||s==null||String(s).trim()===""))if(f<n)l[f]=s;else{if(f<n+a)continue;l[f+e]=s}}return l}function N(o){if(!o||typeof o!="object"||Array.isArray(o))return{};const t={};for(const[n,a]of Object.entries(o)){const r=Number(n);if(!Number.isFinite(r)||r<0)continue;const e=String(a).trim();e&&(t[r]=e)}return t}function D(o){return o.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function K(){return String.raw`ui-monospace, "Cascadia Mono", "Segoe UI Mono", "Noto Sans Mono", "Liberation Mono", monospace`}function Z(){return String.raw`system-ui, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`}function Q(o,t,n){const a=N(t),r=o.split(`
`),e=[];let l=0;for(let u=0;u<r.length;u++){const s=r[u],f=[];for(let h=0;h<s.length;h++){const g=l+h,c=s[h],C=a[g]?D(a[g]):"";f.push(`<span class="cell"><span class="chord-slot">${C}</span><span class="glyph">${D(c)}</span></span>`)}e.push(`<div class="line">${f.join("")}</div>`),l+=s.length,u<r.length-1&&(l+=1)}return e.length===0&&e.push('<div class="line"></div>'),`<div class="lyric-with-chords" style="font-size:${n.lyricFontSize}px">${e.join("")}</div>`}function W(o,t,n={}){var l;const a=D(((l=n.title)==null?void 0:l.trim())||"Lyrics & chords"),r=t.useMonospace?K():Z(),e=o.map(u=>{const s=u.dir==="rtl"?"rtl":"ltr",f=Q(u.lyrics??"",u.chords??{},t);return`<section class="block" dir="${s}">${f}</section>`}).join(`
`);return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${a}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 1.25rem 1.5rem 2rem;
      font-family: ${r};
      background: #fff;
      color: #111;
      line-height: 1.4;
    }
    h1 {
      font-family: system-ui, "Segoe UI", sans-serif;
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 1.25rem;
      border-bottom: 1px solid #ccc;
      padding-bottom: 0.5rem;
    }
    .block {
      margin-bottom: 0.75rem;
      page-break-inside: avoid;
    }
    .lyric-with-chords {
      min-height: ${t.lyricMinHeight}px;
      color: #111;
    }
    .line {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      min-height: calc(${t.chordMinHeight}px + 1em);
      margin-bottom: 0.15rem;
    }
    .cell {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      vertical-align: bottom;
    }
    .chord-slot {
      min-height: ${t.chordMinHeight}px;
      font-size: ${t.chordFontSize}px;
      font-weight: 600;
      color: #9a3412;
      white-space: nowrap;
      line-height: 1.1;
      padding-bottom: 0.1rem;
    }
    .glyph {
      font-family: inherit;
      white-space: pre;
    }
    @media print {
      body { padding: 0; }
      h1 { border-bottom-color: #999; }
      .chord-slot { color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    @page { margin: 14mm; }
  </style>
</head>
<body>
  <h1>${a}</h1>
  <main>
${e}
  </main>
</body>
</html>`}function tt(o,t,n="text/html;charset=utf-8"){const a=new Blob([o],{type:n}),r=URL.createObjectURL(a),e=document.createElement("a");e.href=r,e.download=t,e.rel="noopener",document.body.appendChild(e),e.click(),e.remove(),URL.revokeObjectURL(r)}function et(o){const t=window.open("","_blank","noopener,noreferrer");if(!t){alert("Pop-up blocked. Allow pop-ups for this site to print, or use Download HTML instead.");return}t.document.open(),t.document.write(o),t.document.close();const n=()=>{t.focus(),t.print()};t.document.readyState==="complete"?setTimeout(n,100):t.addEventListener("load",()=>setTimeout(n,100))}function nt(o,t){const n=getComputedStyle(o),a=o.nodeName==="TEXTAREA",r=document.createElement("div"),e=r.style;e.position="absolute",e.visibility="hidden",e.overflow=a?"hidden":"visible",e.whiteSpace=a?"pre-wrap":"pre",e.wordWrap="break-word",e.width=`${o.clientWidth}px`,a&&(e.height=`${o.scrollHeight}px`),e.font=n.font,e.padding=n.padding,e.border=n.border,e.boxSizing=n.boxSizing,e.direction=n.direction,e.lineHeight=n.lineHeight,e.letterSpacing=n.letterSpacing,e.textTransform=n.textTransform,e.textIndent=n.textIndent,e.tabSize=n.tabSize;const l=o.value;r.textContent=l.substring(0,t);const u=document.createElement("span");u.textContent=l.substring(t)||"​",r.appendChild(u),document.body.appendChild(r);const s=parseInt(n.borderLeftWidth,10)||0,f=parseInt(n.borderTopWidth,10)||0,h=u.offsetTop+f,g=u.offsetLeft+s,c=u.offsetHeight||parseFloat(n.lineHeight)||16;return document.body.removeChild(r),{top:h,left:g,height:c}}const ot="lyrics-chords-doc-v1",R="lyrics-chords-doc-v2",X="lyrics-chords-config-v1",$=()=>({chordMinHeight:28,lyricMinHeight:40,chordFontSize:13,lyricFontSize:16,defaultDirection:"ltr",useMonospace:!0});function rt(){try{const o=localStorage.getItem(X);return o?{...$(),...JSON.parse(o)}:$()}catch{return $()}}function q(o){localStorage.setItem(X,JSON.stringify(o))}function it(o){try{const t=JSON.parse(o);return Array.isArray(t)?t.map(n=>({lyrics:n.lyrics??"",chords:{},dir:n.dir==="rtl"?"rtl":"ltr"})):null}catch{return null}}function st(){try{let o=localStorage.getItem(R);if(!o){const n=localStorage.getItem(ot);if(n){const a=it(n);if(a)return localStorage.setItem(R,JSON.stringify(a)),a}return[{lyrics:"",chords:{},dir:"ltr"}]}const t=JSON.parse(o);return!Array.isArray(t)||t.length===0?[{lyrics:"",chords:{},dir:"ltr"}]:t.map(n=>({lyrics:n.lyrics??"",chords:N(n.chords),dir:n.dir==="rtl"?"rtl":"ltr"}))}catch{return[{lyrics:"",chords:{},dir:"ltr"}]}}function ct(o){const t=o.map(n=>({lyrics:n.lyricsEl.value,chords:N(n.chords),dir:n.wrap.dataset.dir==="rtl"?"rtl":"ltr"}));localStorage.setItem(R,JSON.stringify(t))}function U(o,t,n){t.style.setProperty("--chord-min-height",`${o.chordMinHeight}px`),t.style.setProperty("--lyric-min-height",`${o.lyricMinHeight}px`),t.style.setProperty("--chord-font-size",`${o.chordFontSize}px`),t.style.setProperty("--lyric-font-size",`${o.lyricFontSize}px`),n.classList.toggle("use-system-font",!o.useMonospace)}function lt(o){return o.map(t=>{const n=t.wrap.dataset.dir==="rtl"?"rtl":"ltr",a=t.lyricsEl.value,r=Object.entries(N(t.chords)).map(([e,l])=>`${e}:${l}`).join(",");return`DIR:${n}
${a}
CHORDS:${r}`}).join(`
---
`)}function at(o,t){const n=o.replace(/\r\n/g,`
`).trim();if(!n)return[{lyrics:"",chords:{},dir:t}];if(!n.includes("CHORDS:")&&!n.startsWith("DIR:")){const r=n.split(`
`),e=[];for(let l=0;l<r.length;l+=2){r[l];const u=r[l+1]??"";e.push({lyrics:u,chords:{},dir:t})}return e.length===0&&e.push({lyrics:"",chords:{},dir:t}),e}const a=n.split(/\n---\n/).map(r=>r.trim()).filter(Boolean);return a.length===0?[{lyrics:"",chords:{},dir:t}]:a.map(r=>{var h;const e=r.split(`
`);let l=t,u="";const s={};(h=e[0])!=null&&h.startsWith("DIR:")&&(l=e[0].slice(4).trim()==="rtl"?"rtl":"ltr",e.shift());const f=e.findIndex(g=>g.startsWith("CHORDS:"));if(f>=0){u=e.slice(0,f).join(`
`);const g=e[f].slice(7).trim();if(g)for(const c of g.split(",")){const C=c.indexOf(":");if(C===-1)continue;const I=c.slice(0,C).trim(),T=c.slice(C+1).trim(),M=Number(I);Number.isFinite(M)&&T&&(s[M]=T)}}else u=e.join(`
`);return{lyrics:u,chords:N(s),dir:l}})}function V(o){return o.map(t=>({lyrics:t.lyricsEl.value,chords:N(t.chords),dir:t.wrap.dataset.dir==="rtl"?"rtl":"ltr"}))}function dt(o){return`${((o||"").trim()||"lyrics-chords").replace(/[/\\?%*:|"<>]/g,"").replace(/\s+/g,"-").slice(0,80)||"lyrics-chords"}.html`}function P(o,t,n,a,r=null,e){const l=document.createElement("div");l.className="stanza-row",l.dataset.dir=t.dir==="rtl"?"rtl":"ltr";const u=document.createElement("div");u.className="lyric-stage";const s=document.createElement("textarea");s.className="lyric-input",s.placeholder="Lyrics — place the caret on a letter, then set a chord above it.",s.value=t.lyrics??"",s.rows=2,s.spellcheck=!1;const f=document.createElement("div");f.className="chord-overlay";const h=document.createElement("div");h.className="lyric-mirror";const g=document.createElement("div");g.className="chord-zone",g.title="Double-click above lyrics to add chord",u.appendChild(s),u.appendChild(h),u.appendChild(f),u.appendChild(g),l.appendChild(u),r!=null?o.insertBefore(l,r):o.appendChild(l);const c={wrap:l,lyricsEl:s,chordOverlay:f,lyricMirror:h,chords:N(t.chords),_lastValue:t.lyrics??"",_caretMap:[]};Object.defineProperty(c,"dir",{get:()=>l.dataset.dir,set:d=>{l.dataset.dir=d==="rtl"?"rtl":"ltr",a(),e(c)}});const C=()=>Math.max(14,n().chordFontSize+6),I=d=>{d.size=Math.max(2,d.value.length+1),d.style.width="auto"},T=()=>{const d=getComputedStyle(s);h.style.font=d.font,h.style.letterSpacing=d.letterSpacing,h.style.lineHeight=d.lineHeight,h.style.padding=d.padding,h.style.border=d.border,h.style.boxSizing=d.boxSizing,h.style.direction=d.direction,h.style.textAlign=d.textAlign,h.style.width=`${s.clientWidth}px`},M=()=>{T(),h.innerHTML="";const d=s.value,y=document.createDocumentFragment();for(let L=0;L<=d.length;L+=1){const S=document.createElement("span");S.className="caret-marker",S.dataset.i=String(L),S.textContent="​",y.appendChild(S),L<d.length&&y.appendChild(document.createTextNode(d[L]))}h.appendChild(y);const x=h.querySelectorAll(".caret-marker"),E=new Array(d.length+1);x.forEach(L=>{const S=Number(L.dataset.i);E[S]={left:L.offsetLeft,top:L.offsetTop}}),c._caretMap=E},i=d=>{const y=s.getBoundingClientRect(),x=d-y.left,E=c._caretMap;if(!E||E.length===0)return s.value.length;let L=0,S=Number.POSITIVE_INFINITY;for(let F=0;F<E.length;F+=1){const m=E[F];if(!m)continue;const w=Math.abs(m.left-x);w<S&&(S=w,L=F)}return L},p=d=>{const y=c._caretMap;return y&&y[d]?y[d]:nt(s,d)},b=()=>{f.innerHTML="",M();const d=s,y=d.value,x=N(c.chords);c.chords=x;for(const[E,L]of Object.entries(x)){const S=Number(E);if(!Number.isFinite(S)||S<0||S>y.length)continue;const F=p(S),m=document.createElement("input");m.type="text",m.className="chord-bubble",m.value=L,m.dataset.index=String(S),m.setAttribute("aria-label","Chord"),m.autocomplete="off",m.style.left=`${F.left}px`,m.style.top=`${F.top-d.scrollTop-C()}px`,I(m);let w=null;const j=v=>{if(!w)return;const O=v.clientX-w.startX,J=v.clientY-w.startY;if(!w.moved&&Math.hypot(O,J)<4)return;w.moved=!0;const A=w.index;M();const z=i(v.clientX);if(A===z)return;const Y=c.chords[A];delete c.chords[A],c.chords[z]=Y,w.index=z,m.dataset.index=String(z),a(),e(c)},_=()=>{w&&(window.removeEventListener("pointermove",j),window.removeEventListener("pointerup",_),w=null)};m.addEventListener("pointerdown",v=>{v.stopPropagation(),w={startX:v.clientX,startY:v.clientY,index:Number(m.dataset.index),moved:!1},window.addEventListener("pointermove",j),window.addEventListener("pointerup",_,{once:!0})}),m.addEventListener("click",v=>{v.stopPropagation()}),m.addEventListener("input",()=>{const v=Number(m.dataset.index),O=m.value.trim();O?(c.chords[v]=O,I(m)):(delete c.chords[v],m.remove(),e(c)),a()}),m.addEventListener("blur",()=>{const v=Number(m.dataset.index);m.value.trim()||(delete c.chords[v],a(),e(c))}),m.addEventListener("keydown",v=>{v.key==="Escape"&&s.focus()}),f.appendChild(m)}},H=()=>{const d=s.value,y=B(c._lastValue,d);c.chords=G(c.chords,y),c._lastValue=d,a(),e(c)};s.addEventListener("input",H),s.addEventListener("scroll",()=>e(c)),s.addEventListener("click",()=>e(c)),s.addEventListener("keyup",()=>e(c)),s.addEventListener("focus",()=>e(c)),s.addEventListener("keydown",d=>{var y;d.key==="Enter"&&d.ctrlKey&&(d.preventDefault(),(y=c.onInsertAfter)==null||y.call(c))});const k=new ResizeObserver(()=>e(c));return k.observe(s),g.addEventListener("dblclick",d=>{M();const y=i(d.clientX);c.chords[y]||(c.chords[y]="Am"),a(),e(c),requestAnimationFrame(()=>{var E;const x=f.querySelector(`.chord-bubble[data-index="${y}"]`);x&&(x.focus(),(E=x.select)==null||E.call(x))})}),c.layoutChords=b,c.dispose=()=>{k.disconnect()},c}function pt(){const o=document.getElementById("app");let t=rt(),n=[];const a=document.documentElement;o.innerHTML=`
    <header class="toolbar">
      <h1>Lyrics &amp; chords</h1>
      <div class="toolbar-group">
        <button type="button" class="primary" id="btn-add">Add line</button>
        <button type="button" id="btn-del">Remove last line</button>
      </div>
      <div class="toolbar-group">
        <label for="sel-dir">Direction (new lines)</label>
        <select id="sel-dir">
          <option value="ltr">LTR (English)</option>
          <option value="rtl">RTL (Hebrew)</option>
        </select>
        <button type="button" id="btn-apply-dir">Apply direction to all</button>
      </div>
      <div class="toolbar-group">
        <button type="button" id="btn-config">Row settings</button>
        <button type="button" id="btn-export">Copy as text</button>
        <button type="button" id="btn-import">Paste import</button>
        <button type="button" id="btn-export-html">Download HTML</button>
        <button type="button" id="btn-print-pdf">Print / Save PDF</button>
      </div>
    </header>
    <div class="config-panel" id="config-panel" aria-hidden="true"></div>
    <p class="hint">
      Type lyrics in the box, then <strong>double-click above the text</strong> to add a chord exactly at that character position.
      Chord boxes auto-fit their content and can be dragged left/right to a new character.
      <kbd>Ctrl</kbd>+<kbd>Enter</kbd> adds a new line after the current one.
      <strong>Download HTML</strong> / <strong>Print / Save PDF</strong> use the same layout.
    </p>
    <div class="editor" id="editor"></div>
  `;const r=o.querySelector("#config-panel");r.innerHTML=`
    <fieldset>
      <legend>Row height (min)</legend>
      <div class="config-row">
        <label for="cfg-ch-h">Chord box</label>
        <input type="number" id="cfg-ch-h" min="16" max="120" step="1" />
        <span>px</span>
      </div>
      <div class="config-row">
        <label for="cfg-ly-h">Lyrics</label>
        <input type="number" id="cfg-ly-h" min="20" max="160" step="1" />
        <span>px</span>
      </div>
    </fieldset>
    <fieldset>
      <legend>Font size</legend>
      <div class="config-row">
        <label for="cfg-ch-fs">Chords</label>
        <input type="number" id="cfg-ch-fs" min="10" max="28" step="1" />
        <span>px</span>
      </div>
      <div class="config-row">
        <label for="cfg-ly-fs">Lyrics</label>
        <input type="number" id="cfg-ly-fs" min="10" max="32" step="1" />
        <span>px</span>
      </div>
    </fieldset>
    <fieldset>
      <legend>Font</legend>
      <div class="config-row">
        <label for="cfg-mono">Alignment</label>
        <select id="cfg-mono">
          <option value="mono">Monospace (stable columns)</option>
          <option value="system">System UI (softer look)</option>
        </select>
      </div>
    </fieldset>
  `;const e=o.querySelector("#editor"),l=o.querySelector("#sel-dir");l.value=t.defaultDirection;let u=0;const s=i=>{cancelAnimationFrame(u),u=requestAnimationFrame(()=>{var p;(p=i.layoutChords)==null||p.call(i)})},f=()=>{r.querySelector("#cfg-ch-h").value=String(t.chordMinHeight),r.querySelector("#cfg-ly-h").value=String(t.lyricMinHeight),r.querySelector("#cfg-ch-fs").value=String(t.chordFontSize),r.querySelector("#cfg-ly-fs").value=String(t.lyricFontSize),r.querySelector("#cfg-mono").value=t.useMonospace?"mono":"system"},h=()=>{t.chordMinHeight=Number(r.querySelector("#cfg-ch-h").value)||t.chordMinHeight,t.lyricMinHeight=Number(r.querySelector("#cfg-ly-h").value)||t.lyricMinHeight,t.chordFontSize=Number(r.querySelector("#cfg-ch-fs").value)||t.chordFontSize,t.lyricFontSize=Number(r.querySelector("#cfg-ly-fs").value)||t.lyricFontSize,t.useMonospace=r.querySelector("#cfg-mono").value==="mono"},g=()=>{q(t),ct(n)},c=()=>g(),C=i=>{i.onInsertAfter=()=>I(i)},I=i=>{var d,y,x;const p=n.indexOf(i),b={lyrics:"",chords:{},dir:((y=(d=i==null?void 0:i.wrap)==null?void 0:d.dataset)==null?void 0:y.dir)||t.defaultDirection},H=((x=i==null?void 0:i.wrap)==null?void 0:x.nextSibling)??null,k=P(e,b,()=>t,c,H,s);p>=0?n.splice(p+1,0,k):n.push(k),C(k),g(),k.lyricsEl.focus()},T=i=>{var p;for(const b of n)(p=b.dispose)==null||p.call(b);e.innerHTML="",n=i.map(b=>P(e,b,()=>t,c,null,s)),n.forEach(b=>{C(b),s(b)}),g()};U(t,a,document.body),f(),T(st()),l.addEventListener("change",()=>{t.defaultDirection=l.value,q(t)}),o.querySelector("#btn-add").addEventListener("click",()=>{const i={lyrics:"",chords:{},dir:t.defaultDirection},p=P(e,i,()=>t,c,null,s);n.push(p),C(p),g(),p.lyricsEl.focus(),s(p)}),o.querySelector("#btn-del").addEventListener("click",()=>{var p;if(n.length<=1)return;const i=n.pop();(p=i.dispose)==null||p.call(i),i.wrap.remove(),g()}),o.querySelector("#btn-apply-dir").addEventListener("click",()=>{const i=l.value;for(const p of n)p.wrap.dataset.dir=i,s(p);g()}),o.querySelector("#btn-config").addEventListener("click",()=>{const i=!r.classList.contains("open");r.classList.toggle("open",i),r.setAttribute("aria-hidden",i?"false":"true"),f()}),["#cfg-ch-h","#cfg-ly-h","#cfg-ch-fs","#cfg-ly-fs","#cfg-mono"].forEach(i=>{r.querySelector(i).addEventListener("change",()=>{h(),U(t,a,document.body),q(t),n.forEach(p=>s(p))})}),o.querySelector("#btn-export").addEventListener("click",async()=>{const i=lt(n);try{await navigator.clipboard.writeText(i)}catch{prompt("Copy:",i);return}const p=o.querySelector("#btn-export"),b=p.textContent;p.textContent="Copied!",setTimeout(()=>{p.textContent=b},1500)}),o.querySelector("#btn-import").addEventListener("click",()=>{const i=prompt("Paste exported text (v2 blocks or legacy chord/lyric pairs):");if(i==null)return;const p=at(i,t.defaultDirection);T(p)});const M=()=>{const i=prompt("Title (optional, shown at top of page):","");return i===null?null:i};o.querySelector("#btn-export-html").addEventListener("click",()=>{const i=M();if(i===null)return;const p=V(n),b=W(p,t,{title:i});tt(b,dt(i));const H=o.querySelector("#btn-export-html"),k=H.textContent;H.textContent="Downloaded",setTimeout(()=>{H.textContent=k},1500)}),o.querySelector("#btn-print-pdf").addEventListener("click",()=>{const i=M();if(i===null)return;const p=V(n),b=W(p,t,{title:i});et(b)})}pt();
