import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js'
import {
  getDatabase,
  ref,
  get,
  query,
  update,
  remove,
  set,
  orderByChild,
  startAt,
  endAt,
  equalTo,
  onValue,
} from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js'

import { database } from '/js/firebase-config.js'

let allOrders = {}
let allTourBookings = {}
let allTransferBookings = {}
let availableBookingsData = []
let filteredOrders = []

let currentPage = 1
const itemsPerPage = 10
let totalPages = 0

let selectedOrderKey = null
let currentOrderForAddBooking = null
let orderDeleteKey = null
let bookingRemoveKey = null
let bookingRemoveType = null
let bookingRemoveOrderKey = null
let filterType = 'all'

const ordersContainer = document.getElementById('ordersContainer')
const loadingSpinner = document.getElementById('loadingSpinner')
const noOrdersMessage = document.getElementById('noOrdersMessage')
const filterBtn = document.getElementById('filterBtn')
const startDateInput = document.getElementById('startDate')
const endDateInput = document.getElementById('endDate')
const searchInput = document.getElementById('searchInput')
const viewAllBtn = document.getElementById('viewAllBtn')
const viewInvoicedBtn = document.getElementById('viewInvoicedBtn')
const viewNonInvoicedBtn = document.getElementById('viewNonInvoicedBtn')
const refreshOrdersBtn = document.getElementById('refreshOrdersBtn')

const totalOrdersCountEl = document.getElementById('totalOrdersCount')
const totalBookingsCountEl = document.getElementById('totalBookingsCount')
const filteredOrdersCountEl = document.getElementById('filteredOrdersCount')

const prevPageBtn = document.getElementById('prevPage')
const nextPageBtn = document.getElementById('nextPage')
const pageInfoEl = document.getElementById('pageInfo')
const paginationStartEl = document.getElementById('paginationStart')
const paginationEndEl = document.getElementById('paginationEnd')
const paginationTotalEl = document.getElementById('paginationTotal')

const orderDetailsModal = new bootstrap.Modal(document.getElementById('orderDetailsModal'))
const addBookingModal = new bootstrap.Modal(document.getElementById('addBookingModal'))
const confirmDeleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'))
const confirmRemoveBookingModal = new bootstrap.Modal(document.getElementById('confirmRemoveBookingModal'))

document.addEventListener('DOMContentLoaded', async () => {
  console.log('View Orders page loaded')

  setDefaultDates()

  setupEventListeners()

  await loadInitialData()

  await fetchOrdersByFilter()
})

function setDefaultDates() {
  const today = new Date()

  endDateInput.valueAsDate = today

  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  startDateInput.valueAsDate = firstDay
}

function setupEventListeners() {
  filterBtn.addEventListener('click', async () => {
    currentPage = 1
    await fetchOrdersByFilter()
  })

  searchInput.addEventListener(
    'input',
    debounce(() => {
      currentPage = 1
      applySearchFilter()
    }, 300)
  )

  viewAllBtn.addEventListener('click', () => setFilterType('all'))
  viewInvoicedBtn.addEventListener('click', () => setFilterType('invoiced'))
  viewNonInvoicedBtn.addEventListener('click', () => setFilterType('notInvoiced'))

  refreshOrdersBtn.addEventListener('click', async () => {
    await loadInitialData()
    await fetchOrdersByFilter()
  })

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--
      renderOrders()
    }
  })

  nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++
      renderOrders()
    }
  })

  document.getElementById('addBookingConfirmBtn').addEventListener('click', addBookingsToOrder)
  document.getElementById('confirmDeleteBtn').addEventListener('click', deleteOrder)
  document.getElementById('confirmRemoveBookingBtn').addEventListener('click', removeBookingFromOrder)

  document.getElementById('selectAllBookings').addEventListener('change', toggleSelectAllBookings)
}

function setFilterType(type) {
  filterType = type

  viewAllBtn.classList.toggle('active', type === 'all')
  viewInvoicedBtn.classList.toggle('active', type === 'invoiced')
  viewNonInvoicedBtn.classList.toggle('active', type === 'notInvoiced')

  currentPage = 1
  applyFilterTypeFilter()
}

async function loadInitialData() {
  showLoading(true)

  try {
    const [ordersSnap, toursSnap, transfersSnap] = await Promise.all([
      get(ref(database, 'orders')),
      get(ref(database, 'tourBookings')),
      get(ref(database, 'transferBookings')),
    ])

    if (ordersSnap.exists()) {
      allOrders = ordersSnap.val()
    } else {
      allOrders = {}
    }

    if (toursSnap.exists()) {
      allTourBookings = toursSnap.val()
    } else {
      allTourBookings = {}
    }

    if (transfersSnap.exists()) {
      allTransferBookings = transfersSnap.val()
    } else {
      allTransferBookings = {}
    }

    await loadAvailableBookings()

    updateStatsCount()
  } catch (error) {
    console.error('Error loading initial data:', error)
    showErrorMessage('Failed to load data from the server. Please try again.')
  } finally {
    showLoading(false)
  }
}

async function loadAvailableBookings() {
  try {
    const toursQuery = query(ref(database, 'tourBookings'), orderByChild('orderId'), equalTo(null))
    const transfersQuery = query(ref(database, 'transferBookings'), orderByChild('orderId'), equalTo(null))

    const [toursSnapshot, transfersSnapshot] = await Promise.all([get(toursQuery), get(transfersQuery)])

    const results = []

    if (toursSnapshot.exists()) {
      toursSnapshot.forEach(snap => {
        const data = snap.val()
        if (!data.orderId) {
          results.push({
            dbKey: snap.key,
            agent: data.tourAgent || '-',
            name: `${data.tourFirstName || ''} ${data.tourLastName || ''}`.trim() || 'No Name',
            type: 'Tour',
            date: formatDate(data.tourDate) || '-',
            rawDate: data.tourDate || '',
            time: data.tourPickUpTime || '00:00',
            sendTo: data.tourSendTo || '-',
            hotel: data.tourHotel || '-',
          })
        }
      })
    }

    if (transfersSnapshot.exists()) {
      transfersSnapshot.forEach(snap => {
        const data = snap.val()
        if (!data.orderId) {
          results.push({
            dbKey: snap.key,
            agent: data.transferAgent || '-',
            name: `${data.transferFirstName || ''} ${data.transferLastName || ''}`.trim() || 'No Name',
            type: 'Transfer',
            date: formatDate(data.transferDate) || '-',
            rawDate: data.transferDate || '',
            time: data.transferPickUpTime || '00:00',
            sendTo: data.transferSendTo || '-',
          })
        }
      })
    }

    results.sort((a, b) => {
      const dateComparison = compareDates(a.rawDate, b.rawDate)
      if (dateComparison !== 0) return dateComparison

      return a.time.localeCompare(b.time)
    })

    availableBookingsData = results
  } catch (err) {
    console.error('Error fetching available bookings:', err)
    return []
  }
}

async function fetchOrdersByFilter() {
  const startDate = startDateInput.value
  const endDate = endDateInput.value

  if (!startDate || !endDate) {
    showErrorMessage('Please select both start and end dates')
    return
  }

  showLoading(true)

  try {
    const tourQuery = query(ref(database, 'tourBookings'), orderByChild('tourDate'), startAt(startDate), endAt(endDate))

    const transferQuery = query(
      ref(database, 'transferBookings'),
      orderByChild('transferDate'),
      startAt(startDate),
      endAt(endDate)
    )

    const [tourSnap, transferSnap] = await Promise.all([get(tourQuery), get(transferQuery)])

    const orderIdsSet = new Set()

    if (tourSnap.exists()) {
      tourSnap.forEach(tour => {
        const data = tour.val()
        if (data.orderId) {
          orderIdsSet.add(data.orderId)
        }
      })
    }

    if (transferSnap.exists()) {
      transferSnap.forEach(transfer => {
        const data = transfer.val()
        if (data.orderId) {
          orderIdsSet.add(data.orderId)
        }
      })
    }

    if (orderIdsSet.size === 0) {
      filteredOrders = []
      renderOrders()
      return
    }

    const matchingOrders = []

    for (const orderId of orderIdsSet) {
      Object.keys(allOrders).forEach(key => {
        const order = allOrders[key]
        if (order.id === orderId) {
          matchingOrders.push({
            key,
            order,
          })
        }
      })
    }

    const processedOrders = await Promise.all(
      matchingOrders.map(async ({ key, order }) => {
        return await processOrder(key, order)
      })
    )

    processedOrders.sort((a, b) => {
      if (a.earliestDate && b.earliestDate) {
        return a.earliestDate - b.earliestDate
      }
      return 0
    })

    filteredOrders = processedOrders

    applySearchFilter()
    applyFilterTypeFilter()
  } catch (error) {
    console.error('Error fetching orders:', error)
    showErrorMessage('Failed to fetch orders. Please try again.')
    filteredOrders = []
    renderOrders()
  } finally {
    showLoading(false)
  }
}

function applySearchFilter() {
  const searchTerm = searchInput.value.trim().toLowerCase()

  if (!searchTerm) {
    applyFilterTypeFilter()
    return
  }

  const searchResults = filteredOrders.filter(order => {
    if (order.order.id.toLowerCase().includes(searchTerm)) {
      return true
    }

    if (order.customerName.toLowerCase().includes(searchTerm)) {
      return true
    }

    return order.bookingDetails.some(booking => {
      return (
        booking.id.toLowerCase().includes(searchTerm) ||
        booking.sendTo.toLowerCase().includes(searchTerm) ||
        (booking.hotel && booking.hotel.toLowerCase().includes(searchTerm))
      )
    })
  })

  updateFilteredCount(searchResults.length)

  currentPage = 1

  renderFilteredOrders(searchResults)
}

function applyFilterTypeFilter() {
  let results = [...filteredOrders]

  if (filterType === 'invoiced') {
    results = results.filter(order => order.isInvoiced)
  } else if (filterType === 'notInvoiced') {
    results = results.filter(order => !order.isInvoiced)
  }

  const searchTerm = searchInput.value.trim().toLowerCase()
  if (searchTerm) {
    results = results.filter(order => {
      if (order.order.id.toLowerCase().includes(searchTerm)) {
        return true
      }

      if (order.customerName.toLowerCase().includes(searchTerm)) {
        return true
      }

      return order.bookingDetails.some(booking => {
        return (
          booking.id.toLowerCase().includes(searchTerm) ||
          booking.sendTo.toLowerCase().includes(searchTerm) ||
          (booking.hotel && booking.hotel.toLowerCase().includes(searchTerm))
        )
      })
    })
  }

  updateFilteredCount(results.length)

  currentPage = 1

  renderFilteredOrders(results)
}

function renderFilteredOrders(orders) {
  const currentFiltered = orders

  totalPages = Math.ceil(currentFiltered.length / itemsPerPage)

  prevPageBtn.disabled = currentPage === 1
  nextPageBtn.disabled = currentPage === totalPages || totalPages === 0
  pageInfoEl.textContent = `Page ${currentPage} of ${totalPages || 1}`

  const startIdx = (currentPage - 1) * itemsPerPage
  const endIdx = Math.min(startIdx + itemsPerPage, currentFiltered.length)

  paginationStartEl.textContent = currentFiltered.length > 0 ? startIdx + 1 : 0
  paginationEndEl.textContent = endIdx
  paginationTotalEl.textContent = currentFiltered.length

  if (currentFiltered.length === 0) {
    noOrdersMessage.classList.remove('d-none')
    ordersContainer.innerHTML = ''
  } else {
    noOrdersMessage.classList.add('d-none')

    ordersContainer.innerHTML = ''

    const pageItems = currentFiltered.slice(startIdx, endIdx)

    pageItems.forEach(orderData => {
      const orderCard = createOrderCard(orderData)
      ordersContainer.appendChild(orderCard)
    })
  }
}

async function processOrder(orderId, order) {
  const bookings = order.bookings || []
  let bookingDetails = []
  let customerName = 'Unknown'
  let paxx = 'Unknown'
  let isInvoiced = false

  try {
    const paymentsQuery = query(ref(database, 'payments'))
    const paymentsSnap = await get(paymentsQuery)

    if (paymentsSnap.exists()) {
      paymentsSnap.forEach(paymentSnap => {
        const paymentData = paymentSnap.val()

        if (paymentData.orderID === order.id && paymentData.invoiced === true) {
          isInvoiced = true
        } else if (typeof paymentData === 'object') {
          Object.values(paymentData).forEach(subPayment => {
            if (subPayment.orderID === order.id && subPayment.invoiced === true) {
              isInvoiced = true
            }
          })
        }
      })
    }
  } catch (error) {
    console.error('Error checking invoice status:', error)
  }

  const bookingPromises = bookings.map(async bkId => {
    const tourRef = ref(database, `tourBookings/${bkId}`)
    const tourSnap = await get(tourRef)

    if (tourSnap.exists()) {
      const bData = tourSnap.val()
      customerName = `${bData.tourFirstName || ''} ${bData.tourLastName || ''}`.trim() || 'Unknown'
      paxx = `${bData.tourPax}` || 'Unknown'
      bookingDetails.push({
        dbKey: bkId,
        date: bData.tourDate || 'Unknown Date',
        time: bData.tourPickUpTime || '00:00',
        type: bData.tourType || '-',
        type_title: 'Tour',
        sendTo: bData.tourSendTo || '-',
        id: bData.tourID || bkId,
        firstName: bData.tourFirstName || '-',
        lastName: bData.tourLastName || '-',
        detail: bData.tourDetail || '-',
        pax: bData.tourPax || '-',
        fee: bData.tourFee || '-',
        meal: bData.tourMeal || '-',
        hotel: bData.tourHotel || '-',
        roomNo: bData.tourRoomNo || '-',
        contactNo: bData.tourContactNo || '-',
        note: bData.tourNote || '-',
        agent: bData.tourAgent || '-',
        status: bData.status || 'รอดำเนินการ',
      })
    } else {
      const transferRef = ref(database, `transferBookings/${bkId}`)
      const transferSnap = await get(transferRef)

      if (transferSnap.exists()) {
        const bData = transferSnap.val()
        customerName = `${bData.transferFirstName || ''} ${bData.transferLastName || ''}`.trim() || 'Unknown'
        paxx = `${bData.transferPax}` || 'Unknown'

        bookingDetails.push({
          dbKey: bkId,
          date: bData.transferDate || 'Unknown Date',
          time: bData.transferPickUpTime || '00:00',
          type: bData.transferType || '-',
          type_title: 'Transfer',
          sendTo: bData.transferSendTo || '-',
          id: bData.transferID || bkId,
          firstName: bData.transferFirstName || '-',
          lastName: bData.transferLastName || '-',
          detail: bData.transferDetail || '-',
          pax: bData.transferPax || '-',
          flight: bData.transferFlight || '-',
          pickupFrom: bData.transferPickupFrom || '-',
          dropTo: bData.transferDropTo || '-',
          note: bData.transferNote || '-',
          agent: bData.transferAgent || '-',
          status: bData.status || 'รอดำเนินการ',
        })
      }
    }
  })

  await Promise.all(bookingPromises)

  bookingDetails.sort((a, b) => {
    const dateA = new Date(a.date)
    const dateB = new Date(b.date)

    if (dateA.getTime() !== dateB.getTime()) {
      return dateA - dateB
    }

    return a.time.localeCompare(b.time)
  })

  const earliestDate = bookingDetails.reduce((earliest, bk) => {
    const date = new Date(bk.date)
    return !earliest || date < earliest ? date : earliest
  }, null)

  const latestDate = bookingDetails.reduce((latest, bk) => {
    const date = new Date(bk.date)
    return !latest || date > latest ? date : latest
  }, null)

  return {
    orderId,
    order,
    customerName,
    earliestDate,
    latestDate,
    bookingDetails,
    isInvoiced,
    paxx,
  }
}

function createOrderCard(orderData) {
  const { orderId, order, customerName, earliestDate, latestDate, bookingDetails, isInvoiced } = orderData

  const card = document.createElement('div')
  card.className = `card order-item ${isInvoiced ? 'invoiced' : 'not-invoiced'} fade-in`
  card.dataset.orderId = orderId

  const earliestDateStr = earliestDate ? formatDate(earliestDate) : '-'
  const latestDateStr = latestDate ? formatDate(latestDate) : '-'
  const dateRangeStr = earliestDateStr === latestDateStr ? earliestDateStr : `${earliestDateStr} - ${latestDateStr}`

  card.innerHTML = `
    <div class="card-body">
      <div class="row align-items-center">
        <div class="col-md-5">
          <div class="d-flex align-items-center mb-2">
            <span class="order-id me-2">${order.id || 'No ID'}</span>
            ${
              isInvoiced
                ? '<span class="badge bg-success invoiced-badge">Invoiced</span>'
                : '<span class="badge bg-warning invoiced-badge">Not Invoiced</span>'
            }
          </div>
          <h5 class="customer-name">${customerName}</h5>
          <p class="order-date mb-0">
            <i class="bi bi-calendar3"></i> ${dateRangeStr}
          </p>
        </div>
        <div class="col-md-3 text-md-center">
          <span class="badge bg-primary bookings-count">
            <i class="bi bi-bookmark-check"></i> ${bookingDetails.length} Bookings
          </span>
          <div class="mt-2">
            <small class="text-muted ">
              ${bookingDetails.filter(b => b.type_title === 'Tour').length} Tours,
              ${bookingDetails.filter(b => b.type_title === 'Transfer').length} Transfers
            </small>
          </div>
        </div>
        <div class="col-md-4 text-md-end order-actions">
          <button class="btn btn-sm btn-outline-primary me-1 order-action-btn view-order-btn" 
            data-order-id="${orderId}">
            <i class="bi bi-eye"></i> View
          </button>
          <button class="btn btn-sm btn-outline-success me-1 order-action-btn add-booking-btn" 
            data-order-id="${orderId}">
            <i class="bi bi-plus-circle"></i> Add Booking
          </button>
          <button class="btn btn-sm btn-outline-danger order-action-btn delete-order-btn" 
            data-order-id="${orderId}" data-order-name="${order.id}">
            <i class="bi bi-trash"></i> Delete
          </button>
        </div>
      </div>
    </div>
  `

  const viewBtn = card.querySelector('.view-order-btn')
  viewBtn.addEventListener('click', () => showOrderDetails(orderData))

  const addBookingBtn = card.querySelector('.add-booking-btn')
  addBookingBtn.addEventListener('click', () => showAddBookingModal(orderId, order.id))

  const deleteBtn = card.querySelector('.delete-order-btn')
  deleteBtn.addEventListener('click', () => showDeleteOrderConfirmation(orderId, order.id))

  return card
}

function showOrderDetails(orderData) {
  const { orderId, order, customerName, bookingDetails, paxx } = orderData
  selectedOrderKey = orderId

  const modalTitle = document.getElementById('orderDetailsModalLabel')
  const modalContent = document.getElementById('orderDetailsContent')

  modalTitle.textContent = `Order: ${order.id}`

  let content = `
    <div class="order-details mb-4">
      <div class="row">
        <div class="col-md-6">
          <h4 class="mb-3">${customerName}</h4>
          <p class="mb-1"><strong>Order ID:</strong> ${order.id}</p>
          <p class="mb-3"><strong>Total Bookings:</strong> ${bookingDetails.length}</p>
          <p class="mb-3"><strong>Pax:</strong> ${paxx}</p>
        </div>
      </div>
    </div>
  `

  content += `
    <div class="bookings-section">
      <h5 class="border-bottom pb-2 mb-3">Bookings</h5>
      <div class="row">
  `

  bookingDetails.forEach(booking => {
    const isTransfer = booking.type === 'Transfer'
    const statusClass = getStatusClass(booking.status)

    // สร้างรายการของฟิลด์ที่ต้องการแสดง (เลือกฟิลด์หลัก ๆ เพื่อให้ดูไม่รก และสอดคล้องกับภาพ)
    const displayFields = {
      id: 'Booking ID',
      type: 'Type',
      date: 'Date',
      time: 'Time',
      sendTo: 'Send To',
      customer: 'Customer', // รวม First Name + Last Name
      status: 'Status',
      agent: 'Agent',
      detail: 'Detail',
    }

    // เพิ่มฟิลด์เฉพาะสำหรับ Tour
    if (!isTransfer) {
      Object.assign(displayFields, {
        hotel: 'Hotel',
        pax: 'Pax',
      })
    }

    // เพิ่มฟิลด์เฉพาะสำหรับ Transfer
    if (isTransfer) {
      Object.assign(displayFields, {
        flight: 'Flight',
        pickupFrom: 'Pickup From',
        dropTo: 'Drop To',
      })
    }

    // สร้างรายการข้อมูลในรูปแบบ 4 คอลัมน์ต่อแถว
    const fieldEntries = Object.entries(displayFields)
    const rows = []
    for (let i = 0; i < fieldEntries.length; i += 4) {
      rows.push(fieldEntries.slice(i, i + 4))
    }

    // สร้าง card สำหรับ booking นี้ แสดงข้อมูลใน 4 คอลัมน์ต่อแถว
    content += `
      <div class="col-12 mb-1">
        <div class="card booking-details-card ${isTransfer ? 'transfer' : 'tour'}">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span class="booking-id">${booking.id}</span>
            <span class="status-badge ${statusClass}">${booking.status}</span>
          </div>
          <div class="card-body">
            <div class="booking-details-grid">
              ${rows
                .map(
                  row => `
                <div class="booking-row">
                  ${row
                    .map(
                      ([field, label]) => `
                    <div class="booking-item">
                      <div class="booking-label">${label}</div>
                      <div class="booking-value">${
                        field === 'customer'
                          ? `${booking.firstName || ''} ${booking.lastName || ''}`.trim() || '-'
                          : booking[field] || '-'
                      }</div>
                    </div>
                  `
                    )
                    .join('')}
                </div>
              `
                )
                .join('')}
            </div>
            <div class="text-end mt-2">
              <button class="btn btn-sm btn-warning remove-booking-btn" 
                data-booking-key="${booking.dbKey}" 
                data-booking-type="${booking.type}" 
                data-order-key="${orderId}">
                <i class="bi bi-x-circle"></i> Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    `
  })
  content += `
      </div>
    </div>
  `

  modalContent.innerHTML = content

  const removeButtons = modalContent.querySelectorAll('.remove-booking-btn')
  removeButtons.forEach(btn => {
    btn.addEventListener('click', e => {
      const bookingKey = e.target.dataset.bookingKey || e.target.closest('button').dataset.bookingKey
      const bookingType = e.target.dataset.bookingType || e.target.closest('button').dataset.bookingType
      const orderKey = e.target.dataset.orderKey || e.target.closest('button').dataset.orderKey

      showRemoveBookingConfirmation(bookingKey, bookingType, orderKey)
    })
  })

  orderDetailsModal.show()
}

function getStatusClass(status) {
  switch (status) {
    case 'รอดำเนินการ':
      return 'waiting'
    case 'จองแล้ว':
      return 'booked'
    case 'ดำเนินการอยู่':
      return 'in-progress'
    case 'เสร็จสมบูรณ์':
      return 'completed'
    case 'ยกเลิก':
      return 'cancelled'
    default:
      return 'waiting'
  }
}

function showAddBookingModal(orderKey, orderId) {
  currentOrderForAddBooking = orderKey

  const modalTitle = document.getElementById('addBookingModalLabel')
  modalTitle.textContent = `Add Booking to Order: ${orderId}`

  renderAvailableBookingsTable()

  document.getElementById('selectedBookingsCount').textContent = '0 bookings selected'

  document.getElementById('selectAllBookings').checked = false

  document.getElementById('addBookingConfirmBtn').disabled = true

  addBookingModal.show()
}

function renderAvailableBookingsTable() {
  const tableBody = document.getElementById('availableBookingsTable')
  const searchInput = document.getElementById('bookingSearchInput')

  tableBody.innerHTML = ''

  if (!availableBookingsData || availableBookingsData.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">
          No available bookings found
        </td>
      </tr>
    `
    return
  }

  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : ''
  const filteredBookings = searchTerm
    ? availableBookingsData.filter(
        bk =>
          bk.name.toLowerCase().includes(searchTerm) ||
          bk.agent.toLowerCase().includes(searchTerm) ||
          bk.sendTo.toLowerCase().includes(searchTerm) ||
          bk.date.toLowerCase().includes(searchTerm)
      )
    : availableBookingsData

  if (filteredBookings.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">
          No bookings match your search
        </td>
      </tr>
    `
    return
  }

  filteredBookings.forEach(bk => {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>
        <div class="form-check">
          <input type="checkbox" class="form-check-input booking-checkbox" data-dbkey="${bk.dbKey}" data-type="${
      bk.type
    }">
        </div>
      </td>
      <td>${bk.agent}</td>
      <td>
        <span class="badge ${bk.type === 'Tour' ? 'bg-success' : 'bg-primary'}">${bk.type}</span>
      </td>
      <td>${bk.name}</td>
      <td>${bk.date}</td>
    `

    tr.addEventListener('click', e => {
      if (e.target.type !== 'checkbox') {
        const checkbox = tr.querySelector('.booking-checkbox')
        checkbox.checked = !checkbox.checked
        updateSelectedBookingsCount()
        updateAddBookingButtonState()
      }
    })

    tr.querySelector('.booking-checkbox').addEventListener('change', () => {
      updateSelectedBookingsCount()
      updateAddBookingButtonState()
    })

    tableBody.appendChild(tr)
  })

  if (searchInput) {
    searchInput.addEventListener(
      'input',
      debounce(() => {
        renderAvailableBookingsTable()
      }, 300)
    )
  }
}

function toggleSelectAllBookings() {
  const selectAllCheckbox = document.getElementById('selectAllBookings')
  const bookingCheckboxes = document.querySelectorAll('.booking-checkbox')

  bookingCheckboxes.forEach(checkbox => {
    checkbox.checked = selectAllCheckbox.checked
  })

  updateSelectedBookingsCount()
  updateAddBookingButtonState()
}

function updateSelectedBookingsCount() {
  const selectedCount = document.querySelectorAll('.booking-checkbox:checked').length
  const countDisplay = document.getElementById('selectedBookingsCount')

  countDisplay.textContent = `${selectedCount} booking${selectedCount !== 1 ? 's' : ''} selected`
}

function updateAddBookingButtonState() {
  const addButton = document.getElementById('addBookingConfirmBtn')
  const selectedCount = document.querySelectorAll('.booking-checkbox:checked').length

  addButton.disabled = selectedCount === 0
}

async function addBookingsToOrder() {
  if (!currentOrderForAddBooking) {
    showErrorMessage('No order selected')
    return
  }

  const selectedCheckboxes = document.querySelectorAll('.booking-checkbox:checked')
  if (selectedCheckboxes.length === 0) {
    showErrorMessage('No bookings selected')
    return
  }

  try {
    const orderRef = ref(database, `orders/${currentOrderForAddBooking}`)
    const orderSnap = await get(orderRef)

    if (!orderSnap.exists()) {
      showErrorMessage('Order not found')
      return
    }

    const orderData = orderSnap.val()
    const orderId = orderData.id
    const currentBookings = orderData.bookings || []

    const updates = {}

    selectedCheckboxes.forEach(checkbox => {
      const bookingKey = checkbox.dataset.dbkey
      const bookingType = checkbox.dataset.type

      if (!currentBookings.includes(bookingKey)) {
        currentBookings.push(bookingKey)
      }

      if (bookingType === 'Tour') {
        updates[`tourBookings/${bookingKey}/orderId`] = orderId
      } else if (bookingType === 'Transfer') {
        updates[`transferBookings/${bookingKey}/orderId`] = orderId
      }
    })

    updates[`orders/${currentOrderForAddBooking}/bookings`] = currentBookings

    await update(ref(database), updates)

    showSuccessMessage(`Successfully added ${selectedCheckboxes.length} booking(s) to this order`)

    addBookingModal.hide()

    await loadInitialData()
    await fetchOrdersByFilter()
  } catch (err) {
    console.error('Error adding bookings to order:', err)
    showErrorMessage('Failed to add bookings. Please try again.')
  }
}

function showDeleteOrderConfirmation(orderKey, orderName) {
  orderDeleteKey = orderKey

  document.getElementById('deleteOrderId').textContent = orderName

  confirmDeleteModal.show()
}

async function deleteOrder() {
  if (!orderDeleteKey) {
    showErrorMessage('No order selected for deletion')
    return
  }

  try {
    const orderRef = ref(database, `orders/${orderDeleteKey}`)
    const orderSnap = await get(orderRef)

    if (!orderSnap.exists()) {
      showErrorMessage('Order not found')
      return
    }

    const orderData = orderSnap.val()
    const bookingIds = orderData.bookings || []

    const updates = {}

    for (const bookingId of bookingIds) {
      updates[`tourBookings/${bookingId}/orderId`] = null
      updates[`transferBookings/${bookingId}/orderId`] = null
    }

    updates[`orders/${orderDeleteKey}`] = null

    await update(ref(database), updates)

    confirmDeleteModal.hide()

    showSuccessMessage('Order deleted successfully')

    await loadInitialData()
    await fetchOrdersByFilter()
  } catch (error) {
    console.error('Error deleting order:', error)
    showErrorMessage('Failed to delete order. Please try again.')
  }
}

function showRemoveBookingConfirmation(bookingKey, bookingType, orderKey) {
  bookingRemoveKey = bookingKey
  bookingRemoveType = bookingType
  bookingRemoveOrderKey = orderKey

  let bookingId = bookingKey

  if (bookingType === 'Tour' && allTourBookings[bookingKey]) {
    bookingId = allTourBookings[bookingKey].tourID || bookingKey
  } else if (bookingType === 'Transfer' && allTransferBookings[bookingKey]) {
    bookingId = allTransferBookings[bookingKey].transferID || bookingKey
  }

  document.getElementById('removeBookingId').textContent = `${bookingType}: ${bookingId}`

  confirmRemoveBookingModal.show()
}

async function removeBookingFromOrder() {
  if (!bookingRemoveKey || !bookingRemoveType || !bookingRemoveOrderKey) {
    showErrorMessage('Missing booking information')
    return
  }

  try {
    const orderRef = ref(database, `orders/${bookingRemoveOrderKey}`)
    const orderSnap = await get(orderRef)

    if (!orderSnap.exists()) {
      showErrorMessage('Order not found')
      return
    }

    const orderData = orderSnap.val()
    const bookingIds = orderData.bookings || []

    const newBookingsArray = bookingIds.filter(id => id !== bookingRemoveKey)

    const updates = {}

    updates[`orders/${bookingRemoveOrderKey}/bookings`] = newBookingsArray

    if (bookingRemoveType === 'Tour') {
      updates[`tourBookings/${bookingRemoveKey}/orderId`] = null
    } else if (bookingRemoveType === 'Transfer') {
      updates[`transferBookings/${bookingRemoveKey}/orderId`] = null
    }

    await update(ref(database), updates)

    confirmRemoveBookingModal.hide()

    orderDetailsModal.hide()

    showSuccessMessage('Booking removed from order successfully')

    await loadInitialData()
    await fetchOrdersByFilter()
  } catch (error) {
    console.error('Error removing booking from order:', error)
    showErrorMessage('Failed to remove booking. Please try again.')
  }
}

function updateStatsCount() {
  const totalOrders = Object.keys(allOrders).length

  let totalBookings = 0
  Object.values(allOrders).forEach(order => {
    totalBookings += (order.bookings || []).length
  })

  totalOrdersCountEl.textContent = totalOrders
  totalBookingsCountEl.textContent = totalBookings
}

function updateFilteredCount(count) {
  filteredOrdersCountEl.textContent = count
}

function renderOrders() {
  renderFilteredOrders(filteredOrders)
}

function showLoading(show) {
  if (show) {
    loadingSpinner.classList.remove('d-none')
    ordersContainer.classList.add('d-none')
  } else {
    loadingSpinner.classList.add('d-none')
    ordersContainer.classList.remove('d-none')
  }
}

function showErrorMessage(message) {
  const alertEl = document.createElement('div')
  alertEl.className = 'alert alert-danger alert-dismissible fade show fixed-top mx-auto mt-4'
  alertEl.style.maxWidth = '500px'
  alertEl.style.zIndex = '9999'
  alertEl.innerHTML = `
    <i class="bi bi-exclamation-triangle-fill"></i>
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `

  document.body.appendChild(alertEl)

  setTimeout(() => {
    if (document.body.contains(alertEl)) {
      alertEl.remove()
    }
  }, 5000)
}

function showSuccessMessage(message) {
  const alertEl = document.createElement('div')
  alertEl.className = 'alert alert-success alert-dismissible fade show fixed-top mx-auto mt-4'
  alertEl.style.maxWidth = '500px'
  alertEl.style.zIndex = '9999'
  alertEl.innerHTML = `
    <i class="bi bi-check-circle-fill"></i>
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `

  document.body.appendChild(alertEl)

  setTimeout(() => {
    if (document.body.contains(alertEl)) {
      alertEl.remove()
    }
  }, 5000)
}
function debounce(func, delay) {
  let timeoutId
  return function (...args) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args)
    }, delay)
  }
}

// Format date for display
function formatDate(dateStr) {
  if (!dateStr) return '-'

  try {
    const date = new Date(dateStr)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return dateStr
  }
}

// Compare dates for sorting
function compareDates(dateA, dateB) {
  if (!dateA && !dateB) return 0
  if (!dateA) return 1
  if (!dateB) return -1

  const a = new Date(dateA)
  const b = new Date(dateB)

  return a.getTime() - b.getTime()
}
