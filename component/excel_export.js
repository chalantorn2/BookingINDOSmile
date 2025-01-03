import {
  getDatabase,
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";

class ExcelExportComponent extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.innerHTML = `
      <style>
        .export-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
        }
        .export-container button {
          font-size: 1rem;
          padding: 8px;
          width: 100%;
          background: #00ac47;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          transition: background 0.3s;
        }
        .export-container button:hover {
          background-color: #00832d;
        }
        .modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 1000;
        }
        .modal-content {
          background: white;
          margin: 10% auto;
          padding: 20px;
          border-radius: 10px;
          width: 90%;
          max-width: 600px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        .field-group {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .field-selector {
          flex: 1;
          text-align: center;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 5px;
          margin: 0 10px;
          background: #f9f9f9;
        }
        .field-selector label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .field-selector input {
          margin-right: 5px;
        }
        .modal-footer {
          display: flex;
          justify-content: space-between;
        }
        .modal-footer button {
          flex: 1;
          margin: 0 10px;
          padding: 10px;
          border: none;
          border-radius: 5px;
          font-size: 1rem;
        }
        .btn-confirm {
          background: #28a745;
          color: white;
        }
        .btn-cancel {
          background: #dc3545;
          color: white;
        }
      </style>
      <div class="export-container">
        <button id="exportExcelBtn">Export as CSV</button>
      </div>
      <div id="exportModal" class="modal">
        <div class="modal-content">
          <h4 style="text-align:center; margin-bottom:20px;">Export Options</h4>
          <label for="monthSelector" style="font-weight:bold;">Select Month:</label>
          <select id="monthSelector" style="width:100%; margin-bottom:10px;">
            <option value="01">January</option>
            <option value="02">February</option>
            <option value="03">March</option>
            <option value="04">April</option>
            <option value="05">May</option>
            <option value="06">June</option>
            <option value="07">July</option>
            <option value="08">August</option>
            <option value="09">September</option>
            <option value="10">October</option>
            <option value="11">November</option>
            <option value="12">December</option>
          </select>
          <label for="yearSelector" style="font-weight:bold;">Select Year:</label>
          <select id="yearSelector" style="width:100%; margin-bottom:20px;"></select>
          <div id="fieldSelectors" style="margin-bottom:20px;">
          </div>
          <div class="modal-footer">
            <button id="confirmExport" class="btn-confirm">Export</button>
            <button id="cancelExport" class="btn-cancel">Cancel</button>
          </div>
        </div>
      </div>
    `;
    this.querySelector("#exportExcelBtn")?.addEventListener(
      "click",
      this.showExportModal.bind(this)
    );
    this.querySelector("#confirmExport")?.addEventListener(
      "click",
      this.exportCSV.bind(this)
    );
    this.querySelector("#cancelExport")?.addEventListener("click", () => {
      document.getElementById("exportModal").style.display = "none";
    });
    this.populateYearDropdown();
  }

  populateYearDropdown() {
    const yearSelector = document.getElementById("yearSelector");
    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 5; year <= currentYear + 5; year++) {
      const option = document.createElement("option");
      option.value = String(year);
      option.textContent = String(year);
      if (year === currentYear) {
        option.selected = true;
      }
      yearSelector.appendChild(option);
    }
  }

  showExportModal() {
    const modal = document.getElementById("exportModal");
    modal.style.display = "block";
  }

  async exportCSV() {
    const month = document.getElementById("monthSelector")?.value;
    const year = document.getElementById("yearSelector")?.value;
    const defaultFields = [
      "OrderID",
      "customerName",
      "earliestDate",
      "latestDate",
      "tourID",
      "tourAgent",
      "tourType",
      "tourDetail",
      "tourFee",
      "tourMeal",
      "tourDate",
      "tourFirstName",
      "tourLastName",
      "tourPax",
      "tourHotel",
      "tourRoomNo",
      "tourContactNo",
      "tourPickUpTime",
      "tourSendTo",
      "tourNote",
      "transferID",
      "transferAgent",
      "transferType",
      "transferDetail",
      "transferFlight",
      "transferTime",
      "transferDate",
      "transferFirstName",
      "transferLastName",
      "transferPax",
      "transferPickUpTime",
      "transferPickupFrom",
      "transferDropTo",
      "transferSendTo",
      "transferNote",
      "status",
      "timestamp",
    ];

    const db = getDatabase();
    const ordersRef = ref(db, "orders");
    try {
      const ordersSnap = await get(ordersRef);
      if (!ordersSnap.exists()) {
        throw new Error("No orders found.");
      }

      const ordersData = ordersSnap.val();
      const processedOrders = await this.processOrders(ordersData);

      const filtered = processedOrders.filter((o) => {
        if (!o.earliestDate) return false;
        const y = String(o.earliestDate.getFullYear());
        const m = String(o.earliestDate.getMonth() + 1).padStart(2, "0");
        return (!year || year === y) && (!month || month === m);
      });

      if (filtered.length === 0) {
        throw new Error("No data available for the selected month/year.");
      }

      const csvContent = this.generateCSV(filtered, defaultFields);
      const BOM = "\uFEFF";
      const finalCSV = BOM + csvContent;

      const blob = new Blob([finalCSV], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Orders_${year || "All"}-${month || "All"}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      document.getElementById("exportModal").style.display = "none";
      alert("Export successful!");
    } catch (err) {
      console.error("Export error:", err);
      alert(`Failed to export data: ${err.message}`);
    }
  }

  async processOrders(ordersObj) {
    const db = getDatabase();
    const result = [];
    for (const orderKey of Object.keys(ordersObj)) {
      const orderVal = ordersObj[orderKey];
      const bookings = orderVal.bookings || [];
      let bookingDetails = [];
      let customerName = "";
      const promises = bookings.map(async (bkId) => {
        const tourSnap = await get(ref(db, `tourBookings/${bkId}`));
        if (tourSnap.exists()) {
          const b = tourSnap.val();
          const cName = `${b.tourFirstName || ""} ${
            b.tourLastName || ""
          }`.trim();
          if (cName) customerName = cName;
          bookingDetails.push({
            ...b,
            isTour: true,
          });
        } else {
          const transferSnap = await get(ref(db, `transferBookings/${bkId}`));
          if (transferSnap.exists()) {
            const b = transferSnap.val();
            const cName = `${b.transferFirstName || ""} ${
              b.transferLastName || ""
            }`.trim();
            if (cName) customerName = cName;
            bookingDetails.push({
              ...b,
              isTour: false,
            });
          }
        }
      });
      await Promise.all(promises);
      bookingDetails.sort((a, b) => {
        const dA = new Date(a.tourDate || a.transferDate);
        const dB = new Date(b.tourDate || b.transferDate);
        if (isNaN(dA.getTime()) && !isNaN(dB.getTime())) return 1;
        if (!isNaN(dA.getTime()) && isNaN(dB.getTime())) return -1;
        if (isNaN(dA.getTime()) && isNaN(dB.getTime())) return 0;
        return dA - dB;
      });
      let earliestDate = null;
      let latestDate = null;
      bookingDetails.forEach((bk) => {
        const dt = bk.tourDate || bk.transferDate;
        const d = new Date(dt);
        if (!isNaN(d.getTime())) {
          if (!earliestDate || d < earliestDate) earliestDate = d;
          if (!latestDate || d > latestDate) latestDate = d;
        }
      });
      result.push({
        orderID: orderVal.id || orderKey,
        customerName: customerName || "Unknown",
        earliestDate,
        latestDate,
        bookingDetails,
      });
    }
    return result;
  }

  generateCSV(orders, fields) {
    let csv = "";
    const headerLine = fields.map((f) => `"${f}"`).join(",");
    csv += headerLine + "\n";

    orders.forEach((ord) => {
      const rowBase = {};
      rowBase.OrderID = ord.orderID;
      rowBase.customerName = ord.customerName;
      rowBase.earliestDate = ord.earliestDate
        ? this.formatDate(ord.earliestDate)
        : "-";
      rowBase.latestDate = ord.latestDate
        ? this.formatDate(ord.latestDate)
        : "-";

      if (ord.bookingDetails.length === 0) {
        const arr = fields.map((f) =>
          f === "timestamp"
            ? this.escapeCSV(this.formatTimestamp(rowBase[f]))
            : this.escapeCSV(rowBase[f] || "-")
        );
        csv += arr.map((a) => `"${a}"`).join(",") + "\n";
      } else {
        ord.bookingDetails.forEach((bk) => {
          const rowData = { ...rowBase };

          if (bk.isTour) {
            rowData.tourID = bk.tourID || "-";
            rowData.tourAgent = bk.tourAgent || "-";
            rowData.tourType = bk.tourType || "-";
            rowData.tourDetail = bk.tourDetail || "-";
            rowData.tourFee = bk.tourFee || "-";
            rowData.tourMeal = bk.tourMeal || "-";
            rowData.tourDate = bk.tourDate
              ? this.formatDateString(bk.tourDate)
              : "-";
            rowData.tourFirstName = bk.tourFirstName || "-";
            rowData.tourLastName = bk.tourLastName || "-";
            rowData.tourPax = bk.tourPax || "-";
            rowData.tourHotel = bk.tourHotel || "-";
            rowData.tourRoomNo = bk.tourRoomNo || "-";
            rowData.tourContactNo = bk.tourContactNo || "-";
            rowData.tourPickUpTime = bk.tourPickUpTime || "-";
            rowData.tourSendTo = bk.tourSendTo || "-";
            rowData.tourNote = bk.tourNote || "-";
            rowData.status = bk.status || "-";
            rowData.timestamp = this.formatTimestamp(bk.timestamp);
          } else {
            rowData.transferID = bk.transferID || "-";
            rowData.transferAgent = bk.transferAgent || "-";
            rowData.transferType = bk.transferType || "-";
            rowData.transferDetail = bk.transferDetail || "-";
            rowData.transferFlight = bk.transferFlight || "-";
            rowData.transferTime = bk.transferTime || "-";
            rowData.transferDate = bk.transferDate
              ? this.formatDateString(bk.transferDate)
              : "-";
            rowData.transferFirstName = bk.transferFirstName || "-";
            rowData.transferLastName = bk.transferLastName || "-";
            rowData.transferPax = bk.transferPax || "-";
            rowData.transferPickUpTime = bk.transferPickUpTime || "-";
            rowData.transferPickupFrom = bk.transferPickupFrom || "-";
            rowData.transferDropTo = bk.transferDropTo || "-";
            rowData.transferSendTo = bk.transferSendTo || "-";
            rowData.transferNote = bk.transferNote || "-";
            rowData.status = bk.status || "-";
            rowData.timestamp = this.formatTimestamp(bk.timestamp);
          }

          const arr = fields.map((f) =>
            f === "timestamp"
              ? this.escapeCSV(this.formatTimestamp(rowData[f]))
              : this.escapeCSV(rowData[f] || "-")
          );
          csv += arr.map((a) => `"${a}"`).join(",") + "\n";
        });
      }
    });

    return csv;
  }

  formatDate(d) {
    if (!(d instanceof Date)) return "-";
    if (isNaN(d.getTime())) return "-";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }

  formatDateString(str) {
    if (!str) return "-";
    const parts = str.split("-");
    if (parts.length !== 3) return str;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  escapeCSV(str) {
    return str.replace(/"/g, '""');
  }
  formatTimestamp(ts) {
    if (!ts) return "-";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "-";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hh}:${mm} น.`;
  }
}

customElements.define("excel-export", ExcelExportComponent);
