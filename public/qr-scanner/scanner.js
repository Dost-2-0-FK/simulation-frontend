/**
 * Local-first QR scanner component with native and jsQR decoding paths.
 *
 * Add `data-qr-scanner` to a container using the child data attributes shown
 * in index.html. A successful scan updates the output and dispatches:
 *   element.addEventListener("qrscan", event => console.log(event.detail.content))
 */
(() => {
  "use strict";

  const SELECTOR = "[data-qr-scanner]";

  class QRScanner {
    constructor(element) {
      // Idempotent per element: the module-level auto-init below (which runs once,
      // at script-execution time) and a consumer that also instantiates this class
      // programmatically (e.g. a UI framework wiring it up on mount) can both target
      // the same already-present element. Without this guard that produces two live
      // instances sharing one <video>, each racing the other's start()/stop() calls.
      if (element.__qrScannerInstance) return element.__qrScannerInstance;
      element.__qrScannerInstance = this;

      this.element = element;
      this.video = element.querySelector("[data-scanner-video]");
      this.status = element.querySelector("[data-scanner-status]");
      this.result = element.querySelector("[data-scanner-result]");
      this.content = element.querySelector("[data-scanner-content]");
      this.startButton = element.querySelector("[data-scanner-start]");
      this.fileInput = element.querySelector("[data-scanner-file]");
      this.stream = null;
      this.frameRequest = null;
      this.detector = null;
      this.canvas = document.createElement("canvas");

      this.handleStartClick = () => this.start();
      this.handleFileChange = (event) => this.scanFile(event);
      this.handlePageHide = () => this.stop();
      this.startButton?.addEventListener("click", this.handleStartClick);
      this.fileInput?.addEventListener("change", this.handleFileChange);
      window.addEventListener("pagehide", this.handlePageHide, { once: true });
    }

    // Like stop(), but also detaches this instance's listeners and clears the
    // per-element instance marker, so a later `new QRScanner(element)` call on
    // the same (still-alive) element creates a genuinely fresh instance instead
    // of reusing this torn-down one.
    destroy() {
      this.stop();
      this.startButton?.removeEventListener("click", this.handleStartClick);
      this.fileInput?.removeEventListener("change", this.handleFileChange);
      window.removeEventListener("pagehide", this.handlePageHide);
      if (this.element.__qrScannerInstance === this) delete this.element.__qrScannerInstance;
    }

    async getDetector() {
      if (this.detector) return this.detector;

      if ("BarcodeDetector" in window) {
        try {
          const formats = await BarcodeDetector.getSupportedFormats();
          if (formats.includes("qr_code")) {
            this.detector = new BarcodeDetector({ formats: ["qr_code"] });
            return this.detector;
          }
        } catch (_) {
          // Fall through to jsQR when a partial native implementation fails.
        }
      }

      if (typeof window.jsQR !== "function") {
        throw new Error("The QR decoder could not be loaded.");
      }

      this.detector = { detect: (source) => this.detectWithJsQR(source) };
      return this.detector;
    }

    async detectWithJsQR(source) {
      const width = source.videoWidth || source.width;
      const height = source.videoHeight || source.height;
      if (!width || !height) return [];

      this.canvas.width = width;
      this.canvas.height = height;
      const context = this.canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas decoding is not available.");
      context.drawImage(source, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height);
      const code = window.jsQR(pixels.data, width, height, {
        inversionAttempts: "attemptBoth",
      });
      return code ? [{ rawValue: code.data }] : [];
    }

    async start() {
      this.stop();
      this.setStatus("Requesting camera access");
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera access requires HTTPS or localhost.");
        }
        const detector = await this.getDetector();
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
        this.video.srcObject = this.stream;
        await this.video.play();
        this.element.classList.remove("is-found");
        this.element.classList.add("is-scanning");
        this.startButton.textContent = "Restart scanner";
        this.setStatus("Scanning locally");
        this.scanFrames(detector);
      } catch (error) {
        this.stop();
        this.setStatus(error.message || "Camera access failed");
      }
    }

    scanFrames(detector) {
      let lastScan = 0;
      const scan = async (time) => {
        if (!this.stream) return;
        if (time - lastScan > 120 && this.video.readyState >= 2) {
          lastScan = time;
          try {
            const codes = await detector.detect(this.video);
            if (codes.length) return this.found(codes[0].rawValue);
          } catch (_) {
            // A transient frame decode error should not end the camera session.
          }
        }
        this.frameRequest = requestAnimationFrame(scan);
      };
      this.frameRequest = requestAnimationFrame(scan);
    }

    async scanFile(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      this.stop();
      this.setStatus("Reading image locally");
      try {
        const detector = await this.getDetector();
        const image = await createImageBitmap(file);
        const codes = await detector.detect(image);
        image.close();
        if (!codes.length) throw new Error("No QR code found in that image.");
        this.found(codes[0].rawValue);
      } catch (error) {
        this.setStatus(error.message || "Image could not be read");
      } finally {
        event.target.value = "";
      }
    }

    found(value) {
      this.stop();
      this.element.classList.add("is-found");
      this.content.textContent = value || "(empty QR code)";
      this.result.removeAttribute("hidden");
      this.result.hidden = false;
      this.setStatus("Code acquired");
      this.result.scrollIntoView({ behavior: "smooth", block: "nearest" });
      this.element.dispatchEvent(new CustomEvent("qrscan", {
        bubbles: true,
        detail: { content: value },
      }));
    }

    setStatus(message) {
      this.status.textContent = message;
    }

    stop() {
      if (this.frameRequest) cancelAnimationFrame(this.frameRequest);
      this.stream?.getTracks().forEach((track) => track.stop());
      this.video.srcObject = null;
      this.stream = null;
      this.frameRequest = null;
      this.element.classList.remove("is-scanning");
    }
  }

  document.querySelectorAll(SELECTOR).forEach((element) => new QRScanner(element));
  window.QRScanner = QRScanner;
})();
