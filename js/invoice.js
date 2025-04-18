import { database } from '/js/firebase-config.js'
import { ref, get, set, push } from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js'

// Helper function to format numbers with commas
function formatNumberWithCommas(num) {
  if (num === null || num === undefined) return '0'
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Format dates consistently
function parseDateStr(dateStr) {
  if (!dateStr) return null
  const [d, m, y] = dateStr.split('/')
  if (!d || !m || !y) return null
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
}

// Format date for display in Thai short format
function formatToShortThaiDate(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return '-'
  const day = dateObj.getDate()
  const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase()
  const year = (dateObj.getFullYear() % 100).toString().padStart(2, '0')
  return `${day} ${month} ${year}`
}

function formatDate(dateStr) {
  if (!dateStr || dateStr === '-') return '-'

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

  try {
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-')
      if (!year || !month || !day) return dateStr

      const shortYear = year.slice(2)
      const shortMonth = months[parseInt(month, 10) - 1]

      return `${day} ${shortMonth} ${shortYear}`
    } else if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/')
      if (!day || !month || !year) return dateStr

      const shortYear = year.slice(2)
      const shortMonth = months[parseInt(month, 10) - 1]

      return `${day} ${shortMonth} ${shortYear}`
    }

    return dateStr
  } catch (error) {
    console.error('Error formatting date:', error)
    return dateStr
  }
}

// Initialize global variables
let allPaymentsData = {}
let allTourBookingsData = {}
let allTransferBookingsData = {}

let selectedPaymentKeys = []
let draftInvoiceDate = ''

document.addEventListener('DOMContentLoaded', function () {
  // เพิ่มปุ่มเพื่อซ่อน loading overlay ในกรณีฉุกเฉิน
  const emergencyBtn = document.createElement('button')
  emergencyBtn.textContent = 'ปิด Loading'
  emergencyBtn.style.position = 'fixed'
  emergencyBtn.style.top = '10px'
  emergencyBtn.style.right = '10px'
  emergencyBtn.style.zIndex = '10000'
  emergencyBtn.style.padding = '5px 10px'
  emergencyBtn.style.backgroundColor = 'red'
  emergencyBtn.style.color = 'white'
  emergencyBtn.style.border = 'none'
  emergencyBtn.style.borderRadius = '5px'
  emergencyBtn.style.cursor = 'pointer'
  emergencyBtn.style.display = 'none'

  // ใส่ปุ่มในหน้าเว็บ
  document.body.appendChild(emergencyBtn)

  // แสดงปุ่มหลังจาก 10 วินาที
  setTimeout(() => {
    const loadingOverlay = document.getElementById('loading-overlay')
    if (loadingOverlay && loadingOverlay.style.display !== 'none') {
      emergencyBtn.style.display = 'block'
    }
  }, 10000)

  // เมื่อกดปุ่มให้ปิด loading overlay
  emergencyBtn.addEventListener('click', () => {
    const loadingOverlay = document.getElementById('loading-overlay')
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none'
    }
    emergencyBtn.style.display = 'none'
  })

  // ตรวจสอบและซ่อน loading overlay ที่อาจค้างอยู่
  const loadingOverlay = document.getElementById('loading-overlay')
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none'
  }
})

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Invoice.js loaded')

  // Get DOM elements
  const selectPaymentsBtn = document.getElementById('selectPaymentsBtn')
  const confirmSelectBtn = document.getElementById('confirmSelectBtn')
  const printBtn = document.getElementById('printBtn')
  const saveInvoiceBtn = document.getElementById('saveInvoiceBtn')
  const showCostProfitCheckbox = document.getElementById('showCostProfitCheckbox')
  const editInvoiceBtn = document.getElementById('editInvoiceBtn')
  const viewInvoiceBtn = document.getElementById('viewInvoiceBtn')

  const invoiceTbody = document.querySelector('#invoiceTable tbody')
  const grandTotalDisplay = document.getElementById('grandTotalDisplay')

  const selectPaymentsModalEl = document.getElementById('selectPaymentsModal')
  const selectPaymentsModal = new bootstrap.Modal(selectPaymentsModalEl, {
    backdrop: 'static',
    keyboard: false,
  })
  const paymentsListContainer = document.getElementById('paymentsListContainer')

  // Check if banner image exists and apply fallback if needed
  const bannerImage = document.getElementById('bannerImage')
  if (bannerImage) {
    bannerImage.onerror = function () {
      console.warn('Banner image not found, using fallback text')
      const container = bannerImage.parentElement
      container.innerHTML = '<h2 class="text-primary">INDO Smile Phuket</h2>'
    }
  }

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print()
    })
  }

  // Load initial data
  try {
    const [paySnap, tourSnap, transferSnap] = await Promise.all([
      get(ref(database, 'payments')),
      get(ref(database, 'tourBookings')),
      get(ref(database, 'transferBookings')),
    ])

    if (paySnap.exists()) {
      allPaymentsData = paySnap.val()
    }
    if (tourSnap.exists()) {
      allTourBookingsData = tourSnap.val()
    }
    if (transferSnap.exists()) {
      allTransferBookingsData = transferSnap.val()
    }
  } catch (error) {
    console.error('Error loading initial data:', error)
    showNotification('Error loading data. Please refresh the page.', 'error')
  }

  // Set up event listeners
  selectPaymentsBtn?.addEventListener('click', () => {
    buildPaymentsList()
    selectPaymentsModal.show()
  })

  confirmSelectBtn?.addEventListener('click', () => {
    selectedPaymentKeys = []
    const checkboxes = paymentsListContainer.querySelectorAll("input[type='checkbox']:checked")
    checkboxes.forEach(ck => {
      selectedPaymentKeys.push(ck.value)
    })
    selectPaymentsModal.hide()

    buildInvoiceTable(selectedPaymentKeys)

    if (selectedPaymentKeys.length > 0) {
      const invoiceDateSpan = document.getElementById('invoiceDateSpan')
      if (invoiceDateSpan) {
        invoiceDateSpan.textContent = draftInvoiceDate || 'กรุณากรอกวันที่'
        invoiceDateSpan.setAttribute('data-invoice-key', 'temp')
      }

      enableInvoiceDateEdit()
    }
  })

  // Show Cost/Profit checkbox
  showCostProfitCheckbox?.addEventListener('change', () => {
    if (selectedPaymentKeys && selectedPaymentKeys.length > 0) {
      buildInvoiceTable(selectedPaymentKeys)
    }
  })

  // Set up edit invoice button
  editInvoiceBtn?.addEventListener('click', () => {
    openEditInvoiceModal()
  })

  // Set up view invoice button
  viewInvoiceBtn?.addEventListener('click', () => {
    viewInvoiceList()
  })

  // Save invoice button
  saveInvoiceBtn?.addEventListener('click', async () => {
    if (!draftInvoiceDate || draftInvoiceDate === 'กรุณากรอกวันที่') {
      showNotification('กรุณากรอกวันที่ก่อนบันทึก Invoice', 'warning')
      return
    }

    const invoiceName = prompt('กรุณาตั้งชื่อ Invoice:')
    if (!invoiceName) {
      showNotification('คุณยังไม่ได้ตั้งชื่อ Invoice', 'warning')
      return
    }

    try {
      showLoadingOverlay(true, 'Saving invoice...')

      const invoicesRef = ref(database, 'invoices')
      const newInvoiceRef = push(invoicesRef)

      const invoicePayload = {
        invoiceName: invoiceName,
        createdAt: new Date().toISOString(),
        selectedPaymentKeys,
        invoiceDate: draftInvoiceDate || 'กรุณากรอกวันที่',
      }

      await set(newInvoiceRef, invoicePayload)

      // Update invoiced status
      for (let ck of selectedPaymentKeys) {
        let paymentRef
        if (ck && ck.includes('/')) {
          const [mk, sk] = ck.split('/')
          paymentRef = ref(database, `payments/${mk}/${sk}/invoiced`)
        } else if (ck) {
          paymentRef = ref(database, `payments/${ck}/invoiced`)
        }

        if (paymentRef) {
          await set(paymentRef, true)
        }
      }

      showNotification(`บันทึก Invoice เรียบร้อย! InvoiceName: ${invoiceName}`, 'success')
    } catch (err) {
      console.error('Error saving invoice:', err)
      showNotification('เกิดข้อผิดพลาดในการบันทึก Invoice', 'error')
    } finally {
      showLoadingOverlay(false)
    }
  })

  // Initialize view selected invoice button
  const viewSelectedInvoiceBtn = document.getElementById('viewSelectedInvoiceBtn')
  if (viewSelectedInvoiceBtn) {
    viewSelectedInvoiceBtn.addEventListener('click', async () => {
      const invoicesSelect = document.getElementById('invoicesSelect')
      if (!invoicesSelect || !invoicesSelect.value) {
        showNotification('กรุณาเลือก Invoice ก่อน', 'warning')
        return
      }

      const invoiceKey = invoicesSelect.value

      try {
        showLoadingOverlay(true, 'Loading invoice...')

        const invoiceSnap = await get(ref(database, 'invoices/' + invoiceKey))
        if (!invoiceSnap.exists()) {
          showNotification('ไม่พบข้อมูล Invoice นี้', 'error')
          showLoadingOverlay(false)
          return
        }

        const invoiceObj = invoiceSnap.val()

        if (!invoiceObj.selectedPaymentKeys || !Array.isArray(invoiceObj.selectedPaymentKeys)) {
          showNotification('Invoice นี้ไม่มี selectedPaymentKeys', 'error')
          showLoadingOverlay(false)
          return
        }

        console.log('Load Invoice:', invoiceKey, invoiceObj)

        if (showCostProfitCheckbox) {
          showCostProfitCheckbox.checked = false
        }

        selectedPaymentKeys = invoiceObj.selectedPaymentKeys || []

        // ครอบเฉพาะส่วนนี้ด้วย try-catch เพื่อจับข้อผิดพลาดเพิ่มเติม
        try {
          buildInvoiceTable(invoiceObj.selectedPaymentKeys)
        } catch (buildError) {
          console.error('Error building invoice table:', buildError)
          showNotification('เกิดข้อผิดพลาดในการสร้างตาราง Invoice: ' + buildError.message, 'error')
          showLoadingOverlay(false)
          return
        }

        const invoiceDateSpan = document.getElementById('invoiceDateSpan')
        if (invoiceDateSpan) {
          if (invoiceObj.invoiceDate) {
            invoiceDateSpan.textContent = invoiceObj.invoiceDate
          } else {
            invoiceDateSpan.textContent = 'กรุณากรอกวันที่'
          }

          invoiceDateSpan.setAttribute('data-invoice-key', invoiceKey)
        }

        enableInvoiceDateEdit()

        // ปิด modal ด้วยฟังก์ชันที่เราเพิ่มเข้ามา
        closeViewInvoiceModal()

        const exportCsvBtn = document.getElementById('exportCsvBtn')
        if (exportCsvBtn) exportCsvBtn.disabled = false

        // showNotification('Invoice loaded successfully', 'success')
      } catch (error) {
        console.error('Error loading invoice:', error)
        showNotification('Error loading invoice: ' + (error.message || 'Unknown error'), 'error')
      } finally {
        showLoadingOverlay(false)
      }
    })
  }
  // Initialize the export CSV button
  const exportCsvBtn = document.getElementById('exportCsvBtn')
  if (exportCsvBtn) {
    exportCsvBtn.disabled = true

    exportCsvBtn.addEventListener('click', () => {
      exportTableToCSV('invoice_export.csv')
    })
  }
})
document.addEventListener('click', function (e) {
  const viewInvoiceModal = document.getElementById('viewInvoiceModal')
  // Close modal when clicking on backdrop (outside the modal content)
  if (e.target.classList.contains('modal') && e.target.id === 'viewInvoiceModal') {
    closeViewInvoiceModal()
  }
})

// Close modal on ESC key
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    const viewInvoiceModal = document.getElementById('viewInvoiceModal')
    if (viewInvoiceModal && viewInvoiceModal.classList.contains('show')) {
      closeViewInvoiceModal()
    }
  }
})

// Also add a direct click handler to the modal close button in the HTML
document.addEventListener('DOMContentLoaded', function () {
  const closeButtons = document.querySelectorAll('#viewInvoiceModal .btn-close, #viewInvoiceModal .btn-secondary')
  closeButtons.forEach(button => {
    button.addEventListener('click', closeViewInvoiceModal)
  })
})
// Edit invoice modal functions
let editInvoiceModal
let currentEditingInvoiceKey = ''
let currentEditingPayments = []

function openEditInvoiceModal() {
  if (!editInvoiceModal) {
    const modalEl = document.getElementById('editInvoiceModal')
    editInvoiceModal = new bootstrap.Modal(modalEl, { backdrop: 'static' })
  }

  currentEditingInvoiceKey = ''
  currentEditingPayments = []

  buildInvoiceListForEdit()

  document.getElementById('invoiceSearchInput').value = ''
  document.getElementById('invoicesDataList').innerHTML = ''
  document.getElementById('selectedPaymentsList').innerHTML = ''

  editInvoiceModal.show()
}

async function buildInvoiceListForEdit() {
  const invoiceSearchInput = document.getElementById('invoiceSearchInput')
  const invoicesDataList = document.getElementById('invoicesDataList')

  if (!invoiceSearchInput || !invoicesDataList) return

  try {
    showLoadingOverlay(true, 'Loading invoices...')

    const invoicesSnap = await get(ref(database, 'invoices'))

    if (!invoicesSnap.exists()) {
      showNotification('No invoices found', 'info')
      return
    }

    const data = invoicesSnap.val()
    const keys = Object.keys(data)

    invoicesDataList.innerHTML = ''

    keys.forEach(k => {
      let n = data[k].invoiceName || '(No Name)'
      let opt = document.createElement('option')
      opt.value = n
      opt.dataset.key = k
      invoicesDataList.appendChild(opt)
    })

    invoiceSearchInput.addEventListener('change', () => {
      let val = invoiceSearchInput.value.trim()

      if (!val) {
        currentEditingInvoiceKey = ''
        currentEditingPayments = []
        document.getElementById('selectedPaymentsList').innerHTML = ''
        return
      }

      let selectedOption = Array.from(invoicesDataList.children).find(opt => opt.value === val)

      if (!selectedOption) {
        showNotification('Invoice not found', 'warning')
        return
      }

      let invoiceKey = selectedOption.dataset.key
      loadInvoiceForEdit(invoiceKey)
    })
  } catch (error) {
    console.error('Error building invoice list:', error)
    showNotification('Failed to load invoices', 'error')
  } finally {
    showLoadingOverlay(false)
  }
}

async function loadInvoiceForEdit(k) {
  try {
    showLoadingOverlay(true, 'Loading invoice details...')

    const snap = await get(ref(database, 'invoices/' + k))

    if (!snap.exists()) {
      showNotification('Invoice not found', 'error')
      return
    }

    const invObj = snap.val()
    currentEditingInvoiceKey = k
    currentEditingPayments = []

    if (invObj.selectedPaymentKeys && Array.isArray(invObj.selectedPaymentKeys)) {
      currentEditingPayments = invObj.selectedPaymentKeys.slice()
    }

    buildSelectedPaymentsList()
    // showNotification('Invoice loaded successfully', 'success')
  } catch (error) {
    console.error('Error loading invoice for edit:', error)
    showNotification('Failed to load invoice details', 'error')
  } finally {
    showLoadingOverlay(false)
  }
}

function buildSelectedPaymentsList() {
  const listEl = document.getElementById('selectedPaymentsList')
  if (!listEl) return

  listEl.innerHTML = ''

  if (currentEditingPayments.length === 0) {
    listEl.innerHTML = '<li class="list-group-item text-center text-muted">No payments selected</li>'
    return
  }

  currentEditingPayments.forEach((ck, idx) => {
    if (!ck) return

    let li = document.createElement('li')
    li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center')

    let label = getDisplayNameFromPaymentKey(ck)

    li.innerHTML = `
      <div>
        <span class="me-2">${label}</span>
        <button class="btn btn-sm btn-link text-danger" data-idx="${idx}" onclick="deletePaymentFromInvoice(${idx})">Delete</button>
      </div>
      <div>
        <button class="btn btn-sm btn-secondary me-1" onclick="movePaymentUp(${idx})">Up</button>
        <button class="btn btn-sm btn-secondary" onclick="movePaymentDown(${idx})">Down</button>
      </div>
    `
    listEl.appendChild(li)
  })
}

function getDisplayNameFromPaymentKey(key) {
  if (!key) return 'Unknown'

  let payment
  if (key.includes('/')) {
    const [mk, sk] = key.split('/')
    if (!allPaymentsData[mk] || !allPaymentsData[mk][sk]) return key
    payment = allPaymentsData[mk][sk]
  } else {
    payment = allPaymentsData[key]
    if (!payment) return key
  }

  if (payment.customer && payment.customer.firstName) {
    return `${payment.customer.firstName} ${payment.customer.lastName || ''}`.trim()
  }

  return key
}

function movePaymentUp(idx) {
  if (idx <= 0 || idx >= currentEditingPayments.length) return

  let tmp = currentEditingPayments[idx]
  currentEditingPayments[idx] = currentEditingPayments[idx - 1]
  currentEditingPayments[idx - 1] = tmp

  buildSelectedPaymentsList()
}

function movePaymentDown(idx) {
  if (idx < 0 || idx >= currentEditingPayments.length - 1) return

  let tmp = currentEditingPayments[idx]
  currentEditingPayments[idx] = currentEditingPayments[idx + 1]
  currentEditingPayments[idx + 1] = tmp

  buildSelectedPaymentsList()
}

function deletePaymentFromInvoice(idx) {
  if (idx < 0 || idx >= currentEditingPayments.length) return

  currentEditingPayments.splice(idx, 1)
  buildSelectedPaymentsList()
}

// Add Payment Modal functions
let addPaymentModal

function setupAddPaymentModal() {
  if (!addPaymentModal) {
    const el = document.getElementById('addPaymentModal')
    if (el) {
      addPaymentModal = new bootstrap.Modal(el, { backdrop: 'static' })
    }
  }
}

function openAddPaymentModal() {
  setupAddPaymentModal()
  if (!addPaymentModal) return

  buildAddPaymentList()
  addPaymentModal.show()
}

function buildAddPaymentList() {
  const addListEl = document.getElementById('addPaymentList')
  if (!addListEl) return

  addListEl.innerHTML = ''
  let hasPayments = false

  const mainKeys = Object.keys(allPaymentsData).sort()
  for (const mk of mainKeys) {
    const payment = allPaymentsData[mk]

    // Direct payment (no subK)
    if (payment && payment.orderID) {
      if (payment.invoiced === true || currentEditingPayments.includes(mk)) continue

      hasPayments = true
      let label = ''
      if (payment.customer && payment.customer.firstName) {
        label = payment.customer.firstName
        if (payment.customer.lastName) label += ' ' + payment.customer.lastName
      }

      let li = document.createElement('li')
      li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center')
      li.innerHTML = `
        <span>${label || 'Unknown'}</span>
        <button class="btn btn-sm btn-primary add-payment-btn" data-key="${mk}">Add</button>
      `

      li.querySelector('.add-payment-btn').addEventListener('click', () => {
        addPaymentToInvoice(mk)
      })

      addListEl.appendChild(li)
    }
    // Nested payments (with subK)
    else if (payment && typeof payment === 'object') {
      const subKeys = Object.keys(payment).sort()
      for (const sk of subKeys) {
        let pay = payment[sk]
        if (pay.invoiced === true || currentEditingPayments.includes(`${mk}/${sk}`)) continue

        hasPayments = true
        let label = ''
        if (pay.customer && pay.customer.firstName) {
          label = pay.customer.firstName
          if (pay.customer.lastName) label += ' ' + pay.customer.lastName
        }

        let ck = mk + '/' + sk
        let li = document.createElement('li')
        li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center')
        li.innerHTML = `
          <span>${label || 'Unknown'}</span>
          <button class="btn btn-sm btn-primary add-payment-btn" data-key="${ck}">Add</button>
        `

        li.querySelector('.add-payment-btn').addEventListener('click', () => {
          addPaymentToInvoice(ck)
        })

        addListEl.appendChild(li)
      }
    }
  }

  if (!hasPayments) {
    addListEl.innerHTML = '<li class="list-group-item text-center">No available payments found</li>'
  }
}

function addPaymentToInvoice(ck) {
  if (!ck || currentEditingPayments.includes(ck)) return

  currentEditingPayments.push(ck)
  buildSelectedPaymentsList()

  // Close modal if there's no more payments available
  const remainingPayments = document.querySelectorAll('#addPaymentList .add-payment-btn')
  if (remainingPayments.length <= 1) {
    if (addPaymentModal) {
      addPaymentModal.hide()
    }
  } else {
    // Just remove this payment from the list
    const button = document.querySelector(`#addPaymentList .add-payment-btn[data-key="${ck}"]`)
    if (button) {
      const li = button.closest('li')
      if (li) li.remove()
    }
  }
}

async function saveEditInvoice() {
  if (!currentEditingInvoiceKey) {
    showNotification('No invoice selected', 'warning')
    return
  }

  try {
    showLoadingOverlay(true, 'Saving invoice changes...')

    let invKey = currentEditingInvoiceKey
    let invRef = ref(database, 'invoices/' + invKey)

    let snapshot = await get(invRef)
    if (!snapshot.exists()) {
      showNotification('Invoice not found', 'error')
      return
    }

    let obj = snapshot.val()

    // Get previously selected payment keys to reset invoiced status if needed
    const oldKeys = obj.selectedPaymentKeys || []
    const newKeys = currentEditingPayments.slice()

    // Reset invoiced status for removed payments
    for (let ck of oldKeys) {
      if (!newKeys.includes(ck)) {
        if (ck.includes('/')) {
          const [mk, sk] = ck.split('/')
          await set(ref(database, `payments/${mk}/${sk}/invoiced`), false)
        } else {
          await set(ref(database, `payments/${ck}/invoiced`), false)
        }
      }
    }

    // Set invoiced=true for all payments in the invoice
    for (let ck of newKeys) {
      if (ck.includes('/')) {
        const [mk, sk] = ck.split('/')
        await set(ref(database, `payments/${mk}/${sk}/invoiced`), true)
      } else {
        await set(ref(database, `payments/${ck}/invoiced`), true)
      }
    }

    // Update invoice with new payment keys
    obj.selectedPaymentKeys = newKeys
    await set(invRef, obj)

    showNotification('Invoice updated successfully', 'success')

    if (editInvoiceModal) {
      editInvoiceModal.hide()
    }
  } catch (error) {
    console.error('Error saving invoice changes:', error)
    showNotification('Failed to save invoice changes', 'error')
  } finally {
    showLoadingOverlay(false)
  }
}

async function viewInvoiceList() {
  try {
    const invoicesSnap = await get(ref(database, 'invoices'))

    if (!invoicesSnap.exists()) {
      showNotification('No invoices found', 'warning')
      return
    }

    const invoicesData = invoicesSnap.val()
    const invoicesSelect = document.getElementById('invoicesSelect')

    if (!invoicesSelect) {
      showNotification('Invoice select element not found', 'error')
      return
    }

    invoicesSelect.innerHTML = ''
    const invoiceKeys = Object.keys(invoicesData)

    if (invoiceKeys.length === 0) {
      invoicesSelect.innerHTML = '<option value="">No invoices available</option>'
      return
    }

    invoiceKeys.forEach(k => {
      const invObj = invoicesData[k]
      const option = document.createElement('option')
      option.value = k
      const invName = invObj.invoiceName || '(NoName)'
      const invDate = invObj.invoiceDate || ''
      option.textContent = `${invName}${invDate ? ` (${invDate})` : ''}`
      invoicesSelect.appendChild(option)
    })

    // Use the standard Bootstrap modal API
    const viewInvoiceModal = document.getElementById('viewInvoiceModal')
    if (!viewInvoiceModal) {
      showNotification('Invoice modal element not found', 'error')
      return
    }

    // Make sure we have a proper Bootstrap modal instance
    if (typeof bootstrap !== 'undefined') {
      const bsModal = new bootstrap.Modal(viewInvoiceModal)
      bsModal.show()
    } else {
      // Fallback to manual showing if bootstrap is not available
      viewInvoiceModal.style.display = 'block'
      viewInvoiceModal.classList.add('show')
      viewInvoiceModal.setAttribute('aria-modal', 'true')
      viewInvoiceModal.removeAttribute('aria-hidden')
      document.body.classList.add('modal-open')

      // Add backdrop
      const backdrop = document.createElement('div')
      backdrop.className = 'modal-backdrop fade show'
      document.body.appendChild(backdrop)
    }

    // Important: Add proper close button event handler
    const closeBtn = viewInvoiceModal.querySelector('[data-bs-dismiss="modal"]')
    if (closeBtn) {
      closeBtn.addEventListener('click', closeViewInvoiceModal)
    }

    // Also attach to the "Close" button in the footer
    const footerCloseBtn = viewInvoiceModal.querySelector('.modal-footer .btn-secondary')
    if (footerCloseBtn) {
      footerCloseBtn.addEventListener('click', closeViewInvoiceModal)
    }
  } catch (error) {
    console.error('Error loading invoice list:', error)
    showNotification('Failed to load invoices: ' + error.message, 'error')
  }
}

function closeViewInvoiceModal() {
  const viewInvoiceModal = document.getElementById('viewInvoiceModal')
  if (!viewInvoiceModal) return

  // Try multiple methods to ensure the modal closes properly

  // Method 1: Bootstrap API if available
  if (typeof bootstrap !== 'undefined') {
    try {
      const bsModal = bootstrap.Modal.getInstance(viewInvoiceModal)
      if (bsModal) {
        bsModal.hide()
        return // Exit if successful
      }
    } catch (e) {
      console.warn('Could not close modal using Bootstrap API:', e)
    }
  }

  // Method 2: Manual DOM manipulation
  try {
    // Hide modal
    viewInvoiceModal.style.display = 'none'
    viewInvoiceModal.classList.remove('show')
    viewInvoiceModal.setAttribute('aria-hidden', 'true')
    viewInvoiceModal.removeAttribute('aria-modal')

    // Remove backdrop
    const backdrop = document.querySelector('.modal-backdrop')
    if (backdrop) {
      backdrop.remove()
    }

    // Remove modal-open class from body
    document.body.classList.remove('modal-open')
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  } catch (e) {
    console.error('Failed to manually close modal:', e)
  }
}

// Export table to CSV
function exportTableToCSV(filename) {
  const table = document.getElementById('invoiceTable')
  if (!table) {
    showNotification('Invoice table not found', 'error')
    return
  }

  try {
    showLoadingOverlay(true, 'Exporting to CSV...')

    let csv = []

    for (let i = 0; i < table.rows.length; i++) {
      let row = []
      for (let j = 0; j < table.rows[i].cells.length; j++) {
        let text = table.rows[i].cells[j].innerText.replace(/(\r\n|\n|\r)/gm, ' ')
        text = text.replace(/"/g, '""')
        row.push(`"${text}"`)
      }
      csv.push(row.join(','))
    }

    const csvString = csv.join('\n')

    // Add UTF-8 BOM to ensure proper encoding for Thai characters
    const BOM = '\uFEFF'
    const finalCSV = BOM + csvString

    const blob = new Blob([finalCSV], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showNotification('CSV exported successfully', 'success')
  } catch (error) {
    console.error('Error exporting to CSV:', error)
    showNotification('Failed to export to CSV', 'error')
  } finally {
    showLoadingOverlay(false)
  }
}

// Helper functions
function showNotification(message, type = 'info') {
  const iconMap = {
    success: 'bi-check-circle-fill',
    error: 'bi-exclamation-triangle-fill',
    warning: 'bi-exclamation-circle-fill',
    info: 'bi-info-circle-fill',
  }

  const colorMap = {
    success: 'success',
    error: 'danger',
    warning: 'warning',
    info: 'info',
  }

  const alertEl = document.createElement('div')
  alertEl.className = `alert alert-${colorMap[type]} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-4`
  alertEl.style.zIndex = '9999'
  alertEl.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'
  alertEl.style.minWidth = '300px'
  alertEl.style.maxWidth = '500px'

  alertEl.innerHTML = `
    <i class="bi ${iconMap[type]} me-2"></i>
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `

  document.body.appendChild(alertEl)

  setTimeout(() => {
    if (document.body.contains(alertEl)) {
      alertEl.classList.remove('show')
      setTimeout(() => {
        if (document.body.contains(alertEl)) {
          document.body.removeChild(alertEl)
        }
      }, 300)
    }
  }, 3000)
}

function showLoadingIndicator(element, show) {
  if (show) {
    element.classList.add('position-relative')
    const spinner = document.createElement('div')
    spinner.className = 'spinner-border spinner-border-sm text-primary position-absolute'
    spinner.style.right = '5px'
    spinner.style.top = '50%'
    spinner.style.transform = 'translateY(-50%)'
    spinner.setAttribute('role', 'status')
    spinner.innerHTML = '<span class="visually-hidden">Loading...</span>'
    element.appendChild(spinner)
  } else {
    const spinner = element.querySelector('.spinner-border')
    if (spinner) {
      element.removeChild(spinner)
    }
    element.classList.remove('position-relative')
  }
}

function showLoadingOverlay(show, message = 'Loading...') {
  // ไม่ทำอะไรเลยเพื่อป้องกันปัญหา loading ค้าง
  console.log('Loading overlay request:', show ? 'show' : 'hide', message)
  return // ไม่ทำอะไรเลย
}

// Register global functions
window.deletePaymentFromInvoice = deletePaymentFromInvoice
window.movePaymentUp = movePaymentUp
window.movePaymentDown = movePaymentDown
window.addPaymentToInvoice = addPaymentToInvoice
window.setupAddPaymentModal = setupAddPaymentModal
window.openAddPaymentModal = openAddPaymentModal

function buildPaymentsList() {
  const paymentsListContainer = document.getElementById('paymentsListContainer')
  if (!paymentsListContainer) return

  paymentsListContainer.innerHTML = ''
  let hasAny = false

  const paymentsByMonth = {}
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const mainKeys = Object.keys(allPaymentsData).sort()
  mainKeys.forEach(mainK => {
    const payment = allPaymentsData[mainK]
    if (!payment || typeof payment !== 'object') return

    if (payment.orderID) {
      if (payment.invoiced === true) return

      hasAny = true
      let displayName = ''
      if (payment.customer && payment.customer.firstName) {
        displayName = `${payment.customer.firstName}`
        if (payment.customer.lastName) {
          displayName += ` ${payment.customer.lastName}`
        }
      }

      let startDate = null
      let endDate = null
      let bookingsArr = []

      if (Array.isArray(payment.bookings)) {
        bookingsArr = payment.bookings
      } else if (payment.bookings && typeof payment.bookings === 'object') {
        bookingsArr = Object.values(payment.bookings)
      }

      bookingsArr.forEach(booking => {
        const bookingDate = booking.date || booking.tourDate || booking.transferDate
        if (bookingDate) {
          const dateObj = new Date(bookingDate)
          if (!isNaN(dateObj.getTime())) {
            if (!startDate || dateObj < startDate) {
              startDate = dateObj
            }
            if (!endDate || dateObj > endDate) {
              endDate = dateObj
            }
          }
        }
      })

      let dateRangeStr = ''
      if (startDate && endDate) {
        const formatDateShort = date => {
          return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(
            2,
            '0'
          )}/${date.getFullYear()}`
        }

        if (startDate.getTime() === endDate.getTime()) {
          dateRangeStr = ` / ${formatDateShort(startDate)}`
        } else {
          dateRangeStr = ` / ${formatDateShort(startDate)} - ${formatDateShort(endDate)}`
        }
      }

      const monthKey = startDate ? `${months[startDate.getMonth()]} ${startDate.getFullYear()}` : 'Unknown'
      if (!paymentsByMonth[monthKey]) {
        paymentsByMonth[monthKey] = []
      }

      paymentsByMonth[monthKey].push({
        type: 'direct',
        mainK,
        displayName: displayName || 'No Name',
        dateRangeStr,
        isChecked: selectedPaymentKeys.includes(mainK),
      })
    } else {
      // Nested payments (with subK)
      const subObj = payment
      const subKeys = Object.keys(subObj).sort()
      subKeys.forEach(subK => {
        const subPayment = subObj[subK]
        if (subPayment.invoiced === true) return

        hasAny = true
        let displayName = ''
        if (subPayment.customer && subPayment.customer.firstName) {
          displayName = `${subPayment.customer.firstName}`
          if (subPayment.customer.lastName) {
            displayName += ` ${subPayment.customer.lastName}`
          }
        }

        // Extract dates from bookings
        let startDate = null
        let endDate = null
        let bookingsArr = []

        if (Array.isArray(subPayment.bookings)) {
          bookingsArr = subPayment.bookings
        } else if (subPayment.bookings && typeof subPayment.bookings === 'object') {
          bookingsArr = Object.values(subPayment.bookings)
        }

        // Find earliest and latest dates
        bookingsArr.forEach(booking => {
          const bookingDate = booking.date || booking.tourDate || booking.transferDate
          if (bookingDate) {
            const dateObj = new Date(bookingDate)
            if (!isNaN(dateObj.getTime())) {
              if (!startDate || dateObj < startDate) {
                startDate = dateObj
              }
              if (!endDate || dateObj > endDate) {
                endDate = dateObj
              }
            }
          }
        })

        // Format date range string
        let dateRangeStr = ''
        if (startDate && endDate) {
          const formatDateShort = date => {
            return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(
              2,
              '0'
            )}/${date.getFullYear()}`
          }

          if (startDate.getTime() === endDate.getTime()) {
            dateRangeStr = ` / ${formatDateShort(startDate)}`
          } else {
            dateRangeStr = ` / ${formatDateShort(startDate)} - ${formatDateShort(endDate)}`
          }
        }

        // Group by start date month
        const monthKey = startDate ? `${months[startDate.getMonth()]} ${startDate.getFullYear()}` : 'Unknown'
        if (!paymentsByMonth[monthKey]) {
          paymentsByMonth[monthKey] = []
        }

        paymentsByMonth[monthKey].push({
          type: 'nested',
          mainK,
          subK,
          displayName: displayName || 'No Name',
          dateRangeStr,
          isChecked: selectedPaymentKeys.includes(`${mainK}/${subK}`),
        })
      })
    }
  })

  if (!hasAny) {
    paymentsListContainer.innerHTML = `
      <div class="alert alert-warning">No Payments Found</div>
    `
    return
  }

  // Sort months to show in calendar order
  const sortedMonths = Object.keys(paymentsByMonth).sort((a, b) => {
    const aIndex = months.indexOf(a)
    const bIndex = months.indexOf(b)

    // Handle 'Unknown' category
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1

    return aIndex - bIndex
  })

  // Render grouped payments
  sortedMonths.forEach(month => {
    // Create month header
    const firstPaymentInMonth = paymentsByMonth[month][0]
    let yearToShow = 'Unknown'

    // ดึง startDate จาก payment แรกในเดือนนี้
    if (firstPaymentInMonth) {
      // ลองหา startDate จากค่า dateRangeStr
      const dateMatch = firstPaymentInMonth.dateRangeStr.match(/\/\s(\d{2})\/(\d{2})\/(\d{4})/)
      if (dateMatch && dateMatch[3]) {
        yearToShow = dateMatch[3] // ดึงปีจาก match group ที่ 3
      }
    }
    const monthHeader = document.createElement('div')
    monthHeader.classList.add('payment-month-header')
    monthHeader.innerHTML = `
      <h5 class="mt-3 mb-2 border-bottom pb-2 text-primary">${month}</h5>
    `
    paymentsListContainer.appendChild(monthHeader)

    // Add payment items for this month
    paymentsByMonth[month].forEach(payment => {
      const label = document.createElement('label')
      label.classList.add('d-flex', 'align-items-center', 'mb-2', 'ps-3')

      if (payment.type === 'direct') {
        label.innerHTML = `
          <input
            type="checkbox"
            class="form-check-input me-2"
            value="${payment.mainK}"
            ${payment.isChecked ? 'checked' : ''}
          />
          <span>${payment.displayName}${payment.dateRangeStr}</span>
        `
      } else {
        label.innerHTML = `
          <input
            type="checkbox"
            class="form-check-input me-2"
            value="${payment.mainK}/${payment.subK}"
            ${payment.isChecked ? 'checked' : ''}
          />
          <span>${payment.displayName}${payment.dateRangeStr}</span>
        `
      }

      paymentsListContainer.appendChild(label)
    })
  })

  // Add some styling for the month headers
  const style = document.createElement('style')
  if (!document.getElementById('payment-list-styles')) {
    style.id = 'payment-list-styles'
    style.textContent = `
      .payment-month-header {
        background-color: #f8f9fa;
        margin-bottom: 10px;
      }
      .payment-month-header h5 {
        font-weight: 600;
        color: #0d6efd;
      }
      #paymentsListContainer label:hover {
        background-color: rgba(13, 110, 253, 0.05);
      }
      #selectPaymentsModal .modal-body {
        max-height: 70vh;
        overflow-y: auto;
      }
    `
    document.head.appendChild(style)
  }
}

// Build the invoice table with the selected payments
function buildInvoiceTable(paymentKeys) {
  const invoiceTable = document.getElementById('invoiceTable')
  if (!invoiceTable) return

  const showCostProfit = document.getElementById('showCostProfitCheckbox')
    ? document.getElementById('showCostProfitCheckbox').checked
    : false

  const invoiceThead = invoiceTable.querySelector('thead')
  const invoiceTbody = invoiceTable.querySelector('tbody')
  if (!invoiceThead || !invoiceTbody) return

  let theadHtml = `
    <tr>
      <th>Item</th>
      <th>NAME</th>
      <th>REF.</th>
      <th>Hotel</th>
      <th>Date in PHUKET</th>
      <th>TOUR INCLUDE</th>
      ${showCostProfit ? `<th>Cost</th><th>PRICE</th><th>Profit</th>` : `<th>PRICE</th>`}
      <th>Fee</th>
      <th>Unit</th>
      <th>TOTAL</th>
    </tr>
  `
  invoiceThead.innerHTML = theadHtml

  invoiceTbody.innerHTML = ''

  const summaryContainer = document.getElementById('summaryCostProfitContainer')
  if (summaryContainer) {
    summaryContainer.style.display = showCostProfit ? 'block' : 'none'
  }

  if (!paymentKeys || paymentKeys.length === 0) {
    invoiceTbody.innerHTML = `
      <tr>
        <td colspan="${showCostProfit ? 12 : 10}" class="text-center text-danger">
          No Payments Selected
        </td>
      </tr>
    `
    return
  }

  let itemCount = 0
  let grandTotal = 0

  let totalCostSum = 0
  let totalSellingSum = 0
  let totalProfitSum = 0

  const refMap = {}

  paymentKeys.forEach(combinedKey => {
    let payment
    if (combinedKey && combinedKey.includes('/')) {
      const [mainK, subK] = combinedKey.split('/')
      payment = allPaymentsData[mainK] ? allPaymentsData[mainK][subK] : null
    } else if (combinedKey) {
      payment = allPaymentsData[combinedKey]
    }

    if (!payment) return

    itemCount++

    let bookingsArr = []
    if (Array.isArray(payment.bookings)) {
      bookingsArr = payment.bookings
    } else if (payment.bookings && typeof payment.bookings === 'object') {
      bookingsArr = Object.values(payment.bookings)
    }

    if (!bookingsArr || bookingsArr.length === 0) {
      const tr = document.createElement('tr')
      tr.innerHTML = `
      <td>${itemCount}</td>
      <td class="nameCell">${nameText}</td>
      <td class="refCell" data-key="${refKey}">${refMap[refKey]}</td>
      <td class="hotelCell">${hotelText}</td>
      <td>${formatDate(bookingDate)}</td>
      <td class="text-start tour-include-cell">${detailText}</td>
      <td>${formatNumberWithCommas(priceVal)}</td>
      <td>${formatNumberWithCommas(feeVal)}</td>
      <td>${unitVal}</td>
      <td>${formatNumberWithCommas(rowTotal)}</td>
    `
      invoiceTbody.appendChild(tr)
      return
    }

    // Get customer name and agent
    let firstName = payment.customer?.firstName || ''
    let lastName = payment.customer?.lastName || ''
    let pax = payment.customer?.pax || ''

    let agent = ''
    if (payment.customer && payment.customer.agent) {
      agent = payment.customer.agent
    } else if (payment.orderID) {
      // Try to extract from orderID if customer.agent not found
      const orderParts = payment.orderID.split('-')
      if (orderParts.length >= 2) {
        if (orderParts[0] === 'INDO' && orderParts.length >= 3) {
          agent = `${orderParts[0]}/${orderParts[1]}`
        } else {
          agent = orderParts[0]
        }
      }
    }
    // Format agent display
    let agentDisplay = ''
    if (agent && agent.trim() !== '') {
      // Handle different agent formats
      if (agent.startsWith('INDO-')) {
        // Convert INDO-AGENT to INDO/AGENT for display
        agent = agent.replace('INDO-', 'INDO/')
      }
      agentDisplay = ` (${agent})`
    }

    const nameText = `${firstName} ${lastName} / ${pax}${agentDisplay}`.trim()

    const refKey = combinedKey
    refMap[refKey] = payment.ref || '-'

    // Determine hotel name - try to find a non-empty hotel value across all bookings
    let hotelText = '-'
    for (const bk of bookingsArr) {
      if (bk.type === 'tour' && bk.tourHotel && bk.tourHotel.trim() !== '') {
        hotelText = bk.tourHotel
        break
      } else if (bk.type === 'transfer' && bk.transferHotel && bk.transferHotel.trim() !== '') {
        hotelText = bk.transferHotel
        break
      } else if (bk.hotel && bk.hotel.trim() !== '') {
        hotelText = bk.hotel
        break
      }
    }

    let paymentRowTotalSum = 0

    bookingsArr.sort((a, b) => {
      const dateA = a.date || a.tourDate || a.transferDate || ''
      const dateB = b.date || b.tourDate || b.transferDate || ''
      if (!dateA) return 1
      if (!dateB) return -1
      return new Date(dateA) - new Date(dateB)
    })

    const rowSpanCount = bookingsArr.length

    let orderCostSum = 0
    let orderPriceSum = 0
    let orderProfitSum = 0

    bookingsArr.forEach((bk, index) => {
      const unitVal = bk.quantity ?? 0
      const priceVal = bk.sellingPrice || 0
      const costVal = bk.totalCostin ?? 0
      const rowTotal = priceVal * unitVal
      const profitVal = rowTotal - costVal
      const feeVal = bk.fee ?? 0

      paymentRowTotalSum += rowTotal

      const detailText = bk.detail || '-'
      const typeText = bk.type || bk.bookingType || '-'
      const bookingDate = bk.date || bk.tourDate || bk.transferDate || '-'

      orderCostSum += costVal
      orderPriceSum += rowTotal
      orderProfitSum += profitVal

      totalCostSum += costVal
      totalSellingSum += rowTotal
      totalProfitSum += profitVal

      const tr = document.createElement('tr')

      if (index === 0) {
        tr.innerHTML = `
          <td rowspan="${rowSpanCount}">${itemCount}</td>
          <td rowspan="${rowSpanCount}" class="nameCell">${nameText}</td>
          <td rowspan="${rowSpanCount}" class="refCell" data-key="${refKey}">
            ${refMap[refKey]}
          </td>
          <td rowspan="${rowSpanCount}" class="hotelCell">${hotelText}</td>
    
          <td>${formatDate(bookingDate)}</td>
          <td class="text-start tour-include-cell">${detailText} </td>
    
          ${
            showCostProfit
              ? `
                <td>${formatNumberWithCommas(costVal)}</td>
                <td>${formatNumberWithCommas(priceVal)}</td>
                <td>${formatNumberWithCommas(profitVal)}</td>
              `
              : `
                <td>${formatNumberWithCommas(priceVal)}</td>
              `
          }
    
          <td class="feeCell" data-key="${combinedKey}" data-bk-index="${index}">
            ${formatNumberWithCommas(feeVal)}
          </td>
    
          <td>${unitVal}</td>
          <td>${formatNumberWithCommas(rowTotal)}</td>
        `
      } else {
        tr.innerHTML = `
          <td>${formatDate(bookingDate)}</td>
          <td class="text-start tour-include-cell">${detailText} </td>
    
          ${
            showCostProfit
              ? `
                <td>${formatNumberWithCommas(costVal)}</td>
                <td>${formatNumberWithCommas(priceVal)}</td>
                <td>${formatNumberWithCommas(profitVal)}</td>
              `
              : `
                <td>${formatNumberWithCommas(priceVal)}</td>
              `
          }
    
          <td class="feeCell" data-key="${combinedKey}" data-bk-index="${index}">
            ${formatNumberWithCommas(feeVal)}
          </td>
    
          <td>${unitVal}</td>
          <td>${formatNumberWithCommas(rowTotal)}</td>
        `
      }

      invoiceTbody.appendChild(tr)
    })

    if (showCostProfit) {
      const cpRow = document.createElement('tr')
      cpRow.innerHTML = `
        <td colspan="6" class="text-end fw-bold text-secondary">
          Sub-Total (Cost/Price/Profit)
        </td>
        <td class="fw-bold text-info">
          ${formatNumberWithCommas(orderCostSum)}
        </td>
        <td class="fw-bold text-primary">
          ${formatNumberWithCommas(orderPriceSum)}
        </td>
        <td class="fw-bold text-success">
          ${formatNumberWithCommas(orderProfitSum)}
        </td>
        <td colspan="2"></td>
      `
      invoiceTbody.appendChild(cpRow)
    }

    const totalRow = document.createElement('tr')
    totalRow.innerHTML = `
      <td colspan="${showCostProfit ? 10 : 8}" class="text-end fw-bold">
        Total Amount
      </td>
      <td class="fw-bold" colspan="2">
        ${formatNumberWithCommas(paymentRowTotalSum)}
      </td>
    `
    invoiceTbody.appendChild(totalRow)

    grandTotal += paymentRowTotalSum
  })

  const grandRow = document.createElement('tr')
  grandRow.innerHTML = `
    <td colspan="${showCostProfit ? 10 : 8}" class="text-end fw-bold text-success">
      GRAND TOTAL
    </td>
    <td class="fw-bold text-success" colspan="2">
      ${formatNumberWithCommas(grandTotal)}
    </td>
  `
  invoiceTbody.appendChild(grandRow)

  const grandTotalDisplay = document.getElementById('grandTotalDisplay')
  if (grandTotalDisplay) {
    grandTotalDisplay.textContent = `GRAND TOTAL: ${formatNumberWithCommas(grandTotal)} THB`
  }

  if (showCostProfit) {
    if (summaryContainer) {
      const totalCostEl = document.getElementById('totalCost')
      const totalSellingEl = document.getElementById('totalSellingPrice')
      const totalProfitEl = document.getElementById('totalProfit')

      if (totalCostEl) totalCostEl.textContent = formatNumberWithCommas(totalCostSum)
      if (totalSellingEl) totalSellingEl.textContent = formatNumberWithCommas(totalSellingSum)
      if (totalProfitEl) totalProfitEl.textContent = formatNumberWithCommas(totalProfitSum)
    }
  }

  enableRefEdit()
  enableFeeEdit()
}

// Save REF values to the database
async function storeRefInDB(mainKey, subKey, newVal) {
  try {
    let refPath
    if (subKey) {
      refPath = ref(database, `payments/${mainKey}/${subKey}/ref`)
    } else {
      refPath = ref(database, `payments/${mainKey}/ref`)
    }
    await set(refPath, newVal)
    return true
  } catch (error) {
    console.error('Error saving REF to database:', error)
    return false
  }
}

// Enable REF cell editing
function enableRefEdit() {
  const invoiceTbody = document.querySelector('#invoiceTable tbody')
  if (!invoiceTbody) return

  const refCells = invoiceTbody.querySelectorAll('.refCell')
  refCells.forEach(cell => {
    cell.addEventListener('dblclick', () => {
      const oldText = cell.textContent.trim()
      const combinedKey = cell.dataset.key
      if (!combinedKey) return

      const input = document.createElement('input')
      input.type = 'text'
      input.value = oldText === '-' ? '' : oldText
      input.classList.add('form-control', 'ref-edit-input')

      cell.textContent = ''
      cell.appendChild(input)
      input.focus()

      const saveRef = async () => {
        const newVal = input.value.trim() || '-'

        try {
          showLoadingIndicator(cell, true)

          if (combinedKey.includes('/')) {
            const [mainK, subK] = combinedKey.split('/')
            await storeRefInDB(mainK, subK, newVal)
          } else {
            await storeRefInDB(combinedKey, null, newVal)
          }

          cell.innerHTML = newVal
          showNotification('REF updated successfully', 'success')
        } catch (err) {
          console.error(err)
          showNotification('Failed to save REF', 'error')
          cell.innerHTML = oldText
        } finally {
          showLoadingIndicator(cell, false)
        }
      }

      input.addEventListener('blur', saveRef)
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault()
          saveRef()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cell.innerHTML = oldText
        }
      })
    })
  })
}

// Enable FEE cell editing
function enableFeeEdit() {
  const invoiceTbody = document.querySelector('#invoiceTable tbody')
  if (!invoiceTbody) return

  const feeCells = invoiceTbody.querySelectorAll('.feeCell')
  feeCells.forEach(cell => {
    cell.addEventListener('dblclick', () => {
      const oldText = cell.textContent.replace(/,/g, '').trim()
      const combinedKey = cell.getAttribute('data-key')
      const bkIndex = cell.getAttribute('data-bk-index')

      if (!combinedKey || bkIndex === null || bkIndex === undefined) {
        return
      }

      const inputEl = document.createElement('input')
      inputEl.type = 'text'
      inputEl.value = oldText === '-' ? '' : oldText
      inputEl.classList.add('form-control')
      inputEl.style.maxWidth = '100px'

      cell.textContent = ''
      cell.appendChild(inputEl)
      inputEl.focus()

      const saveFee = async () => {
        const newVal = inputEl.value.trim()
        const numericVal = parseFloat(newVal) || 0

        try {
          showLoadingIndicator(cell, true)

          // Update fee in database
          if (combinedKey.includes('/')) {
            const [mainK, subK] = combinedKey.split('/')
            const feeRef = ref(database, `payments/${mainK}/${subK}/bookings/${bkIndex}/fee`)
            await set(feeRef, numericVal)
          } else {
            const feeRef = ref(database, `payments/${combinedKey}/bookings/${bkIndex}/fee`)
            await set(feeRef, numericVal)
          }

          cell.innerHTML = formatNumberWithCommas(numericVal)
          showNotification('Fee updated successfully', 'success')
        } catch (err) {
          console.error('Error saving fee:', err)
          showNotification('Failed to save Fee', 'error')
          cell.innerHTML = oldText
        } finally {
          showLoadingIndicator(cell, false)
        }
      }

      inputEl.addEventListener('blur', saveFee)
      inputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault()
          saveFee()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cell.innerHTML = formatNumberWithCommas(parseFloat(oldText) || 0)
        }
      })
    })
  })
}

// Enable invoice date editing
function enableInvoiceDateEdit() {
  const dateSpan = document.getElementById('invoiceDateSpan')
  if (!dateSpan) return

  dateSpan.addEventListener('dblclick', () => {
    const oldText = dateSpan.textContent.trim()
    const invoiceKey = dateSpan.getAttribute('data-invoice-key') || ''

    const inputEl = document.createElement('input')
    inputEl.type = 'text'
    inputEl.value = oldText === 'กรุณากรอกวันที่' ? '' : oldText
    inputEl.classList.add('form-control')
    inputEl.style.display = 'inline-block'
    inputEl.style.width = 'auto'

    dateSpan.innerHTML = ''
    dateSpan.appendChild(inputEl)
    inputEl.focus()

    const saveDate = async () => {
      const newVal = inputEl.value.trim() || 'กรุณากรอกวันที่'

      try {
        showLoadingIndicator(dateSpan, true)

        if (invoiceKey === 'temp') {
          draftInvoiceDate = newVal
        } else if (invoiceKey) {
          const dateRef = ref(database, `invoices/${invoiceKey}/invoiceDate`)
          await set(dateRef, newVal)
        }

        dateSpan.textContent = newVal
        showNotification('Invoice date updated', 'success')
      } catch (error) {
        console.error('Error saving invoice date:', error)
        showNotification('Failed to save invoice date', 'error')
        dateSpan.textContent = oldText
      } finally {
        showLoadingIndicator(dateSpan, false)
      }
    }

    inputEl.addEventListener('blur', saveDate)
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault()
        saveDate()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        dateSpan.textContent = oldText
      }
    })
  })
}
// Add this in your invoice.js file
// This creates an emergency close function that can be triggered from the console

window.closeAllModals = function () {
  try {
    // 1. Get all modals
    const modals = document.querySelectorAll('.modal')

    // 2. Remove all backdrops
    const backdrops = document.querySelectorAll('.modal-backdrop')
    backdrops.forEach(backdrop => backdrop.remove())

    // 3. Hide and clean up each modal
    modals.forEach(modal => {
      modal.style.display = 'none'
      modal.classList.remove('show')
      modal.setAttribute('aria-hidden', 'true')
      modal.removeAttribute('aria-modal')
    })

    // 4. Fix the body
    document.body.classList.remove('modal-open')
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''

    console.log('All modals have been forcibly closed')
    return 'Success: All modals closed'
  } catch (error) {
    console.error('Error in emergency modal closing:', error)
    return 'Error: ' + error.message
  }
}

// Add a hidden emergency button for mobile users
document.addEventListener('DOMContentLoaded', function () {
  const emergencyBtn = document.createElement('button')
  emergencyBtn.textContent = 'Emergency Close'
  emergencyBtn.style.position = 'fixed'
  emergencyBtn.style.bottom = '10px'
  emergencyBtn.style.right = '10px'
  emergencyBtn.style.zIndex = '9999'
  emergencyBtn.style.padding = '10px'
  emergencyBtn.style.background = '#dc3545'
  emergencyBtn.style.color = 'white'
  emergencyBtn.style.border = 'none'
  emergencyBtn.style.borderRadius = '5px'
  emergencyBtn.style.display = 'none'

  emergencyBtn.addEventListener('click', function () {
    window.closeAllModals()
    this.style.display = 'none'
  })

  document.body.appendChild(emergencyBtn)

  // Show emergency button after a long press (useful for mobile)
  let pressTimer
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length === 3) {
      // Three finger touch
      pressTimer = window.setTimeout(function () {
        emergencyBtn.style.display = 'block'
      }, 2000) // Show after 2 seconds of three-finger press
    }
  })

  document.addEventListener('touchend', function () {
    clearTimeout(pressTimer)
  })
})

window.lastInvoiceError = null
window.debugInvoice = function (invoiceKey) {
  try {
    console.log('ข้อมูล Invoice ที่กำลังตรวจสอบ:', invoiceKey)

    // ตรวจสอบข้อมูลที่เกี่ยวข้อง
    console.log('Selected Payment Keys:', selectedPaymentKeys)
    console.log('All Payment Data Available:', Object.keys(allPaymentsData).length)

    // ตรวจสอบว่าข้อมูล Payment ที่เลือกมีหรือไม่
    const missingPayments = []
    if (selectedPaymentKeys && selectedPaymentKeys.length > 0) {
      selectedPaymentKeys.forEach(key => {
        let found = false
        if (key.includes('/')) {
          const [mainK, subK] = key.split('/')
          if (allPaymentsData[mainK] && allPaymentsData[mainK][subK]) {
            found = true
            console.log(`Payment ${key} found:`, allPaymentsData[mainK][subK])
          }
        } else {
          if (allPaymentsData[key]) {
            found = true
            console.log(`Payment ${key} found:`, allPaymentsData[key])
          }
        }

        if (!found) {
          missingPayments.push(key)
        }
      })
    }

    if (missingPayments.length > 0) {
      console.error('Missing payments:', missingPayments)
    } else {
      console.log('All payments found successfully!')
    }

    return 'Debug completed. Check console for results.'
  } catch (error) {
    console.error('Debug error:', error)
    window.lastInvoiceError = error
    return 'Error during debug. See console.'
  }
}

// ฟังก์ชันช่วยในการล้างข้อมูลหากมีปัญหา
window.resetInvoiceState = function () {
  try {
    selectedPaymentKeys = []
    draftInvoiceDate = ''

    const invoiceTbody = document.querySelector('#invoiceTable tbody')
    if (invoiceTbody) {
      invoiceTbody.innerHTML = ''
    }

    const grandTotalDisplay = document.getElementById('grandTotalDisplay')
    if (grandTotalDisplay) {
      grandTotalDisplay.textContent = ''
    }

    const invoiceDateSpan = document.getElementById('invoiceDateSpan')
    if (invoiceDateSpan) {
      invoiceDateSpan.textContent = 'กรุณากรอกวันที่'
      invoiceDateSpan.setAttribute('data-invoice-key', '')
    }

    showNotification('ล้างข้อมูล Invoice เรียบร้อยแล้ว', 'success')
    return 'Reset completed'
  } catch (error) {
    console.error('Reset error:', error)
    return 'Error during reset'
  }
}
