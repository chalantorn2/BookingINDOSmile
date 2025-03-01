import {
  ref,
  get,
  update,
  onValue,
  query,
  orderByChild,
  equalTo,
} from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js'
import { database } from '/js/firebase-config.js'

function toYmd(dateObj) {
  const y = dateObj.getFullYear()
  const m = String(dateObj.getMonth() + 1).padStart(2, '0')
  const d = String(dateObj.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function findEarliestLatest(bookings) {
  let earliest = null
  let latest = null

  for (const bk of bookings) {
    let rawDate = null

    if (bk.type === 'tour') {
      rawDate = bk.tourDate
    } else if (bk.type === 'transfer') {
      rawDate = bk.transferDate
    }
    if (!rawDate) continue

    const dt = new Date(rawDate)
    if (isNaN(dt.getTime())) continue

    if (!earliest || dt < earliest) {
      earliest = dt
    }
    if (!latest || dt > latest) {
      latest = dt
    }
  }

  return { earliest, latest }
}

export async function recalcOrderDates(orderKey) {
  try {
    const orderRef = ref(database, `orders/${orderKey}`)
    const orderSnap = await get(orderRef)
    if (!orderSnap.exists()) {
      console.warn(`Order key ${orderKey} not found.`)
      return
    }

    const orderData = orderSnap.val()
    const bookingKeys = orderData.bookings || []
    if (bookingKeys.length === 0) {
      await update(orderRef, { startDate: '', endDate: '' })
      return
    }

    let allBookingData = []
    for (const bkKey of bookingKeys) {
      const tourSnap = await get(ref(database, `tourBookings/${bkKey}`))
      if (tourSnap.exists()) {
        const tData = tourSnap.val()
        tData.type = 'tour'
        allBookingData.push(tData)
        continue
      }

      const transSnap = await get(ref(database, `transferBookings/${bkKey}`))
      if (transSnap.exists()) {
        const fData = transSnap.val()
        fData.type = 'transfer'
        allBookingData.push(fData)
        continue
      }
    }

    const { earliest, latest } = findEarliestLatest(allBookingData)

    let newStart = ''
    let newEnd = ''
    if (earliest) newStart = toYmd(earliest)
    if (latest) newEnd = toYmd(latest)

    await update(orderRef, {
      startDate: newStart,
      endDate: newEnd,
    })

    console.log(`Order ${orderData.id} => startDate=${newStart}, endDate=${newEnd}`)
  } catch (err) {
    console.error('recalcOrderDates error:', err)
  }
}

export function watchBookingChanges() {
  async function findOrderKeyById(orderId) {
    const q = query(ref(database, 'orders'), orderByChild('id'), equalTo(orderId))
    const snap = await get(q)
    if (!snap.exists()) return null
    const foundObj = snap.val()
    const arrKeys = Object.keys(foundObj)
    return arrKeys[0] || null
  }

  const tourRef = ref(database, 'tourBookings')
  onValue(tourRef, async snapshot => {
    if (!snapshot.exists()) return
    const allTour = snapshot.val()

    for (const bkKey of Object.keys(allTour)) {
      const tData = allTour[bkKey]
      if (!tData.orderId) continue

      const orderKey = await findOrderKeyById(tData.orderId)
      if (orderKey) {
        await recalcOrderDates(orderKey)
      }
    }
  })

  const transfRef = ref(database, 'transferBookings')
  onValue(transfRef, async snapshot => {
    if (!snapshot.exists()) return
    const allTrans = snapshot.val()

    for (const bkKey of Object.keys(allTrans)) {
      const fData = allTrans[bkKey]
      if (!fData.orderId) continue

      const orderKey = await findOrderKeyById(fData.orderId)
      if (orderKey) {
        await recalcOrderDates(orderKey)
      }
    }
  })
}
