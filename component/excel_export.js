// ExcelExportComponent.js
import { getDatabase, ref, query, orderByChild, startAt, endAt, get } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";

class ExcelExportComponent extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <style>
            .export-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                width: 100%;
                margin-bottom: 10px;
            }

            .export-container button {
                font-size: 1rem;
                padding: 10px 15px;
                width: 100%;
                background: #00ac47;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                transition: background 0.3s;
            }

            .export-container button:hover {
                background-color: #00832d;
            }

            .modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 1000;
            }

            .modal-content {
                background: white;
                margin: 10% auto;
                padding: 20px;
                border-radius: 10px;
                width: 90%;
                max-width: 600px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }

            .field-group {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
            }

            .field-selector {
                flex: 1;
                text-align: center;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 5px;
                margin: 0 10px;
                background: #f9f9f9;
            }

            .field-selector label {
                display: block;
                margin-bottom: 5px;
                font-weight: bold;
            }

            .field-selector input {
                margin-right: 5px;
            }

            .modal-footer {
                display: flex;
                justify-content: space-between;
            }

            .modal-footer button {
                flex: 1;
                margin: 0 10px;
                padding: 10px;
                border: none;
                border-radius: 5px;
                font-size: 1rem;
            }

            .btn-confirm {
                background: #28a745;
                color: white;
            }

            .btn-cancel {
                background: #dc3545;
                color: white;
            }
        </style>

        <div class="export-container mt-2">
            <button id="exportExcelBtn">Export as CSV</button>
        </div>

        <!-- Modal -->
        <div id="exportModal" class="modal">
            <div class="modal-content">
                <h4 style="text-align:center; margin-bottom:20px;">Export Options</h4>

                <label for="monthSelector" style="font-weight:bold;">Select Month:</label>
                <select id="monthSelector" style="width:100%; margin-bottom:10px;">
                    <option value="01">January</option>
                    <option value="02">February</option>
                    <option value="03">March</option>
                    <option value="04">April</option>
                    <option value="05">May</option>
                    <option value="06">June</option>
                    <option value="07">July</option>
                    <option value="08">August</option>
                    <option value="09">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                </select>

                <label for="yearSelector" style="font-weight:bold;">Select Year:</label>
                <select id="yearSelector" style="width:100%; margin-bottom:20px;"></select>

                <div class="field-group">
                    <div class="field-selector">
                        <input type="checkbox" id="exportTour" checked />
                        <label for="exportTour">Tour</label>
                        <div id="tourFieldSelector" style="display:block;">
                            <!-- Tour fields dynamically populate here -->
                        </div>
                    </div>
                    <div class="field-selector">
                        <input type="checkbox" id="exportTransfer" checked />
                        <label for="exportTransfer">Transfer</label>
                        <div id="transferFieldSelector" style="display:block;">
                            <!-- Transfer fields dynamically populate here -->
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button id="confirmExport" class="btn-confirm">Export</button>
                    <button id="cancelExport" class="btn-cancel">Cancel</button>
                </div>
            </div>
        </div>
        `;

        this.querySelector('#exportExcelBtn').addEventListener('click', this.showExportModal.bind(this));
        this.populateYearDropdown();
        this.querySelector('#confirmExport').addEventListener('click', this.exportCSV.bind(this));
        this.querySelector('#cancelExport').addEventListener('click', () => {
            document.getElementById('exportModal').style.display = 'none';
        });
    }

    showExportModal() {
        const modal = document.getElementById('exportModal');
        const tourFields = [
            'customerName', 'agent', 'type', 'detail', 'pax', 'fee', 'meal', 'date', 'hotel', 'roomNo', 'contactNo', 'pickUpTime', 'sendTo', 'note', 'status', 'timestamp'
        ];
        const transferFields = [
            'name', 'agent', 'type', 'detail', 'pax', 'flight', 'time', 'date', 'pickUpTime', 'pickupFrom', 'dropTo', 'sendTo', 'note', 'status', 'timestamp'
        ];

        const tourFieldSelector = document.getElementById('tourFieldSelector');
        const transferFieldSelector = document.getElementById('transferFieldSelector');

        tourFieldSelector.innerHTML = '';
        transferFieldSelector.innerHTML = '';

        tourFields.forEach(field => {
            const labelMap = {
                customerName: 'ชื่อลูกค้า',
                agent: 'Agent',
                type: 'ประเภท',
                detail: 'รายละเอียด',
                pax: 'จำนวน',
                fee: 'ค่าทัวร์',
                meal: 'อาหารที่รวม',
                date: 'วันที่',
                hotel: 'โรงแรม',
                roomNo: 'หมายเลขห้อง',
                contactNo: 'เบอร์โทร',
                pickUpTime: 'เวลารับ',
                sendTo: 'ผู้รับ',
                note: 'หมายเหตุ',
                status: 'สถานะ',
                timestamp: 'เวลาเพิ่มข้อมูล'
            };
            const fieldHTML = `<div style='display:flex; align-items:center; margin-bottom:5px;'>
                                <input type="checkbox" id="tour-field-${field}" value="${field}" checked style='margin-right:10px;' /> 
                                <label for="tour-field-${field}" style='font-weight:bold;'>${labelMap[field]}</label>
                              </div>`;
            tourFieldSelector.innerHTML += fieldHTML;
        });

        transferFields.forEach(field => {
            const labelMap = {
                name: 'ชื่อลูกค้า',
                agent: 'Agent',
                type: 'ประเภท',
                detail: 'รายละเอียด',
                pax: 'จำนวน',
                flight: 'เที่ยวบิน',
                time: 'เวลาบิน',
                date: 'วันที่',
                pickUpTime: 'เวลารับ',
                pickupFrom: 'รับจาก',
                dropTo: 'ส่งที่',
                sendTo: 'ผู้รับ',
                note: 'หมายเหตุ',
                status: 'สถานะ',
                timestamp: 'เวลาเพิ่มข้อมูล'
            };
            const fieldHTML = `<div style='display:flex; align-items:center; margin-bottom:5px;'>
                                <input type="checkbox" id="transfer-field-${field}" value="${field}" checked style='margin-right:10px;' /> 
                                <label for="transfer-field-${field}" style='font-weight:bold;'>${labelMap[field]}</label>
                              </div>`;
            transferFieldSelector.innerHTML += fieldHTML;
        });

        document.getElementById('exportTour').addEventListener('change', (e) => {
            tourFieldSelector.style.display = e.target.checked ? 'block' : 'none';
        });

        document.getElementById('exportTransfer').addEventListener('change', (e) => {
            transferFieldSelector.style.display = e.target.checked ? 'block' : 'none';
        });

        modal.style.display = 'block';
    }

    populateYearDropdown() {
        const yearSelector = document.getElementById('yearSelector');
        const currentYear = new Date().getFullYear();
        for (let year = currentYear - 5; year <= currentYear + 5; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) {
                option.selected = true;
            }
            yearSelector.appendChild(option);
        }
    }

    async exportCSV() {
        const month = document.getElementById('monthSelector').value;
        const exportTour = document.getElementById('exportTour').checked;
        const exportTransfer = document.getElementById('exportTransfer').checked;
        const selectedTourFields = Array.from(document.querySelectorAll('#tourFieldSelector input:checked')).map(input => input.value);
        const selectedTransferFields = Array.from(document.querySelectorAll('#transferFieldSelector input:checked')).map(input => input.value);

        if (!exportTour && !exportTransfer) {
            alert('Please select at least one type to export.');
            return;
        }

        const database = getDatabase();
        const year = document.getElementById('yearSelector').value;
        const start = `${year}-${month}-01`;
        const end = `2024-${month}-31`;

        try {
            const tourQuery = exportTour ? query(ref(database, 'tourBookings'), orderByChild('date'), startAt(start), endAt(end)) : null;
            const transferQuery = exportTransfer ? query(ref(database, 'transferBookings'), orderByChild('date'), startAt(start), endAt(end)) : null;

            const [tourSnap, transferSnap] = await Promise.all([
                tourQuery ? get(tourQuery) : Promise.resolve(null),
                transferQuery ? get(transferQuery) : Promise.resolve(null)
            ]);

            const tourData = tourSnap && tourSnap.exists() ? Object.values(tourSnap.val()) : [];
            const transferData = transferSnap && transferSnap.exists() ? Object.values(transferSnap.val()) : [];

            if (tourData.length === 0 && transferData.length === 0) {
                throw new Error('No data available for the selected month.');
            }

            const generateCSVContent = (data, fields) => {
                const headers = fields.map(field => `"${field}"`).join(",");
                let csvContent = `${headers}
`;

                data.forEach(row => {
                    const values = fields.map(field => `"${row[field] || "-"}"`).join(",");
                    csvContent += `${values}
`;
                });

                return csvContent;
            };

            const BOM = '﻿';
            let finalCSV = BOM;

            if (exportTour) {
                finalCSV += `"--- TOUR BOOKINGS ---"
${generateCSVContent(tourData, selectedTourFields)}
`;
            }

            if (exportTransfer) {
                finalCSV += `"--- TRANSFER BOOKINGS ---"
${generateCSVContent(transferData, selectedTransferFields)}
`;
            }

            const blob = new Blob([finalCSV], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `Report_${month}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // alert('Export successful!');
            document.getElementById('exportModal').style.display = 'none';
        } catch (error) {
            console.error('Error exporting data:', error);
            // alert(`Failed to export data: ${error.message}`);
        }
    }
}

customElements.define('excel-export', ExcelExportComponent);
