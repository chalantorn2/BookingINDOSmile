import { initializeApp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  push,
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";
import { generateBookingID } from "../js/id.js"; // นำเข้า generateBookingID

import { database } from "/js/firebase-config.js";

async function addSampleData() {
  const tourRef = ref(database, "tourBookings");
  const transferRef = ref(database, "transferBookings");

  // const sampleTourData = [
  //   {
  //     tourAgent: "Exclusive Travels",
  //     tourType: "Luxury Retreat",
  //     tourDetail: "5-star spa and wellness experience",
  //     tourFee: "15000",
  //     tourMeal: "All meals included",
  //     tourDate: "2024-12-28",
  //     tourFirstName: "John",
  //     tourLastName: "Doe",
  //     tourPax: 2,
  //     tourHotel: "Royal Spa Hotel",
  //     tourRoomNo: "101",
  //     tourContactNo: "0912345678",
  //     tourPickUpTime: "09:00",
  //     tourSendTo: "Spa Team",
  //     tourNote: "Include welcome drinks",
  //     status: "จองแล้ว",
  //     timestamp: Date.now(),
  //   },
  //   {
  //     tourAgent: "Adventure Co.",
  //     tourType: "Jungle Trekking",
  //     tourDetail: "Explore the lush green forest trails",
  //     tourFee: "8000",
  //     tourMeal: "Lunch provided",
  //     tourDate: "2024-12-28",
  //     tourFirstName: "Alice",
  //     tourLastName: "Smith",
  //     tourPax: 4,
  //     tourHotel: "Forest Camp",
  //     tourRoomNo: "Tent 3",
  //     tourContactNo: "0898765432",
  //     tourPickUpTime: "07:30",
  //     tourSendTo: "Trekking Guide",
  //     tourNote: "Prepare outdoor gear",
  //     status: "รอดำเนินการ",
  //     timestamp: Date.now(),
  //   },
  //   {
  //     tourAgent: "City Vibes",
  //     tourType: "Cultural Tour",
  //     tourDetail: "Visit museums and local markets",
  //     tourFee: "5500",
  //     tourMeal: "Breakfast and snacks",
  //     tourDate: "2024-12-28",
  //     tourFirstName: "Bob",
  //     tourLastName: "Johnson",
  //     tourPax: 3,
  //     tourHotel: "City Inn",
  //     tourRoomNo: "305",
  //     tourContactNo: "0855556789",
  //     tourPickUpTime: "08:00",
  //     tourSendTo: "Culture Team",
  //     tourNote: "Ensure early arrival",
  //     status: "ดำเนินการอยู่",
  //     timestamp: Date.now(),
  //   },
  // ];

  const sampleTransferData = [
    {
      transferAgent: "Airport Shuttle",
      transferType: "Airport Pickup",
      transferDetail: "Transport from airport to city",
      transferFlight: "FL987",
      transferTime: "10:30",
      transferDate: "2024-12-28",
      transferFirstName: "Jane",
      transferLastName: "Doe",
      transferPax: 2,
      transferPickUpTime: "11:00",
      transferPickupFrom: "Airport Terminal 3",
      transferDropTo: "City Center Hotel",
      transferSendTo: "Driver Team",
      transferNote: "Includes bottled water",
      status: "จองแล้ว",
      timestamp: Date.now(),
    },
    {
      transferAgent: "Express Cars",
      transferType: "Hotel to Pier",
      transferDetail: "Fast transport to pier",
      transferFlight: "N/A",
      transferTime: "14:00",
      transferDate: "2024-12-28",
      transferFirstName: "Emily",
      transferLastName: "Clark",
      transferPax: 3,
      transferPickUpTime: "13:30",
      transferPickupFrom: "Hotel Grand",
      transferDropTo: "Pier A",
      transferSendTo: "Pier Team",
      transferNote: "VIP service requested",
      status: "ดำเนินการอยู่",
      timestamp: Date.now(),
    },
    {
      transferAgent: "Tour Bus Co.",
      transferType: "City to Airport",
      transferDetail: "Group transport to airport",
      transferFlight: "FL123",
      transferTime: "18:00",
      transferDate: "2024-12-28",
      transferFirstName: "Mike",
      transferLastName: "Brown",
      transferPax: 10,
      transferPickUpTime: "16:30",
      transferPickupFrom: "Downtown",
      transferDropTo: "Airport Terminal 1",
      transferSendTo: "Airport Coordinator",
      transferNote: "Group checked in",
      status: "รอดำเนินการ",
      timestamp: Date.now(),
    },
  ];

  try {
    // เพิ่ม Tour พร้อม ID
    for (const data of sampleTourData) {
      const bookingID = await generateBookingID("tour"); // สร้าง ID
      const newTourRef = push(tourRef);
      await set(newTourRef, { id: bookingID, ...data }); // เพิ่ม ID เข้าไปในข้อมูล
      console.log("Tour data added with ID:", bookingID);
    }

    // เพิ่ม Transfer พร้อม ID
    for (const data of sampleTransferData) {
      const bookingID = await generateBookingID("transfer"); // สร้าง ID
      const newTransferRef = push(transferRef);
      await set(newTransferRef, { id: bookingID, ...data }); // เพิ่ม ID เข้าไปในข้อมูล
      console.log("Transfer data added with ID:", bookingID);
    }

    console.log("All sample data added successfully!");
  } catch (error) {
    console.error("Error adding sample data:", error);
  }
}

addSampleData();
