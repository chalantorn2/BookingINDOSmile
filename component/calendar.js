class CalendarComponent extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
        <style>
            /* Calendar Container Styles */
#calendar {
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    background: #ffffff; /* พื้นหลังสีขาว */
    padding: 20px;
    border-radius: 15px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    font-family: "Prompt", sans-serif;
}

/* Calendar Titles */
.calendar-title {
    font-size: 2rem;
    font-weight: bold;
    text-align: center;
    margin-bottom: 1rem;
    color: #1e40af; /* สีน้ำเงินเข้ม */
}
.calendar-subtitle {
    text-align: center;
    font-size: 1rem;
    margin-bottom: 1.5rem;
    color: #475569; /* น้ำเงินเทา */
}

/* Toolbar Styles */
.fc-toolbar {
    margin-bottom: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.fc-toolbar-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e3a8a; /* น้ำเงินเข้ม */
}
.fc-button {
    background-color: #3b82f6; /* สีน้ำเงิน */
    color: #ffffff; /* สีตัวอักษรขาว */
    border: none;
    border-radius: 5px;
    padding: 5px 10px;
    font-weight: bold;
    transition: background-color 0.3s ease;
}
.fc-button:hover {
    background-color: #2563eb; /* น้ำเงินเข้มขึ้นเมื่อ hover */
}

/* Day Grid Styles */
.fc-daygrid-day-number {
    text-decoration: none !important; /* ลบเส้นใต้ */
    color:rgb(0, 0, 0); /* สีน้ำเงินเข้ม */
    font-weight: bold;
    font-size: 1rem;
}
.fc-col-header-cell-cushion {
    text-decoration: none !important;
    color: #1d4ed8; /* น้ำเงิน */
    font-weight: bold;
    font-size: 1.2rem;
}

/* Days Background */
.fc-daygrid-day {
    border-radius: 10px;
    background-color: #f9fafb; /* สีพื้นหลังของวัน */
    transition: background-color 0.3s ease;
}
.fc-daygrid-day:hover {
    background-color: #e0f2fe; /* น้ำเงินอ่อนเมื่อ hover */
    cursor: pointer;
}
.fc-daygrid-day.fc-day-today {
    background-color:rgb(238, 238, 238) !important; /* น้ำเงินอ่อนสำหรับวันที่ปัจจุบัน */
    font-weight: bold;
    // border: 2px solid #1d4ed8;
}
.fc-daygrid-day.fc-day-today:hover {
    background-color: #bfdbfe !important; /* น้ำเงินเข้มขึ้นเมื่อ hover */
}

/* Event Styles */
.fc-event {
    border: none;
    padding: 5px 12px;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    text-align: left;
    overflow: hidden;
    color: #fff; /* สีตัวอักษร */
}
.fc-event-status-รอดำเนินการ {
    background-color: #f0f0f0 !important;
    border-left: 4px solid #c4c4c4;
}
.fc-event-status-จองแล้ว {
    background-color: #cfe8ff !important;
    border-left: 4px solid #5ab4f7;
}
.fc-event-status-ดำเนินการอยู่ {
    background-color: #fff4ce !important;
    border-left: 4px solid #ffc107;
}
.fc-event-status-เสร็จสมบูรณ์ {
    background-color: #d1fae5 !important;
    border-left: 4px solid #28a745;
}

/* Tooltip Styles */
.tooltip {
    position: absolute;
    background-color: #ffffff;
    border: 1px solid #e5e7eb;
    padding: 10px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    font-size: 0.9rem;
    color: #374151;
    z-index: 1000;
    display: none;
}

        </style>
        <div>
            <div id="calendar"></div>
        </div>
        `;

    // Your existing JavaScript to initialize FullCalendar
    // Add features like tooltips or animations as needed.

    // Firebase Config
    const firebaseConfig = {
      apiKey: "AIzaSyDijkIIuVzWQWk6VSkXmexrnR_Ldjro",
      authDomain: "booking-database-86230.firebaseapp.com",
      databaseURL:
        "https://booking-database-86230-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "booking-database-86230",
      storageBucket: "booking-database-86230.appspot.com",
      messagingSenderId: "891604763798",
      appId: "1:891604763798:web:a27d3bf90c0e60563caeb7",
      measurementId: "G-YVFPZ8RJGE",
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();

    // Initialize FullCalendar
    const calendarEl = this.querySelector("#calendar");
    const calendar = new FullCalendar.Calendar(calendarEl, {
      themeSystem: "standard",
      initialView: "dayGridMonth",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,dayGridWeek",
      },
      events: async function (info, successCallback, failureCallback) {
        try {
          const [tourSnapshot, transferSnapshot] = await Promise.all([
            database.ref("tourBookings").once("value"),
            database.ref("transferBookings").once("value"),
          ]);

          const events = [];
          if (tourSnapshot.exists()) {
            tourSnapshot.forEach((booking) => {
              const data = booking.val();
              events.push({
                title: `${data.customerName || "No name"} (Tour)`,
                start: data.date,
                color: getColorByStatus(data.status),
                extendedProps: {
                  agent: data.agent,
                  type: data.type,
                  detail: data.detail,
                  pax: data.pax,
                  fee: data.fee,
                  meal: data.meal,
                  hotel: data.hotel,
                  roomNo: data.roomNo,
                  contactNo: data.contactNo,
                  pickUpTime: data.pickUpTime,
                  sendTo: data.sendTo,
                  note: data.note,
                  status: data.status,
                },
              });
            });
          }

          if (transferSnapshot.exists()) {
            transferSnapshot.forEach((booking) => {
              const data = booking.val();
              events.push({
                title: `${data.name || "No name"} (Transfer)`,
                start: data.date,
                color: getColorByStatus(data.status),
                extendedProps: {
                  agent: data.agent,
                  type: data.type,
                  detail: data.detail,
                  pax: data.pax,
                  flight: data.flight,
                  time: data.time,
                  pickUpTime: data.pickUpTime,
                  pickupFrom: data.pickupFrom,
                  dropTo: data.dropTo,
                  sendTo: data.sendTo,
                  note: data.note,
                  status: data.status,
                },
              });
            });
          }

          successCallback(events);
        } catch (error) {
          console.error("Error fetching events:", error);
          failureCallback(error);
        }
      },
      eventDidMount: function (info) {
        const tooltipContent = `
        <div>
          <strong>Title:</strong> ${info.event.title || "-"}<br>
          <strong>Date:</strong> ${
            info.event.start.toLocaleDateString("th-TH") || "-"
          }<br>
          <strong>Agent:</strong> ${info.event.extendedProps.agent || "-"}<br>
          <strong>Type:</strong> ${info.event.extendedProps.type || "-"}<br>
          <strong>Details:</strong> ${
            info.event.extendedProps.detail || "-"
          }<br>
          <strong>Pax:</strong> ${info.event.extendedProps.pax || "-"}<br>
          <strong>Status:</strong> ${info.event.extendedProps.status || "-"}<br>
          <strong>Note:</strong> ${info.event.extendedProps.note || "-"}<br>
        </div>`;

        const tooltip = document.createElement("div");
        tooltip.innerHTML = tooltipContent;
        tooltip.style.position = "absolute";
        tooltip.style.backgroundColor = "#fff";
        tooltip.style.padding = "10px";
        tooltip.style.border = "1px solid #ddd";
        tooltip.style.borderRadius = "5px";
        tooltip.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
        tooltip.style.zIndex = "1000";
        tooltip.style.display = "none";
        tooltip.style.fontSize = "0.9rem";
        tooltip.style.color = "#333";

        document.body.appendChild(tooltip);

        info.el.addEventListener("mouseenter", (e) => {
          tooltip.style.left = `${e.pageX + 10}px`;
          tooltip.style.top = `${e.pageY + 10}px`;
          tooltip.style.display = "block";
        });

        info.el.addEventListener("mousemove", (e) => {
          tooltip.style.left = `${e.pageX + 10}px`;
          tooltip.style.top = `${e.pageY + 10}px`;
        });

        info.el.addEventListener("mouseleave", () => {
          tooltip.style.display = "none";
        });
      },
    });

    const getColorByStatus = (status) => {
      switch (status) {
        case "รอดำเนินการ":
          return "#c4c4c4";
        case "จองแล้ว":
          return "#5ab4f7";
        case "ดำเนินการอยู่":
          return "#ffc107";
        case "เสร็จสมบูรณ์":
          return "#28a745";
        default:
          return "#000000";
      }
    };

    const updateCalendar = () => {
      database.ref("tourBookings").on("value", () => {
        calendar.refetchEvents();
      });

      database.ref("transferBookings").on("value", () => {
        calendar.refetchEvents();
      });
    };

    calendar.render();
    updateCalendar();
  }
}

customElements.define("calendar-component", CalendarComponent);
