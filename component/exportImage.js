class ExportImageComponent extends HTMLElement {
  connectedCallback() {
    this.render();
    this.setupEventListener();
  }

  render() {
    this.innerHTML = `
        <button id="exportImageBtn" class="btn btn-outline-success btn-sm  w-100">
          <i class="bi bi-download"></i> Export as Image
        </button>
      `;
  }

  setupEventListener() {
    const exportButton = this.querySelector("#exportImageBtn");
    exportButton.addEventListener("click", () => {
      const captureAreaSelector =
        this.getAttribute("capture-area") || "#captureArea";
      const container = document.querySelector(captureAreaSelector);

      if (container) {
        html2canvas(container, { scale: 2 })
          .then((canvas) => {
            const link = document.createElement("a");
            link.download = `Bookings_${
              new Date().toISOString().split("T")[0]
            }.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
          })
          .catch((error) => {
            console.error("Error capturing image:", error);
          });
      } else {
        console.error(`Capture area "${captureAreaSelector}" not found.`);
      }
    });
  }
}

customElements.define("export-image", ExportImageComponent);
