import {
  getDatabase,
  ref,
  get,
  update,
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";
import { generateBookingID } from "/js/id.js";

const database = getDatabase();

async function updateOldDataWithNewIDs() {
  try {
    // ดึงข้อมูล Tour Bookings
    const tourRef = ref(database, "tourBookings");
    const tourSnapshot = await get(tourRef);

    if (tourSnapshot.exists()) {
      const tourBookings = tourSnapshot.val();

      for (const [key, booking] of Object.entries(tourBookings)) {
        if (!booking.tourID) {
          // ตรวจสอบว่า ID เก่ายังไม่มี
          const newID = await generateBookingID("tour");
          const updates = {
            [`/tourBookings/${key}/tourID`]: newID,
          };
          await update(ref(database), updates);
          console.log(`Updated Tour ID for booking ${key} to ${newID}`);
        }
      }
    }

    // ดึงข้อมูล Transfer Bookings
    const transferRef = ref(database, "transferBookings");
    const transferSnapshot = await get(transferRef);

    if (transferSnapshot.exists()) {
      const transferBookings = transferSnapshot.val();

      for (const [key, booking] of Object.entries(transferBookings)) {
        if (!booking.transferID) {
          // ตรวจสอบว่า ID เก่ายังไม่มี
          const newID = await generateBookingID("transfer");
          const updates = {
            [`/transferBookings/${key}/transferID`]: newID,
          };
          await update(ref(database), updates);
          console.log(`Updated Transfer ID for booking ${key} to ${newID}`);
        }
      }
    }

    console.log("All old data updated with new IDs.");
  } catch (error) {
    console.error("Error updating old data:", error);
  }
}

// เรียกใช้ฟังก์ชัน
updateOldDataWithNewIDs();

// class Student {
//   constructor(name, age) {
//     this.name = name;
//     this.age = age;
//   }
//   introduce() {
//     console.log(`Hi, I'm ${this.name} and I'm ${this.age} year old.`);
//   }
// }
// const std1 = new Student("John", "18");
// console.log(Student.introduce);
