/* ===================================================================
   ニュース風ジェネレーター (NewsGen) — 本体スクリプト
   キャンバス上で直接ドラッグ移動・リサイズ・文字編集ができる自由配置エディタ
=================================================================== */
(() => {
  const FONT_SANS  = '"Zen Kaku Gothic New","Hiragino Sans","Noto Sans JP",sans-serif';
  const FONT_MONO   = '"JetBrains Mono",monospace';
  const FONT_SERIF  = '"Noto Serif JP",serif';
  const FALLBACK = ',"Hiragino Sans","Noto Sans JP",sans-serif';
  // 追加フォント: key -> [CSS名, 使える太さ]
  const EXTRA_FONTS = {
    notosans:   ['Noto Sans JP', [400,500,700,900]],
    mplus1p:    ['M PLUS 1p', [400,700,900]],
    mplusround: ['M PLUS Rounded 1c', [400,700,900]],
    zenmaru:    ['Zen Maru Gothic', [400,700,900]],
    bizudp:     ['BIZ UDPGothic', [400,700]],
    kosugimaru: ['Kosugi Maru', [400]],
    kiwimaru:   ['Kiwi Maru', [400,500]],
    zenoldmin:  ['Zen Old Mincho', [400,700,900]],
    zenantique: ['Zen Antique', [400]],
    kleeone:    ['Klee One', [400,600]],
    yujisyuku:  ['Yuji Syuku', [400]],
    dela:       ['Dela Gothic One', [400]],
    rocknroll:  ['RocknRoll One', [400]],
    reggae:     ['Reggae One', [400]],
    rampart:    ['Rampart One', [400]],
    stick:      ['Stick', [400]],
    potta:      ['Potta One', [400]],
    mochiy:     ['Mochiy Pop One', [400]],
    hachimaru:  ['Hachi Maru Pop', [400]],
    darumadrop: ['Darumadrop One', [400]],
    yusei:      ['Yusei Magic', [400]],
    yomogi:     ['Yomogi', [400]],
    trainone:   ['Train One', [400]],
    dotgothic:  ['DotGothic16', [400]],
  };
  const FONT_MAP = { sans: FONT_SANS, serif: FONT_SERIF, mono: FONT_MONO };
  Object.keys(EXTRA_FONTS).forEach(k => { FONT_MAP[k] = '"' + EXTRA_FONTS[k][0] + '"' + FALLBACK; });
  // 太字が無いフォントで擬似ボールドが掛かって崩れないよう、使える太さに合わせる
  function fontWeightFor(item){
    const ex = EXTRA_FONTS[item.fontFamily];
    const w = parseInt(item.weight, 10) || 700;
    if(!ex) return item.weight || 700;
    return ex[1].reduce((best, cur) => Math.abs(cur - w) < Math.abs(best - w) ? cur : best, ex[1][0]);
  }

  const RATIOS = {
    '16:9': [1280, 720],
    '1:1':  [1080, 1080],
    '4:5':  [1080, 1350],
    '9:16': [1080, 1920],
  };

  let canvasW = 1280, canvasH = 720;
  let items = [];
  let selectedId = null;
  let idCounter = 1;
  let currentTplId = 'breaking';

  const stageArea = document.querySelector('.stage-area');
  const stageWrap = document.getElementById('stageWrap');
  const stage = document.getElementById('stage');
  const selectionOverlay = document.getElementById('selectionOverlay');
  const ratioSelect = document.getElementById('ratioSelect');
  const downloadBtn = document.getElementById('downloadBtn');
  const fileInput = document.getElementById('fileInput');
  const addTextBtn = document.getElementById('addTextBtn');
  const addFrameBtn = document.getElementById('addFrameBtn');
  const addImageBtn = document.getElementById('addImageBtn');
  const templateGrid = document.getElementById('templateGrid');
  const dlLink = document.getElementById('dlLink');
  const toggleTime = document.getElementById('toggleTime');
  const toggleWeather = document.getElementById('toggleWeather');

  const propEmpty = document.getElementById('propEmpty');
  const propText = document.getElementById('propText');
  const propImage = document.getElementById('propImage');
  const propDeleteBtn = document.getElementById('propDeleteBtn');
  const propFontFamily = document.getElementById('propFontFamily');
  const propFontSize = document.getElementById('propFontSize');
  const propWeight = document.getElementById('propWeight');
  const propColor = document.getElementById('propColor');
  const propAlign = document.getElementById('propAlign');
  const propFrameShape = document.getElementById('propFrameShape');
  const propFrameColor = document.getElementById('propFrameColor');
  const propFrameOpacity = document.getElementById('propFrameOpacity');
  const propOutline = document.getElementById('propOutline');
  const propBorder = document.getElementById('propBorder');
  const propBorderColor = document.getElementById('propBorderColor');
  const propBorderColorField = document.getElementById('propBorderColorField');
  const propBorderWidth = document.getElementById('propBorderWidth');
  const propBorderWidthField = document.getElementById('propBorderWidthField');
  const propImgFront = document.getElementById('propImgFront');
  const propImgBack = document.getElementById('propImgBack');
  const addWipeBtn = document.getElementById('addWipeBtn');
  const propWipe = document.getElementById('propWipe');
  const propWipeShape = document.getElementById('propWipeShape');
  const propWipeColor = document.getElementById('propWipeColor');
  const propWipeWidth = document.getElementById('propWipeWidth');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const layerList = document.getElementById('layerList');
  const layerEmpty = document.getElementById('layerEmpty');

  const imageCache = new Map(); // src -> Image要素（undo/redo時の再利用）

  // ---------- 汎用ヘルパー ----------
  function hexToRgba(hex, a){
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#e8342a');
    if(!m) return `rgba(232,52,42,${a})`;
    const r = parseInt(m[1],16), g = parseInt(m[2],16), b = parseInt(m[3],16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function wrapLines(c, text, maxWidth){
    const paragraphs = String(text).split('\n');
    const lines = [];
    paragraphs.forEach(p => {
      if(p === ''){ lines.push(''); return; }
      let line = '';
      for(const ch of p){
        const test = line + ch;
        if(c.measureText(test).width > maxWidth && line !== ''){
          lines.push(line);
          line = ch;
        } else {
          line = test;
        }
      }
      if(line) lines.push(line);
    });
    return lines;
  }

  function roundRectPath(c, x, y, w, h, r){
    if(typeof r === 'number') r = {tl:r, tr:r, br:r, bl:r};
    c.beginPath();
    c.moveTo(x + r.tl, y);
    c.lineTo(x + w - r.tr, y);
    c.arcTo(x + w, y, x + w, y + r.tr, r.tr);
    c.lineTo(x + w, y + h - r.br);
    c.arcTo(x + w, y + h, x + w - r.br, y + h, r.br);
    c.lineTo(x + r.bl, y + h);
    c.arcTo(x, y + h, x, y + h - r.bl, r.bl);
    c.lineTo(x, y + r.tl);
    c.arcTo(x, y, x + r.tl, y, r.tl);
    c.closePath();
  }

  function frameShapePathCanvas(c, shape, x, y, w, h){
    const s = Math.min(w,h);
    switch(shape){
      case 'rect': c.beginPath(); c.rect(x,y,w,h); break;
      case 'rounded': roundRectPath(c, x, y, w, h, s*0.18); break;
      case 'pill': roundRectPath(c, x, y, w, h, h/2); break;
      case 'circle': {
        c.beginPath();
        if(c.ellipse) c.ellipse(x+w/2, y+h/2, w/2, h/2, 0, 0, Math.PI*2);
        else roundRectPath(c, x, y, w, h, Math.min(w,h)/2);
        break;
      }
      case 'parallelogram-right': {
        const skew = Math.min(h*0.45, w*0.25);
        c.beginPath(); c.moveTo(x,y); c.lineTo(x+w-skew,y); c.lineTo(x+w,y+h); c.lineTo(x,y+h); c.closePath();
        break;
      }
      case 'parallelogram-left': {
        const skew = Math.min(h*0.45, w*0.25);
        c.beginPath(); c.moveTo(x+skew,y); c.lineTo(x+w,y); c.lineTo(x+w,y+h); c.lineTo(x,y+h); c.closePath();
        break;
      }
      case 'diagonal': {
        const tail = Math.min(h*0.5, w*0.15);
        c.beginPath();
        c.moveTo(x+tail,y); c.lineTo(x+w-tail,y); c.lineTo(x+w,y+h/2);
        c.lineTo(x+w-tail,y+h); c.lineTo(x+tail,y+h); c.lineTo(x,y+h/2);
        c.closePath();
        break;
      }
      case 'ribbon': {
        const tail = Math.min(h*0.5, w*0.25);
        c.beginPath();
        c.moveTo(x,y); c.lineTo(x+w-tail,y); c.lineTo(x+w,y+h/2); c.lineTo(x+w-tail,y+h); c.lineTo(x,y+h);
        c.closePath();
        break;
      }
      default: c.beginPath(); c.rect(x,y,w,h);
    }
  }

  function drawCoverCanvas(c, img, x, y, w, h){
    if(!img){ c.fillStyle = '#20262d'; c.fillRect(x,y,w,h); return; }
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale, sh = h / scale;
    const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
    c.save();
    c.beginPath(); c.rect(x,y,w,h); c.clip();
    c.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    c.restore();
  }

  // ---------- キャンバス合成描画（プレビュー・書き出し・サムネ共通） ----------
  function drawTextItemComposite(c, item){
    const {x,y,w,h} = item;
    if(item.frameShape && item.frameShape !== 'none' && item.frameShape !== 'underline'){
      c.save();
      c.shadowColor = 'rgba(0,0,0,.32)';
      c.shadowBlur = Math.max(2, h*0.09);
      c.shadowOffsetY = Math.max(1, h*0.03);
      c.fillStyle = hexToRgba(item.frameColor, (item.frameOpacity==null?100:item.frameOpacity)/100);
      frameShapePathCanvas(c, item.frameShape, x, y, w, h);
      c.fill();
      c.restore();
      if(item.border){
        c.lineWidth = item.borderWidth != null ? item.borderWidth : Math.max(2, Math.min(w,h)*0.025);
        c.strokeStyle = item.borderColor || '#141414';
        frameShapePathCanvas(c, item.frameShape, x, y, w, h);
        c.stroke();
      }
    }
    if(item.frameShape === 'underline'){
      c.fillStyle = hexToRgba(item.frameColor, (item.frameOpacity==null?100:item.frameOpacity)/100);
      c.fillRect(x, y+h*0.86, w, h*0.12);
    }
    if(!item.text) return;
    const padX = w*0.06, padY = h*0.12;
    const maxW = Math.max(4, w - padX*2);
    const fam = FONT_MAP[item.fontFamily] || FONT_SANS;
    c.font = `${fontWeightFor(item)} ${item.fontSize}px ${fam}`;
    const lineHeight = item.fontSize * 1.25;
    const lines = wrapLines(c, item.text, maxW);
    const totalH = lines.length * lineHeight;
    let startY = y + h/2 - totalH/2 + lineHeight*0.78;
    const align = item.align || 'left';
    const alignX = align==='left' ? x+padX : align==='right' ? x+w-padX : x+w/2;
    c.textAlign = align;
    c.textBaseline = 'alphabetic';
    if(item.outline){
      c.lineJoin = 'round';
      c.miterLimit = 2;
      c.lineWidth = Math.max(1, item.fontSize*0.16);
      c.strokeStyle = '#000000';
      lines.forEach((line,i) => c.strokeText(line, alignX, startY + i*lineHeight));
    }
    c.fillStyle = item.color || '#ffffff';
    lines.forEach((line,i) => c.fillText(line, alignX, startY + i*lineHeight));
  }

  function drawWipeComposite(c, item){
    const { x, y, w, h } = item;
    const bw = item.borderWidth || 0;
    c.save();
    c.beginPath();
    if(item.shape === 'square') c.rect(x, y, w, h);
    else c.ellipse(x+w/2, y+h/2, w/2, h/2, 0, 0, Math.PI*2);
    c.clip();
    if(item.innerImgEl){
      const iw = item.innerImgEl.naturalWidth || item.innerImgEl.width || 1;
      const ih = item.innerImgEl.naturalHeight || item.innerImgEl.height || 1;
      const innerW = Math.max(1, w - bw*2), innerH = Math.max(1, h - bw*2);
      const baseScale = Math.max(innerW/iw, innerH/ih);
      const scale = baseScale * (item.innerScale || 1);
      const dw = iw*scale, dh = ih*scale;
      const cx = x + w/2 + (item.innerOffsetX||0);
      const cy = y + h/2 + (item.innerOffsetY||0);
      c.drawImage(item.innerImgEl, cx - dw/2, cy - dh/2, dw, dh);
    }
    c.restore();
    if(bw > 0){
      c.lineWidth = bw;
      c.strokeStyle = item.frameColor || '#ffffff';
      c.beginPath();
      const inset = bw/2;
      if(item.shape === 'square') c.rect(x+inset, y+inset, w-bw, h-bw);
      else c.ellipse(x+w/2, y+h/2, w/2-inset, h/2-inset, 0, 0, Math.PI*2);
      c.stroke();
    }
  }

  function renderComposite(targetCanvas, w, h, itemList){
    targetCanvas.width = w; targetCanvas.height = h;
    const c = targetCanvas.getContext('2d');
    c.clearRect(0,0,w,h);
    const sorted = [...itemList].sort((a,b) => a.z - b.z);
    sorted.forEach(item => {
      if(item.type === 'image') drawCoverCanvas(c, item.imgEl, item.x, item.y, item.w, item.h);
      else if(item.type === 'wipe') drawWipeComposite(c, item);
      else drawTextItemComposite(c, item);
    });
    return targetCanvas;
  }

  // ---------- DOM: フレーム形状の反映 ----------
  function applyFrameShapeDOM(bg, bar, item){
    bg.style.clipPath = 'none';
    bg.style.borderRadius = '0';
    bg.style.display = 'block';
    bg.style.border = 'none';
    bar.style.display = 'none';
    const rgba = hexToRgba(item.frameColor, (item.frameOpacity==null?100:item.frameOpacity)/100);
    const w = item.w, h = item.h, s = Math.min(w,h);
    const borderCss = item.border ? `${item.borderWidth != null ? item.borderWidth : Math.max(2, s*0.025)}px solid ${item.borderColor || '#141414'}` : 'none';
    switch(item.frameShape){
      case 'none':
        bg.style.display = 'none';
        break;
      case 'rect':
        bg.style.background = rgba;
        bg.style.border = borderCss;
        break;
      case 'rounded':
        bg.style.background = rgba;
        bg.style.borderRadius = (s*0.18) + 'px';
        bg.style.border = borderCss;
        break;
      case 'pill':
        bg.style.background = rgba;
        bg.style.borderRadius = (h/2) + 'px';
        bg.style.border = borderCss;
        break;
      case 'circle':
        bg.style.background = rgba;
        bg.style.borderRadius = '50%';
        bg.style.border = borderCss;
        break;
      case 'parallelogram-right': {
        bg.style.background = rgba;
        const skew = Math.min(h*0.45, w*0.25);
        bg.style.clipPath = `polygon(0 0, calc(100% - ${skew}px) 0, 100% 100%, 0 100%)`;
        break;
      }
      case 'parallelogram-left': {
        bg.style.background = rgba;
        const skew = Math.min(h*0.45, w*0.25);
        bg.style.clipPath = `polygon(${skew}px 0, 100% 0, 100% 100%, 0 100%)`;
        break;
      }
      case 'diagonal': {
        bg.style.background = rgba;
        const tail = Math.min(h*0.5, w*0.15);
        bg.style.clipPath = `polygon(${tail}px 0, calc(100% - ${tail}px) 0, 100% 50%, calc(100% - ${tail}px) 100%, ${tail}px 100%, 0 50%)`;
        break;
      }
      case 'ribbon': {
        bg.style.background = rgba;
        const tail = Math.min(h*0.5, w*0.25);
        bg.style.clipPath = `polygon(0 0, calc(100% - ${tail}px) 0, 100% 50%, calc(100% - ${tail}px) 100%, 0 100%)`;
        break;
      }
      case 'underline':
        bg.style.display = 'none';
        bar.style.display = 'block';
        bar.style.background = rgba;
        break;
      default:
        bg.style.background = rgba;
    }
  }

  // ---------- DOM: アイテムのノード生成・更新 ----------
  function createItemNode(item){
    const node = document.createElement('div');
    node.className = 'stage-item';
    node.dataset.id = item.id;
    if(item.type === 'image'){
      const img = document.createElement('img');
      img.src = item.src;
      img.draggable = false;
      node.appendChild(img);
    } else if(item.type === 'wipe'){
      const mask = document.createElement('div');
      mask.className = 'wipe-mask';
      const img = document.createElement('img');
      img.className = 'wipe-img';
      img.draggable = false;
      mask.appendChild(img);
      node.appendChild(mask);
    } else {
      const bg = document.createElement('div');
      bg.className = 'frame-bg';
      node.appendChild(bg);
      const bar = document.createElement('div');
      bar.className = 'underline-bar';
      node.appendChild(bar);
      const inner = document.createElement('div');
      inner.className = 'text-inner';
      inner.contentEditable = 'false';
      node.appendChild(inner);
    }
    stage.appendChild(node);
    attachItemEvents(node, item.id);
    return node;
  }

  function updateWipeImgTransform(item, img){
    if(!item.innerImgEl){ img.style.display = 'none'; return; }
    img.style.display = 'block';
    if(img.getAttribute('src') !== item.innerSrc) img.src = item.innerSrc;
    const iw = item.innerImgEl.naturalWidth || item.innerImgEl.width || 1;
    const ih = item.innerImgEl.naturalHeight || item.innerImgEl.height || 1;
    const innerW = Math.max(1, item.w - (item.borderWidth||0)*2);
    const innerH = Math.max(1, item.h - (item.borderWidth||0)*2);
    const baseScale = Math.max(innerW/iw, innerH/ih);
    const scale = baseScale * (item.innerScale || 1);
    img.style.width = (iw*scale) + 'px';
    img.style.height = (ih*scale) + 'px';
    img.style.transform = `translate(calc(-50% + ${item.innerOffsetX||0}px), calc(-50% + ${item.innerOffsetY||0}px))`;
  }

  function updateItemNode(node, item, opts){
    opts = opts || {};
    node.style.left = item.x + 'px';
    node.style.top = item.y + 'px';
    node.style.width = item.w + 'px';
    node.style.height = item.h + 'px';
    node.style.zIndex = item.z;
    node.classList.toggle('selected', item.id === selectedId);
    if(item.type === 'image'){
      const img = node.querySelector('img');
      if(img && img.getAttribute('src') !== item.src) img.src = item.src;
      return;
    }
    if(item.type === 'wipe'){
      const mask = node.querySelector('.wipe-mask');
      mask.classList.toggle('shape-circle', item.shape !== 'square');
      mask.classList.toggle('shape-square', item.shape === 'square');
      mask.style.borderWidth = (item.borderWidth||0) + 'px';
      mask.style.borderColor = item.frameColor || '#ffffff';
      const img = node.querySelector('.wipe-img');
      updateWipeImgTransform(item, img);
      return;
    }
    const bg = node.querySelector('.frame-bg');
    const bar = node.querySelector('.underline-bar');
    const inner = node.querySelector('.text-inner');
    applyFrameShapeDOM(bg, bar, item);
    inner.style.fontFamily = FONT_MAP[item.fontFamily] || FONT_SANS;
    inner.style.fontSize = item.fontSize + 'px';
    inner.style.fontWeight = fontWeightFor(item);
    inner.style.color = item.color;
    inner.style.textAlign = item.align;
    inner.style.justifyContent = item.align==='left' ? 'flex-start' : item.align==='right' ? 'flex-end' : 'center';
    inner.classList.toggle('outlined', !!item.outline);
    const padY = Math.round(item.h*0.12), padX = Math.round(item.w*0.06);
    inner.style.padding = padY+'px '+padX+'px';
    if(item.frameShape === 'underline'){ inner.style.paddingBottom = (padY + Math.round(item.h*0.12)) + 'px'; }
    if(!opts.skipText && document.activeElement !== inner){
      inner.textContent = item.text;
    }
  }

  function fullRenderDOM(){
    stage.innerHTML = '';
    items.forEach(item => {
      const node = createItemNode(item);
      updateItemNode(node, item);
    });
    syncSelectionOverlay();
  }

  function getItem(id){ return items.find(it => it.id === id); }
  function getNode(id){ return stage.querySelector(`.stage-item[data-id="${id}"]`); }
  function nextZ(){ return items.reduce((m,it) => Math.max(m,it.z), 0) + 1; }

  // ---------- ステージ座標変換 ----------
  function stagePointFromEvent(e){
    const rect = stage.getBoundingClientRect();
    const scaleX = canvasW / rect.width;
    const scaleY = canvasH / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function layoutStage(){
    const MARGIN = 30;
    const availW = Math.max(200, stageArea.clientWidth - MARGIN*2);
    const availH = Math.max(200, stageArea.clientHeight - MARGIN*2);
    let scale = Math.min(availW / canvasW, availH / canvasH);
    if(!isFinite(scale) || scale <= 0) scale = 0.3;
    stage.style.width = canvasW + 'px';
    stage.style.height = canvasH + 'px';
    stage.style.left = MARGIN + 'px';
    stage.style.top = MARGIN + 'px';
    stage.style.transform = 'scale(' + scale + ')';
    selectionOverlay.style.width = canvasW + 'px';
    selectionOverlay.style.height = canvasH + 'px';
    selectionOverlay.style.left = MARGIN + 'px';
    selectionOverlay.style.top = MARGIN + 'px';
    selectionOverlay.style.transform = 'scale(' + scale + ')';
    stageWrap.style.width = (canvasW * scale + MARGIN*2) + 'px';
    stageWrap.style.height = (canvasH * scale + MARGIN*2) + 'px';
  }

  // ---------- 選択・プロパティパネル ----------
  function selectItem(id){
    selectedId = id;
    document.querySelectorAll('.stage-item').forEach(n => n.classList.toggle('selected', n.dataset.id === id));
    layerList.querySelectorAll('.layer-row').forEach(r => r.classList.toggle('selected', r.dataset.id === id));
    refreshPropPanel();
    syncSelectionOverlay();
  }
  function deselect(){
    selectedId = null;
    document.querySelectorAll('.stage-item').forEach(n => n.classList.remove('selected'));
    layerList.querySelectorAll('.layer-row').forEach(r => r.classList.remove('selected'));
    refreshPropPanel();
    syncSelectionOverlay();
  }
  function refreshPropPanel(){
    const item = getItem(selectedId);
    propEmpty.style.display = item ? 'none' : 'block';
    propDeleteBtn.style.display = item ? 'block' : 'none';
    propText.style.display = (item && item.type === 'text') ? 'block' : 'none';
    propImage.style.display = (item && item.type === 'image') ? 'block' : 'none';
    propWipe.style.display = (item && item.type === 'wipe') ? 'block' : 'none';
    if(item && item.type === 'text'){
      propFontFamily.value = item.fontFamily;
      propFontSize.value = Math.round(item.fontSize);
      propWeight.value = item.weight;
      propColor.value = item.color;
      propAlign.value = item.align;
      propFrameShape.value = item.frameShape;
      propFrameColor.value = item.frameColor;
      propFrameOpacity.value = item.frameOpacity;
      propOutline.checked = !!item.outline;
      propBorder.checked = !!item.border;
      propBorderColor.value = item.borderColor || '#141414';
      propBorderWidth.value = item.borderWidth != null ? item.borderWidth : 4;
      propBorderColorField.style.display = item.border ? 'block' : 'none';
      propBorderWidthField.style.display = item.border ? 'block' : 'none';
    }
    if(item && item.type === 'wipe'){
      propWipeShape.value = item.shape;
      propWipeColor.value = item.frameColor || '#ffffff';
      propWipeWidth.value = item.borderWidth != null ? item.borderWidth : 6;
    }
  }
  function updateSelected(fn){
    const item = getItem(selectedId);
    if(!item) return;
    fn(item);
    const node = getNode(selectedId);
    if(node) updateItemNode(node, item);
    renderGallery(); renderLayers(); syncToggles();
    scheduleSnapshot();
  }

  propWipeShape.addEventListener('change', () => { updateSelected(it => it.shape = propWipeShape.value); snapshot(); });
  propWipeColor.addEventListener('input', () => updateSelected(it => it.frameColor = propWipeColor.value));
  propWipeColor.addEventListener('change', () => snapshot());
  propWipeWidth.addEventListener('input', () => updateSelected(it => it.borderWidth = parseFloat(propWipeWidth.value) || 0));
  propWipeWidth.addEventListener('change', () => snapshot());

  propFontFamily.addEventListener('change', () => updateSelected(it => it.fontFamily = propFontFamily.value));
  propFontSize.addEventListener('input', () => updateSelected(it => it.fontSize = parseFloat(propFontSize.value) || it.fontSize));
  propWeight.addEventListener('change', () => updateSelected(it => it.weight = propWeight.value));
  propColor.addEventListener('input', () => updateSelected(it => it.color = propColor.value));
  propAlign.addEventListener('change', () => updateSelected(it => it.align = propAlign.value));
  propFrameShape.addEventListener('change', () => updateSelected(it => it.frameShape = propFrameShape.value));
  propFrameColor.addEventListener('input', () => updateSelected(it => it.frameColor = propFrameColor.value));
  propFrameOpacity.addEventListener('input', () => updateSelected(it => it.frameOpacity = parseFloat(propFrameOpacity.value)));
  propOutline.addEventListener('change', () => updateSelected(it => it.outline = propOutline.checked));
  propBorder.addEventListener('change', () => {
    updateSelected(it => it.border = propBorder.checked);
    propBorderColorField.style.display = propBorder.checked ? 'block' : 'none';
    propBorderWidthField.style.display = propBorder.checked ? 'block' : 'none';
  });
  propBorderColor.addEventListener('input', () => updateSelected(it => it.borderColor = propBorderColor.value));
  propBorderWidth.addEventListener('input', () => updateSelected(it => it.borderWidth = parseFloat(propBorderWidth.value) || 1));
  propImgFront.addEventListener('click', () => updateSelected(it => it.z = nextZ()));
  propImgBack.addEventListener('click', () => updateSelected(it => it.z = Math.min(0, ...items.map(x=>x.z)) - 1));
  propDeleteBtn.addEventListener('click', deleteSelected);

  function deleteItem(id){
    const idx = items.findIndex(it => it.id === id);
    if(idx < 0) return;
    const node = getNode(id);
    if(node) node.remove();
    items.splice(idx, 1);
    if(selectedId === id){ selectedId = null; refreshPropPanel(); syncSelectionOverlay(); }
    renderGallery(); renderLayers(); syncToggles(); snapshot();
  }
  function deleteSelected(){
    if(selectedId) deleteItem(selectedId);
  }

  // ---------- ドラッグ移動・リサイズ・テキスト編集 ----------
  // ---------- 同じ場所への再クリックで重なった要素を順番に選択 ----------
  let lastClickPoint = null;
  let lastHitIds = [];
  let lastHitIndex = -1;

  function hitTestPoint(p){
    return items
      .filter(it => p.x >= it.x && p.x <= it.x + it.w && p.y >= it.y && p.y <= it.y + it.h)
      .sort((a, b) => b.z - a.z);
  }

  function resolveClickTarget(p){
    const hits = hitTestPoint(p);
    if(hits.length === 0) return null;
    const ids = hits.map(h => h.id);
    const samePoint = lastClickPoint && Math.abs(lastClickPoint.x - p.x) < 6 && Math.abs(lastClickPoint.y - p.y) < 6;
    const sameStack = samePoint && ids.length === lastHitIds.length && ids.every((v,i) => v === lastHitIds[i]);
    let idx = 0;
    if(sameStack) idx = (lastHitIndex + 1) % hits.length;
    lastClickPoint = p;
    lastHitIds = ids;
    lastHitIndex = idx;
    return hits[idx];
  }

  function attachItemEvents(node, id){
    node.addEventListener('pointerdown', e => {
      if(node.classList.contains('editing')) return;
      e.stopPropagation();

      const rawItem = getItem(id);
      const wantsPan = rawItem && rawItem.type === 'wipe' && rawItem.innerImgEl;
      if(wantsPan){
        const item = rawItem;
        selectItem(id);
        const start = stagePointFromEvent(e);
        const orig = { x: item.innerOffsetX||0, y: item.innerOffsetY||0 };
        node.classList.add('grabbing');
        if(node.setPointerCapture) try{ node.setPointerCapture(e.pointerId); }catch(err){}
        function onMovePan(ev){
          const p = stagePointFromEvent(ev);
          item.innerOffsetX = orig.x + (p.x - start.x);
          item.innerOffsetY = orig.y + (p.y - start.y);
          updateItemNode(node, item);
        }
        function onUpPan(){
          try{ node.releasePointerCapture(e.pointerId); }catch(err){}
          node.classList.remove('grabbing');
          node.removeEventListener('pointermove', onMovePan);
          node.removeEventListener('pointerup', onUpPan);
          renderGallery(); renderLayers(); syncToggles(); snapshot();
        }
        node.addEventListener('pointermove', onMovePan);
        node.addEventListener('pointerup', onUpPan);
        return;
      }

      const p0 = stagePointFromEvent(e);
      const resolved = resolveClickTarget(p0) || getItem(id);
      if(!resolved) return;
      const targetId = resolved.id;
      const targetNode = getNode(targetId) || node;
      const wasSelected = (selectedId === targetId);
      selectItem(targetId);

      const item = getItem(targetId);
      const start = p0;
      const orig = { x: item.x, y: item.y };
      let moved = false;
      if(targetNode.setPointerCapture) try{ targetNode.setPointerCapture(e.pointerId); }catch(err){}
      function onMove(ev){
        const p = stagePointFromEvent(ev);
        const dx = p.x - start.x, dy = p.y - start.y;
        if(Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
        item.x = orig.x + dx;
        item.y = orig.y + dy;
        targetNode.style.left = item.x + 'px';
        targetNode.style.top = item.y + 'px';
        syncSelectionOverlay();
      }
      function onUp(){
        try{ targetNode.releasePointerCapture(e.pointerId); }catch(err){}
        targetNode.removeEventListener('pointermove', onMove);
        targetNode.removeEventListener('pointerup', onUp);
        renderGallery(); renderLayers(); syncToggles();
        if(moved) snapshot();
        if(!moved && wasSelected && item.type === 'text' && !targetNode.classList.contains('editing')){
          startTextEdit(targetNode, item);
        }
      }
      targetNode.addEventListener('pointermove', onMove);
      targetNode.addEventListener('pointerup', onUp);
    });

    node.addEventListener('dblclick', e => {
      const item = getItem(id);
      if(!item || item.type !== 'text') return;
      e.preventDefault();
      if(!node.classList.contains('editing')) startTextEdit(node, item);
    });
  }

  // ---------- 選択ハンドル（常に最前面のオーバーレイに1セットだけ配置） ----------
  const selFrame = document.getElementById('selFrame');
  const selDeleteHandle = document.getElementById('selDeleteHandle');
  const selMoveHandle = document.getElementById('selMoveHandle');

  function syncSelectionOverlay(){
    const item = getItem(selectedId);
    if(!item){ selFrame.style.display = 'none'; return; }
    selFrame.style.display = 'block';
    selFrame.style.left = item.x + 'px';
    selFrame.style.top = item.y + 'px';
    selFrame.style.width = item.w + 'px';
    selFrame.style.height = item.h + 'px';
  }

  selDeleteHandle.addEventListener('pointerdown', e => e.stopPropagation());
  selDeleteHandle.addEventListener('click', e => {
    e.stopPropagation();
    if(selectedId) deleteItem(selectedId);
  });

  selMoveHandle.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const item = getItem(selectedId);
    if(!item) return;
    const node = getNode(selectedId);
    const start = stagePointFromEvent(e);
    const orig = { x: item.x, y: item.y };
    if(selMoveHandle.setPointerCapture) try{ selMoveHandle.setPointerCapture(e.pointerId); }catch(err){}
    function onMove(ev){
      const p = stagePointFromEvent(ev);
      item.x = orig.x + (p.x - start.x);
      item.y = orig.y + (p.y - start.y);
      if(node){ node.style.left = item.x + 'px'; node.style.top = item.y + 'px'; }
      syncSelectionOverlay();
    }
    function onUp(){
      try{ selMoveHandle.releasePointerCapture(e.pointerId); }catch(err){}
      selMoveHandle.removeEventListener('pointermove', onMove);
      selMoveHandle.removeEventListener('pointerup', onUp);
      renderGallery(); renderLayers(); syncToggles(); snapshot();
    }
    selMoveHandle.addEventListener('pointermove', onMove);
    selMoveHandle.addEventListener('pointerup', onUp);
  });

  selFrame.querySelectorAll('.resize-handle').forEach(handle => {
    handle.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const item = getItem(selectedId);
      if(!item) return;
      const node = getNode(selectedId);
      const pos = handle.dataset.handle;
      const start = stagePointFromEvent(e);
      const orig = { x: item.x, y: item.y, w: item.w, h: item.h };
      handle.setPointerCapture && (() => { try{ handle.setPointerCapture(e.pointerId); }catch(err){} })();
      function onMove(ev){
        const p = stagePointFromEvent(ev);
        const dx = p.x - start.x, dy = p.y - start.y;
        let { x, y, w, h } = orig;
        const MIN = 24;
        if(pos === 'se'){ w = Math.max(MIN, orig.w + dx); h = Math.max(MIN, orig.h + dy); }
        if(pos === 'sw'){ w = Math.max(MIN, orig.w - dx); x = orig.x + orig.w - w; h = Math.max(MIN, orig.h + dy); }
        if(pos === 'ne'){ w = Math.max(MIN, orig.w + dx); h = Math.max(MIN, orig.h - dy); y = orig.y + orig.h - h; }
        if(pos === 'nw'){ w = Math.max(MIN, orig.w - dx); x = orig.x + orig.w - w; h = Math.max(MIN, orig.h - dy); y = orig.y + orig.h - h; }
        item.x = x; item.y = y; item.w = w; item.h = h;
        if(node) updateItemNode(node, item, { skipText: true });
        syncSelectionOverlay();
      }
      function onUp(){
        try{ handle.releasePointerCapture(e.pointerId); }catch(err){}
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        renderGallery(); renderLayers(); syncToggles(); snapshot();
      }
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
  });

  function startTextEdit(node, item){
    const inner = node.querySelector('.text-inner');
    node.classList.add('editing');
    inner.setAttribute('contenteditable', 'true');
    inner.focus();
    const selectAll = () => {
      const range = document.createRange();
      range.selectNodeContents(inner);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    };
    if(window.requestAnimationFrame) window.requestAnimationFrame(selectAll); else selectAll();
    function onBlur(){
      item.text = (inner.textContent || '').replace(/\n+$/, '');
      inner.setAttribute('contenteditable', 'false');
      node.classList.remove('editing');
      inner.removeEventListener('blur', onBlur);
      renderGallery(); renderLayers(); syncToggles();
    }
    inner.addEventListener('blur', onBlur);
  }

  stage.addEventListener('pointerdown', e => { if(e.target === stage) deselect(); });

  // ---------- 画像読み込み ----------
  function loadImageFile(file, dropPoint){
    if(!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imageCache.set(url, img);

      // ドロップ位置がワイプの上ならワイプの中に画像を入れる
      if(dropPoint){
        const wipeHit = items
          .filter(it => it.type === 'wipe' && dropPoint.x >= it.x && dropPoint.x <= it.x+it.w && dropPoint.y >= it.y && dropPoint.y <= it.y+it.h)
          .sort((a,b) => b.z - a.z)[0];
        if(wipeHit){
          wipeHit.innerSrc = url;
          wipeHit.innerImgEl = img;
          wipeHit.innerScale = 1;
          wipeHit.innerOffsetX = 0;
          wipeHit.innerOffsetY = 0;
          const node = getNode(wipeHit.id);
          if(node) updateItemNode(node, wipeHit);
          selectItem(wipeHit.id);
          renderGallery(); renderLayers(); syncToggles(); snapshot();
          return;
        }
      }

      const hasImage = items.some(it => it.type === 'image');
      let x, y, w, h;
      if(!hasImage){
        x = 0; y = 0; w = canvasW; h = canvasH;
      } else {
        w = canvasW * 0.4;
        h = w * (img.height / img.width);
        x = dropPoint ? dropPoint.x - w/2 : canvasW*0.3;
        y = dropPoint ? dropPoint.y - h/2 : canvasH*0.3;
      }
      const item = { id: 'it'+(idCounter++), type: 'image', x, y, w, h, z: hasImage ? nextZ() : 0, src: url, imgEl: img };
      items.push(item);
      const node = createItemNode(item);
      updateItemNode(node, item);
      selectItem(item.id);
      renderGallery(); renderLayers(); syncToggles(); snapshot();
    };
    img.src = url;
  }

  stage.addEventListener('dragover', e => { e.preventDefault(); stage.classList.add('dragover'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('dragover'));
  stage.addEventListener('drop', e => {
    e.preventDefault(); stage.classList.remove('dragover');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if(file) loadImageFile(file, stagePointFromEvent(e));
  });
  fileInput.addEventListener('change', () => { if(fileInput.files[0]) loadImageFile(fileInput.files[0]); });
  addImageBtn.addEventListener('click', () => fileInput.click());

  addTextBtn.addEventListener('click', () => {
    const item = {
      id: 'it'+(idCounter++), type: 'text', z: nextZ(),
      x: canvasW*0.3, y: canvasH*0.44, w: canvasW*0.4, h: canvasH*0.12,
      text: t('new_text'), fontFamily: 'sans', fontSize: canvasH*0.045, weight: '700',
      color: '#ffffff', align: 'center', frameShape: 'none', frameColor: '#e8342a', frameOpacity: 100,
      outline: false, border: false, borderColor: '#141414', borderWidth: 4,
    };
    items.push(item);
    const node = createItemNode(item);
    updateItemNode(node, item);
    selectItem(item.id);
    renderGallery(); renderLayers(); syncToggles(); snapshot();
  });

  addFrameBtn.addEventListener('click', () => {
    const item = {
      id: 'it'+(idCounter++), type: 'text', z: nextZ(),
      x: canvasW*0.25, y: canvasH*0.4, w: canvasW*0.5, h: canvasH*0.16,
      text: '', fontFamily: 'sans', fontSize: canvasH*0.04, weight: '900',
      color: '#141414', align: 'center', frameShape: 'rounded', frameColor: '#ffffff', frameOpacity: 100,
      outline: false, border: false, borderColor: '#141414', borderWidth: 4,
    };
    items.push(item);
    const node = createItemNode(item);
    updateItemNode(node, item);
    selectItem(item.id);
    renderGallery(); renderLayers(); syncToggles(); snapshot();
  });

  addWipeBtn.addEventListener('click', () => {
    const size = Math.min(canvasW, canvasH) * 0.32;
    const item = {
      id: 'it'+(idCounter++), type: 'wipe', z: nextZ(),
      x: canvasW*0.5 - size/2, y: canvasH*0.5 - size/2, w: size, h: size,
      shape: 'circle', frameColor: '#ffffff', borderWidth: Math.max(2, size*0.012),
      innerSrc: null, innerImgEl: null, innerScale: 1, innerOffsetX: 0, innerOffsetY: 0,
    };
    items.push(item);
    const node = createItemNode(item);
    updateItemNode(node, item);
    selectItem(item.id);
    renderGallery(); renderLayers(); syncToggles(); snapshot();
  });

  // ---------- テンプレート ----------
  function instantiateTemplateItem(def, W, H, z){
    return {
      id: 'it'+(idCounter++),
      type: 'text',
      x: def.nx*W, y: def.ny*H, w: def.squareByH ? def.nh*H : def.nw*W, h: def.nh*H,
      z,
      text: def.textKey ? t(def.textKey) : (def.text || ''),
      fontFamily: def.fontFamily || 'sans',
      fontSize: ((def.longFontSizeRatio && ((def.textKey ? t(def.textKey) : (def.text||'')).length > 2)) ? def.longFontSizeRatio : (def.fontSizeRatio || 0.05)) * H,
      weight: def.weight || '700',
      color: def.color || '#ffffff',
      align: def.align || 'left',
      frameShape: def.frameShape || 'rect',
      frameColor: def.frameColor || '#e8342a',
      frameOpacity: def.frameOpacity != null ? def.frameOpacity : 100,
      outline: !!def.outline,
      border: !!def.border,
      borderColor: def.borderColor || '#141414',
      borderWidth: def.borderWidth != null ? def.borderWidth : Math.max(2, Math.min(def.squareByH ? def.nh*H : def.nw*W, def.nh*H) * 0.025),
    };
  }

  const TEMPLATES = [
    { id:'blank', nameKey:'tpl_blank', items: [] },

    // 速報スタンダード（赤リボン＋白角丸ボックス）
    { id:'breaking', nameKey:'tpl_breaking', items: [
      { nx:0.62, ny:0.03, nw:0.1, nh:0.08, textKey:'default_pickup', fontSizeRatio:0.022, weight:'900', color:'#ffffff', align:'center', frameShape:'pill', frameColor:'#e8342a', frameOpacity:100 },
      { nx:0.73, ny:0.03, nw:0.25, nh:0.08, textKey:'default_change', fontSizeRatio:0.022, weight:'700', color:'#141414', align:'center', frameShape:'rounded', frameColor:'#ffffff', frameOpacity:100 },
      { nx:0.03, ny:0.82, nw:0.16, nh:0.13, text:'NEWS', fontSizeRatio:0.036, weight:'900', color:'#ffffff', align:'center', frameShape:'parallelogram-right', frameColor:'#f2542d', frameOpacity:100 },
      { nx:0.185, ny:0.82, nw:0.795, nh:0.13, textKey:'default_headline', fontSizeRatio:0.042, weight:'900', color:'#141414', align:'left', frameShape:'rounded', frameColor:'#ffffff', frameOpacity:100 },
    ]},

    // バラエティ見出し（時計＋LIVE＋色つきタグ＋白帯ヘッドライン）
    { id:'variety', nameKey:'tpl_variety', items: [
      { nx:0.02, ny:0.03, nw:0.1, nh:0.06, textKey:'default_live', fontSizeRatio:0.022, weight:'900', color:'#ffffff', align:'center', frameShape:'pill', frameColor:'#e8342a', frameOpacity:100 },
      { nx:0.13, ny:0.03, nw:0.26, nh:0.06, textKey:'default_weather', fontFamily:'sans', fontSizeRatio:0.024, weight:'900', color:'#ffffff', align:'left', frameShape:'none', outline:true },
      { nx:0.62, ny:0.03, nw:0.13, nh:0.065, textKey:'default_tag', fontSizeRatio:0.024, weight:'900', color:'#ffffff', align:'center', frameShape:'pill', frameColor:'#17b6d4', frameOpacity:100 },
      { nx:0.76, ny:0.03, nw:0.22, nh:0.065, textKey:'default_change', fontSizeRatio:0.02, weight:'700', color:'#141414', align:'center', frameShape:'rounded', frameColor:'#ffffff', frameOpacity:100 },
      { nx:0.76, ny:0.105, nw:0.22, nh:0.05, textKey:'default_variety_q', fontSizeRatio:0.016, weight:'700', color:'#ffffff', align:'center', frameShape:'rounded', frameColor:'#d6389a', frameOpacity:100 },
      { nx:0.03, ny:0.78, nw:0.28, nh:0.07, textKey:'default_tag', fontSizeRatio:0.028, weight:'900', color:'#ffffff', align:'center', frameShape:'rect', frameColor:'#17b6d4', frameOpacity:100 },
      { nx:0.03, ny:0.85, nw:0.94, nh:0.13, textKey:'default_headline', fontSizeRatio:0.044, weight:'900', color:'#141414', align:'left', frameShape:'rect', frameColor:'#ffffff', frameOpacity:100 },
    ]},

    // 衝撃テロップ（赤スタンプ＋大きな白ヘッドライン）
    { id:'impact', nameKey:'tpl_impact', items: [
      { nx:0.02, ny:0.68, nw:0.164, nh:0.292, squareByH:true, textKey:'default_impact', fontSizeRatio:80/720, longFontSizeRatio:0.038, weight:'900', color:'#ffffff', align:'center', frameShape:'circle', frameColor:'#e8342a', frameOpacity:100, border:true, borderColor:'#ffffff' },
      { nx:0.21, ny:0.8, nw:0.77, nh:0.13, textKey:'default_headline', fontSizeRatio:0.05, weight:'900', color:'#141414', align:'left', frameShape:'rounded', frameColor:'#ffffff', frameOpacity:100 },
    ]},

    // 二段見出し（ナビー×淡ブルーのニ色構成）
    { id:'twotone', nameKey:'tpl_twotone', items: [
      { nx:0.62, ny:0.02, nw:0.13, nh:0.08, textKey:'default_tag', fontSizeRatio:0.024, weight:'900', color:'#ffffff', align:'center', frameShape:'ribbon', frameColor:'#e8342a', frameOpacity:100 },
      { nx:0.76, ny:0.02, nw:0.22, nh:0.08, textKey:'default_change', fontSizeRatio:0.02, weight:'700', color:'#141414', align:'center', frameShape:'rounded', frameColor:'#ffffff', frameOpacity:100 },
      { nx:0.02, ny:0.78, nw:0.32, nh:0.09, textKey:'default_source', fontSizeRatio:0.026, weight:'900', color:'#ffffff', align:'center', frameShape:'rect', frameColor:'#16305c', frameOpacity:100 },
      { nx:0.02, ny:0.87, nw:0.96, nh:0.1, textKey:'default_headline', fontSizeRatio:0.04, weight:'900', color:'#16305c', align:'left', frameShape:'rect', frameColor:'#e8f1ff', frameOpacity:100 },
    ]},

    // 字幕テロップ（縁取り文字・バラエティ質問バー）
    { id:'caption', nameKey:'tpl_caption', items: [
      { nx:0.14, ny:0.03, nw:0.62, nh:0.09, textKey:'default_variety_q', fontSizeRatio:0.028, weight:'900', color:'#ffffff', align:'center', frameShape:'pill', frameColor:'#7a3fd1', frameOpacity:100 },
      { nx:0.78, ny:0.03, nw:0.15, nh:0.09, textKey:'default_tag', fontSizeRatio:0.02, weight:'700', color:'#141414', align:'center', frameShape:'rounded', frameColor:'#ffffff', frameOpacity:100 },
      { nx:0.04, ny:0.76, nw:0.92, nh:0.2, textKey:'default_caption', fontSizeRatio:0.09, weight:'900', color:'#ffe042', align:'center', frameShape:'none', frameColor:'#000000', outline:true },
    ]},

    // フォーマルニュース（紺帯＋白ヘッドライン、シンプル）
    { id:'formal', nameKey:'tpl_formal', items: [
      { nx:0, ny:0.79, nw:0.46, nh:0.075, textKey:'default_tag', fontSizeRatio:0.026, weight:'900', color:'#ffffff', align:'left', frameShape:'rect', frameColor:'#16305c', frameOpacity:100 },
      { nx:0, ny:0.865, nw:1, nh:0.135, textKey:'default_headline', fontSizeRatio:0.048, weight:'900', color:'#141414', align:'left', frameShape:'rect', frameColor:'#ffffff', frameOpacity:100 },
    ]},

    // 監視カメラ風（ビューファインダー枠＋REC＋タイムスタンプ＋カメラID）
    { id:'cctv', nameKey:'tpl_cctv', items: [
      { nx:0, ny:0, nw:1, nh:1, text:'', frameShape:'rect', frameColor:'#ffffff', frameOpacity:0, border:true, borderColor:'#e8e8e8', borderWidth:3 },
      { nx:0.015, ny:0.02, nw:0.07, nh:0.09, text:'┌', fontFamily:'mono', fontSizeRatio:0.07, weight:'900', color:'#ffffff', align:'left', frameShape:'none', outline:true },
      { nx:0.915, ny:0.02, nw:0.07, nh:0.09, text:'┐', fontFamily:'mono', fontSizeRatio:0.07, weight:'900', color:'#ffffff', align:'right', frameShape:'none', outline:true },
      { nx:0.015, ny:0.89, nw:0.07, nh:0.09, text:'└', fontFamily:'mono', fontSizeRatio:0.07, weight:'900', color:'#ffffff', align:'left', frameShape:'none', outline:true },
      { nx:0.915, ny:0.89, nw:0.07, nh:0.09, text:'┘', fontFamily:'mono', fontSizeRatio:0.07, weight:'900', color:'#ffffff', align:'right', frameShape:'none', outline:true },
      { nx:0.07, ny:0.05, nw:0.18, nh:0.055, text:'● REC', fontFamily:'mono', fontSizeRatio:0.024, weight:'900', color:'#ff3b30', align:'left', frameShape:'none', outline:true },
      { nx:0.5, ny:0.05, nw:0.43, nh:0.05, textKey:'default_cctv_time', fontFamily:'mono', fontSizeRatio:0.02, weight:'700', color:'#ffffff', align:'right', frameShape:'none', outline:true },
      { nx:0.07, ny:0.895, nw:0.6, nh:0.05, textKey:'default_camera_id', fontFamily:'mono', fontSizeRatio:0.02, weight:'700', color:'#ffffff', align:'left', frameShape:'none', outline:true },
    ]},

    // デジカメ風（AFフォーカス枠＋バッテリー＋撮影設定＋残り枚数）
    { id:'digicam', nameKey:'tpl_digicam', items: [
      { nx:0.32, ny:0.28, nw:0.36, nh:0.32, text:'', frameShape:'rect', frameColor:'#7CFC7C', frameOpacity:0, border:true, borderColor:'#7CFC7C', borderWidth:2 },
      { nx:0.03, ny:0.03, nw:0.3, nh:0.05, textKey:'default_battery', fontFamily:'sans', fontSizeRatio:0.024, weight:'700', color:'#ffffff', align:'left', frameShape:'none', outline:true },
      { nx:0.45, ny:0.03, nw:0.52, nh:0.05, textKey:'default_rec_timer', fontFamily:'mono', fontSizeRatio:0.022, weight:'900', color:'#ffffff', align:'right', frameShape:'none', outline:true },
      { nx:0.03, ny:0.9, nw:0.6, nh:0.05, textKey:'default_camera_settings', fontFamily:'mono', fontSizeRatio:0.02, weight:'700', color:'#ffffff', align:'left', frameShape:'none', outline:true },
      { nx:0.65, ny:0.9, nw:0.32, nh:0.05, textKey:'default_shots_left', fontFamily:'sans', fontSizeRatio:0.02, weight:'700', color:'#ffffff', align:'right', frameShape:'none', outline:true },
    ]},
  ];

  function syncToggles(){
    if(toggleTime) toggleTime.checked = items.some(it => it.role === 'time');
    if(toggleWeather) toggleWeather.checked = items.some(it => it.role === 'weather');
  }

  toggleTime.addEventListener('change', () => {
    if(toggleTime.checked){
      if(items.some(it => it.role === 'time')) return;
      const item = {
        id: 'it'+(idCounter++), type: 'text', z: nextZ(), role: 'time',
        x: canvasW*0.78, y: canvasH*0.035, w: canvasW*0.19, h: canvasH*0.09,
        text: t('default_time'), fontFamily: 'sans', fontSize: canvasH*0.05, weight: '900',
        color: '#ffffff', align: 'center', frameShape: 'none', frameColor: '#000000', frameOpacity: 100,
        outline: true,
      };
      items.push(item);
      const node = createItemNode(item);
      updateItemNode(node, item);
    } else {
      items.filter(it => it.role === 'time').forEach(it => { const n = getNode(it.id); if(n) n.remove(); });
      items = items.filter(it => it.role !== 'time');
      if(selectedId && !getItem(selectedId)) { selectedId = null; refreshPropPanel(); }
    }
    renderGallery(); renderLayers(); snapshot();
  });

  toggleWeather.addEventListener('change', () => {
    if(toggleWeather.checked){
      if(items.some(it => it.role === 'weather')) return;
      const item = {
        id: 'it'+(idCounter++), type: 'text', z: nextZ(), role: 'weather',
        x: canvasW*0.03, y: canvasH*0.035, w: canvasW*0.4, h: canvasH*0.07,
        text: t('default_weather'), fontFamily: 'sans', fontSize: canvasH*0.034, weight: '700',
        color: '#ffffff', align: 'left', frameShape: 'none', frameColor: '#000000', frameOpacity: 100,
        outline: true,
      };
      items.push(item);
      const node = createItemNode(item);
      updateItemNode(node, item);
    } else {
      items.filter(it => it.role === 'weather').forEach(it => { const n = getNode(it.id); if(n) n.remove(); });
      items = items.filter(it => it.role !== 'weather');
      if(selectedId && !getItem(selectedId)) { selectedId = null; refreshPropPanel(); }
    }
    renderGallery(); renderLayers(); snapshot();
  });

  function applyTemplate(tplId){
    const tpl = TEMPLATES.find(x => x.id === tplId);
    if(!tpl) return;
    currentTplId = tplId;
    items = items.filter(it => it.type === 'image');
    let z = nextZ();
    tpl.items.forEach(def => { items.push(instantiateTemplateItem(def, canvasW, canvasH, z++)); });
    selectedId = null;
    fullRenderDOM();
    refreshPropPanel();
    renderGallery(); renderLayers();
    syncToggles();
    snapshot();
  }

  function renderTemplateThumb(cv, tpl){
    const w = 220, h = 124;
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.clearRect(0,0,w,h);
    c.fillStyle = '#1a1e23';
    c.fillRect(0,0,w,h);
    tpl.items.forEach(def => {
      const item = instantiateTemplateItem(def, w, h, 0);
      drawTextItemComposite(c, item);
    });
  }

  function buildGallery(){
    templateGrid.innerHTML = '';
    TEMPLATES.forEach(tpl => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'template-card' + (tpl.id === currentTplId ? ' active' : '');
      card.dataset.tpl = tpl.id;
      const cv = document.createElement('canvas');
      cv.dataset.tpl = tpl.id;
      const label = document.createElement('span');
      label.setAttribute('data-i18n', tpl.nameKey);
      label.textContent = t(tpl.nameKey);
      card.appendChild(cv);
      card.appendChild(label);
      card.addEventListener('click', () => {
        applyTemplate(tpl.id);
        templateGrid.querySelectorAll('.template-card').forEach(el => el.classList.remove('active'));
        card.classList.add('active');
      });
      templateGrid.appendChild(card);
    });
    renderGallery(); renderLayers(); syncToggles();
  }

  function renderGallery(){
    TEMPLATES.forEach(tpl => {
      const cv = templateGrid.querySelector(`canvas[data-tpl="${tpl.id}"]`);
      if(cv) renderTemplateThumb(cv, tpl);
    });
  }

  // ---------- レイヤー一覧 ----------
  function layerLabel(item){
    if(item.type === 'image') return t('layer_type_image');
    if(item.type === 'wipe') return t('layer_type_wipe') + (item.innerImgEl ? ' 🖼' : '');
    return item.text && item.text.trim() ? item.text.trim() : t('layer_type_text');
  }
  function layerIcon(item){
    if(item.type === 'image') return '🖼';
    if(item.type === 'wipe') return item.shape === 'square' ? '□' : '◯';
    return 'T';
  }

  let dragLayerId = null;

  function renderLayers(){
    const sorted = [...items].sort((a,b) => b.z - a.z);
    layerEmpty.style.display = sorted.length ? 'none' : 'block';
    layerList.innerHTML = '';
    sorted.forEach(item => {
      const row = document.createElement('div');
      row.className = 'layer-row' + (item.id === selectedId ? ' selected' : '');
      row.draggable = true;
      row.dataset.id = item.id;

      const icon = document.createElement('span');
      icon.className = 'layer-row-icon';
      icon.textContent = layerIcon(item);
      row.appendChild(icon);

      const label = document.createElement('span');
      label.className = 'layer-row-label';
      label.textContent = layerLabel(item);
      row.appendChild(label);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'layer-row-del';
      del.textContent = '×';
      del.addEventListener('click', e => { e.stopPropagation(); deleteItem(item.id); });
      row.appendChild(del);

      row.addEventListener('click', () => selectItem(item.id));

      row.addEventListener('dragstart', e => {
        dragLayerId = item.id;
        row.classList.add('dragging-row');
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging-row');
        layerList.querySelectorAll('.layer-row').forEach(r => r.classList.remove('drop-target'));
        dragLayerId = null;
      });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        if(dragLayerId && dragLayerId !== item.id) row.classList.add('drop-target');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
      row.addEventListener('drop', e => {
        e.preventDefault();
        row.classList.remove('drop-target');
        if(!dragLayerId || dragLayerId === item.id) return;
        const dragItem = getItem(dragLayerId);
        const dropItem = getItem(item.id);
        if(!dragItem || !dropItem) return;
        const tmp = dragItem.z;
        dragItem.z = dropItem.z;
        dropItem.z = tmp;
        const dragNode = getNode(dragItem.id), dropNode = getNode(dropItem.id);
        if(dragNode) dragNode.style.zIndex = dragItem.z;
        if(dropNode) dropNode.style.zIndex = dropItem.z;
        renderLayers();
        snapshot();
      });

      layerList.appendChild(row);
    });
  }

  // ---------- 比率変更 ----------
  ratioSelect.addEventListener('change', () => {
    const next = RATIOS[ratioSelect.value] || RATIOS['16:9'];
    const [W, H] = next;
    const sx = W / canvasW, sy = H / canvasH;
    const sMin = Math.min(sx, sy);
    items.forEach(it => {
      it.x *= sx; it.y *= sy; it.w *= sx; it.h *= sy;
      if(it.type === 'text') it.fontSize *= sMin;
      if(it.type === 'wipe'){
        it.innerOffsetX = (it.innerOffsetX||0) * sMin;
        it.innerOffsetY = (it.innerOffsetY||0) * sMin;
        if(it.borderWidth != null) it.borderWidth *= sMin;
      }
      if(it.type === 'text' && it.borderWidth != null) it.borderWidth *= sMin;
    });
    canvasW = W; canvasH = H;
    layoutStage();
    fullRenderDOM();
    renderGallery(); renderLayers(); syncToggles();
    snapshot();
  });

  // ---------- ダウンロード ----------
  downloadBtn.addEventListener('click', async () => {
    if(document.fonts && document.fonts.ready) await document.fonts.ready;
    const exportCanvas = document.createElement('canvas');
    renderComposite(exportCanvas, canvasW, canvasH, items);
    exportCanvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      dlLink.href = url;
      dlLink.download = 'newsgen.png';
      dlLink.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, 'image/png');
  });

  // ---------- 元に戻す・やり直す(履歴) ----------
  let history = [];
  let historyIndex = -1;
  let isRestoring = false;
  let snapshotTimer = null;

  function serializeItems(){
    return items.map(it => {
      const copy = Object.assign({}, it);
      delete copy.imgEl;
      delete copy.innerImgEl;
      return copy;
    });
  }

  function snapshot(){
    if(isRestoring) return;
    clearTimeout(snapshotTimer);
    history = history.slice(0, historyIndex + 1);
    history.push(JSON.stringify(serializeItems()));
    if(history.length > 50) history.shift();
    historyIndex = history.length - 1;
    updateHistoryButtons();
  }

  function scheduleSnapshot(){
    if(isRestoring) return;
    clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(snapshot, 500);
  }

  function restoreIndex(idx){
    isRestoring = true;
    const data = JSON.parse(history[idx]);
    items = data.map(d => {
      if(d.type === 'image') d.imgEl = imageCache.get(d.src) || null;
      if(d.type === 'wipe' && d.innerSrc) d.innerImgEl = imageCache.get(d.innerSrc) || null;
      return d;
    });
    selectedId = null;
    fullRenderDOM();
    refreshPropPanel();
    renderGallery(); renderLayers();
    syncToggles();
    isRestoring = false;
  }

  function undo(){
    if(historyIndex <= 0) return;
    historyIndex--;
    restoreIndex(historyIndex);
    updateHistoryButtons();
  }
  function redo(){
    if(historyIndex >= history.length - 1) return;
    historyIndex++;
    restoreIndex(historyIndex);
    updateHistoryButtons();
  }
  function updateHistoryButtons(){
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= history.length - 1;
  }
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  // ---------- キーボード削除・元に戻す ----------
  document.addEventListener('keydown', e => {
    if((e.key === 'Delete' || e.key === 'Backspace') && selectedId){
      const active = document.activeElement;
      if(active && active.isContentEditable) return;
      deleteSelected();
      e.preventDefault();
      return;
    }
    const active = document.activeElement;
    if(active && active.isContentEditable) return;
    const key = e.key.toLowerCase();
    if((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey){ e.preventDefault(); undo(); }
    else if((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))){ e.preventDefault(); redo(); }
  });

  // ---------- i18n連携 ----------
  window.newsgenOnLangChange = () => {
    templateGrid.querySelectorAll('.template-card span').forEach(span => {
      span.textContent = t(span.getAttribute('data-i18n'));
    });
    renderGallery(); renderLayers(); syncToggles();
  };

  // ---------- サイドバーの折りたたみ ----------
  document.querySelectorAll('.panel-h2[data-collapse-target]').forEach(h2 => {
    h2.addEventListener('click', () => {
      const block = h2.closest('.panel-block');
      if(block) block.classList.toggle('collapsed');
    });
  });

  // ---------- 初期化 ----------
  document.addEventListener('DOMContentLoaded', () => {
    layoutStage();
    buildGallery();
    applyTemplate(currentTplId);
    window.addEventListener('resize', layoutStage);
    if(document.fonts && document.fonts.ready){
      document.fonts.ready.then(() => { layoutStage(); fullRenderDOM(); renderGallery(); renderLayers(); syncToggles(); });
    }
  });
})();
