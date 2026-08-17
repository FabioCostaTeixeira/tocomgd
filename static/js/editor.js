(() => {
  "use strict";

  const SIZE = 1080;
  const MAX_WORK_SIDE = 2800;
  const MAX_FALLBACK_PIXELS = 16_000_000;
  const MAX_FALLBACK_SIDE = 4096;
  const ALLOWED_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
  const MAX_FILE_BYTES = 15 * 1024 * 1024;
  const canvas = document.getElementById("artCanvas");
  const canvasWrap = document.getElementById("canvasWrap");
  const ctx = canvas.getContext("2d", { alpha: false });
  const photoInput = document.getElementById("photoInput");
  const emptyState = document.getElementById("emptyState");
  const processing = document.getElementById("processing");
  const processingTitle = document.getElementById("processingTitle");
  const processingText = document.getElementById("processingText");
  const adjustments = document.getElementById("adjustments");
  const primaryControls = document.getElementById("primaryControls");
  const zoomRange = document.getElementById("zoomRange");
  const zoomValue = document.getElementById("zoomValue");
  const zoomDec = document.getElementById("zoomDec");
  const zoomInc = document.getElementById("zoomInc");
  const resetButton = document.getElementById("resetButton");
  const rotateButton = document.getElementById("rotateButton");
  const downloadButton = document.getElementById("downloadButton");
  const resultCard = document.getElementById("resultCard");
  const resultImage = document.getElementById("resultImage");
  const resultHint = document.getElementById("resultHint");
  const toast = document.getElementById("toast");
  const toastIcon = document.getElementById("toastIcon");
  const toastMessage = document.getElementById("toastMessage");
  const guideV = document.getElementById("guideV");
  const guideH = document.getElementById("guideH");
  const maskRadios = [...document.querySelectorAll(".template-radio")];

  const maskImages = {
    rosa: document.getElementById("maskRosa"),
    azul: document.getElementById("maskAzul"),
  };

  const maskReady = { rosa: false, azul: false };

  const TOAST_ICONS = {
    info: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="8" r="1" fill="currentColor"/></svg>',
    success: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M8 12.3l2.6 2.6L16 9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5v5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>',
  };

  let selectedMask =
    document.querySelector(".template-radio:checked")?.value || "rosa";
  let personImage = null;
  let personW = 0;
  let personH = 0;
  let personUrl = null;
  let resultUrl = null;
  let isBusy = false;
  let baseScale = 1;
  let person = { x: SIZE / 2, y: SIZE / 2, scale: 1, rotation: 0 };
  let toastTimer = null;

  const pointers = new Map();
  let dragState = null;
  let pinchState = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // Caixa delimitadora da imagem já rotacionada — imagem girada ocupa uma
  // área maior que w×h puro, e clampPerson() precisa dessa área maior para
  // não deixar a pessoa escapar do canvas perto de 45°.
  function bboxGirado(w, h, rotation) {
    const c = Math.abs(Math.cos(rotation));
    const s = Math.abs(Math.sin(rotation));
    return { w: w * c + h * s, h: w * s + h * c };
  }

  function clampPerson() {
    if (!personImage) return;
    const { w: width, h: height } = bboxGirado(
      personW * person.scale,
      personH * person.scale,
      person.rotation
    );
    const minVisible = SIZE * 0.16;

    person.x = clamp(person.x, minVisible - width / 2, SIZE - minVisible + width / 2);
    person.y = clamp(person.y, minVisible - height / 2, SIZE - minVisible + height / 2);
  }

  function showToast(message, type = "info") {
    window.clearTimeout(toastTimer);
    toastMessage.textContent = message;
    toastIcon.innerHTML = TOAST_ICONS[type] || TOAST_ICONS.info;
    toast.dataset.type = type;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  }

  function invalidateResult() {
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      resultUrl = null;
    }
    if (resultImage) resultImage.removeAttribute("src");
    if (resultCard) resultCard.hidden = true;
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function showResult(blob) {
    invalidateResult();
    resultUrl = URL.createObjectURL(blob);
    resultImage.src = resultUrl;
    resultCard.hidden = false;
    resultHint.hidden = !isIOS();
  }

  function setBusy(busy, title = "Processando…", text = "") {
    isBusy = busy;
    processingTitle.textContent = title;
    processingText.textContent = text;
    processing.hidden = !busy;
    photoInput.disabled = busy;
    maskRadios.forEach((radio) => {
      radio.disabled = busy;
    });
    downloadButton.disabled = busy || !personImage;
  }

  function currentMaskImage() {
    return maskImages[selectedMask] || maskImages.rosa;
  }

  function applyMaskAccent() {
    document.body.dataset.mask = selectedMask;
  }

  function draw() {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SIZE, SIZE);

    if (personImage) {
      const width = personW * person.scale;
      const height = personH * person.scale;
      ctx.save();
      ctx.translate(person.x, person.y);
      ctx.rotate(person.rotation);
      ctx.drawImage(personImage, -width / 2, -height / 2, width, height);
      ctx.restore();
    }

    const mask = currentMaskImage();
    if (mask && maskReady[selectedMask]) {
      ctx.drawImage(mask, 0, 0, SIZE, SIZE);
    }

    ctx.restore();
  }

  function updateZoomUI() {
    const percent = Math.round((person.scale / baseScale) * 100);
    const clamped = clamp(percent, 50, 250);
    zoomRange.value = String(clamped);
    zoomValue.value = `${clamped}%`;
    zoomValue.textContent = `${clamped}%`;
  }

  function setZoomPercent(percent) {
    if (!personImage) return;
    const clamped = clamp(percent, 50, 250);
    person.scale = baseScale * (clamped / 100);
    clampPerson();
    updateZoomUI();
    invalidateResult();
    draw();
  }

  function autoFitPerson() {
    if (!personImage) return;

    // person.rotation NÃO é tocado aqui de propósito: "Centralizar" reposiciona
    // e reenquadra, mas a rotação foi escolha deliberada do usuário e não deve
    // ser desfeita por esse botão.
    const scaleByWidth = (SIZE * 0.90) / personW;
    const scaleByHeight = (SIZE * 0.94) / personH;
    baseScale = Math.min(scaleByWidth, scaleByHeight);

    person.scale = baseScale;
    person.x = SIZE / 2;

    const renderedHeight = bboxGirado(
      personW * person.scale,
      personH * person.scale,
      person.rotation
    ).h;
    const bottomMargin = 18;
    person.y = SIZE - bottomMargin - renderedHeight / 2;

    clampPerson();
    updateZoomUI();
    invalidateResult();
    draw();
  }

  function pointInCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * SIZE,
      y: ((event.clientY - rect.top) / rect.height) * SIZE,
    };
  }

  function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function angleBetween(a, b) {
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  // Normaliza uma diferença de ângulo para (-π, π], evitando saltos de 360°
  // quando o gesto atravessa a descontinuidade de atan2 em ±180°.
  function normalizeAngleDelta(delta) {
    let d = delta % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }

  const ROTATION_DEAD_ZONE = (8 * Math.PI) / 180; // só engata rotação após 8°
  const ROTATION_SNAP = (5 * Math.PI) / 180; // encaixa em 0/90/180/270 dentro de 5°
  const QUARTER_TURN = Math.PI / 2;

  // Ao soltar os dedos, se a rotação acumulada estiver perto o bastante de um
  // múltiplo de 90°, encaixa nele — evita deixar a foto "quase reta".
  function snapRotationIfClose() {
    const nearest = Math.round(person.rotation / QUARTER_TURN) * QUARTER_TURN;
    if (Math.abs(person.rotation - nearest) <= ROTATION_SNAP) {
      person.rotation = nearest;
    }
  }

  function rotatePersonBy90() {
    if (!personImage || isBusy) return;
    person.rotation += QUARTER_TURN;
    clampPerson();
    invalidateResult();
    draw();
  }

  function setDragging(active) {
    canvasWrap.classList.toggle("is-dragging", active);
  }

  function startGestureState() {
    const values = [...pointers.values()];

    if (values.length === 1) {
      pinchState = null;
      dragState = {
        startPointer: { ...values[0] },
        startX: person.x,
        startY: person.y,
      };
      setDragging(true);
    } else if (values.length >= 2) {
      dragState = null;
      const a = values[0];
      const b = values[1];
      pinchState = {
        startDistance: Math.max(1, distance(a, b)),
        startMidpoint: midpoint(a, b),
        startScale: person.scale,
        startX: person.x,
        startY: person.y,
        startAngle: angleBetween(a, b),
        startRotation: person.rotation,
        rotationEngaged: false,
      };
      setDragging(true);
    } else {
      setDragging(false);
    }
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!personImage || isBusy) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, pointInCanvas(event));
    startGestureState();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId) || !personImage || isBusy) return;
    event.preventDefault();
    pointers.set(event.pointerId, pointInCanvas(event));

    const values = [...pointers.values()];

    if (values.length === 1 && dragState) {
      person.x = dragState.startX + values[0].x - dragState.startPointer.x;
      person.y = dragState.startY + values[0].y - dragState.startPointer.y;
      clampPerson();
      invalidateResult();
      draw();
      return;
    }

    if (values.length >= 2 && pinchState) {
      const a = values[0];
      const b = values[1];
      const currentMidpoint = midpoint(a, b);
      const ratio = distance(a, b) / pinchState.startDistance;
      const minScale = baseScale * 0.5;
      const maxScale = baseScale * 2.5;

      // Zona morta: só passa a acompanhar o ângulo do gesto depois que o giro
      // acumulado ultrapassa ROTATION_DEAD_ZONE — sem isso, quem só quer dar
      // zoom termina com a foto alguns graus torta sem perceber.
      const angleDelta = normalizeAngleDelta(angleBetween(a, b) - pinchState.startAngle);
      if (!pinchState.rotationEngaged && Math.abs(angleDelta) > ROTATION_DEAD_ZONE) {
        pinchState.rotationEngaged = true;
      }
      if (pinchState.rotationEngaged) {
        person.rotation = pinchState.startRotation + angleDelta;
      }

      person.scale = clamp(pinchState.startScale * ratio, minScale, maxScale);
      person.x = pinchState.startX + currentMidpoint.x - pinchState.startMidpoint.x;
      person.y = pinchState.startY + currentMidpoint.y - pinchState.startMidpoint.y;
      clampPerson();
      updateZoomUI();
      invalidateResult();
      draw();
    }
  });

  function finishPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (pinchState?.rotationEngaged && pointers.size < 2) {
      snapRotationIfClose();
      clampPerson();
      invalidateResult();
      draw();
    }
    startGestureState();
  }

  canvas.addEventListener("pointerup", finishPointer);
  canvas.addEventListener("pointercancel", finishPointer);
  canvas.addEventListener("lostpointercapture", finishPointer);

  canvas.addEventListener("keydown", (event) => {
    if (!personImage || isBusy) return;
    const step = event.shiftKey ? 24 : 6;

    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        person.y -= step;
        clampPerson();
        invalidateResult();
        draw();
        break;
      case "ArrowDown":
        event.preventDefault();
        person.y += step;
        clampPerson();
        invalidateResult();
        draw();
        break;
      case "ArrowLeft":
        event.preventDefault();
        person.x -= step;
        clampPerson();
        invalidateResult();
        draw();
        break;
      case "ArrowRight":
        event.preventDefault();
        person.x += step;
        clampPerson();
        invalidateResult();
        draw();
        break;
      case "+":
      case "=":
        event.preventDefault();
        setZoomPercent(Number(zoomRange.value) + 5);
        break;
      case "-":
      case "_":
        event.preventDefault();
        setZoomPercent(Number(zoomRange.value) - 5);
        break;
      case "Home":
        event.preventDefault();
        autoFitPerson();
        break;
      case "r":
      case "R":
        event.preventDefault();
        rotatePersonBy90();
        break;
      default:
        break;
    }
  });

  zoomRange.addEventListener("input", () => setZoomPercent(Number(zoomRange.value)));
  zoomDec.addEventListener("click", () => setZoomPercent(Number(zoomRange.value) - 10));
  zoomInc.addEventListener("click", () => setZoomPercent(Number(zoomRange.value) + 10));

  resetButton.addEventListener("click", autoFitPerson);
  rotateButton.addEventListener("click", rotatePersonBy90);

  maskRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      selectedMask = radio.value;
      applyMaskAccent();
      invalidateResult();
      draw();
      showToast(selectedMask === "rosa" ? "Modelo Rosa selecionado." : "Modelo Azul selecionado.");
    });
  });

  // ---------------------------------------------------------------------
  // Task 4 — leitura leve de metadados (dimensões + orientação EXIF), sem
  // decodificar pixel nenhum. Serve de base para o Task 5 calcular o
  // resize correto ANTES de chamar createImageBitmap.
  // ---------------------------------------------------------------------

  const JPEG_HEADER_PROBE_BYTES = 1_048_576; // 1 MB cobre EXIF+thumbnail+ICC de qualquer foto real

  function readAscii(view, offset, length) {
    let out = "";
    for (let i = 0; i < length; i += 1) out += String.fromCharCode(view.getUint8(offset + i));
    return out;
  }

  function readUint24LE(view, offset) {
    return view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
  }

  function isPngSignature(view) {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < 8; i += 1) {
      if (view.getUint8(i) !== sig[i]) return false;
    }
    return true;
  }

  // Lê a tag Orientation (0x0112) de um bloco TIFF/EXIF que começa em
  // `tiffStart` dentro de `view`. Devolve null sempre que o EXIF não puder
  // ser lido com confiança (nunca lança) — orientação ausente/ilegível vira
  // orientation=1 e orientationTagOffset=null no chamador.
  function parseExifOrientation(view, tiffStart) {
    if (tiffStart + 8 > view.byteLength) return null;

    const b0 = view.getUint8(tiffStart);
    const b1 = view.getUint8(tiffStart + 1);
    let littleEndian;
    if (b0 === 0x49 && b1 === 0x49) littleEndian = true;
    else if (b0 === 0x4d && b1 === 0x4d) littleEndian = false;
    else return null;

    if (view.getUint16(tiffStart + 2, littleEndian) !== 42) return null;

    const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
    const ifdStart = tiffStart + ifd0Offset;
    if (ifdStart + 2 > view.byteLength) return null;

    const entryCount = view.getUint16(ifdStart, littleEndian);
    const entriesEnd = ifdStart + 2 + entryCount * 12;
    if (entriesEnd > view.byteLength) return null;

    for (let i = 0; i < entryCount; i += 1) {
      const entryOffset = ifdStart + 2 + i * 12;
      const tag = view.getUint16(entryOffset, littleEndian);
      if (tag !== 0x0112) continue;

      const type = view.getUint16(entryOffset + 2, littleEndian);
      if (type !== 3) return null; // Orientation deveria ser SHORT; formato inesperado = ilegível

      // Numa IFD entry o valor começa em entryOffset + 8 (2 bytes de tag,
      // 2 de tipo, 4 de contagem) — é aí que a neutralização escreve depois.
      const valueOffset = entryOffset + 8;
      const value = view.getUint16(valueOffset, littleEndian);
      if (value < 1 || value > 8) return null;

      return { orientation: value, orientationTagOffset: valueOffset, littleEndian };
    }

    return null; // tag Orientation ausente
  }

  // Escaneia os marcadores JPEG a partir de `buf` (pode ser só um prefixo do
  // arquivo). `reachedEnd` indica se o scan chegou a SOS/EOI dentro do
  // buffer disponível — usado pelo chamador para decidir se vale reler o
  // arquivo inteiro em busca de SOF/EXIF que ficaram fora do prefixo.
  function parseJpegBuffer(buf) {
    const view = new DataView(buf);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;

    let offset = 2;
    let rawWidth = null;
    let rawHeight = null;
    let orientation = 1;
    let orientationTagOffset = null;
    let littleEndian = true;
    let reachedEnd = false;

    while (offset + 2 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;

      let marker = view.getUint8(offset + 1);
      offset += 2;
      while (marker === 0xff && offset < view.byteLength) {
        marker = view.getUint8(offset);
        offset += 1;
      }

      if (marker === 0xd9) { reachedEnd = true; break; } // EOI
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue; // TEM/RSTn: sem payload

      if (offset + 2 > view.byteLength) break;
      const segLength = view.getUint16(offset);
      const segDataStart = offset + 2;
      const segDataLength = Math.max(0, segLength - 2);
      const availableEnd = Math.min(view.byteLength, segDataStart + segDataLength);

      const isSOF =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

      if (isSOF && segDataStart + 5 <= availableEnd) {
        rawHeight = view.getUint16(segDataStart + 1);
        rawWidth = view.getUint16(segDataStart + 3);
      }

      if (marker === 0xe1 && segDataStart + 6 <= availableEnd) {
        const isExif =
          view.getUint8(segDataStart) === 0x45 &&
          view.getUint8(segDataStart + 1) === 0x78 &&
          view.getUint8(segDataStart + 2) === 0x69 &&
          view.getUint8(segDataStart + 3) === 0x66 &&
          view.getUint8(segDataStart + 4) === 0x00 &&
          view.getUint8(segDataStart + 5) === 0x00;

        if (isExif) {
          const exifResult = parseExifOrientation(view, segDataStart + 6);
          if (exifResult) {
            orientation = exifResult.orientation;
            orientationTagOffset = exifResult.orientationTagOffset;
            littleEndian = exifResult.littleEndian;
          }
        }
      }

      if (marker === 0xda) { reachedEnd = true; break; } // SOS: começam os dados comprimidos

      if (segDataStart + segDataLength > view.byteLength) break; // não dá pra saber onde o próximo marcador começa

      offset = segDataStart + segDataLength;
    }

    return { rawWidth, rawHeight, orientation, orientationTagOffset, littleEndian, reachedEnd };
  }

  async function readJpegMeta(file) {
    const probeSize = Math.min(file.size, JPEG_HEADER_PROBE_BYTES);
    let result = parseJpegBuffer(await file.slice(0, probeSize).arrayBuffer());

    const needsFullFile =
      probeSize < file.size &&
      (!result || result.rawWidth == null || (!result.reachedEnd && result.orientationTagOffset == null));

    if (needsFullFile) {
      result = parseJpegBuffer(await file.arrayBuffer());
    }

    if (!result || result.rawWidth == null || result.rawHeight == null) return null;

    return {
      rawWidth: result.rawWidth,
      rawHeight: result.rawHeight,
      orientation: result.orientation,
      orientationTagOffset: result.orientationTagOffset,
      littleEndian: result.littleEndian,
    };
  }

  function parsePngMeta(buf) {
    const view = new DataView(buf);
    if (view.byteLength < 24 || !isPngSignature(view)) return null;

    // O primeiro chunk de um PNG válido é sempre IHDR, logo após a assinatura.
    const chunkType = readAscii(view, 12, 4);
    if (chunkType !== "IHDR") return null;

    const rawWidth = view.getUint32(16, false);
    const rawHeight = view.getUint32(20, false);
    if (!rawWidth || !rawHeight) return null;

    return { rawWidth, rawHeight, orientation: 1, orientationTagOffset: null, littleEndian: true };
  }

  function parseWebpMeta(buf) {
    const view = new DataView(buf);
    if (view.byteLength < 20) return null;
    if (readAscii(view, 0, 4) !== "RIFF" || readAscii(view, 8, 4) !== "WEBP") return null;

    const fourCC = readAscii(view, 12, 4);
    const dataStart = 20;
    let rawWidth = null;
    let rawHeight = null;

    if (fourCC === "VP8X" && dataStart + 10 <= view.byteLength) {
      rawWidth = readUint24LE(view, dataStart + 4) + 1;
      rawHeight = readUint24LE(view, dataStart + 7) + 1;
    } else if (fourCC === "VP8 " && dataStart + 10 <= view.byteLength) {
      rawWidth = view.getUint16(dataStart + 6, true) & 0x3fff;
      rawHeight = view.getUint16(dataStart + 8, true) & 0x3fff;
    } else if (fourCC === "VP8L" && dataStart + 5 <= view.byteLength && view.getUint8(dataStart) === 0x2f) {
      const bits = view.getUint32(dataStart + 1, true);
      rawWidth = (bits & 0x3fff) + 1;
      rawHeight = ((bits >>> 14) & 0x3fff) + 1;
    } else {
      return null;
    }

    if (!rawWidth || !rawHeight) return null;
    return { rawWidth, rawHeight, orientation: 1, orientationTagOffset: null, littleEndian: true };
  }

  function finalizeMeta(partial) {
    const swapsAxes = [5, 6, 7, 8].includes(partial.orientation);
    return {
      rawWidth: partial.rawWidth,
      rawHeight: partial.rawHeight,
      orientation: partial.orientation,
      orientedWidth: swapsAxes ? partial.rawHeight : partial.rawWidth,
      orientedHeight: swapsAxes ? partial.rawWidth : partial.rawHeight,
      orientationTagOffset: partial.orientationTagOffset,
      littleEndian: partial.littleEndian,
    };
  }

  // Contrato (Task 4): { rawWidth, rawHeight, orientation, orientedWidth,
  // orientedHeight, orientationTagOffset, littleEndian }, ou null se o
  // formato não for reconhecido (o fallback decide o que fazer nesse caso).
  // Nunca lança por causa de metadata malformada.
  async function readImageMeta(file) {
    const headBuf = await file.slice(0, 32).arrayBuffer();
    const headView = new DataView(headBuf);

    if (
      headView.byteLength >= 3 &&
      headView.getUint8(0) === 0xff &&
      headView.getUint8(1) === 0xd8 &&
      headView.getUint8(2) === 0xff
    ) {
      const jpegMeta = await readJpegMeta(file);
      return jpegMeta ? finalizeMeta(jpegMeta) : null;
    }

    if (headView.byteLength >= 8 && isPngSignature(headView)) {
      const pngMeta = parsePngMeta(await file.slice(0, 24).arrayBuffer());
      return pngMeta ? finalizeMeta(pngMeta) : null;
    }

    if (
      headView.byteLength >= 12 &&
      readAscii(headView, 0, 4) === "RIFF" &&
      readAscii(headView, 8, 4) === "WEBP"
    ) {
      const webpMeta = parseWebpMeta(await file.slice(0, 30).arrayBuffer());
      return webpMeta ? finalizeMeta(webpMeta) : null;
    }

    return null;
  }

  // ---------------------------------------------------------------------
  // Task 5 — imagem de trabalho otimizada.
  //
  // Pipeline (decisão de design da migração — NÃO usar imageOrientation
  // do createImageBitmap, em nenhum valor):
  //   1. Task 4 lê dimensões + orientação sem decodificar pixel nenhum.
  //   2. Neutraliza a tag Orientation do JPEG para 1 direto nos bytes do
  //      header (sem tocar em pixel). A spec renomeou "none" para
  //      "from-image" e pode reintroduzir "none" com outro sentido no
  //      futuro — não é seguro depender de nenhum dos dois valores. E sem
  //      saber se o navegador vai girar a imagem não dá pra calcular
  //      resizeWidth/resizeHeight certo: errar o eixo distorce a foto, não
  //      só deixa girada.
  //   3. createImageBitmap decodifica já neutralizado: sai SEM rotação
  //      alguma, deterministicamente, em qualquer navegador.
  //   4. Um canvas intermediário aplica a rotação/espelhamento manualmente
  //      (switch 1..8) com base na orientação que o Task 4 leu — foto de
  //      retrato de iPhone é gravada deitada com Orientation=6, é o caso
  //      comum, não a exceção.
  // ---------------------------------------------------------------------

  const FALLBACK_TOO_LARGE_MESSAGE =
    "Não foi possível processar esta foto neste aparelho. Tente usar uma foto menor ou uma captura de tela da foto.";

  function fitInside(width, height, maxSide) {
    const ratio = Math.min(1, maxSide / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * ratio)),
      height: Math.max(1, Math.round(height * ratio)),
    };
  }

  // Substitui só os 2 bytes do VALOR da tag Orientation por 1, direto nos
  // bytes do arquivo — file.slice() é lazy, não materializa pixel nenhum.
  function neutralizeJpegOrientation(file, meta) {
    if (meta.orientation === 1 || meta.orientationTagOffset == null) {
      return file; // nada a fazer
    }
    const valor = new ArrayBuffer(2);
    new DataView(valor).setUint16(0, 1, meta.littleEndian);
    return new Blob(
      [
        file.slice(0, meta.orientationTagOffset),
        valor,
        file.slice(meta.orientationTagOffset + 2),
      ],
      { type: file.type }
    );
  }

  // Aplica manualmente a rotação/espelhamento EXIF (1..8) num canvas
  // intermediário. `bitmap` é o resultado CRU do createImageBitmap
  // (dimensões pré-rotação, eixos trocados quando orientation é 5..8);
  // outW/outH são as dimensões já orientadas de destino.
  function applyOrientation(bitmap, orientation, outW, outH) {
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx2d = canvas.getContext("2d");
    const w = bitmap.width;
    const h = bitmap.height;

    switch (orientation) {
      case 2: ctx2d.transform(-1, 0, 0, 1, w, 0); break;   // espelho horizontal
      case 3: ctx2d.transform(-1, 0, 0, -1, w, h); break;  // 180°
      case 4: ctx2d.transform(1, 0, 0, -1, 0, h); break;   // espelho vertical
      case 5: ctx2d.transform(0, 1, 1, 0, 0, 0); break;    // transpose
      case 6: ctx2d.transform(0, 1, -1, 0, h, 0); break;   // 90° horário
      case 7: ctx2d.transform(0, -1, -1, 0, h, w); break;  // transverse
      case 8: ctx2d.transform(0, -1, 1, 0, 0, w); break;   // 90° anti-horário
      default: break;                                      // 1: identidade
    }
    ctx2d.drawImage(bitmap, 0, 0);
    return canvas;
  }

  async function loadPersonViaImageBitmap(file, meta) {
    let bitmap = null;
    try {
      const target = fitInside(meta.orientedWidth, meta.orientedHeight, MAX_WORK_SIDE);
      const swapsAxes = [5, 6, 7, 8].includes(meta.orientation);
      const decodeWidth = swapsAxes ? target.height : target.width;
      const decodeHeight = swapsAxes ? target.width : target.height;

      const source = neutralizeJpegOrientation(file, meta);
      bitmap = await createImageBitmap(source, {
        resizeWidth: decodeWidth,
        resizeHeight: decodeHeight,
        resizeQuality: "high",
      });

      const outCanvas = applyOrientation(bitmap, meta.orientation, target.width, target.height);
      return { image: outCanvas, width: target.width, height: target.height };
    } catch (error) {
      return null; // deixa o chamador cair no fallback <img>
    } finally {
      bitmap?.close?.();
    }
  }

  // Fallback para navegadores sem createImageBitmap/resize: <img> + decode()
  // (aplica EXIF sozinho via image-orientation:from-image nativo do
  // elemento — é o comportamento atual em produção, preservado aqui).
  async function loadPersonViaImg(file, meta) {
    if (meta) {
      const pixels = meta.orientedWidth * meta.orientedHeight;
      const maxSide = Math.max(meta.orientedWidth, meta.orientedHeight);
      if (pixels > MAX_FALLBACK_PIXELS || maxSide > MAX_FALLBACK_SIDE) {
        throw new Error(FALLBACK_TOO_LARGE_MESSAGE);
      }
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    image.src = url;

    try {
      await image.decode();
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }

    // Sem meta prévia (formato que o parser leve não reconhece): valida
    // depois de decodificado, com as dimensões reais.
    if (!meta) {
      const pixels = image.naturalWidth * image.naturalHeight;
      const maxSide = Math.max(image.naturalWidth, image.naturalHeight);
      if (pixels > MAX_FALLBACK_PIXELS || maxSide > MAX_FALLBACK_SIDE) {
        URL.revokeObjectURL(url);
        throw new Error(FALLBACK_TOO_LARGE_MESSAGE);
      }
    }

    personUrl = url;
    return { image, width: image.naturalWidth, height: image.naturalHeight };
  }

  function releasePersonImage() {
    personImage?.close?.();
    if (personUrl) {
      URL.revokeObjectURL(personUrl);
      personUrl = null;
    }
    personImage = null;
    personW = 0;
    personH = 0;
  }

  async function loadPersonFromBlob(file) {
    const meta = await readImageMeta(file).catch(() => null);

    let loaded = null;
    if (meta && typeof createImageBitmap === "function") {
      loaded = await loadPersonViaImageBitmap(file, meta);
    }
    if (!loaded) {
      loaded = await loadPersonViaImg(file, meta);
    }

    releasePersonImage();
    personImage = loaded.image;
    personW = loaded.width;
    personH = loaded.height;
    person.rotation = 0;
    invalidateResult();

    emptyState.hidden = true;
    adjustments.hidden = false;
    primaryControls.hidden = true;
    downloadButton.disabled = false;
    autoFitPerson();
  }

  async function processFile(file) {
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      showToast("Selecione uma imagem válida.", "error");
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      showToast("A foto deve ter no máximo 15 MB.", "error");
      return;
    }

    invalidateResult();
    setBusy(true, "Carregando…");

    try {
      await loadPersonFromBlob(file);
      showToast("Foto carregada. Agora ajuste a posição.", "success");
    } catch (error) {
      const message =
        error?.message === FALLBACK_TOO_LARGE_MESSAGE
          ? FALLBACK_TOO_LARGE_MESSAGE
          : "Não foi possível ler essa imagem.";
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files?.[0];
    photoInput.value = "";
    await processFile(file);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    canvasWrap.addEventListener(eventName, (event) => {
      if (isBusy) return;
      event.preventDefault();
      canvasWrap.classList.add("is-drag-over");
    });
  });

  ["dragleave", "dragend"].forEach((eventName) => {
    canvasWrap.addEventListener(eventName, () => {
      canvasWrap.classList.remove("is-drag-over");
    });
  });

  canvasWrap.addEventListener("drop", async (event) => {
    event.preventDefault();
    canvasWrap.classList.remove("is-drag-over");
    if (isBusy) return;
    const file = event.dataTransfer?.files?.[0];
    await processFile(file);
  });

  downloadButton.addEventListener("click", async () => {
    if (!personImage || isBusy) return;

    setBusy(true, "Gerando a arte…", "Preparando o PNG em 1080×1080.");

    try {
      draw();
      const resultBlob = await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Não foi possível gerar a imagem."));
        }, "image/png");
      });
      showResult(resultBlob);

      const link = document.createElement("a");
      link.href = resultUrl;
      link.download = `arte-campanha-${selectedMask}-1080x1080.png`;
      if (!isIOS()) {
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      showToast("Imagem gerada com sucesso.", "success");
    } catch (error) {
      showToast(error.message || "Não foi possível gerar a imagem.", "error");
    } finally {
      setBusy(false);
    }
  });

  Object.entries(maskImages).forEach(([name, image]) => {
    if (!image) return;

    image.addEventListener("load", () => {
      maskReady[name] = true;
      draw();
    });

    image.addEventListener("error", () => {
      maskReady[name] = false;
      draw();
      showToast(`A máscara ${name} não foi encontrada.`, "error");
    });

    if (image.complete && image.naturalWidth > 0) {
      maskReady[name] = true;
    }
  });

  applyMaskAccent();
  draw();
})();
