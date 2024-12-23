import { initializeApp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";


const firebaseConfig = {
  // ... Firebase config ของคุณ
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

async function generateSimpleCode() {
  const lastNumberRef = ref(database, 'lastNumber');
  const snapshot = await get(lastNumberRef);
  
  let lastNumber = 0;
  if (snapshot.exists()) {
    lastNumber = snapshot.val();
  }

  const newNumber = lastNumber + 1;

  // อัพเดต lastNumber ใน Firebase
  await set(lastNumberRef, newNumber);

  // คืนค่าหมายเลขรันเพื่อใช้เป็น Code
  return newNumber; 
}

// เมื่อต้องการนำไปใช้ใน submit ฟอร์ม (Tour หรือ Transfer):
async function handleSubmit() {
  const code = await generateSimpleCode();
  // code จะเป็นตัวเลขเรียงถัดจากเดิม
  const formData = {
    code: code,
    // ...ข้อมูลอื่นๆ
  };

  // บันทึก formData ลงใน Firebase ตามปกติ
}


