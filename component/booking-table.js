// /component/booking-table.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";

import { database } from "/js/firebase-config.js";

class BookingTable extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    // ---- (1) คอลัมน์ทั้งหมด (key, label) ----
    this.allColumns = [
      { key: "type", label: "Type" },
      { key: "id", label: "Booking ID" },
      { key: "agent", label: "Agent" },
      { key: "sendTo", label: "Send To" },
      { key: "date", label: "Date" },
      { key: "timestamp", label: "Timestamp" },
    ];

    // ค่าเริ่มต้น: ใช้ทุกคอลัมน์
    this.selectedColumns = [...this.allColumns];

    // ---- (2) ตัวแปรสำหรับข้อมูล bookings และการ sort ----
    this.allBookings = []; // เก็บข้อมูลทั้งหมด (Tour + Transfer)
    this.filteredBookings = []; // เก็บข้อมูลหลัง Filter (Day, Month, Year)
    this.sortKey = "timestamp"; // ค่าเริ่มต้น: sort ตาม timestamp
    this.sortDirection = "desc"; // เรียงจากล่าสุดมาก่อน

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

      // --- ดึง Tour ---
      if (tourSnap.exists()) {
        tourSnap.forEach((snap) => {
          const d = snap.val();
          tempData.push({
            type: "Tour",
            id: d.tourID || snap.key,
            agent: d.tourAgent || "-",
            sendTo: d.tourSendTo || "-",
            date: d.tourDate || "-", // "YYYY-MM-DD"
            // เก็บตัวเลขไว้เรียงได้ง่าย (ถ้า d.timestamp เป็น number)
            rawTimestamp: typeof d.timestamp === "number" ? d.timestamp : 0,
          });
        });
      }

      // --- ดึง Transfer ---
      if (transferSnap.exists()) {
        transferSnap.forEach((snap) => {
          const d = snap.val();
          tempData.push({
            type: "Transfer",
            id: d.transferID || snap.key,
            agent: d.transferAgent || "-",
            sendTo: d.transferSendTo || "-",
            date: d.transferDate || "-", // "YYYY-MM-DD"
            rawTimestamp: typeof d.timestamp === "number" ? d.timestamp : 0,
          });
        });
      }

      // เก็บลงตัวแปรของ component
      this.allBookings = tempData;

      // เรียก populate Dropdown (Day/Month/Year)
      this.populateDateFilters();

      // เรียกฟังก์ชัน filter (ค่าเริ่มต้นไม่เลือกอะไร = ดูทั้งหมด) แล้ว sort + render
      this.applyDateFilter();
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
    max-width: 1200px;
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
</style>

<div class="container">
  <!-- Header -->
  <div class="header">
    <h3>Booking Table</h3>
  </div>

  <!-- Filters and Sort Options -->
  <div class="filter-sort-container">
    <!-- Row 1: Date Filters -->
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
</div>

    `;

    // Bind Events to Date Filters
    const dayFilterEl = this.container.querySelector("#dayFilter");
    const monthFilterEl = this.container.querySelector("#monthFilter");
    const yearFilterEl = this.container.querySelector("#yearFilter");

    [dayFilterEl, monthFilterEl, yearFilterEl].forEach((filterEl) => {
      if (filterEl) {
        filterEl.addEventListener("change", () => {
          this.applyDateFilter(); // Automatically apply filter when user selects a value
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
  }

  // --- (4.x) Populate ตัวเลือก Day, Month, Year จากข้อมูลทั้งหมด (this.allBookings) ---
  populateDateFilters() {
    // เอาทุก date (YYYY-MM-DD) มาแตกเป็น day/month/year
    const daySet = new Set();
    const monthSet = new Set();
    const yearSet = new Set();

    this.allBookings.forEach((bk) => {
      if (!bk.date || bk.date === "-") return; // ถ้าไม่มี date, ข้าม
      const [yyyy, mm, dd] = bk.date.split("-");
      if (yyyy && mm && dd) {
        daySet.add(dd);
        monthSet.add(mm);
        yearSet.add(yyyy);
      }
    });

    // แปลงเป็น array แล้ว sort
    const dayArr = Array.from(daySet).sort((a, b) => Number(a) - Number(b));
    const monthArr = Array.from(monthSet).sort((a, b) => Number(a) - Number(b));
    const yearArr = Array.from(yearSet).sort((a, b) => Number(a) - Number(b));

    // เพิ่มลงใน dropdown
    const dayFilter = this.container.querySelector("#dayFilter");
    const monthFilter = this.container.querySelector("#monthFilter");
    const yearFilter = this.container.querySelector("#yearFilter");

    dayArr.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d; // "01" / "02" ...
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

  // --- (4.y) ฟังก์ชัน Filter ตาม day/month/year (จาก Dropdown) ---
  applyDateFilter() {
    const dayFilterVal = this.container.querySelector("#dayFilter").value; // "" or "01" "02" ...
    const monthFilterVal = this.container.querySelector("#monthFilter").value; // "" or "01" "02" ...
    const yearFilterVal = this.container.querySelector("#yearFilter").value; // "" or "2025" ...

    // Filter บน allBookings แล้วเก็บใน filteredBookings
    this.filteredBookings = this.allBookings.filter((bk) => {
      if (!bk.date || bk.date === "-") return false; // ถ้าไม่มีวันเลย ก็ไม่โชว์
      const [yyyy, mm, dd] = bk.date.split("-");

      // ถ้า user เลือก year แต่ปีไม่ match -> ตัดทิ้ง
      if (yearFilterVal && yearFilterVal !== yyyy) return false;
      // ถ้า user เลือก month แต่เดือนไม่ match -> ตัดทิ้ง
      if (monthFilterVal && monthFilterVal !== mm) return false;
      // ถ้า user เลือก day แต่วันไม่ match -> ตัดทิ้ง
      if (dayFilterVal && dayFilterVal !== dd) return false;

      // ผ่านทุกเงื่อนไข -> เก็บ
      return true;
    });

    // จากนั้นเรียก sort + render
    this.sortBookings();
    this.renderTable();
  }

  // --- (5) จัดเรียง (sort) bookings ตาม sortKey และ sortDirection ---
  sortBookings() {
    // ตรงนี้เปลี่ยนจาก this.allBookings เป็น this.filteredBookings
    // เพราะจะแสดงเฉพาะที่ผ่าน filter แล้ว
    this.filteredBookings.sort((a, b) => {
      let valA, valB;

      if (this.sortKey === "timestamp") {
        valA = a.rawTimestamp;
        valB = b.rawTimestamp;
      } else {
        valA = a[this.sortKey] || "";
        valB = b[this.sortKey] || "";
      }

      // แยกกรณีเทียบเป็น number หรือ string
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

    // ตอนนี้เราจะใช้ข้อมูลจาก this.filteredBookings ในการแสดง
    if (this.filteredBookings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="99">No bookings found</td></tr>`;
      return;
    }

    // วนใน each booking ของ filtered
    this.filteredBookings.forEach((bk) => {
      const tr = document.createElement("tr");

      this.selectedColumns.forEach((col) => {
        const td = document.createElement("td");

        // ฟิลด์ date → แปลง "YYYY-MM-DD" => "dd/mm/yyyy"
        if (col.key === "date") {
          td.textContent = this.formatDate(bk.date);
        }
        // ฟิลด์ timestamp → แปลง milli => "dd/mm/yyyy HH:MM"
        else if (col.key === "timestamp") {
          td.textContent = this.formatTimestamp(bk.rawTimestamp);
        } else {
          // ฟิลด์อื่น ๆ
          td.textContent = bk[col.key] || "-";
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  // --- (7.1) Format timestamp => "dd/mm/yyyy HH:MM" ---
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

  // --- (7.2) Format "YYYY-MM-DD" => "dd/mm/yyyy" ---
  formatDate(dateStr) {
    if (!dateStr || dateStr === "-") return "-";
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  }
}

customElements.define("booking-table", BookingTable);
