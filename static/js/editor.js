(() => {
  "use strict";

  const SIZE = 1080;
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
  const downloadButton = document.getElementById("downloadButton");
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
  let processedBlob = null;
  let personUrl = null;
  let isBusy = false;
  let baseScale = 1;
  let person = { x: SIZE / 2, y: SIZE / 2, scale: 1 };
  let toastTimer = null;

  const pointers = new Map();
  let dragState = null;
  let pinchState = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function clampPerson() {
    if (!personImage) return;
    const width = personImage.naturalWidth * person.scale;
    const height = personImage.naturalHeight * person.scale;
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
      const width = personImage.naturalWidth * person.scale;
      const height = personImage.naturalHeight * person.scale;
      ctx.drawImage(
        personImage,
        person.x - width / 2,
        person.y - height / 2,
        width,
        height
      );
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
    draw();
  }

  function autoFitPerson() {
    if (!personImage) return;

    const scaleByWidth = (SIZE * 0.90) / personImage.naturalWidth;
    const scaleByHeight = (SIZE * 0.94) / personImage.naturalHeight;
    baseScale = Math.min(scaleByWidth, scaleByHeight);

    person.scale = baseScale;
    person.x = SIZE / 2;

    const renderedHeight = personImage.naturalHeight * person.scale;
    const bottomMargin = 18;
    person.y = SIZE - bottomMargin - renderedHeight / 2;

    updateZoomUI();
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

      person.scale = clamp(pinchState.startScale * ratio, minScale, maxScale);
      person.x = pinchState.startX + currentMidpoint.x - pinchState.startMidpoint.x;
      person.y = pinchState.startY + currentMidpoint.y - pinchState.startMidpoint.y;
      clampPerson();
      updateZoomUI();
      draw();
    }
  });

  function finishPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
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
        draw();
        break;
      case "ArrowDown":
        event.preventDefault();
        person.y += step;
        clampPerson();
        draw();
        break;
      case "ArrowLeft":
        event.preventDefault();
        person.x -= step;
        clampPerson();
        draw();
        break;
      case "ArrowRight":
        event.preventDefault();
        person.x += step;
        clampPerson();
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
      default:
        break;
    }
  });

  zoomRange.addEventListener("input", () => setZoomPercent(Number(zoomRange.value)));
  zoomDec.addEventListener("click", () => setZoomPercent(Number(zoomRange.value) - 10));
  zoomInc.addEventListener("click", () => setZoomPercent(Number(zoomRange.value) + 10));

  resetButton.addEventListener("click", autoFitPerson);

  maskRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      selectedMask = radio.value;
      applyMaskAccent();
      draw();
      showToast(selectedMask === "rosa" ? "Modelo Rosa selecionado." : "Modelo Azul selecionado.");
    });
  });

  async function responseError(response) {
    try {
      const data = await response.json();
      return data.error || "Ocorreu um erro inesperado.";
    } catch {
      return "Ocorreu um erro inesperado.";
    }
  }

  async function loadPersonFromBlob(blob) {
    if (personUrl) URL.revokeObjectURL(personUrl);
    personUrl = URL.createObjectURL(blob);

    const image = new Image();
    image.decoding = "async";
    image.src = personUrl;

    await image.decode();
    personImage = image;
    processedBlob = blob;

    emptyState.hidden = true;
    adjustments.hidden = false;
    primaryControls.hidden = true;
    downloadButton.disabled = false;
    autoFitPerson();
  }

  async function processFile(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Selecione uma imagem válida.", "error");
      return;
    }

    const maxBytes = 15 * 1024 * 1024;
    if (file.size > maxBytes) {
      showToast("A foto deve ter no máximo 15 MB.", "error");
      return;
    }

    setBusy(true, "Carregando…");

    try {
      await loadPersonFromBlob(file);
      showToast("Foto carregada. Agora ajuste a posição.", "success");
    } catch (error) {
      showToast("Não foi possível ler essa imagem.", "error");
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
    if (!processedBlob || !personImage || isBusy) return;

    setBusy(true, "Gerando a arte…", "Preparando o PNG em 1080×1080.");

    try {
      const formData = new FormData();
      formData.append("foreground", processedBlob, processedBlob.name || "foto.png");
      formData.append("x", String(person.x));
      formData.append("y", String(person.y));
      // Mesmos valores usados em draw(): o tamanho final em pixels do canvas.
      // Enviar o tamanho absoluto — e não person.scale — evita que o servidor
      // aplique a escala sobre dimensões diferentes das da prévia.
      formData.append("w", String(personImage.naturalWidth * person.scale));
      formData.append("h", String(personImage.naturalHeight * person.scale));
      formData.append("mask", selectedMask);

      const response = await fetch("/api/render", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(await responseError(response));

      const resultBlob = await response.blob();
      const url = URL.createObjectURL(resultBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `arte-campanha-${selectedMask}-1080x1080.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 3000);
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
