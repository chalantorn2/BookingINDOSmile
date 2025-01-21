// /component/booking-table.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";

import { database } from "/js/firebase-config.js";

// ถ้าคุณใช้แบบ ES Module (แนะนำ) ให้ import flatpickr จาก ESM URL
// ถ้าคุณใช้แบบ Script ธรรมดา ให้ลบออกแล้วใช้ window.flatpickr แทน
// import flatpickr from "https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/esm/index.js";

class BookingTable extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.itemsPerPage = 10; // จำนวนรายการต่อหน้า
    this.currentPage = 1; // หน้าเริ่มต้น

    // ---- (1) คอลัมน์ทั้งหมด (key, label) ----
    // เพิ่ม "customer" ระหว่าง "agent" กับ "sendTo"
    this.allColumns = [
      { key: "type", label: "Type" },
      { key: "id", label: "Booking ID" },
      { key: "agent", label: "Agent" },
      { key: "customer", label: "Customer Name" }, // <-- เพิ่มคอลัมน์
      { key: "sendTo", label: "Send To" },
      { key: "date", label: "Date" },
      { key: "timestamp", label: "Timestamp" },
    ];

    // ค่าเริ่มต้น: ใช้ทุกคอลัมน์
    this.selectedColumns = [...this.allColumns];

    // ---- (2) ตัวแปรสำหรับข้อมูล bookings และการ sort ----
    this.allBookings = []; // เก็บข้อมูลทั้งหมด (Tour + Transfer)
    this.filteredBookings = []; // เก็บข้อมูลหลัง Filter
    this.sortKey = "timestamp"; // ค่าเริ่มต้น: sort ตาม timestamp
    this.sortDirection = "desc"; // เรียงจากล่าสุดมาก่อน

    // ตัวแปรสำหรับการกรองตามช่วงวันที่ (เก็บจาก tourDate / transferDate)
    this.startDateStr = null; // string "dd/mm/yyyy"
    this.endDateStr = null; // string "dd/mm/yyyy"

    // Container หลักใน Shadow DOM
    this.container = document.createElement("div");
    this.shadowRoot.appendChild(this.container);
  }

  connectedCallback() {
    this.renderLayout(); // สร้าง UI พื้นฐาน
    this.loadData(); // โหลดข้อมูลจาก Firebase
  }

  // --- (3) โหลด Tour + Transfer จาก Firebase ---
  async loadData() {
    try {
      const tourRef = ref(database, "tourBookings");
      const transferRef = ref(database, "transferBookings");

      // ดึงข้อมูล Tour และ Transfer พร้อมกัน
      const [tourSnap, transferSnap] = await Promise.all([
        get(tourRef),
        get(transferRef),
      ]);

      const tempData = [];

      // ฟังก์ชันแปลง "YYYY-MM-DD" => timestamp (00:00:00 ของวันนั้น)
      const parseYYYYMMDDtoTimestamp = (dateStr) => {
        if (!dateStr || dateStr === "-") return 0;
        // สมมติค่าที่เก็บใน Firebase เป็น "2025-01-03"
        const [yyyy, mm, dd] = dateStr.split("-");
        if (!yyyy || !mm || !dd) return 0;

        const d = new Date(+yyyy, +mm - 1, +dd, 0, 0, 0);
        if (isNaN(d.getTime())) return 0;
        return d.getTime();
      };

      // --- ดึง Tour ---
      if (tourSnap.exists()) {
        tourSnap.forEach((snap) => {
          const d = snap.val();
          // สมมติ d.tourDate = "2025-01-03"
          tempData.push({
            type: "Tour",
            id: d.tourID || snap.key,
            agent: d.tourAgent || "-",
            customer: d.tourFirstName || "-", // ลูกค้า
            sendTo: d.tourSendTo || "-",
            date: d.tourDate || "-", // "YYYY-MM-DD"
            rawTimestamp: typeof d.timestamp === "number" ? d.timestamp : 0,
            // rawDate ใช้สำหรับช่วงวันที่ (Start Date / End Date)
            rawDate: parseYYYYMMDDtoTimestamp(d.tourDate || ""),
          });
        });
      }

      // --- ดึง Transfer ---
      if (transferSnap.exists()) {
        transferSnap.forEach((snap) => {
          const d = snap.val();
          // สมมติ d.transferDate = "2025-01-03"
          tempData.push({
            type: "Transfer",
            id: d.transferID || snap.key,
            agent: d.transferAgent || "-",
            customer: d.transferFirstName || "-", // ลูกค้า
            sendTo: d.transferSendTo || "-",
            date: d.transferDate || "-", // "YYYY-MM-DD"
            rawTimestamp: typeof d.timestamp === "number" ? d.timestamp : 0,
            rawDate: parseYYYYMMDDtoTimestamp(d.transferDate || ""),
          });
        });
      }

      this.allBookings = tempData;
      // console.log("All Bookings:", this.allBookings);

      // เรียก populate Dropdown (Day/Month/Year)
      this.populateDateFilters();

      // เรียก applyAllFilters() เพื่อกรอง + sort + render
      this.applyAllFilters();
    } catch (err) {
      console.error("Error loading data in booking-table:", err);
      const tBody = this.container.querySelector("#bookingTableBody");
      if (tBody) {
        tBody.innerHTML = `
          <tr>
            <td colspan="99" class="text-danger">Failed to load booking data</td>
          </tr>
        `;
      }
    }
  }

  // --- (4) สร้าง Layout/DOM ทั้งหมด ---
  renderLayout() {
    this.container.innerHTML = `
     <style>
  :host {
    font-family: 'Prompt', sans-serif;
    color: #343a40;
  }

  .container {
    max-width: 1320px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  .header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .filter-sort-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    background: #ffffff;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    margin-bottom: 2rem;
  }

  .row-group {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    width: 100%;
    margin-bottom: 1.5rem;
  }

  .filter-group, .sort-group {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .filter-group label,
  .sort-group label {
    font-size: 0.9rem;
    font-weight: bold;
    color: #495057;
    margin-bottom: 0.5rem;
  }

  .filter-group select,
  .sort-group select {
    width: 100%;
    padding: 10px;
    font-size: 0.9rem;
    border: 1px solid #ced4da;
    border-radius: 5px;
    transition: all 0.3s ease;
  }

  /* ปรับให้ input[type=text] ก็มี style เดียวกัน */
  .filter-group input[type="text"] {
    width: 100%;
    padding: 10px;
    font-size: 0.9rem;
    border: 1px solid #ced4da;
    border-radius: 5px;
    transition: all 0.3s ease;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  table th, table td {
    padding: 15px;
    text-align: center;
    font-size: 0.9rem;
    border-bottom: 1px solid #dee2e6;
  }

  table thead th {
    background-color: #007bff;
    color: white;
    text-transform: uppercase;
    font-weight: bold;
  }

  @media (max-width: 768px) {
    .filter-sort-container {
      grid-template-columns: 1fr;
    }
  }

  .pagination-container {
    display: flex;
    justify-content: center;
    margin-top: 20px;
  }

  .pagination-container button {
    margin: 0 5px;
    padding: 5px 10px;
    border: none;
    background: #007bff;
    color: white;
    border-radius: 5px;
    cursor: pointer;
  }

  .pagination-container button.active {
    background: #0056b3;
    font-weight: bold;
  }

  .pagination-container button:hover {
    background: #0056b3;
  }
</style>

<div class="container">
  <!-- Header -->
  <div class="header">
    <h3>Booking Table</h3>
  </div>

  <!-- Filters and Sort Options -->
  <div class="filter-sort-container">
    <!-- Row 1: Date Filters (Day/Month/Year) -->
    <div class="row-group">
      <div class="filter-group">
        <label for="dayFilter">Day:</label>
        <select id="dayFilter">
          <option value="">All</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="monthFilter">Month:</label>
        <select id="monthFilter">
          <option value="">All</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="yearFilter">Year:</label>
        <select id="yearFilter">
          <option value="">All</option>
        </select>
      </div>
    </div>

    <!-- Row 2: Sort Options -->
    <div class="row-group">
      <div class="sort-group">
        <label for="sortKey">Sort by:</label>
        <select id="sortKey">
          <option value="type">Type</option>
          <option value="id">Booking ID</option>
          <option value="agent">Agent</option>
          <option value="customer">CustomerName</option>
          <option value="sendTo">Send To</option>
          <option value="date">Date</option>
          <option value="timestamp" selected>Timestamp</option>
        </select>
      </div>
      <div class="sort-group">
        <label for="sortDirection">Order:</label>
        <select id="sortDirection">
          <option value="asc">Ascending</option>
          <option value="desc" selected>Descending</option>
        </select>
      </div>
    </div>

    <!-- Row 3: Filter by Date Range (tourDate / transferDate) -->
    <div class="row-group">
      <div class="filter-group">
        <label for="startDateFilter">Start Date:</label>
        <input type="text" id="startDateFilter" placeholder="เลือกวันที่เริ่มต้น" />
      </div>
      <div class="filter-group">
        <label for="endDateFilter">End Date:</label>
        <input type="text" id="endDateFilter" placeholder="เลือกวันที่สิ้นสุด" />
      </div>
    </div>
  </div>

  <!-- Table -->
  <table>
    <thead>
      <tr id="bookingTableHead"></tr>
    </thead>
    <tbody id="bookingTableBody">
      <tr><td colspan="99">Loading...</td></tr>
    </tbody>
  </table>
  <div id="pagination" class="pagination-container"></div>

</div>
    `;

    // Bind Events to Day/Month/Year Filters
    const dayFilterEl = this.container.querySelector("#dayFilter");
    const monthFilterEl = this.container.querySelector("#monthFilter");
    const yearFilterEl = this.container.querySelector("#yearFilter");

    [dayFilterEl, monthFilterEl, yearFilterEl].forEach((filterEl) => {
      if (filterEl) {
        filterEl.addEventListener("change", () => {
          this.applyAllFilters();
        });
      }
    });

    // Bind Events to Sort Options
    const sortKeyEl = this.container.querySelector("#sortKey");
    const sortDirectionEl = this.container.querySelector("#sortDirection");
    if (sortKeyEl && sortDirectionEl) {
      sortKeyEl.addEventListener("change", () => {
        this.sortKey = sortKeyEl.value;
        this.sortBookings();
        this.renderTable();
      });

      sortDirectionEl.addEventListener("change", () => {
        this.sortDirection = sortDirectionEl.value;
        this.sortBookings();
        this.renderTable();
      });
    }

    // เรียก Flatpickr กับ Start/End Date
    const startDateInput = this.container.querySelector("#startDateFilter");
    const endDateInput = this.container.querySelector("#endDateFilter");

    // flatpickr แบบ ES Module
    flatpickr(startDateInput, {
      dateFormat: "d/m/Y", // ให้แสดง/รับเป็น dd/mm/yyyy
      onChange: (selectedDates, dateStr) => {
        // dateStr เช่น "13/01/2025"
        this.startDateStr = dateStr || null;
        this.applyAllFilters();
      },
    });

    flatpickr(endDateInput, {
      dateFormat: "d/m/Y",
      onChange: (selectedDates, dateStr) => {
        this.endDateStr = dateStr || null;
        this.applyAllFilters();
      },
    });
  }

  // --- (4.x) Populate ตัวเลือก Day, Month, Year จากข้อมูลทั้งหมด (this.allBookings) ---
  populateDateFilters() {
    const daySet = new Set();
    const monthSet = new Set();
    const yearSet = new Set();

    this.allBookings.forEach((bk) => {
      // bk.date = "YYYY-MM-DD"
      if (!bk.date || bk.date === "-") return;
      const [yyyy, mm, dd] = bk.date.split("-");
      if (yyyy && mm && dd) {
        daySet.add(dd);
        monthSet.add(mm);
        yearSet.add(yyyy);
      }
    });

    const dayArr = Array.from(daySet).sort((a, b) => Number(a) - Number(b));
    const monthArr = Array.from(monthSet).sort((a, b) => Number(a) - Number(b));
    const yearArr = Array.from(yearSet).sort((a, b) => Number(a) - Number(b));

    const dayFilter = this.container.querySelector("#dayFilter");
    const monthFilter = this.container.querySelector("#monthFilter");
    const yearFilter = this.container.querySelector("#yearFilter");

    dayArr.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      dayFilter.appendChild(opt);
    });

    monthArr.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      monthFilter.appendChild(opt);
    });

    yearArr.forEach((y) => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      yearFilter.appendChild(opt);
    });
  }

  // --- ฟังก์ชันรวมสำหรับ apply filter (Day/Month/Year + Date Range)
  applyAllFilters() {
    const dayFilterVal = this.container.querySelector("#dayFilter").value;
    const monthFilterVal = this.container.querySelector("#monthFilter").value;
    const yearFilterVal = this.container.querySelector("#yearFilter").value;

    // แปลง this.startDateStr, this.endDateStr (รูปแบบ "dd/mm/yyyy") => timestamp
    const startTs = this.startDateStr
      ? this.parseDdMmYyyyToTimestamp(this.startDateStr, true) // true = เริ่มวัน
      : null;
    const endTs = this.endDateStr
      ? this.parseDdMmYyyyToTimestamp(this.endDateStr, false) // false = สิ้นวัน
      : null;

    this.filteredBookings = this.allBookings.filter((bk) => {
      // (1) Filter Day/Month/Year (อิงจาก bk.date)
      if (bk.date && bk.date !== "-") {
        const [yyyy, mm, dd] = bk.date.split("-");
        if (yearFilterVal && yearFilterVal !== yyyy) return false;
        if (monthFilterVal && monthFilterVal !== mm) return false;
        if (dayFilterVal && dayFilterVal !== dd) return false;
      }

      // (2) Filter Date Range (startTs <= bk.rawDate <= endTs)
      if (startTs && bk.rawDate < startTs) return false;
      if (endTs && bk.rawDate > endTs) return false;

      return true;
    });

    // console.log("After filter:", this.filteredBookings);

    this.sortBookings();
    this.renderTable();
    this.renderPagination();
  }

  // ฟังก์ชันช่วย parse "dd/mm/yyyy" เป็น timestamp
  parseDdMmYyyyToTimestamp(dateStr, isStartOfDay = true) {
    if (!dateStr) return null;
    const [dd, mm, yyyy] = dateStr.split("/");
    if (!dd || !mm || !yyyy) return null;

    let h = isStartOfDay ? 0 : 23;
    let m = isStartOfDay ? 0 : 59;
    let s = isStartOfDay ? 0 : 59;

    const d = new Date(+yyyy, +mm - 1, +dd, h, m, s);
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  // --- (5) จัดเรียง (sort) bookings ตาม sortKey และ sortDirection ---
  sortBookings() {
    this.filteredBookings.sort((a, b) => {
      let valA, valB;

      if (this.sortKey === "timestamp") {
        valA = a.rawTimestamp;
        valB = b.rawTimestamp;
      } else {
        valA = a[this.sortKey] || "";
        valB = b[this.sortKey] || "";
      }

      if (typeof valA === "number" && typeof valB === "number") {
        return this.sortDirection === "asc" ? valA - valB : valB - valA;
      } else {
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        if (strA === strB) return 0;
        if (this.sortDirection === "asc") {
          return strA < strB ? -1 : 1;
        } else {
          return strA > strB ? -1 : 1;
        }
      }
    });
  }

  // --- (6) แสดงตารางตาม this.selectedColumns ---
  renderTable() {
    const thead = this.container.querySelector("#bookingTableHead");
    const tbody = this.container.querySelector("#bookingTableBody");

    // Head
    thead.innerHTML = "";
    this.selectedColumns.forEach((col) => {
      const th = document.createElement("th");
      th.textContent = col.label;
      thead.appendChild(th);
    });

    // Body
    tbody.innerHTML = "";

    const paginatedData = this.paginateData();
    if (paginatedData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="99">No bookings found</td></tr>`;
      return;
    }

    paginatedData.forEach((bk) => {
      const tr = document.createElement("tr");
      this.selectedColumns.forEach((col) => {
        const td = document.createElement("td");
        if (col.key === "date") {
          // แปลง "YYYY-MM-DD" => "dd/mm/yyyy"
          td.textContent = this.formatDate(bk.date);
        } else if (col.key === "timestamp") {
          // แสดง timestamp เป็น วันที่/เวลา
          td.textContent = this.formatTimestamp(bk.rawTimestamp);
        } else {
          td.textContent = bk[col.key] || "-";
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  // --- แสดง timestamp เป็น "dd/mm/yyyy HH:MM น."
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

  // --- แสดง "YYYY-MM-DD" => "dd/mm/yyyy"
  formatDate(dateStr) {
    if (!dateStr || dateStr === "-") return "-";
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  }

  paginateData() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredBookings.slice(start, end);
  }

  changePage(newPage) {
    const totalPages = Math.ceil(
      this.filteredBookings.length / this.itemsPerPage
    );
    if (newPage < 1 || newPage > totalPages) return;
    this.currentPage = newPage;
    this.renderTable();
    this.renderPagination();
  }

  renderPagination() {
    const totalPages = Math.ceil(
      this.filteredBookings.length / this.itemsPerPage
    );
    const paginationContainer = this.container.querySelector("#pagination");
    paginationContainer.innerHTML = "";

    for (let i = 1; i <= totalPages; i++) {
      const button = document.createElement("button");
      button.textContent = i;
      button.className = i === this.currentPage ? "active" : "";
      button.addEventListener("click", () => this.changePage(i));
      paginationContainer.appendChild(button);
    }
  }
}

customElements.define("booking-table", BookingTable);
