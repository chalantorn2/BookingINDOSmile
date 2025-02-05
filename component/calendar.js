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
    background-color:rgb(209, 209, 209) !important; /* น้ำเงินอ่อนสำหรับวันที่ปัจจุบัน */
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
    background-color: #d6d6d6 !important;
    border-left: 4px solid #a6a6a6;
    color: #ffffff;
}
.fc-event-status-จองแล้ว {
    background-color: #99c9ff !important;
    border-left: 4px solid #007bff;
    color: #ffffff;
}
.fc-event-status-ดำเนินการอยู่ {
    background-color: #ffe08a !important;
    border-left: 4px solid #e0a800;
    color: #ffffff;
}
.fc-event-status-เสร็จสมบูรณ์ {
    background-color: #82e1aa !important;
    border-left: 4px solid #218838;
    color: #ffffff;
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
        `

    // Your existing JavaScript to initialize FullCalendar
    // Add features like tooltips or animations as needed.

    // Firebase Config
    const firebaseConfig = {
      apiKey: 'AIzaSyDijkIIuVzWQWk6VSkXmexrnR_Ldjro',
      authDomain: 'booking-database-86230.firebaseapp.com',
      databaseURL: 'https://booking-database-86230-default-rtdb.asia-southeast1.firebasedatabase.app',
      projectId: 'booking-database-86230',
      storageBucket: 'booking-database-86230.appspot.com',
      messagingSenderId: '891604763798',
      appId: '1:891604763798:web:a27d3bf90c0e60563caeb7',
      measurementId: 'G-YVFPZ8RJGE',
    }

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig)
    const database = firebase.database()

    // Initialize FullCalendar
    const calendarEl = this.querySelector('#calendar')
    const calendar = new FullCalendar.Calendar(calendarEl, {
      themeSystem: 'standard',
      initialView: 'dayGridMonth',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,dayGridWeek',
      },
      events: async function (info, successCallback, failureCallback) {
        try {
          const [tourSnapshot, transferSnapshot] = await Promise.all([
            database.ref('tourBookings').once('value'),
            database.ref('transferBookings').once('value'),
          ])

          const events = []

          // ดึงข้อมูล Tour
          if (tourSnapshot.exists()) {
            tourSnapshot.forEach(booking => {
              const data = booking.val()
              events.push({
                title: `(T) ${data.tourPickUpTime + ' ' + (data.tourFirstName || data.customerName || 'No name')} `,
                start: data.tourDate || data.date,
                color: getColorByStatus(data.status),
                extendedProps: {
                  id: data.tourID,
                  agent: data.tourAgent || data.agent,
                  type: data.tourType || data.type,
                  detail: data.tourDetail || data.detail,
                  pax: data.tourPax || data.pax,
                  fee: data.tourFee || data.fee,
                  meal: data.tourMeal || data.meal,
                  hotel: data.tourHotel || data.hotel,
                  roomNo: data.tourRoomNo || data.roomNo,
                  contactNo: data.tourContactNo || data.contactNo,
                  pickUpTime: data.tourPickUpTime || data.pickUpTime,
                  sendTo: data.tourSendTo || data.sendTo,
                  note: data.tourNote || data.note,
                  firstName: data.tourFirstName || '',
                  lastName: data.tourLastName || '',
                  status: data.status,
                },
              })
            })
          }

          // ดึงข้อมูล Transfer
          if (transferSnapshot.exists()) {
            transferSnapshot.forEach(booking => {
              const data = booking.val()
              events.push({
                title: `(Tr) ${data.transferPickUpTime + ' ' + (data.transferFirstName || data.name || 'No name')} `,
                start: data.transferDate || data.date,
                color: getColorByStatus(data.status),
                extendedProps: {
                  id: data.transferID,
                  agent: data.transferAgent || data.agent,
                  type: data.transferType || data.type,
                  detail: data.transferDetail || data.detail,
                  pax: data.transferPax || data.pax,
                  flight: data.transferFlight || data.flight,
                  time: data.transferTime || data.time,
                  pickUpTime: data.transferPickUpTime || data.pickUpTime,
                  pickupFrom: data.transferPickupFrom || data.pickupFrom,
                  dropTo: data.transferDropTo || data.dropTo,
                  sendTo: data.transferSendTo || data.sendTo,
                  note: data.transferNote || data.note,
                  firstName: data.transferFirstName || '',
                  lastName: data.transferLastName || '',
                  status: data.status,
                  carModel: data.car_model || '-',
                  licensePlate: data.license_plate || '-',
                  driverName: data.driver_name || '-',
                  phoneNumber: data.phone_number || '-',
                },
              })
            })
          }

          // จัดเรียงเหตุการณ์ตาม pickUpTime
          events.sort((a, b) => {
            const timeA = a.extendedProps.pickUpTime || '00:00'
            const timeB = b.extendedProps.pickUpTime || '00:00'
            return timeA.localeCompare(timeB)
          })

          // ส่งข้อมูลกลับไปยัง FullCalendar
          successCallback(events)
        } catch (error) {
          console.error('Error fetching events:', error)
          failureCallback(error)
        }
      },

      eventDidMount: function (info) {
        const isTransfer = info.event.title.includes('(Tr)') // ตรวจสอบว่าเป็น Transfer หรือไม่
        const firstName = info.event.extendedProps.firstName || '-'
        const lastName = info.event.extendedProps.lastName || '-'

        const tooltipContent = `
          <div style="display: flex; gap: 20px;">
                        <div style="flex: 1;">
              <h5><strong>${
                info.event.start
                  ? `${String(info.event.start.getDate()).padStart(2, '0')}/${String(
                      info.event.start.getMonth() + 1
                    ).padStart(2, '0')}/${info.event.start.getFullYear()}`
                  : '-'
              }</strong></h5>

              <h6><strong>เวลารับ:</strong> ${info.event.extendedProps.pickUpTime || '-'}</h6>
              <strong>ชื่อ:</strong> ${firstName}<br>
              <strong>นามสกุล:</strong> ${lastName}<br>
              <strong>จำนวน:</strong> ${info.event.extendedProps.pax || '-'}<br>
              <strong>ส่งใคร:</strong> ${info.event.extendedProps.sendTo || '-'}<br>
            
              <strong>ประเภท:</strong> ${info.event.extendedProps.type || '-'}<br>
              <strong>รายละเอียด:</strong> ${info.event.extendedProps.detail || '-'}<br>
             
            </div>
      
                        <div style="flex: 1;">

              ${
                isTransfer
                  ? `
                <strong>รุ่นรถ:</strong> ${info.event.extendedProps.carModel}<br>
                <strong>ป้ายทะเบียน:</strong> ${info.event.extendedProps.licensePlate}<br>
                <strong>ชื่อคนขับ:</strong> ${info.event.extendedProps.driverName}<br>
                <strong>เบอร์โทร:</strong> ${info.event.extendedProps.phoneNumber}<br>
                `
                  : `
                 <strong>โรงแรม:</strong> ${info.event.extendedProps.hotel || '-'}<br>
          <strong>หมายเลขห้อง:</strong> ${info.event.extendedProps.roomNo || '-'}<br>
          <strong>Fee:</strong> ${info.event.extendedProps.fee || '-'}<br>
          <strong>อาหาร:</strong> ${info.event.extendedProps.meal || '-'}<br>
          <strong>ติดต่อ:</strong> ${info.event.extendedProps.contactNo || '-'}<br>
                `
              }
              <strong>หมายเหตุ:</strong> ${info.event.extendedProps.note || '-'}<br>
              <strong>สถานะ:</strong> ${info.event.extendedProps.status || '-'}<br>
              <h5 style="color:rgb(128, 128, 128);"><i><strong>${isTransfer ? 'Transfer' : 'Tour'}</strong></i></h5>
              <h6 style="color:rgb(128, 128, 128);"><i><strong>${info.event.extendedProps.id || '-'}</strong></i></h6>
            </div>
          </div>
        `

        const tooltip = document.createElement('div')
        tooltip.innerHTML = tooltipContent
        tooltip.style.position = 'absolute'
        tooltip.style.backgroundColor = '#fff'
        tooltip.style.padding = '10px'
        tooltip.style.border = '1px solid #ddd'
        tooltip.style.borderRadius = '5px'
        tooltip.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
        tooltip.style.zIndex = '1000'
        tooltip.style.display = 'none'
        tooltip.style.fontSize = '0.9rem'
        tooltip.style.color = '#333'

        document.body.appendChild(tooltip)

        // เพิ่มเอฟเฟกต์ hover
        info.el.addEventListener('mouseenter', e => {
          tooltip.style.left = `${e.pageX + 10}px`
          tooltip.style.top = `${e.pageY + 10}px`
          tooltip.style.display = 'block'

          // เพิ่มสไตล์ hover
          info.el.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease, border 0.3s ease'
          info.el.style.transform = 'scale(1.05)'
          info.el.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)'
          info.el.style.border = '2px solid black' // เพิ่มกรอบสีดำ
        })

        info.el.addEventListener('mousemove', e => {
          tooltip.style.left = `${e.pageX + 10}px`
          tooltip.style.top = `${e.pageY + 10}px`
        })

        info.el.addEventListener('mouseleave', () => {
          tooltip.style.display = 'none'

          // คืนค่าเดิมเมื่อเมาส์ออก
          info.el.style.transform = 'scale(1)'
          info.el.style.boxShadow = 'none'
          info.el.style.border = 'none' // ลบกรอบสีดำ
        })
      },
    })
    const getColorByStatus = status => {
      switch (status) {
        case 'รอดำเนินการ':
          return '#a6a6a6' // สีเทาเข้มขึ้น
        case 'จองแล้ว':
          return '#007bff' // สีน้ำเงินเข้มขึ้น
        case 'ดำเนินการอยู่':
          return '#e0a800' // สีเหลืองเข้มขึ้น
        case 'เสร็จสมบูรณ์':
          return '#218838' // สีเขียวเข้มขึ้น
        default:
          return '#ff0033' // สีดำ (สำหรับสถานะที่ไม่รู้จัก)
      }
    }

    const updateCalendar = () => {
      database.ref('tourBookings').on('value', () => {
        calendar.refetchEvents()
      })

      database.ref('transferBookings').on('value', () => {
        calendar.refetchEvents()
      })
    }

    calendar.render()
    updateCalendar()
  }
}

customElements.define('calendar-component', CalendarComponent)
