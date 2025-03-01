import { database } from '/js/firebase-config.js'
import { ref, get, set, push } from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js'

function formatNumberWithCommas(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function parseDateStr(dateStr) {
  if (!dateStr) return null
  const [d, m, y] = dateStr.split('/')
  if (!d || !m || !y) return null
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
}

function formatToShortThaiDate(dateObj) {
  if (!dateObj) return '-'
  const day = dateObj.getDate()
  const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase()
  const year = (dateObj.getFullYear() % 100).toString().padStart(2, '0')
  return `${day} ${month} ${year}`
}

let allPaymentsData = {}
let allTourBookingsData = {}
let allTransferBookingsData = {}

let selectedPaymentKeys = []
let draftInvoiceDate = ''

document.addEventListener('DOMContentLoaded', async () => {
  const selectPaymentsBtn = document.getElementById('selectPaymentsBtn')
  const confirmSelectBtn = document.getElementById('confirmSelectBtn')
  const printBtn = document.getElementById('printBtn')
  const saveInvoiceBtn = document.getElementById('saveInvoiceBtn')

  const invoiceTbody = document.querySelector('#invoiceTable tbody')
  const grandTotalDisplay = document.getElementById('grandTotalDisplay')

  const selectPaymentsModalEl = document.getElementById('selectPaymentsModal')
  const selectPaymentsModal = new bootstrap.Modal(selectPaymentsModalEl, {
    backdrop: 'static',
    keyboard: false,
  })
  const paymentsListContainer = document.getElementById('paymentsListContainer')

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print()
    })
  }

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

  selectPaymentsBtn.addEventListener('click', () => {
    buildPaymentsList()
    selectPaymentsModal.show()
  })

  confirmSelectBtn.addEventListener('click', () => {
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

  function buildPaymentsList() {
    paymentsListContainer.innerHTML = ''
    let hasAny = false

    const mainKeys = Object.keys(allPaymentsData).sort()
    mainKeys.forEach(mainK => {
      const payment = allPaymentsData[mainK]
      if (!payment || typeof payment !== 'object') return

      // กรณีเป็น payment โดยตรง (ไม่มี subK)
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

        const label = document.createElement('label')
        label.classList.add('d-flex', 'align-items-center', 'mb-2')
        label.innerHTML = `
          <input
            type="checkbox"
            class="form-check-input me-2"
            value="${mainK}"
            ${selectedPaymentKeys.includes(mainK) ? 'checked' : ''}
          />
          <span>${displayName}</span>
        `
        paymentsListContainer.appendChild(label)
      } else {
        // กรณีมี subK (โค้ดเดิม)
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

          const label = document.createElement('label')
          label.classList.add('d-flex', 'align-items-center', 'mb-2')
          label.innerHTML = `
            <input
              type="checkbox"
              class="form-check-input me-2"
              value="${mainK}/${subK}"
              ${selectedPaymentKeys.includes(`${mainK}/${subK}`) ? 'checked' : ''}
            />
            <span>${displayName}</span>
          `
          paymentsListContainer.appendChild(label)
        })
      }
    })

    if (!hasAny) {
      paymentsListContainer.innerHTML = `
        <div class="alert alert-warning">No Payments Found</div>
      `
    }
  }

  const refMap = {}

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
      if (combinedKey.includes('/')) {
        const [mainK, subK] = combinedKey.split('/')
        payment = allPaymentsData[mainK][subK]
      } else {
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
       <td>NAME ???</td>
       <td>REF ???</td>
       <td colspan="${showCostProfit ? 9 : 7}" class="text-danger">
         No bookings found
       </td>
     `
        invoiceTbody.appendChild(tr)
        return
      }

      let firstName = payment.customer?.firstName || ''
      let lastName = payment.customer?.lastName || ''
      let pax = payment.customer?.pax || ''
      const nameText = `${firstName} ${lastName} / ${pax}`.trim()

      const refKey = combinedKey
      refMap[refKey] = payment.ref || '-'

      let hotelText = '-'
      // วนลูปหาในทุกการจอง
      for (const booking of bookingsArr) {
        // เช็คจาก payments structure ใหม่
        if (booking.hotel && booking.hotel.trim() !== '') {
          hotelText = booking.hotel
          break // พบค่าแล้วให้หยุดวนลูป
        }
        // เช็คจาก structure เดิม
        else if (booking.type === 'tour' && booking.tourHotel && booking.tourHotel.trim() !== '') {
          hotelText = booking.tourHotel
          break
        } else if (booking.type === 'transfer' && booking.transferHotel && booking.transferHotel.trim() !== '') {
          hotelText = booking.transferHotel
          break
        }
      }

      let paymentRowTotalSum = 0

      bookingsArr.sort((a, b) => {
        const dateA = a.tourDate || a.transferDate
        const dateB = b.tourDate || b.transferDate
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
        const priceVal = bk.sellingPrice
        const costVal = bk.totalCostin ?? 0
        const rowTotal = priceVal * unitVal
        const profitVal = rowTotal - costVal
        const feeVal = bk.fee ?? 0

        paymentRowTotalSum += rowTotal

        const detailText = bk.detail || '-'
        const typeText = bk.type || bk.bookingType || '-'
        const bookingDate = bk.tourDate || bk.transferDate || '-'

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
         <td class="text-start">${detailText} </td>
   
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
         <td class="text-start">${detailText} </td>
   
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

    enableRefEdit?.()
    enableFeeEdit?.()
  }

  const viewSelectedInvoiceBtn = document.getElementById('viewSelectedInvoiceBtn')
  if (viewSelectedInvoiceBtn) {
    viewSelectedInvoiceBtn.addEventListener('click', async () => {
      const invoicesSelect = document.getElementById('invoicesSelect')
      if (!invoicesSelect.value) {
        alert('กรุณาเลือก Invoice ก่อน')
        return
      }
      const invoiceKey = invoicesSelect.value

      const invoiceSnap = await get(ref(database, 'invoices/' + invoiceKey))
      if (!invoiceSnap.exists()) {
        alert('ไม่พบข้อมูล Invoice นี้')
        return
      }
      const invoiceObj = invoiceSnap.val()

      if (!invoiceObj.selectedPaymentKeys || !Array.isArray(invoiceObj.selectedPaymentKeys)) {
        alert('Invoice นี้ไม่มี selectedPaymentKeys')
        return
      }

      console.log('Load Invoice:', invoiceKey, invoiceObj)
      document.getElementById('showCostProfitCheckbox').checked = false
      selectedPaymentKeys = invoiceObj.selectedPaymentKeys || []

      buildInvoiceTable(invoiceObj.selectedPaymentKeys)

      const invoiceDateSpan = document.getElementById('invoiceDateSpan')
      if (invoiceDateSpan) {
        if (invoiceObj.invoiceDate) {
          invoiceDateSpan.textContent = invoiceObj.invoiceDate
        } else {
          invoiceDateSpan.textContent = 'กรุณากรอกวันที่'
        }

        invoiceDateSpan.setAttribute('data-invoice-key', invoiceKey)
      }

      enableInvoiceDateEdit?.()

      const viewInvoiceModalEl = document.getElementById('viewInvoiceModal')
      const viewInvoiceModal = bootstrap.Modal.getInstance(viewInvoiceModalEl)
      viewInvoiceModal.hide()

      if (exportCsvBtn) exportCsvBtn.disabled = false
    })
  }
  async function storeRefInDB(mainKey, subKey, newVal) {
    let refPath
    if (subKey) {
      refPath = ref(database, `payments/${mainKey}/${subK}/ref`)
    } else {
      refPath = ref(database, `payments/${mainKey}/ref`)
    }
    await set(refPath, newVal)
  }

  function enableRefEdit() {
    const refCells = invoiceTbody.querySelectorAll('.refCell')
    refCells.forEach(cell => {
      cell.addEventListener('dblclick', () => {
        const oldText = cell.textContent.trim()
        const combinedKey = cell.dataset.key
        if (!combinedKey) return

        const input = document.createElement('input')
        input.type = 'text'
        input.value = oldText === '-' ? '' : oldText
        input.classList.add('form-control')
        input.style.maxWidth = '120px'

        cell.textContent = ''
        cell.appendChild(input)
        input.focus()

        const saveRef = async () => {
          const newVal = input.value.trim() || '-'
          cell.innerHTML = newVal

          try {
            if (combinedKey.includes('/')) {
              const [mainK, subK] = combinedKey.split('/')
              await storeRefInDB(mainK, subK, newVal)
            } else {
              await storeRefInDB(combinedKey, null, newVal)
            }
          } catch (err) {
            console.error(err)
            alert('ไม่สามารถบันทึก REF ได้')
          }
        }

        input.addEventListener('blur', saveRef)
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            saveRef()
          }
        })
      })
    })
  }

  if (saveInvoiceBtn) {
    saveInvoiceBtn.addEventListener('click', async () => {
      if (!draftInvoiceDate || draftInvoiceDate === 'กรุณากรอกวันที่') {
        alert('กรุณากรอกวันที่ก่อนบันทึก Invoice')
        return
      }

      const invoiceName = prompt('กรุณาตั้งชื่อ Invoice:')
      if (!invoiceName) {
        alert('คุณยังไม่ได้ตั้งชื่อ Invoice')
        return
      }

      const invoicesRef = ref(database, 'invoices')
      const newInvoiceRef = push(invoicesRef)

      const invoicePayload = {
        invoiceName: invoiceName,
        createdAt: new Date().toISOString(),
        selectedPaymentKeys,
        invoiceDate: draftInvoiceDate || 'กรุณากรอกวันที่',
      }

      try {
        await set(newInvoiceRef, invoicePayload)

        // อัพเดท invoiced status
        for (let ck of selectedPaymentKeys) {
          let paymentRef
          if (ck.includes('/')) {
            const [mk, sk] = ck.split('/')
            paymentRef = ref(database, `payments/${mk}/${sk}/invoiced`)
          } else {
            paymentRef = ref(database, `payments/${ck}/invoiced`)
          }
          await set(paymentRef, true)
        }

        alert(`บันทึก Invoice เรียบร้อย! InvoiceName: ${invoiceName}`)
      } catch (err) {
        console.error(err)
        alert('เกิดข้อผิดพลาดในการบันทึก Invoice')
      }
    })
  }
  document.getElementById('showCostProfitCheckbox')?.addEventListener('change', () => {
    if (selectedPaymentKeys && selectedPaymentKeys.length > 0) {
      buildInvoiceTable(selectedPaymentKeys)
    }
  })

  function setupRefEdit() {
    const refCells = invoiceTbody.querySelectorAll('.refCell')
    refCells.forEach(cell => {
      cell.addEventListener('dblclick', () => {
        const currentRef = cell.getAttribute('data-ref') || '-'

        const inputEl = document.createElement('input')
        inputEl.type = 'text'
        inputEl.value = currentRef
        inputEl.classList.add('ref-edit-input')

        cell.innerHTML = ''
        cell.appendChild(inputEl)
        inputEl.focus()

        const finalize = () => {
          const newVal = inputEl.value.trim() || '-'
          cell.setAttribute('data-ref', newVal)
          cell.textContent = newVal
        }
        inputEl.addEventListener('blur', finalize)
        inputEl.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            finalize()
          }
        })
      })
    })
  }
  async function storeFeeInDB(mainKey, subKey, bookingIndex, feeValue) {
    const feeRef = ref(database, `payments/${mainKey}/${subKey}/bookings/${bookingIndex}/fee`)

    const numericFee = parseFloat(feeValue) || 0
    await set(feeRef, numericFee)
  }

  function enableFeeEdit() {
    const invoiceTbody = document.querySelector('#invoiceTable tbody')
    if (!invoiceTbody) return

    const feeCells = invoiceTbody.querySelectorAll('.feeCell')
    feeCells.forEach(cell => {
      cell.addEventListener('dblclick', () => {
        const oldText = cell.textContent.replace(/,/g, '').trim()
        const combinedKey = cell.getAttribute('data-key')
        const bkIndex = cell.getAttribute('data-bk-index')

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
          cell.innerHTML = newVal

          try {
            // แยก key และอัพเดท fee
            if (combinedKey.includes('/')) {
              const [mainK, subK] = combinedKey.split('/')
              const feeRef = ref(database, `payments/${mainK}/${subK}/bookings/${bkIndex}/fee`)
              await set(feeRef, newVal)
            } else {
              const feeRef = ref(database, `payments/${combinedKey}/bookings/${bkIndex}/fee`)
              await set(feeRef, newVal)
            }
          } catch (err) {
            console.error('Error saving fee:', err)
            alert('ไม่สามารถบันทึก Fee ได้')
          }
        }

        inputEl.addEventListener('blur', saveFee)
        inputEl.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            saveFee()
          }
        })
      })
    })
  }
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
        dateSpan.textContent = newVal

        if (invoiceKey === 'temp') {
          draftInvoiceDate = newVal
        } else {
          const dateRef = ref(database, `invoices/${invoiceKey}/invoiceDate`)
          await set(dateRef, newVal)
        }
      }

      inputEl.addEventListener('blur', saveDate)
      inputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault()
          saveDate()
        }
      })
    })
  }

  const addPaymentBtn = document.getElementById('addPaymentBtn')
  if (addPaymentBtn) {
    addPaymentBtn.addEventListener('click', () => {
      setupAddPaymentModal()
      openAddPaymentModal()
    })
  }
  const saveEditInvoiceBtn = document.getElementById('saveEditInvoiceBtn')
  if (saveEditInvoiceBtn) {
    saveEditInvoiceBtn.addEventListener('click', () => {
      saveEditInvoice()
    })
  }
  document.getElementById('editInvoiceBtn').addEventListener('click', () => {
    openEditInvoiceModal()
  })
})
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

  const invoicesSnap = await get(ref(database, 'invoices'))
  if (!invoicesSnap.exists()) return

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
    if (!selectedOption) return

    let invoiceKey = selectedOption.dataset.key
    loadInvoiceForEdit(invoiceKey)
  })
}

async function loadInvoiceForEdit(k) {
  const snap = await get(ref(database, 'invoices/' + k))
  if (!snap.exists()) return
  const invObj = snap.val()
  currentEditingInvoiceKey = k
  currentEditingPayments = []
  if (invObj.selectedPaymentKeys && Array.isArray(invObj.selectedPaymentKeys)) {
    currentEditingPayments = invObj.selectedPaymentKeys.slice()
  }
  buildSelectedPaymentsList()
}

function movePaymentUp(idx) {
  if (idx <= 0) return
  let tmp = currentEditingPayments[idx]
  currentEditingPayments[idx] = currentEditingPayments[idx - 1]
  currentEditingPayments[idx - 1] = tmp
  buildSelectedPaymentsList()
}
let addPaymentModal
function setupAddPaymentModal() {
  if (!addPaymentModal) {
    const el = document.getElementById('addPaymentModal')
    addPaymentModal = new bootstrap.Modal(el, { backdrop: 'static' })
  }
}
function movePaymentDown(idx) {
  if (idx >= currentEditingPayments.length - 1) return
  let tmp = currentEditingPayments[idx]
  currentEditingPayments[idx] = currentEditingPayments[idx + 1]
  currentEditingPayments[idx + 1] = tmp
  buildSelectedPaymentsList()
}

function openAddPaymentModal() {
  buildAddPaymentList()
  addPaymentModal.show()
}

window.deletePaymentFromInvoice = deletePaymentFromInvoice
window.movePaymentUp = movePaymentUp
window.movePaymentDown = movePaymentDown
window.addPaymentToInvoice = addPaymentToInvoice
window.setupAddPaymentModal = setupAddPaymentModal
window.openAddPaymentModal = openAddPaymentModal

function buildSelectedPaymentsList() {
  const listEl = document.getElementById('selectedPaymentsList')
  if (!listEl) return
  listEl.innerHTML = ''
  currentEditingPayments.forEach((ck, idx) => {
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

function deletePaymentFromInvoice(idx) {
  currentEditingPayments.splice(idx, 1)
  buildSelectedPaymentsList()
}

function buildAddPaymentList() {
  const addListEl = document.getElementById('addPaymentList')
  if (!addListEl) return
  addListEl.innerHTML = ''

  const mainKeys = Object.keys(allPaymentsData).sort()
  mainKeys.forEach(mk => {
    const payment = allPaymentsData[mk]

    // กรณีเป็น payment โดยตรง (ไม่มี subK)
    if (payment && payment.orderID) {
      if (payment.invoiced === true) return

      let label = ''
      if (payment.customer && payment.customer.firstName) {
        label = payment.customer.firstName
        if (payment.customer.lastName) label += ' ' + payment.customer.lastName
      }

      let li = document.createElement('li')
      li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center')
      li.innerHTML = `
        <span>${label}</span>
        <button class="btn btn-sm btn-primary" onclick="addPaymentToInvoice('${mk}')">Add</button>
      `
      addListEl.appendChild(li)
    }
    // กรณีมี subK
    else if (payment && typeof payment === 'object') {
      const subKeys = Object.keys(payment).sort()
      subKeys.forEach(sk => {
        let pay = payment[sk]
        if (pay.invoiced === true) return

        let label = ''
        if (pay.customer && pay.customer.firstName) {
          label = pay.customer.firstName
          if (pay.customer.lastName) label += ' ' + pay.customer.lastName
        }

        let ck = mk + '/' + sk
        let li = document.createElement('li')
        li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center')
        li.innerHTML = `
          <span>${label}</span>
          <button class="btn btn-sm btn-primary" onclick="addPaymentToInvoice('${ck}')">Add</button>
        `
        addListEl.appendChild(li)
      })
    }
  })
}

function addPaymentToInvoice(ck) {
  if (!currentEditingPayments.includes(ck)) {
    currentEditingPayments.push(ck)
  }
  buildSelectedPaymentsList()
}

async function saveEditInvoice() {
  if (!currentEditingInvoiceKey) return
  let invKey = currentEditingInvoiceKey
  let invRef = ref(database, 'invoices/' + invKey)
  let snapshot = await get(invRef)
  if (!snapshot.exists()) return

  let obj = snapshot.val()
  obj.selectedPaymentKeys = currentEditingPayments.slice()

  for (let ck of currentEditingPayments) {
    if (ck.includes('/')) {
      const [mk, sk] = ck.split('/')
      await set(ref(database, `payments/${mk}/${sk}/invoiced`), true)
    } else {
      await set(ref(database, `payments/${ck}/invoiced`), true)
    }
  }

  await set(invRef, obj)
  editInvoiceModal.hide()
}
function formatDate(dateStr) {
  if (!dateStr || dateStr === '-') return '-'

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const [year, month, day] = dateStr.split('-')
  if (!year || !month || !day) return dateStr

  const shortYear = year.slice(2)
  const shortMonth = months[parseInt(month, 10) - 1]

  return `${day} ${shortMonth} `
}

const exportCsvBtn = document.getElementById('exportCsvBtn')
if (exportCsvBtn) {
  exportCsvBtn.disabled = true

  exportCsvBtn.addEventListener('click', () => {
    exportTableToCSV('invoice_export.csv')
  })
}

function exportTableToCSV(filename) {
  const table = document.getElementById('invoiceTable')
  if (!table) {
    alert('ไม่พบตาราง invoiceTable')
    return
  }
  let csv = []

  for (let i = 0; i < table.rows.length; i++) {
    let row = []
    for (let j = 0; j < table.rows[i].cells.length; j++) {
      let text = table.rows[i].cells[j].innerText.replace(/(\r\n|\n|\r)/gm, '')
      text = text.replace(/"/g, '""')
      row.push(`"${text}"`)
    }
    csv.push(row.join(','))
  }

  const csvString = csv.join('\n')

  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
const viewInvoiceBtn = document.getElementById('viewInvoiceBtn')
if (viewInvoiceBtn) {
  viewInvoiceBtn.addEventListener('click', () => {
    viewInvoiceList()
  })
}

async function viewInvoiceList() {
  const invoicesSnap = await get(ref(database, 'invoices'))
  if (!invoicesSnap.exists()) {
    alert('ยังไม่มี Invoice ใดๆ')
    return
  }
  const invoicesData = invoicesSnap.val()

  const invoicesSelect = document.getElementById('invoicesSelect')
  if (!invoicesSelect) {
    alert('ไม่พบ select #invoicesSelect')
    return
  }
  invoicesSelect.innerHTML = ''

  const invoiceKeys = Object.keys(invoicesData)
  invoiceKeys.forEach(k => {
    const invObj = invoicesData[k]
    const option = document.createElement('option')
    option.value = k
    const invName = invObj.invoiceName || '(NoName)'

    option.textContent = `${invName}`
    invoicesSelect.appendChild(option)
  })

  const viewInvoiceModalEl = document.getElementById('viewInvoiceModal')
  if (!viewInvoiceModalEl) {
    alert('ไม่มี modal #viewInvoiceModal ใน HTML')
    return
  }
  const viewInvoiceModal = new bootstrap.Modal(viewInvoiceModalEl, {
    backdrop: 'static',
    keyboard: false,
  })
  viewInvoiceModal.show()
}

function updateSummary() {
  let sumTotalCost = 0
  let sumCost = 0
  let sumTPrice = 0

  const rows = bookingDetailsTable.querySelectorAll('tr')
  rows.forEach(row => {
    const totalCostCell = row.querySelector('.totalCostCell')
    const tPriceCell = row.querySelector('.tPriceCell')

    if (totalCostCell && tPriceCell) {
      const costValRaw = totalCostCell.textContent.replace(/,/g, '')
      const tPriceValRaw = tPriceCell.textContent.replace(/,/g, '')

      const costVal = parseFloat(costValRaw) || 0
      const tPriceVal = parseFloat(tPriceValRaw) || 0

      sumCost += costVal
      sumTPrice += tPriceVal
    }
  })

  const sumSellingPrice = sumTPrice
  const sumProfit = sumTPrice - sumCost

  totalCost.textContent = '฿' + formatNumberWithCommas(sumCost)
  totalSellingPrice.textContent = '฿' + formatNumberWithCommas(sumSellingPrice)
  totalProfit.textContent = '฿' + formatNumberWithCommas(sumProfit)
}
