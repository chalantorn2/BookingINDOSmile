import { database } from '/js/firebase-config.js' // Firebase Configuration
import { ref, get } from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js'

class CalendarHighlight extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <style>
        .calendar-slider {
          display: flex;
          justify-content: center; /* จัดให้อยู่ตรงกลาง */
          align-items: center;
          gap: 10px; /* ระยะห่างระหว่างแต่ละวัน */
          flex-wrap: wrap; /* ให้วันที่เกินขนาดหน้าจอพับบรรทัดใหม่ */
        //   background-color:rgb(255, 255, 255);
          border-radius: 2px;
        }

        .calendar-slider .day {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 37px; /* กำหนดขนาดความกว้าง */
          height: 40px; /* กำหนดขนาดความสูง */
          font-weight: bold;
          color: black;
          gap: 10px;
          margin: 2px;
          padding: 10px;
          background-color:rgb(255, 255, 255);
          border-radius: 5px;
          cursor: pointer;
          text-align: center;
          transition: background-color 0.3s ease; /* เพิ่ม Transition */
        }

        .calendar-slider .day.booked {
          background-color: #4caf50; /* สีเขียวสำหรับวันที่จอง */
          color: white;
        }

        .calendar-slider .day:hover {
          background-color: #0288d1;
          color: white;
        }

        .calendar-slider .day.selected {
          border: 2px solid #0f5434;
          box-shadow: 0 0 5px #0288d1;
          border-radius: 5px;
        }

      </style>

      <div class="calendar-slider">
        <div id="days-container"></div>
      </div>
    `

    this.initializeSlider()
    this.listenForDateChange() // Listen for date change from inlineCalendar
  }

  initializeSlider() {
    this.daysContainer = this.querySelector('#days-container')
    this.updateSlider(new Date()) // Initial load for the current month
  }

  async updateSlider(selectedDate) {
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const bookedDates = await this.fetchBookingDates(year, month)

    this.daysContainer.innerHTML = '' // Clear current days

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const dayElement = document.createElement('div')
      dayElement.classList.add('day')

      if (bookedDates.has(dateStr)) {
        dayElement.classList.add('booked')
      }

      // Highlight the selected day
      if (day === selectedDate.getDate()) {
        dayElement.classList.add('selected')
      }

      dayElement.textContent = day

      // Add click event to day
      dayElement.addEventListener('click', () => {
        // Remove previous selected class
        this.daysContainer.querySelectorAll('.day').forEach(el => {
          el.classList.remove('selected')
        })

        // Add selected class to clicked day
        dayElement.classList.add('selected')

        // Dispatch custom event with the selected date
        const selectedEvent = new CustomEvent('day-selected', {
          detail: {
            year,
            month,
            day,
          },
        })
        window.dispatchEvent(selectedEvent) // ส่งเหตุการณ์ไปยังระบบ
      })

      this.daysContainer.appendChild(dayElement)
    }
  }

  listenForDateChange() {
    window.addEventListener('calendar-date-change', event => {
      const { year, month, day } = event.detail // รับข้อมูลวันที่ที่เลือก
      const selectedDate = new Date(year, month, day) // สร้างวันที่ที่เลือก
      this.updateSlider(selectedDate) // อัปเดต slider พร้อมวันที่ที่เลือก
    })
  }

  async fetchBookingDates(year, month) {
    const tourRef = ref(database, 'tourBookings')
    const transferRef = ref(database, 'transferBookings')

    const bookedDates = new Set()

    try {
      const [tourSnapshot, transferSnapshot] = await Promise.all([get(tourRef), get(transferRef)])

      if (tourSnapshot.exists()) {
        tourSnapshot.forEach(booking => {
          const date = booking.val().tourDate
          const bookingDate = new Date(date)
          if (bookingDate.getFullYear() === year && bookingDate.getMonth() === month) {
            bookedDates.add(date)
          }
        })
      }

      if (transferSnapshot.exists()) {
        transferSnapshot.forEach(booking => {
          const date = booking.val().transferDate
          const bookingDate = new Date(date)
          if (bookingDate.getFullYear() === year && bookingDate.getMonth() === month) {
            bookedDates.add(date)
          }
        })
      }
    } catch (error) {
      console.error('Error fetching booking dates:', error)
    }

    return bookedDates
  }
}

customElements.define('calendar-highlight', CalendarHighlight)
