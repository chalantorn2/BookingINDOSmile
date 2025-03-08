import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js'
import {
  getDatabase,
  ref,
  get,
  set,
  query,
  orderByChild,
  startAt,
  endAt,
} from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js'

import { database } from '/js/firebase-config.js'

function formatNumberWithCommas(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const orderDropdown = document.getElementById('orderDropdown')
const bookingContainer = document.getElementById('bookingContainer')
const customerNameDisplay = document.getElementById('customerNameDisplay')
const idDisplay = document.getElementById('idDisplay')
const bookingList = document.getElementById('bookingList')
const selectedBookingsContainer = document.getElementById('selectedBookingsContainer')
const bookingDetailsTable = document.getElementById('bookingDetailsTable')
const summaryContainer = document.getElementById('summaryContainer')
const totalCostEl = document.getElementById('totalCost')
const totalSellingPriceEl = document.getElementById('totalSellingPrice')
const totalProfitEl = document.getElementById('totalProfit')
const saveDataBtn = document.getElementById('saveDataBtn')

const startDateFilter = document.getElementById('startDateFilter')
const endDateFilter = document.getElementById('endDateFilter')
const applyDateFilterBtn = document.getElementById('applyDateFilterBtn')

const goToInvoiceBtn = document.getElementById('goToInvoiceBtn')
if (goToInvoiceBtn) {
  goToInvoiceBtn.addEventListener('click', () => {
    window.location.href = '/frontend/main/Invoice.html'
  })
}

let allOrders = {}
let allTours = {}
let allTransfers = {}
let allOrdersList = []
let loadingState = true

function showLoading() {
  orderDropdown.innerHTML = '<option value="">Loading...</option>'
  loadingState = true
}

function hideLoading() {
  loadingState = false
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('payments.js :: DOMContentLoaded')

  const today = new Date()
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
  startDateFilter.valueAsDate = lastMonth
  endDateFilter.valueAsDate = today

  orderDropdown.innerHTML = '<option value="">กรุณากดปุ่ม Filter เพื่อแสดงรายการ Order</option>'

  applyDateFilterBtn.addEventListener('click', async () => {
    await fetchFilteredOrders()
  })

  orderDropdown.addEventListener('change', async () => {
    const selectedOrderKey = orderDropdown.value
    if (!selectedOrderKey) {
      bookingContainer.classList.add('d-none')
      return
    }
    bookingContainer.classList.remove('d-none')
    await loadBookings(selectedOrderKey)
  })

  saveDataBtn.addEventListener('click', onSavePayment)

  const filterHintEl = document.createElement('div')

  document.querySelector('.col-md-6').appendChild(filterHintEl)
})

async function fetchFilteredOrders() {
  const startVal = startDateFilter.value
  const endVal = endDateFilter.value

  if (!startVal || !endVal) {
    alert('กรุณาระบุวันที่เริ่มต้นและวันที่สิ้นสุด')
    return
  }

  orderDropdown.innerHTML = '<option value="">กำลังโหลดข้อมูล...</option>'

  try {
    const startDate = new Date(startVal)
    const endDate = new Date(endVal)
    endDate.setHours(23, 59, 59, 999)

    console.log('Fetching orders between:', startDate.toISOString(), 'and', endDate.toISOString())

    const startTimestamp = startDate.toISOString()
    const endTimestamp = endDate.toISOString()

    const ordersRef = ref(database, 'orders')
    const ordersSnapshot = await get(ordersRef)

    if (!ordersSnapshot.exists()) {
      orderDropdown.innerHTML = '<option value="">ไม่พบข้อมูล Order</option>'
      return
    }

    allOrders = {}
    const filteredOrdersKeys = []

    ordersSnapshot.forEach(snapshot => {
      const orderData = snapshot.val()
      const orderKey = snapshot.key

      if (orderData.startDate && orderData.endDate) {
        const orderStartDate = new Date(orderData.startDate)
        const orderEndDate = new Date(orderData.endDate)

        if (
          (orderStartDate <= endDate && orderStartDate >= startDate) ||
          (orderEndDate <= endDate && orderEndDate >= startDate) ||
          (orderStartDate <= startDate && orderEndDate >= endDate)
        ) {
          allOrders[orderKey] = orderData
          filteredOrdersKeys.push(orderKey)
        }
      } else {
        const bookings = orderData.bookings || []
        let hasMatchingBooking = false

        allOrders[orderKey] = orderData
        filteredOrdersKeys.push(orderKey)
      }
    })

    console.log(`Found ${filteredOrdersKeys.length} orders matching date criteria`)

    if (filteredOrdersKeys.length > 0) {
      const bookingIds = []
      filteredOrdersKeys.forEach(key => {
        const orderBookings = allOrders[key].bookings || []
        bookingIds.push(...orderBookings)
      })

      console.log(`Found ${bookingIds.length} bookings to fetch details`)

      if (bookingIds.length > 0) {
        const promises = []

        const toursRef = ref(database, 'tourBookings')
        promises.push(
          get(toursRef).then(snapshot => {
            if (snapshot.exists()) {
              allTours = {}
              snapshot.forEach(childSnapshot => {
                const tourData = childSnapshot.val()
                const tourKey = childSnapshot.key

                if (bookingIds.includes(tourKey)) {
                  allTours[tourKey] = tourData
                }
              })
            }
          })
        )

        const transfersRef = ref(database, 'transferBookings')
        promises.push(
          get(transfersRef).then(snapshot => {
            if (snapshot.exists()) {
              allTransfers = {}
              snapshot.forEach(childSnapshot => {
                const transferData = childSnapshot.val()
                const transferKey = childSnapshot.key

                if (bookingIds.includes(transferKey)) {
                  allTransfers[transferKey] = transferData
                }
              })
            }
          })
        )

        await Promise.all(promises)
      }
    }

    allOrdersList = buildOrderList(allOrders)
    populateOrderDropdown(allOrdersList)
  } catch (error) {
    console.error('Error fetching filtered orders:', error)
    orderDropdown.innerHTML = '<option value="">เกิดข้อผิดพลาดในการดึงข้อมูล</option>'
  }
}

function buildOrderList(ordersObj) {
  const arr = []

  Object.keys(ordersObj).forEach(firebaseId => {
    const order = ordersObj[firebaseId]
    const orderId = order.id || firebaseId
    const allBookings = order.bookings || []

    const orderStartDate = order.startDate || null
    const orderEndDate = order.endDate || null

    let cFirst = '-'
    let cLast = '-'
    let pax = '-'

    if (allBookings.length > 0) {
      const firstBkKey = allBookings[0]

      if (allTours[firstBkKey]) {
        cFirst = allTours[firstBkKey].tourFirstName || '-'
        cLast = allTours[firstBkKey].tourLastName || '-'
        pax = allTours[firstBkKey].tourPax || '-'
      } else if (allTransfers[firstBkKey]) {
        cFirst = allTransfers[firstBkKey].transferFirstName || '-'
        cLast = allTransfers[firstBkKey].transferLastName || '-'
        pax = allTransfers[firstBkKey].transferPax || '-'
      }
    }

    let bookingDates = []
    allBookings.forEach(bkId => {
      if (allTours[bkId] && allTours[bkId].tourDate) {
        bookingDates.push(allTours[bkId].tourDate)
      } else if (allTransfers[bkId] && allTransfers[bkId].transferDate) {
        bookingDates.push(allTransfers[bkId].transferDate)
      }
    })

    arr.push({
      key: firebaseId,
      orderId: orderId,
      firstName: cFirst,
      lastName: cLast,
      pax: pax,
      startDate: orderStartDate,
      endDate: orderEndDate,
      bookingDates: bookingDates,
    })
  })

  arr.sort((a, b) => b.orderId.localeCompare(a.orderId))

  return arr
}

function populateOrderDropdown(orderList) {
  orderDropdown.innerHTML = ''

  if (!orderList || orderList.length === 0) {
    orderDropdown.innerHTML = '<option value="">No matching orders found</option>'
    return
  }

  const defaultOption = document.createElement('option')
  defaultOption.value = ''
  defaultOption.textContent = 'Select an Order'
  orderDropdown.appendChild(defaultOption)

  orderList.forEach(item => {
    const opt = document.createElement('option')
    opt.value = item.key
    opt.textContent = `${item.orderId} - ${item.firstName} ${item.lastName}`
    orderDropdown.appendChild(opt)
  })
}

function filterOrdersByDate() {
  const startVal = startDateFilter.value
  const endVal = endDateFilter.value

  if (!startVal && !endVal) {
    populateOrderDropdown(allOrdersList)
    return
  }

  const startDate = startVal ? new Date(startVal) : new Date(0)
  const endDate = endVal ? new Date(endVal) : new Date(8640000000000000)

  console.log(
    'Filtering orders between:',
    startDate.toISOString().split('T')[0],
    'and',
    endDate.toISOString().split('T')[0]
  )

  const filtered = allOrdersList.filter(ord => {
    if (ord.startDate && ord.endDate) {
      const orderStartDate = new Date(ord.startDate)
      const orderEndDate = new Date(ord.endDate)

      return (
        (orderStartDate <= endDate && orderStartDate >= startDate) ||
        (orderEndDate <= endDate && orderEndDate >= startDate) ||
        (orderStartDate <= startDate && orderEndDate >= endDate)
      )
    }

    return ord.bookingDates.some(dateStr => {
      if (!dateStr) return false

      const bookingDate = new Date(dateStr)
      if (isNaN(bookingDate.getTime())) return false

      return bookingDate >= startDate && bookingDate <= endDate
    })
  })

  console.log('Filtered orders:', filtered.length)
  populateOrderDropdown(filtered)
}

async function loadBookings(orderKey) {
  const orderObj = allOrders[orderKey]
  if (!orderObj) {
    alert('Order data not found in allOrders')
    return
  }

  const orderId = orderObj.id || orderKey

  bookingList.innerHTML = '<div class="col-12 text-center">Loading bookings...</div>'
  bookingDetailsTable.innerHTML = `
    <tr>
      <td colspan="12" class="text-center">ยังไม่มีการเลือก Booking</td>
    </tr>
  `

  selectedBookingsContainer.classList.add('d-none')
  summaryContainer.classList.add('d-none')
  totalCostEl.textContent = '0'
  totalSellingPriceEl.textContent = '0'
  totalProfitEl.textContent = '0'

  const orderBkKeys = orderObj.bookings || []
  let combinedBookings = []

  const fetchPromises = []
  orderBkKeys.forEach(bkKey => {
    if (allTours[bkKey]) {
      combinedBookings.push({
        type: 'tour',
        dbKey: bkKey,
        ...allTours[bkKey],
      })
    } else if (allTransfers[bkKey]) {
      combinedBookings.push({
        type: 'transfer',
        dbKey: bkKey,
        ...allTransfers[bkKey],
      })
    } else {
      const tourPromise = get(ref(database, `tourBookings/${bkKey}`)).then(snap => {
        if (snap.exists()) {
          const data = snap.val()
          combinedBookings.push({
            type: 'tour',
            dbKey: bkKey,
            ...data,
          })

          allTours[bkKey] = data
        }
      })

      const transferPromise = get(ref(database, `transferBookings/${bkKey}`)).then(snap => {
        if (snap.exists()) {
          const data = snap.val()
          combinedBookings.push({
            type: 'transfer',
            dbKey: bkKey,
            ...data,
          })

          allTransfers[bkKey] = data
        }
      })

      fetchPromises.push(tourPromise, transferPromise)
    }
  })

  if (fetchPromises.length > 0) {
    await Promise.all(fetchPromises)
  }

  combinedBookings.sort((a, b) => {
    const aDate = a.type === 'tour' ? a.tourDate || '' : a.transferDate || ''
    const bDate = b.type === 'tour' ? b.tourDate || '' : b.transferDate || ''
    return aDate.localeCompare(bDate)
  })

  if (combinedBookings.length > 0) {
    const firstBk = combinedBookings[0]
    let displayName, displayPax

    if (firstBk.type === 'tour') {
      displayName = `${firstBk.tourFirstName || ''} ${firstBk.tourLastName || ''}`
      displayPax = firstBk.tourPax || 0
    } else {
      displayName = `${firstBk.transferFirstName || ''} ${firstBk.transferLastName || ''}`
      displayPax = firstBk.transferPax || 0
    }

    customerNameDisplay.textContent = `${displayName} / ${displayPax} คน`
    idDisplay.textContent = orderId
  } else {
    customerNameDisplay.textContent = 'No customer info'
    idDisplay.textContent = orderId
  }

  renderBookingList(combinedBookings)

  const payKey = `P_${orderId}`
  try {
    const payRef = ref(database, `payments/${payKey}`)
    const paySnap = await get(payRef)

    if (paySnap.exists()) {
      const payData = paySnap.val()

      if (payData.bookings && (Array.isArray(payData.bookings) || typeof payData.bookings === 'object')) {
        bookingDetailsTable.innerHTML = ''
        selectedBookingsContainer.classList.remove('d-none')
        summaryContainer.classList.remove('d-none')

        const chosenCountMap = {}

        const bookingsArray = Array.isArray(payData.bookings) ? payData.bookings : Object.values(payData.bookings)

        bookingsArray.forEach(item => {
          const chosenSpan = document.createElement('span')
          chosenSpan.classList.add('chosenCount', 'badge', 'bg-dark')

          const rowEl = createBookingRow(item, chosenSpan)
          bookingDetailsTable.appendChild(rowEl)

          const key = `${item.type || ''}|${item.id || ''}`
          if (!chosenCountMap[key]) chosenCountMap[key] = 0
          chosenCountMap[key] += item.chosenCount || 0
        })

        bookingList.querySelectorAll('.card').forEach(cardEl => {
          const cType = cardEl.dataset.type || ''
          const cId = cardEl.dataset.id || ''
          const cSpan = cardEl.querySelector('.chosenCount')
          if (!cSpan) return

          const ccKey = `${cType}|${cId}`
          const totChosen = chosenCountMap[ccKey] || 0
          cSpan.textContent = totChosen

          if (totChosen > 0) {
            cSpan.classList.remove('bg-secondary')
            cSpan.classList.add('bg-dark')
          }
        })

        updateSummary()
      }
    }
  } catch (error) {
    console.error('Error loading payment data:', error)
  }
}

function renderBookingList(listData) {
  bookingList.innerHTML = ''

  if (!Array.isArray(listData) || listData.length === 0) {
    bookingList.innerHTML = `<div class="col-12 text-center text-muted">No Bookings</div>`
    return
  }

  listData.forEach((bk, idx) => {
    const isTour = bk.type === 'tour'
    const bID = isTour ? bk.tourID : bk.transferID
    const bSend = isTour ? bk.tourSendTo : bk.transferSendTo
    const bDate = isTour ? bk.tourDate : bk.transferDate
    const bDetail = isTour ? bk.tourDetail : bk.transferDetail
    const bPax = isTour ? bk.tourPax : bk.transferPax
    const bHotel = isTour ? bk.tourHotel : bk.transferHotel || ''

    const colDiv = document.createElement('div')
    colDiv.classList.add('col-md-4', 'mb-3')
    colDiv.innerHTML = `
      <div class="card h-100 shadow-sm" data-type="${bk.type}" data-id="${bID}" data-key="${bk.dbKey || ''}">
        <div class="card-body">
          <h4
            class="card-title text-white fw-bold text-center text-truncate rounded-2 py-1 ${
              isTour ? 'bg-success' : 'bg-primary'
            }"
          >
            ${idx + 1}. ${bSend || '-'}
          </h4>
          <div class="d-flex justify-content-between align-items-center my-2">
            <h5 class="card-title text-dark fw-bold text-truncate">
              ${formatDate(bDate) || '-'}
            </h5>
            <h5 class="card-title text-secondary fw-bold text-truncate">
              ID: ${bID || '-'}
            </h5>
          </div>
          <p class="card-text fst-italic lh-1 mb-1">
            ${bDetail || '-'}
          </p>
          <p class="card-text mb-2">
            <small class="text-muted">${bHotel || '-'} | ${bPax || '-'} คน</small>
          </p>
          <div class="d-flex justify-content-between align-items-center mt-3">
            <button class="btn btn-secondary btnAddBooking" type="button">
              <i class="bi bi-plus-lg"></i> Add
            </button>
            <span>
              <small>Chosen: </small>
              <span class="chosenCount badge bg-secondary">0</span>
              <small> times</small>
            </span>
          </div>
        </div>
      </div>
    `
    bookingList.appendChild(colDiv)

    const addBtn = colDiv.querySelector('.btnAddBooking')
    const chosenSpan = colDiv.querySelector('.chosenCount')
    addBtn.addEventListener('click', () => {
      addBookingToTable(bk, chosenSpan)
    })
  })
}

function addBookingToTable(bk, countSpan) {
  if (bookingDetailsTable.querySelector('td[colspan="12"]')) {
    bookingDetailsTable.innerHTML = ''
  }

  const item = convertToPaymentItem(bk)
  const rowEl = createBookingRow(item, countSpan)
  bookingDetailsTable.appendChild(rowEl)

  const oldVal = parseInt(countSpan.textContent) || 0
  const newVal = oldVal + 1
  countSpan.textContent = newVal
  if (newVal > 0) {
    countSpan.classList.remove('bg-secondary')
    countSpan.classList.add('bg-dark')
  }

  selectedBookingsContainer.classList.remove('d-none')
  summaryContainer.classList.remove('d-none')
  updateSummary()
}

function convertToPaymentItem(bk) {
  let bID = bk.type === 'tour' ? bk.tourID : bk.transferID
  let hotel = ''
  let detail = ''
  let pax = 1
  let sendTo = ''
  let tourDate = ''

  if (bk.type === 'tour') {
    hotel = bk.tourHotel || ''
    detail = bk.tourDetail || ''
    pax = parseInt(bk.tourPax) || 1
    sendTo = bk.tourSendTo || ''
    tourDate = bk.tourDate || ''
  } else {
    hotel = bk.transferHotel || bk.hotel || ''
    detail = bk.transferDetail || ''
    pax = parseInt(bk.transferPax) || 1
    sendTo = bk.transferSendTo || ''
    tourDate = bk.transferDate || ''
  }

  return {
    type: bk.type,
    id: bID || '',
    sendTo: sendTo,
    detail: detail,
    hotel: hotel,
    tourHotel: hotel,
    transferHotel: hotel,
    cost: 0,
    quantity: pax,
    sellingPrice: 0,
    chosenCount: 1,
    status: 'notPaid',
    remark: '',
    tourDate: tourDate,
    transferDate: tourDate,
    dbKey: bk.dbKey || '',
  }
}

function formatToDDMMYYYY(isoStr) {
  if (!isoStr) return ''
  const parts = isoStr.split('-')
  if (parts.length !== 3) return isoStr
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}
function createBookingRow(item, countSpan) {
  const row = document.createElement('tr')
  const isTour = item.type === 'tour'

  const totalCost = parseFloat(item.cost || 0) * parseInt(item.quantity || 1)
  const totalPrice = parseFloat(item.sellingPrice || 0) * parseInt(item.quantity || 1)
  const dateRaw = isTour ? item.tourDate : item.transferDate
  const displayDate = formatToDDMMYYYY(dateRaw || '')
  const bHotel = isTour ? item.tourHotel : item.transferHotel || ''
  const rowBgClass = item.type === 'tour' ? 'bg-light-success' : 'bg-light-primary'
  row.classList.add(rowBgClass, 'align-middle')
  const bgClass = item.type === 'tour' ? 'bg-success' : 'bg-primary'
  row.innerHTML = `
    <td class="border-start border-4" style="min-width: 140px">
     <div class="fw-bold rounded-2 text-white text-center ${bgClass}">${item.id || '-'}</div>
  <div class="fw-bold  small text-muted">${item.sendTo || '-'}</div>
  <div class="text-secondary">${displayDate || '-'}</div>
    </td>
    
    <td style="min-width: 150px">
      <textarea class="form-control form-control-sm hotelInput" rows="2">${bHotel || ''}</textarea>
    </td>
    
    <td style="min-width: 180px">
      <textarea class="form-control form-control-sm detailInput" rows="2">${item.detail || ''}</textarea>
    </td>
    
    <td style="min-width: 90px">
      <select class="form-select form-select-sm bookingTypeSelect w-100">
       <option value="" ${item.bookingType === '' ? 'selected' : ''}>--Select--</option>
        <option value="ADL" ${item.bookingType === 'ADL' ? 'selected' : ''}>ADL</option>
        <option value="CHD" ${item.bookingType === 'CHD' ? 'selected' : ''}>CHD</option>
      </select>
    </td>
    
    <td style="min-width: 120px">
  <input type="number" class="form-control form-control-sm costInput text-end" 
      value="${item.cost || 0}" style="width: 100%; padding-right: 8px;" />
</td>
    
    <td style="min-width: 80px">
  <input type="number" class="form-control form-control-sm quantityInput text-center" 
      value="${item.quantity || 1}" />
</td>
    
    <td class="text-end fw-bold totalCostCell" style="min-width: 120px">
  ${formatNumberWithCommas(totalCost)}
</td>
    
   <td style="min-width: 120px">
  <input type="number" class="form-control form-control-sm sellingPriceInput text-end" 
      value="${item.sellingPrice || 0}" style="width: 100%; padding-right: 8px;" />
</td>
    
    <td class="text-end fw-bold tPriceCell" style="min-width: 120px">
  ${formatNumberWithCommas(totalPrice)}
</td>
    
  <td style="min-width: 120px">
  <select class="form-select form-select-sm statusSelect w-100 ${
    item.status === 'paid' ? 'bg-success text-white' : 'bg-danger text-white'
  }">
    <option value="notPaid" class="bg-danger text-white" ${
      item.status === 'notPaid' ? 'selected' : ''
    }>ยังไม่จ่าย</option>
    <option value="paid" class="bg-success text-white" ${item.status === 'paid' ? 'selected' : ''}>จ่ายแล้ว</option>
  </select>
</td>
    
    <td style="min-width: 150px">
      <textarea class="form-control form-control-sm remarkInput" rows="1">${item.remark || ''}</textarea>
    </td>
    
    <td class="text-center" style="min-width: 70px">
      <button class="btn btn-sm btn-danger btnRemoveBooking" title="ลบรายการ">
        <i class="bi bi-trash"></i>
      </button>
    </td>
  `

  if (!document.getElementById('booking-table-styles')) {
    const styleElement = document.createElement('style')
    styleElement.id = 'booking-table-styles'
    styleElement.textContent = `
      .bg-light-success {
        background-color: rgba(25, 135, 84, 0.05);
      }
      .bg-light-primary {
        background-color: rgba(13, 110, 253, 0.05);
      }
      .totalCostCell, .tPriceCell {
        font-size: 1rem;
      }
      #bookingDetailsTable tr:hover {
        background-color: rgba(0, 0, 0, 0.03);
      }
      #bookingDetailsTable input[type="number"] {
        padding-right: 5px;
      }

  #selectedBookingsContainer .table {
    table-layout: fixed;
    min-width: 1500px;
  }
      .table-responsive {
        overflow-x: auto;
      }
        #bookingDetailsTable input[type="number"] {
    min-width: 90px;
  }
     .totalCostCell, .tPriceCell {
    min-width: 120px;
    font-size: 1rem;
    white-space: nowrap;
  }
    input.costInput, input.sellingPriceInput {
    text-align: right;
    padding-right: 20px !important;
  }
  
input[type="number"]::-webkit-inner-spin-button, 
  input[type="number"]::-webkit-outer-spin-button { 
    -webkit-appearance: none; 
    margin: 0; 
  }
  
  input[type="number"] {
    -moz-appearance: textfield;
  }
    .bg-danger.text-white {
    background-color: #dc3545 !important;
    color: white !important;
  }
  
  .bg-success.text-white {
    background-color: #28a745 !important;
    color: white !important;
  }  

  .statusSelect option {
    color: white;
    font-weight: 500;
  }
    `
    document.head.appendChild(styleElement)
  }
  const statusSelect = row.querySelector('.statusSelect')
  statusSelect.addEventListener('change', function () {
    if (this.value === 'paid') {
      this.classList.remove('bg-danger')
      this.classList.add('bg-success')
    } else {
      this.classList.remove('bg-success')
      this.classList.add('bg-danger')
    }
  })

  row.dataset.item = JSON.stringify({
    ...item,
    hotel: undefined,
    detail: undefined,
    cost: undefined,
    quantity: undefined,
    sellingPrice: undefined,
    status: undefined,
    remark: undefined,
  })

  const costInput = row.querySelector('.costInput')
  const quantityInput = row.querySelector('.quantityInput')
  const sellPriceInput = row.querySelector('.sellingPriceInput')
  const totalCostCell = row.querySelector('.totalCostCell')
  const tPriceCell = row.querySelector('.tPriceCell')
  const removeBtn = row.querySelector('.btnRemoveBooking')

  const recalc = () => {
    const c = parseFloat(costInput.value) || 0
    const q = parseInt(quantityInput.value) || 0
    const s = parseFloat(sellPriceInput.value) || 0

    const sumCost = c * q
    const sumPrice = s * q

    totalCostCell.textContent = formatNumberWithCommas(sumCost)
    tPriceCell.textContent = formatNumberWithCommas(sumPrice)

    updateSummary()
  }

  costInput.addEventListener('input', recalc)
  quantityInput.addEventListener('input', recalc)
  sellPriceInput.addEventListener('input', recalc)

  removeBtn.addEventListener('click', () => {
    row.remove()

    const oldVal = parseInt(countSpan.textContent) || 1
    const newVal = oldVal - 1
    countSpan.textContent = newVal >= 0 ? newVal : 0

    if (newVal <= 0) {
      countSpan.classList.remove('bg-dark')
      countSpan.classList.add('bg-secondary')
    }

    updateSummary()

    if (bookingDetailsTable.children.length === 0) {
      bookingDetailsTable.innerHTML = `
        <tr>
          <td colspan="12" class="text-center">ยังไม่มีการเลือก Booking</td>
        </tr>
      `
      selectedBookingsContainer.classList.add('d-none')
      summaryContainer.classList.add('d-none')
    }
  })

  return row
}

function updateSummary() {
  let sumCost = 0
  let sumPrice = 0

  const rows = bookingDetailsTable.querySelectorAll('tr')

  if (rows.length === 0 || (rows.length === 1 && rows[0].querySelector('td[colspan="12"]'))) {
    totalCostEl.textContent = '0'
    totalSellingPriceEl.textContent = '0'
    totalProfitEl.textContent = '0'
    return
  }

  rows.forEach(r => {
    const costCell = r.querySelector('.totalCostCell')
    const priceCell = r.querySelector('.tPriceCell')

    if (!costCell || !priceCell) return

    const cVal = parseFloat(costCell.textContent.replace(/,/g, '')) || 0
    const pVal = parseFloat(priceCell.textContent.replace(/,/g, '')) || 0

    sumCost += cVal
    sumPrice += pVal
  })

  totalCostEl.textContent = formatNumberWithCommas(sumCost)
  totalSellingPriceEl.textContent = formatNumberWithCommas(sumPrice)
  totalProfitEl.textContent = formatNumberWithCommas(sumPrice - sumCost)
}

async function onSavePayment() {
  try {
    const selectedOrderKey = orderDropdown.value
    if (!selectedOrderKey) {
      alert('กรุณาเลือก Order ก่อน')
      return
    }

    const orderData = allOrders[selectedOrderKey]
    if (!orderData) {
      alert('ไม่พบข้อมูล Order')
      return
    }

    const orderID = orderData.id
    if (!orderID) {
      alert('ไม่พบ Order ID ในข้อมูล Order')
      return
    }

    const rows = bookingDetailsTable.querySelectorAll('tr')

    if (rows.length === 0 || (rows.length === 1 && rows[0].querySelector('td[colspan="12"]'))) {
      alert('ไม่มีข้อมูล Booking ในตาราง')
      return
    }

    let bookingsArray = []

    rows.forEach(r => {
      const removeBtn = r.querySelector('.btnRemoveBooking')
      if (!removeBtn) return

      const costInputVal = parseFloat(r.querySelector('.costInput').value) || 0
      const quantityVal = parseInt(r.querySelector('.quantityInput').value) || 1
      const sellingVal = parseFloat(r.querySelector('.sellingPriceInput').value) || 0
      const hotelVal = r.querySelector('.hotelInput').value || ''
      const detailVal = r.querySelector('.detailInput').value || ''
      const remarkVal = r.querySelector('.remarkInput').value || ''
      const statusVal = r.querySelector('.statusSelect').value || 'notPaid'
      const bType = r.querySelector('.bookingTypeSelect').value || 'ADL'

      const idElement = r.querySelector('td').querySelector('.fw-bold')
      const sendToElement = r.querySelector('td').querySelector('.text-muted')

      const idText = idElement ? idElement.textContent.trim() : ''
      const sendToText = sendToElement ? sendToElement.textContent.trim() : ''

      let originalData = {}
      try {
        if (r.dataset.item) {
          originalData = JSON.parse(r.dataset.item)
        }
      } catch (e) {
        console.error('Error parsing item data:', e)
      }

      const totalCostEl = r.querySelector('.totalCostCell')
      const tPriceEl = r.querySelector('.tPriceCell')

      const costCellVal = parseFloat(totalCostEl ? totalCostEl.textContent.replace(/,/g, '') : 0) || 0
      const priceCellVal = parseFloat(tPriceEl ? tPriceEl.textContent.replace(/,/g, '') : 0) || 0

      const itemType = originalData.type || 'tour'

      bookingsArray.push({
        type: itemType,
        id: idText,
        sendTo: sendToText,
        bookingType: bType,
        cost: costInputVal,
        quantity: quantityVal,
        sellingPrice: sellingVal,
        totalCostin: costCellVal,
        tPrice: priceCellVal,
        status: statusVal,
        remark: remarkVal,
        hotel: hotelVal,
        detail: detailVal,
        chosenCount: 1,
        tourDate: originalData.tourDate || '',
        transferDate: originalData.transferDate || '',
        dbKey: originalData.dbKey || '',
      })
    })

    const sumCost = parseFloat(totalCostEl.textContent.replace(/,/g, '')) || 0
    const sumPrice = parseFloat(totalSellingPriceEl.textContent.replace(/,/g, '')) || 0
    const sumProfit = parseFloat(totalProfitEl.textContent.replace(/,/g, '')) || 0

    const customerName = customerNameDisplay.textContent.split('/')[0].trim()
    const customerPax = customerNameDisplay.textContent.split('/')[1]?.trim() || '0 คน'

    let firstName = customerName
    let lastName = ''

    if (customerName.includes(' ')) {
      const nameParts = customerName.split(' ')
      firstName = nameParts[0]
      lastName = nameParts.slice(1).join(' ')
    }

    const paxNumber = parseInt(customerPax) || 0

    const paymentID = `P_${orderID}`
    const finalData = {
      paymentID: paymentID,
      orderID: orderID,
      customer: {
        firstName: firstName,
        lastName: lastName,
        pax: paxNumber,
      },
      bookings: bookingsArray,
      summary: {
        totalCost: sumCost,
        totalSellingPrice: sumPrice,
        totalProfit: sumProfit,
      },
      invoiced: false,
      timestamp: Date.now(),
    }

    await set(ref(database, `payments/${paymentID}`), finalData)
    alert(`บันทึกข้อมูลสำเร็จ! Payment ID: ${paymentID}`)
  } catch (err) {
    console.error('Error saving data: ', err)
    alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message)
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''

  if (dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-')
    if (year && month && day) {
      return `${day}/${month}/${year}`
    }
  }

  return dateStr
}
