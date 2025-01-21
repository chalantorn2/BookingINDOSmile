document.addEventListener("DOMContentLoaded", function () {
  const invoiceItems = [
    { id: 1, description: "ทัวร์เกาะพีพี", quantity: 2, unitPrice: 1500 },
    { id: 2, description: "ล่องแพไม้ไผ่", quantity: 1, unitPrice: 800 },
  ];

  function populateInvoice() {
    let tbody = document.getElementById("invoice-items");
    let totalAmount = 0;

    invoiceItems.forEach((item, index) => {
      let row = `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>${item.unitPrice.toLocaleString()}</td>
                    <td>${(
                      item.quantity * item.unitPrice
                    ).toLocaleString()}</td>
                </tr>
            `;
      tbody.innerHTML += row;
      totalAmount += item.quantity * item.unitPrice;
    });

    document.getElementById("total-amount").innerText =
      totalAmount.toLocaleString();
  }

  function printInvoice() {
    window.print();
  }

  populateInvoice();
  window.printInvoice = printInvoice;
});
