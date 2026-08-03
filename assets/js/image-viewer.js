(function () {
  "use strict";

  const SELECTOR = ".article-content img:not(.nozoom)";
  const ZOOM_FACTOR = 1.25;
  const MAX_SCALE = 8;

  function start() {
    const sourceImages = Array.from(document.querySelectorAll(SELECTOR)).filter(
      (image) => !image.closest("a[href], button")
    );

    if (!sourceImages.length) return;

    const isChinese = (document.documentElement.lang || "").toLowerCase().startsWith("zh");
    const labels = isChinese
      ? {
          dialog: "图片预览",
          open: "打开图片预览",
          close: "关闭",
          zoomOut: "缩小",
          zoomIn: "放大",
          fit: "适应",
          fitLabel: "适应屏幕",
          actual: "1:1",
          actualLabel: "显示原始尺寸",
          loading: "正在加载高清图片…",
          help: "单击图片退出 · 滚轮缩放 · 拖动画面 · 双击切换 1:1",
        }
      : {
          dialog: "Image preview",
          open: "Open image preview",
          close: "Close",
          zoomOut: "Zoom out",
          zoomIn: "Zoom in",
          fit: "Fit",
          fitLabel: "Fit to screen",
          actual: "1:1",
          actualLabel: "Show actual size",
          loading: "Loading full-resolution image…",
          help: "Click image to close · Wheel to zoom · Drag to pan · Double-click for 1:1",
        };

    const viewer = document.createElement("div");
    viewer.className = "image-viewer";
    viewer.hidden = true;
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");
    viewer.setAttribute("aria-label", labels.dialog);
    viewer.innerHTML = `
      <div class="image-viewer__toolbar" role="toolbar" aria-label="${labels.dialog}">
        <button class="image-viewer__button image-viewer__button--symbol" type="button" data-viewer-action="zoom-out" aria-label="${labels.zoomOut}" title="${labels.zoomOut}">−</button>
        <output class="image-viewer__percentage" aria-live="polite">100%</output>
        <button class="image-viewer__button image-viewer__button--symbol" type="button" data-viewer-action="zoom-in" aria-label="${labels.zoomIn}" title="${labels.zoomIn}">+</button>
        <span class="image-viewer__separator" aria-hidden="true"></span>
        <button class="image-viewer__button" type="button" data-viewer-action="fit" aria-label="${labels.fitLabel}" title="${labels.fitLabel}">${labels.fit}</button>
        <button class="image-viewer__button" type="button" data-viewer-action="actual" aria-label="${labels.actualLabel}" title="${labels.actualLabel}">${labels.actual}</button>
        <span class="image-viewer__separator" aria-hidden="true"></span>
        <button class="image-viewer__button image-viewer__button--symbol" type="button" data-viewer-action="close" aria-label="${labels.close}" title="${labels.close}">×</button>
      </div>
      <div class="image-viewer__stage" tabindex="-1">
        <img class="image-viewer__image" alt="" draggable="false">
        <div class="image-viewer__loading" role="status">${labels.loading}</div>
      </div>
      <div class="image-viewer__caption"></div>
      <div class="image-viewer__help">${labels.help}</div>
    `;
    document.body.appendChild(viewer);

    const stage = viewer.querySelector(".image-viewer__stage");
    const image = viewer.querySelector(".image-viewer__image");
    const loading = viewer.querySelector(".image-viewer__loading");
    const percentage = viewer.querySelector(".image-viewer__percentage");
    const caption = viewer.querySelector(".image-viewer__caption");
    const closeButton = viewer.querySelector('[data-viewer-action="close"]');
    const toolbarButtons = Array.from(viewer.querySelectorAll("button"));

    let activeSource = null;
    let previousOverflow = "";
    let naturalWidth = 0;
    let naturalHeight = 0;
    let scale = 1;
    let fitScale = 1;
    let panX = 0;
    let panY = 0;
    let fitMode = true;
    let loadToken = 0;
    const pointers = new Map();
    let lastPointer = null;
    let lastPinch = null;
    let gestureStart = null;
    let gestureMoved = false;
    let gestureStartedOnImage = false;
    let imageClickTimer = null;

    function getStageMetrics() {
      const rect = stage.getBoundingClientRect();
      return {
        rect,
        centerX: rect.width / 2,
        centerY: rect.height / 2,
      };
    }

    function calculateFitScale() {
      const { rect } = getStageMetrics();
      if (!naturalWidth || !naturalHeight || !rect.width || !rect.height) return 1;
      return Math.min((rect.width - 40) / naturalWidth, (rect.height - 40) / naturalHeight, 1);
    }

    function scaleBounds() {
      return {
        min: Math.min(fitScale, 0.05),
        max: Math.max(MAX_SCALE, fitScale),
      };
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function clampPan() {
      const { rect } = getStageMetrics();
      const overflowX = Math.max(0, naturalWidth * scale - rect.width);
      const overflowY = Math.max(0, naturalHeight * scale - rect.height);
      panX = clamp(panX, -overflowX / 2, overflowX / 2);
      panY = clamp(panY, -overflowY / 2, overflowY / 2);
    }

    function render() {
      if (!naturalWidth || !naturalHeight) return;
      clampPan();
      const { centerX, centerY } = getStageMetrics();
      image.style.width = `${naturalWidth}px`;
      image.style.height = `${naturalHeight}px`;
      image.style.left = `${centerX + panX}px`;
      image.style.top = `${centerY + panY}px`;
      image.style.transform = `translate(-50%, -50%) scale(${scale})`;
      percentage.value = `${Math.round(scale * 100)}%`;
      percentage.textContent = percentage.value;
    }

    function fitToScreen() {
      fitScale = calculateFitScale();
      scale = fitScale;
      panX = 0;
      panY = 0;
      fitMode = true;
      render();
    }

    function showActualSize() {
      const { min, max } = scaleBounds();
      scale = clamp(1, min, max);
      panX = 0;
      panY = 0;
      fitMode = false;
      render();
    }

    function zoomAt(nextScale, clientX, clientY) {
      if (!naturalWidth || !naturalHeight) return;
      const { rect, centerX, centerY } = getStageMetrics();
      const { min, max } = scaleBounds();
      const boundedScale = clamp(nextScale, min, max);
      const focalX = clientX == null ? centerX : clientX - rect.left;
      const focalY = clientY == null ? centerY : clientY - rect.top;
      const worldX = (focalX - centerX - panX) / scale;
      const worldY = (focalY - centerY - panY) / scale;
      panX = focalX - centerX - worldX * boundedScale;
      panY = focalY - centerY - worldY * boundedScale;
      scale = boundedScale;
      fitMode = false;
      render();
    }

    function closeViewer() {
      if (viewer.hidden) return;
      if (imageClickTimer) {
        window.clearTimeout(imageClickTimer);
        imageClickTimer = null;
      }
      loadToken += 1;
      viewer.hidden = true;
      image.removeAttribute("src");
      image.style.removeProperty("width");
      image.style.removeProperty("height");
      pointers.clear();
      lastPointer = null;
      lastPinch = null;
      gestureStart = null;
      gestureMoved = false;
      gestureStartedOnImage = false;
      stage.classList.remove("is-dragging");
      document.body.classList.remove("image-viewer-open");
      document.body.style.overflow = previousOverflow;
      if (activeSource) activeSource.focus({ preventScroll: true });
      activeSource = null;
    }

    function openViewer(source) {
      activeSource = source;
      previousOverflow = document.body.style.overflow;
      document.body.classList.add("image-viewer-open");
      document.body.style.overflow = "hidden";
      viewer.hidden = false;
      loading.hidden = false;
      image.hidden = true;
      caption.textContent = source.getAttribute("alt") || "";
      naturalWidth = 0;
      naturalHeight = 0;
      panX = 0;
      panY = 0;
      fitMode = true;
      const currentToken = ++loadToken;

      image.onload = function () {
        if (currentToken !== loadToken) return;
        naturalWidth = image.naturalWidth;
        naturalHeight = image.naturalHeight;
        loading.hidden = true;
        image.hidden = false;
        fitToScreen();
      };
      image.onerror = closeViewer;
      image.src = source.dataset.zoomSrc || source.currentSrc || source.src;
      closeButton.focus({ preventScroll: true });
    }

    sourceImages.forEach((source) => {
      source.classList.add("image-viewer__trigger");
      source.tabIndex = 0;
      source.setAttribute("role", "button");
      source.setAttribute("aria-label", `${labels.open}${source.alt ? `：${source.alt}` : ""}`);
      source.addEventListener("click", () => openViewer(source));
      source.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openViewer(source);
        }
      });
    });

    viewer.addEventListener("click", (event) => {
      const button = event.target.closest("[data-viewer-action]");
      if (!button) return;
      switch (button.dataset.viewerAction) {
        case "zoom-out":
          zoomAt(scale / ZOOM_FACTOR);
          break;
        case "zoom-in":
          zoomAt(scale * ZOOM_FACTOR);
          break;
        case "fit":
          fitToScreen();
          break;
        case "actual":
          showActualSize();
          break;
        case "close":
          closeViewer();
          break;
      }
    });

    stage.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const factor = Math.exp(-event.deltaY * 0.0015);
        zoomAt(scale * factor, event.clientX, event.clientY);
      },
      { passive: false }
    );

    stage.addEventListener("dblclick", (event) => {
      event.preventDefault();
      if (imageClickTimer) {
        window.clearTimeout(imageClickTimer);
        imageClickTimer = null;
      }
      if (Math.abs(scale - fitScale) < 0.01) {
        zoomAt(1, event.clientX, event.clientY);
      } else {
        fitToScreen();
      }
    });

    stage.addEventListener("click", (event) => {
      if (!gestureStartedOnImage) return;
      if (gestureMoved) {
        gestureMoved = false;
        return;
      }

      if (event.detail > 1) {
        if (imageClickTimer) {
          window.clearTimeout(imageClickTimer);
          imageClickTimer = null;
        }
        return;
      }

      imageClickTimer = window.setTimeout(() => {
        imageClickTimer = null;
        closeViewer();
      }, 260);
    });

    function pointerSnapshot() {
      const values = Array.from(pointers.values());
      if (values.length < 2) return null;
      const first = values[0];
      const second = values[1];
      return {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
        distance: Math.hypot(second.x - first.x, second.y - first.y),
      };
    }

    stage.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      if (!pointers.size) {
        gestureStart = { x: event.clientX, y: event.clientY };
        gestureMoved = false;
        gestureStartedOnImage = event.target === image;
      } else {
        gestureMoved = true;
      }
      stage.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      stage.classList.add("is-dragging");
      if (pointers.size === 1) {
        lastPointer = { x: event.clientX, y: event.clientY };
        lastPinch = null;
      } else {
        lastPointer = null;
        lastPinch = pointerSnapshot();
      }
    });

    stage.addEventListener("pointermove", (event) => {
      if (!pointers.has(event.pointerId)) return;
      if (
        gestureStart &&
        Math.hypot(event.clientX - gestureStart.x, event.clientY - gestureStart.y) > 6
      ) {
        gestureMoved = true;
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.size === 1 && lastPointer) {
        panX += event.clientX - lastPointer.x;
        panY += event.clientY - lastPointer.y;
        lastPointer = { x: event.clientX, y: event.clientY };
        fitMode = false;
        render();
        return;
      }

      if (pointers.size >= 2) {
        const nextPinch = pointerSnapshot();
        if (nextPinch && lastPinch && lastPinch.distance > 0) {
          panX += nextPinch.x - lastPinch.x;
          panY += nextPinch.y - lastPinch.y;
          zoomAt(
            scale * (nextPinch.distance / lastPinch.distance),
            nextPinch.x,
            nextPinch.y
          );
        }
        lastPinch = nextPinch;
      }
    });

    function releasePointer(event) {
      pointers.delete(event.pointerId);
      if (!pointers.size) {
        stage.classList.remove("is-dragging");
        lastPointer = null;
        lastPinch = null;
        gestureStart = null;
      } else if (pointers.size === 1) {
        const remaining = Array.from(pointers.values())[0];
        lastPointer = { x: remaining.x, y: remaining.y };
        lastPinch = null;
      }
    }

    stage.addEventListener("pointerup", releasePointer);
    stage.addEventListener("pointercancel", (event) => {
      gestureMoved = true;
      releasePointer(event);
    });

    document.addEventListener("keydown", (event) => {
      if (viewer.hidden) return;

      if (event.key === "Tab") {
        const first = toolbarButtons[0];
        const last = toolbarButtons[toolbarButtons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      switch (event.key) {
        case "Escape":
          closeViewer();
          break;
        case "+":
        case "=":
          event.preventDefault();
          zoomAt(scale * ZOOM_FACTOR);
          break;
        case "-":
        case "_":
          event.preventDefault();
          zoomAt(scale / ZOOM_FACTOR);
          break;
        case "0":
          event.preventDefault();
          fitToScreen();
          break;
        case "1":
          event.preventDefault();
          showActualSize();
          break;
        case "ArrowLeft":
          event.preventDefault();
          panX += 48;
          fitMode = false;
          render();
          break;
        case "ArrowRight":
          event.preventDefault();
          panX -= 48;
          fitMode = false;
          render();
          break;
        case "ArrowUp":
          event.preventDefault();
          panY += 48;
          fitMode = false;
          render();
          break;
        case "ArrowDown":
          event.preventDefault();
          panY -= 48;
          fitMode = false;
          render();
          break;
      }
    });

    window.addEventListener("resize", () => {
      if (viewer.hidden || !naturalWidth) return;
      fitScale = calculateFitScale();
      if (fitMode) {
        fitToScreen();
      } else {
        render();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
