import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js'
import {
  getDatabase,
  ref,
  query,
  orderByChild,
  equalTo,
  get,
  set,
} from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js'

import { database } from '/js/firebase-config.js'

const formatDate = dateString => {
  if (!dateString) return ''
  const parts = dateString.split('/')
  if (parts.length === 3) {
    return dateString
  } else {
    const dateObj = new Date(dateString)
    if (isNaN(dateObj)) {
      return dateString
    }
    const day = String(dateObj.getDate()).padStart(2, '0')
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const year = dateObj.getFullYear()
    return `${day}/${month}/${year}`
  }
}

async function fetchBookings(selectedDate) {
  const tourContainer = document.getElementById('tourBookings')
  const transferContainer = document.getElementById('transferBookings')

  if (!selectedDate) {
    tourContainer.innerHTML = '<p class="text-center text-muted">กรุณาเลือกวันที่</p>'
    transferContainer.innerHTML = '<p class="text-center text-muted">กรุณาเลือกวันที่</p>'
    return
  }

  tourContainer.innerHTML = '<div class="spinner-border text-primary" role="status"></div>'
  transferContainer.innerHTML = '<div class="spinner-border text-primary" role="status"></div>'

  try {
    const tourOldRef = query(ref(database, 'tourBookings'), orderByChild('date'), equalTo(selectedDate))
    const tourNewRef = query(ref(database, 'tourBookings'), orderByChild('tourDate'), equalTo(selectedDate))

    const transferOldRef = query(ref(database, 'transferBookings'), orderByChild('date'), equalTo(selectedDate))
    const transferNewRef = query(ref(database, 'transferBookings'), orderByChild('transferDate'), equalTo(selectedDate))

    const [tourOldSnapshot, tourNewSnapshot, transferOldSnapshot, transferNewSnapshot] = await Promise.all([
      get(tourOldRef),
      get(tourNewRef),
      get(transferOldRef),
      get(transferNewRef),
    ])

    const tourData = []
    const transferData = []

    if (tourOldSnapshot.exists()) {
      tourOldSnapshot.forEach(booking => {
        const data = booking.val()
        data.id = booking.key
        tourData.push(data)
      })
    }

    if (tourNewSnapshot.exists()) {
      tourNewSnapshot.forEach(booking => {
        const data = booking.val()
        data.id = booking.key
        tourData.push(data)
      })
    }

    if (transferOldSnapshot.exists()) {
      transferOldSnapshot.forEach(booking => {
        const data = booking.val()
        data.id = booking.key
        transferData.push(data)
      })
    }

    if (transferNewSnapshot.exists()) {
      transferNewSnapshot.forEach(booking => {
        const data = booking.val()
        data.id = booking.key
        transferData.push(data)
      })
    }

    tourData.sort((a, b) =>
      (a.tourPickUpTime || a.pickUpTime || '').localeCompare(b.tourPickUpTime || b.pickUpTime || '')
    )
    tourContainer.innerHTML = ''

    if (tourData.length > 0) {
      tourData.forEach((data, index) => {
        const customerName = `${data.tourFirstName || data.customerName || 'ไม่มีชื่อ'} ${
          data.tourLastName || ''
        }`.trim()
        const listItem = document.createElement('div')
        listItem.className = `list-group-item mb-1 status-${data.status || 'unknown'}`
        listItem.innerHTML = `
          <div class="d-flex justify-content-between">
            <span><strong>${index + 1}. ${customerName}</strong> | ${data.tourPax || data.pax || '-'} คน</span>
            <button class="btn btn-sm  view-details-btn" style="background-color: #0f5434; color: white;" data-id="${
              data.id
            }" data-type="tour"><i class="bi bi-eye"></i></button>
          </div>
          <small>
            <span style="background-color: #0f5434; color: white; padding: 2px 5px; border-radius: 3px;">
              <i class="bi bi-clock"> </i><strong> Pick Up Time ${data.tourPickUpTime || '-'}</strong>
            </span> <strong style="background-color: #198754; color: white; padding: 2px 5px; margin: 5px; border-radius: 3px;"> <i class="bi bi-calendar-check"> </i> ${formatDate(
              data.tourDate || '-'
            )} </strong><br> 
            <strong>${data.tourSendTo || data.sendTo || '-'}</strong> |
            <strong>รายละเอียด:</strong> ${data.tourDetail || data.detail || '-'} 
            <br><strong><i class="bi bi-geo-alt-fill"> </i> โรงแรม:</strong> ${data.tourHotel || '-'}  
          </small><br>
          <div class="row justify-content-between"><div class="col"><strong style="color: #686868;"><i>${
            data.tourID || '-'
          }</i></strong></div>
          <div class="col row justify-content-end"> <div class="text-end"><strong  style="
color: ${
          data.status === 'รอดำเนินการ'
            ? '#555555'
            : data.status === 'จองแล้ว'
            ? '#0056b3'
            : data.status === 'ดำเนินการอยู่'
            ? '#c79100'
            : data.status === 'เสร็จสมบูรณ์'
            ? '#1e7e34'
            : data.status === 'ยกเลิก'
            ? '#b21f2d'
            : '#000000'
        };
font-weight: 700;">${data.status || '-'}</strong></div></div> </div>
        `
        tourContainer.appendChild(listItem)
      })
    } else {
      tourContainer.innerHTML = '<p class="text-center text-muted">ไม่พบข้อมูลการจองทัวร์</p>'
    }

    transferData.sort((a, b) =>
      (a.transferPickUpTime || a.pickUpTime || '').localeCompare(b.transferPickUpTime || b.pickUpTime || '')
    )
    transferContainer.innerHTML = ''

    if (transferData.length > 0) {
      transferData.forEach((data, index) => {
        const customerName = `${data.transferFirstName || data.customerName || 'ไม่มีชื่อ'} ${
          data.transferLastName || ''
        }`.trim()
        const listItem = document.createElement('div')
        listItem.className = `list-group-item mb-1 status-${data.status || 'unknown'}`
        listItem.innerHTML = `
          <div class="d-flex justify-content-between">
            <span><strong> ${index + 1}. ${customerName}</strong> | ${data.transferPax || data.pax || '-'} คน </span>
            <button class="btn btn-sm view-details-btn" style="background-color: #06357d; color: white;" data-id="${
              data.id
            }" data-type="transfer"><i class="bi bi-eye"></i></button>
          </div>
          <small>
            <span style="background-color: #06357d; color: white; padding: 2px 5px; border-radius: 3px;">
              <i class="bi bi-clock"></i> 
              <strong>Pick Up Time ${data.transferPickUpTime || '-'}</strong>
            </span> <strong style="background-color: #0d6efd; color: white; padding: 2px 5px; margin: 5px; border-radius: 3px;"><i class="bi bi-calendar-check"> </i> ${formatDate(
              data.transferDate || '-'
            )} </strong><br> 
            <strong>${data.transferSendTo || data.sendTo || '-'}</strong> |
            <strong>รับจาก:</strong> ${data.transferPickupFrom || data.pickupFrom || '-'} |
            <strong>ไปส่งที่:</strong> ${data.transferDropTo || data.dropTo || '-'}
              |
            <strong><i class="bi bi-airplane-fill"></i> ไฟลต์:</strong> ${data.transferFlight || '-'}
              |
            <strong>เวลา:</strong> ${data.transferTime || '-'}
          </small><br>
          <div class="row justify-content-between"><div class="col"><strong style="color: #686868;"><i>${
            data.transferID || '-'
          }</i></strong></div>
          <div class="col row justify-content-end"> <div class="text-end"><strong  style="
color: ${
          data.status === 'รอดำเนินการ'
            ? '#555555'
            : data.status === 'จองแล้ว'
            ? '#0056b3'
            : data.status === 'ดำเนินการอยู่'
            ? '#c79100'
            : data.status === 'เสร็จสมบูรณ์'
            ? '#1e7e34'
            : data.status === 'ยกเลิก'
            ? '#b21f2d'
            : '#000000'
        };
font-weight: 700;">${data.status || '-'}</strong></div></div> </div>
         
        `
        transferContainer.appendChild(listItem)
      })
    } else {
      transferContainer.innerHTML = '<p class="text-center text-muted">ไม่พบข้อมูลการจองการรับ-ส่ง</p>'
    }
  } catch (error) {
    console.error('Error fetching data:', error)
    tourContainer.innerHTML = '<p class="text-center text-danger">เกิดข้อผิดพลาดในการโหลดข้อมูลการจองทัวร์</p>'
    transferContainer.innerHTML = '<p class="text-center text-danger">เกิดข้อผิดพลาดในการโหลดข้อมูลการรับ-ส่ง</p>'
  }
}

function showPopup(data, type) {
  const fieldOrder = {
    tour: [
      'orderId',
      'tourID',
      'tourFirstName',
      'tourLastName',
      'tourSendTo',
      'tourType',
      'tourDetail',
      'tourPax',
      'tourFee',
      'tourMeal',
      'tourDate',
      'tourHotel',
      'tourRoomNo',
      'tourContactNo',
      'tourPickUpTime',
      'tourNote',
      'tourAgent',
      'timestamp',
    ],
    transfer: [
      'orderId',
      'transferID',
      'transferFirstName',
      'transferLastName',
      'transferSendTo',
      'transferType',
      'transferDetail',
      'transferPax',
      'transferFlight',
      'transferTime',
      'transferDate',
      'transferPickUpTime',
      'transferPickupFrom',
      'transferDropTo',
      'transferNote',
      'timestamp',
      'transferAgent',
    ],
  }

  const labelMap = {
    orderId: 'OrderID',
    tourID: 'BookingID',
    tourFirstName: 'ชื่อ (ทัวร์)',
    tourLastName: 'นามสกุล (ทัวร์)',
    tourSendTo: 'ส่งใคร (ทัวร์)',
    tourAgent: 'Agent',
    tourType: 'ประเภท (ทัวร์)',
    tourDetail: 'รายละเอียด (ทัวร์)',
    tourPax: 'จำนวน (ทัวร์)',
    tourFee: 'ค่าอุทยาน',
    tourMeal: 'อาหาร',
    tourDate: 'วันที่ (ทัวร์)',
    tourHotel: 'โรงแรม (ทัวร์)',
    tourRoomNo: 'หมายเลขห้อง (ทัวร์)',
    tourContactNo: 'เบอร์ติดต่อ (ทัวร์)',
    tourPickUpTime: 'เวลารับ (ทัวร์)',
    tourNote: 'หมายเหตุ (ทัวร์)',
    transferID: 'BookingID',
    transferFirstName: 'ชื่อ (รับ-ส่ง)',
    transferLastName: 'นามสกุล (รับ-ส่ง)',
    transferSendTo: 'ส่งใคร (รับ-ส่ง)',
    transferAgent: 'Agent',
    transferType: 'ประเภท (รับ-ส่ง)',
    transferDetail: 'รายละเอียด (รับ-ส่ง)',
    transferPax: 'จำนวน (รับ-ส่ง)',
    transferFlight: 'เที่ยวบิน',
    transferTime: 'เวลาเที่ยวบิน',
    transferDate: 'วันที่ (รับ-ส่ง)',
    transferPickUpTime: 'เวลารับ (รับ-ส่ง)',
    transferPickupFrom: 'สถานที่รับ',
    transferDropTo: 'สถานที่ส่ง',
    transferNote: 'หมายเหตุ (รับ-ส่ง)',
    timestamp: 'ตราประทับ',
  }

  const formatTimestamp = data => {
    if (!data || !data.timestamp) return '-'
    const ts = data.timestamp
    const d = new Date(ts)

    if (isNaN(d.getTime())) return '-'

    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')

    return `${day}/${month}/${year} ${hh}:${mm} น.`
  }

  const fields = fieldOrder[type]
  const popup = document.createElement('div')
  popup.className = 'modal fade'
  popup.id = 'detailPopup'
  popup.tabIndex = '-1'
  popup.setAttribute('role', 'dialog')

  const statusOptions = `
    <div class="row g-3 mb-3">
      <div class="col-md-6">
        <label for="field-status" class="form-label font-weight-bold">สถานะ</label>
        <select id="field-status" class="form-select">
          <option value="รอดำเนินการ">รอดำเนินการ</option>
          <option value="จองแล้ว">จองแล้ว</option>
          <option value="ดำเนินการอยู่">ดำเนินการอยู่</option>
          <option value="เสร็จสมบูรณ์">เสร็จสมบูรณ์</option>
                          <option value="ยกเลิก">ยกเลิก</option>
        </select>
      </div>
    </div>
  `

  const additionalTransferFields = `
    <div id="additionalTransferFields" class="row g-3 mb-3 ${
      ['จองแล้ว', 'ดำเนินการอยู่', 'เสร็จสมบูรณ์'].includes(data.status) ? '' : 'd-none'
    }">
      <div class="col-md-6">
        <label for="field-car_model" class="form-label font-weight-bold">รุ่นรถ</label>
        <input type="text" class="form-control" id="field-car_model" value="${data.car_model || ''}" />
      </div>
      <div class="col-md-6">
        <label for="field-license_plate" class="form-label font-weight-bold">ป้ายทะเบียน</label>
        <input type="text" class="form-control" id="field-license_plate" value="${data.license_plate || ''}" />
      </div>
      <div class="col-md-6">
        <label for="field-driver_name" class="form-label font-weight-bold">ชื่อคนขับ</label>
        <input type="text" class="form-control" id="field-driver_name" value="${data.driver_name || ''}" />
      </div>
      <div class="col-md-6">
        <label for="field-phone_number" class="form-label font-weight-bold">เบอร์โทร</label>
        <input type="text" class="form-control" id="field-phone_number" value="${data.phone_number || ''}" />
      </div>
    </div>
  `

  const createFieldRow = (field1, field2) => {
    const createFieldHtml = fieldName => {
      if (!fieldName) return ''

      let value = data[fieldName] || ''
      let inputElement = ''

      if (fieldName === 'tourDate' || fieldName === 'transferDate' || fieldName === 'timestamp') {
        value = fieldName === 'timestamp' ? formatTimestamp({ timestamp: value }) : formatDate(value)
      }

      const isLockedField =
        fieldName === 'orderId' || fieldName === 'tourID' || fieldName === 'transferID' || fieldName === 'timestamp'

      if (fieldName === 'tourDetail' || fieldName === 'transferDetail') {
        inputElement = `
          <textarea
            class="form-control"
            id="field-${fieldName}"
            rows="5"
            ${isLockedField ? 'disabled' : ''}
            style="${isLockedField ? 'background-color: #f8f9fa;' : ''}"
          >${value}</textarea>
        `
      } else {
        inputElement = `
          <input
            type="text"
            class="form-control"
            id="field-${fieldName}"
            value="${value}"
            ${isLockedField ? 'disabled' : ''}
            style="${isLockedField ? 'background-color: #f8f9fa;' : ''}"
          />
        `
      }

      return `
        <div class="col-md-6">
          <label for="field-${fieldName}" class="form-label font-weight-bold">${labelMap[fieldName]}</label>
          ${inputElement}
        </div>
      `
    }

    const fieldHtml1 = createFieldHtml(field1)
    const fieldHtml2 = createFieldHtml(field2)

    return `<div class="row g-3 mb-3">${fieldHtml1}${fieldHtml2}</div>`
  }

  const generateFields = (() => {
    const rows = []
    for (let i = 0; i < fields.length; i += 2) {
      rows.push(createFieldRow(fields[i], fields[i + 1]))
    }
    return rows.join('')
  })()

  const generateFieldsWithStatus = generateFields + statusOptions + additionalTransferFields

  let content = `
<div class="modal-dialog modal-lg" role="document">
<div class="modal-content border-0 shadow-lg rounded-3">
<div class="modal-header ${type === 'tour' ? 'bg-success' : 'bg-primary'} text-white">
  <h5 class="modal-title fw-bold">
    <i class="bi bi-pencil-square me-2"></i>${type === 'tour' ? 'Tour Details' : 'Transfer Details'}
  </h5>
  <button type="button" class="btn-close btn-light" data-bs-dismiss="modal" aria-label="Close"></button>
</div>
<div class="modal-body px-4 py-5">
  <div class="container-fluid">
    <form id="editForm">
      ${generateFieldsWithStatus}
    </form>
    <div id="statusMessage" class="alert alert-success d-none text-center mt-4" role="alert"></div>
  </div>
</div>
<div class="modal-footer d-flex justify-content-between">
  <button type="button" class="btn btn-outline-danger delete-btn">
    <i class="bi bi-trash me-1"></i>ลบข้อมูล
  </button>
  <div>
    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
      <i class="bi bi-x me-1"></i>ปิด
    </button>
    <button type="button" class="btn ${type === 'tour' ? 'btn-success' : 'btn-primary'} save-btn">
      <i class="bi bi-save me-1"></i>บันทึกข้อมูล
    </button>
  </div>
</div>
</div>
</div>
`

  popup.innerHTML = content
  document.body.appendChild(popup)

  const modal = new bootstrap.Modal(popup)

  const statusField = popup.querySelector('#field-status')
  statusField.value = data.status || 'รอดำเนินการ'

  modal.show()

  statusField.addEventListener('change', () => {
    const additionalFields = popup.querySelector('#additionalTransferFields')
    if (['จองแล้ว', 'ดำเนินการอยู่', 'เสร็จสมบูรณ์'].includes(statusField.value) && type === 'transfer') {
      additionalFields.classList.remove('d-none')
    } else {
      additionalFields.classList.add('d-none')
    }
  })

  const saveBtn = popup.querySelector('.save-btn')
  saveBtn.addEventListener('click', async () => {
    const updatedData = {}
    updatedData['status'] = popup.querySelector('#field-status').value

    fields.forEach(key => {
      const input = popup.querySelector(`#field-${key}`)
      let value = input ? input.value : ''

      if (key === 'tourDate' || key === 'transferDate') {
        const [day, month, year] = value.split('/')
        updatedData[key] = `${year}-${month}-${day}`
      } else if (key === 'timestamp') {
        updatedData[key] = data.timestamp || '-'
      } else {
        updatedData[key] = value
      }
    })

    updatedData['car_model'] = popup.querySelector('#field-car_model')?.value || ''
    updatedData['license_plate'] = popup.querySelector('#field-license_plate')?.value || ''
    updatedData['driver_name'] = popup.querySelector('#field-driver_name')?.value || ''
    updatedData['phone_number'] = popup.querySelector('#field-phone_number')?.value || ''

    const refPath = type === 'tour' ? 'tourBookings' : 'transferBookings'
    const bookingRef = ref(database, `${refPath}/${data.id}`)
    const statusMessage = popup.querySelector('#statusMessage')

    try {
      statusMessage.textContent = 'กำลังบันทึกข้อมูล...'
      statusMessage.classList.remove('d-none', 'alert-success', 'alert-danger')
      statusMessage.classList.add('alert-info')

      await set(bookingRef, updatedData)

      statusMessage.textContent = 'บันทึกข้อมูลสำเร็จ'
      statusMessage.classList.remove('alert-info', 'alert-danger')
      statusMessage.classList.add('alert-success')

      setTimeout(() => {
        modal.hide()
        location.reload()
      }, 2000)
    } catch (error) {
      statusMessage.textContent = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'
      statusMessage.classList.remove('alert-info', 'alert-success')
      statusMessage.classList.add('alert-danger')
      console.error('Error saving data:', error)
    }
  })

  const deleteBtn = popup.querySelector('.delete-btn')
  deleteBtn.addEventListener('click', async () => {
    const refPath = type === 'tour' ? 'tourBookings' : 'transferBookings'
    const bookingRef = ref(database, `${refPath}/${data.id}`)
    if (confirm('คุณต้องการลบข้อมูลนี้หรือไม่?')) {
      try {
        await set(bookingRef, null)
        alert('ลบข้อมูลสำเร็จ')
        modal.hide()
        location.reload()
      } catch (error) {
        alert('เกิดข้อผิดพลาดในการลบข้อมูล')
        console.error('Error deleting data:', error)
      }
    }
  })

  popup.addEventListener('hidden.bs.modal', () => {
    document.body.removeChild(popup)
  })
}

document.getElementById('tourBookings').addEventListener('click', handleViewDetails)
document.getElementById('transferBookings').addEventListener('click', handleViewDetails)

async function handleViewDetails(event) {
  if (event.target.closest('.view-details-btn')) {
    const button = event.target.closest('.view-details-btn')
    const id = button.getAttribute('data-id')
    const type = button.getAttribute('data-type')

    const refPath = type === 'tour' ? 'tourBookings' : 'transferBookings'
    const bookingRef = ref(database, `${refPath}/${id}`)

    try {
      const bookingSnapshot = await get(bookingRef)

      if (bookingSnapshot.exists()) {
        const data = bookingSnapshot.val()
        data.id = id
        showPopup(data, type)
      } else {
        alert('ไม่พบข้อมูลรายการจองนี้')
      }
    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการโหลดข้อมูล:', error)
      alert('เกิดข้อผิดพลาดในการโหลดข้อมูล')
    }
  }
}

async function verifyData(refPath, id) {
  const bookingRef = ref(database, `${refPath}/${id}`)
  const snapshot = await get(bookingRef)
  if (!snapshot.exists()) {
    console.error('ID ไม่พบใน Firebase:', id)
    return false
  }
  console.log('Data exists in Firebase:', snapshot.val())
  return true
}

window.addEventListener('DOMContentLoaded', () => {
  const dateText = document.getElementById('dateDisplay')

  if (!dateText) {
    console.error('Error: #dateDisplay element not found!')
    return
  }

  const today = new Date()
  const formattedToday = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${today.getFullYear()}`

  const fp = flatpickr('#inlineCalendar', {
    inline: true,
    dateFormat: 'd/m/Y',
    defaultDate: today,
    onChange: (selectedDates, dateStr) => {
      if (selectedDates.length > 0) {
        const rawDate = selectedDates[0]
        const year = rawDate.getFullYear()
        const month = rawDate.getMonth()
        const day = rawDate.getDate()

        const calendarChangeEvent = new CustomEvent('calendar-date-change', {
          detail: { year, month, day },
        })
        window.dispatchEvent(calendarChangeEvent)

        dateText.textContent = dateStr
        fetchBookings(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
      }
    },
  })

  dateText.textContent = formattedToday
  fetchBookings(
    `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today
      .getDate()
      .toString()
      .padStart(2, '0')}`
  )

  window.addEventListener('day-selected', event => {
    const { year, month, day } = event.detail
    const selectedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    dateText.textContent = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`

    const rawDate = new Date(year, month, day)
    fp.setDate(rawDate, true)

    fetchBookings(selectedDateStr)
  })
})
