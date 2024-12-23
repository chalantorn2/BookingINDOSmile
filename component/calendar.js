class CalendarComponent extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <style>
            /* Calendar Styles */
            #calendar {
                width: 100%
                max-width: 1400px;
                margin: 0 auto;
                background: #f8fafc;
                padding: 20px;
                border-radius: 15px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                overflow: hidden;
            }
            .calendar-title {
                font-size: 1.75rem;
                font-weight: bold;
                text-align: center;
                margin-bottom: 1rem;
                color: #1f2937; 
            }
            .calendar-subtitle {
                text-align: center;
                font-size: 1rem;
                margin-bottom: 1.5rem;
                color: #6b7280;
            }
            .fc-toolbar {
                margin-bottom: 1rem;
            }
            .fc-daygrid-day {
                border-radius: 8px;
                background-color: #ffffff;
            }
            .fc-daygrid-day:hover {
                background-color: rgba(59, 130, 246, 0.1);
                cursor: pointer;
            }
            .fc-daygrid-day.fc-day-today {
                background-color: #e0f2fe !important;
                font-weight: bold;
            }
            .fc .fc-daygrid-day.fc-day-today:hover {
                background-color: #bae6fd !important;
            }
            .fc-event {
                border: none;
                padding: 5px 10px;
                border-radius: 5px;
                color: #fff;
                font-size: 0.85rem;
                text-align: left;
            }
            .fc-event-status-รอดำเนินการ {
                background-color: #f0f0f0 !important;
                border-left: 4px solid #c4c4c4;
            }
            .fc-event-status-จองแล้ว {
                background-color: #d0e7ff !important;
                border-left: 4px solid #5ab4f7;
            }
            .fc-event-status-ดำเนินการอยู่ {
                background-color: #ffe8a1 !important;
                border-left: 4px solid #ffc107;
            }
            .fc-event-status-เสร็จสมบูรณ์ {
                background-color: #d4f7d4 !important;
                border-left: 4px solid #28a745;
            }
        </style>
        <div>
            <div id="calendar"></div>
        </div>
        `;

        // Firebase Config
        const firebaseConfig = {
            apiKey: "AIzaSyDijkIIuVzWQWk6VSkXmexrnR_Ldjro",
            authDomain: "booking-database-86230.firebaseapp.com",
            databaseURL: "https://booking-database-86230-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "booking-database-86230",
            storageBucket: "booking-database-86230.appspot.com",
            messagingSenderId: "891604763798",
            appId: "1:891604763798:web:a27d3bf90c0e60563caeb7",
            measurementId: "G-YVFPZ8RJGE"
        };

        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        const database = firebase.database();

        // Initialize FullCalendar
        const calendarEl = this.querySelector("#calendar");
        const calendar = new FullCalendar.Calendar(calendarEl, {
            themeSystem: 'standard', // หรือ 'none' เพื่อปิดธีม
            initialView: "dayGridMonth",
            headerToolbar: {
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,dayGridWeek"
            },
            events: async function (info, successCallback, failureCallback) {
                try {
                    const [tourSnapshot, transferSnapshot] = await Promise.all([
                        database.ref("tourBookings").once("value"),
                        database.ref("transferBookings").once("value")
                    ]);

                    const events = [];
                    if (tourSnapshot.exists()) {
                        tourSnapshot.forEach((booking) => {
                            const data = booking.val();
                            events.push({
                                title: `${data.pickUpTime || "No time"} - ${data.sendTo || "Tour"}`,
                                start: data.date,
                                color: data.status === 'รอดำเนินการ' ? '#c4c4c4' :
                                    data.status === 'จองแล้ว' ? '#5ab4f7' :
                                    data.status === 'ดำเนินการอยู่' ? '#ffc107' :
                                    '#28a745',
                                extendedProps: {
                                    description: data.detail || "No details available",
                                    status: data.status
                                }
                            });
                        });
                    }

                    if (transferSnapshot.exists()) {
                        transferSnapshot.forEach((booking) => {
                            const data = booking.val();
                            events.push({
                                title: `${data.pickUpTime || "No time"} - ${data.sendTo || "Transfer"}`,
                                start: data.date,
                                color: data.status === 'รอดำเนินการ' ? '#c4c4c4' :
                                    data.status === 'จองแล้ว' ? '#5ab4f7' :
                                    data.status === 'ดำเนินการอยู่' ? '#ffc107' :
                                    '#28a745',
                                extendedProps: {
                                    description: data.detail || "No details available",
                                    status: data.status
                                }
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
                        <strong>ชื่อผู้จอง:</strong> ${info.event.title || "-"}<br>
                        <strong>วันที่:</strong> ${info.event.start.toLocaleDateString('th-TH') || "-"}<br>
                        <strong>รายละเอียด:</strong> ${info.event.extendedProps.description || "ไม่มีรายละเอียด"}<br>
                        <strong>สถานะ:</strong> ${info.event.extendedProps.status || "ไม่ระบุ"}
                    </div>
                `;
            
                // Create Tooltip Element
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
            
                // Show Tooltip on Hover
                info.el.addEventListener("mouseenter", (e) => {
                    tooltip.style.left = `${e.pageX + 10}px`;
                    tooltip.style.top = `${e.pageY + 10}px`;
                    tooltip.style.display = "block";
                });
            
                // Move Tooltip with Mouse
                info.el.addEventListener("mousemove", (e) => {
                    tooltip.style.left = `${e.pageX + 10}px`;
                    tooltip.style.top = `${e.pageY + 10}px`;
                });
            
                // Hide Tooltip on Mouse Leave
                info.el.addEventListener("mouseleave", () => {
                    tooltip.style.display = "none";
                });
            }
            
        });

        // Listen to Firebase changes
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

// Define the custom element
customElements.define("calendar-component", CalendarComponent);

