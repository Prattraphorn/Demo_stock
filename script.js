const API_URL = "https://6971d39532c6bacb12c4a497.mockapi.io/DATA"; 
const HISTORY_URL = "https://6971d39532c6bacb12c4a497.mockapi.io/history"; 
let inventory = [];

function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleString('th-TH', { hour12: false });
    const clockElem = document.getElementById('realTimeClock');
    if (clockElem) clockElem.innerText = `Current Time: ${timeString}`;
}
setInterval(updateClock, 1000);

async function loadData() {
    try {
        const res = await fetch(API_URL);
        inventory = await res.json();
        renderTable(inventory);
    } catch (err) { console.error("Error loading data:", err); }
}

function renderTable(data) {
    const body = document.getElementById('inventoryBody');
    body.innerHTML = '';
    let normal = 0, restock = 0;

    data.forEach((item, index) => {
        const itemId = item.id || item.ID; 
        const isLow = Number(item.qty) <= Number(item.min);
        if (isLow) restock++; else normal++;

        body.innerHTML += `
            <tr class="${isLow ? 'low-stock-row' : ''}">
                <td class="ps-3">${index + 1}</td>
                <td class="fw-bold text-dark">${item.Part || '-'}</td>
                <td>${item.Description || '-'}</td>
                <td>${item.Manufac || '-'}</td>
                <td>${item.remark || '-'}</td>
                <td class="fw-bold ${isLow ? 'text-danger' : 'text-dark'}">${item.qty || 0}</td>
                <td>${item.min || 0}</td>
                <td><span class="status-badge ${isLow ? 'bg-restock' : 'bg-normal'}">${isLow ? 'RESTOCK' : 'NORMAL'}</span></td>
                <td class="text-center">
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-success" onclick="updateStock('${itemId}', 'in')">In</button>
                        <button class="btn btn-sm btn-outline-warning" onclick="updateStock('${itemId}', 'out')">Out</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteItem('${itemId}')">Delete</button>
                    </div>
                </td>
            </tr>`;
    });
    document.getElementById('normalCount').innerText = normal;
    document.getElementById('restockCount').innerText = restock;
}


async function updateStock(id, type) {

    const item = inventory.find(i => String(i.id || i.ID) === String(id));
    if (!item) return;

    const { value: formValues } = await Swal.fire({
        title: type === 'in' ? 'Stock In (เติมของ)' : 'Stock Out (เบิกของ)',
        html: `
            <div class="text-start mb-2"><small>Item: ${item.Part}</small></div>
            <input id="swal-amount" type="number" class="swal2-input" placeholder="Qty">
            ${type === 'out' ? '<input id="swal-detail" class="swal2-input" placeholder="Description">' : ''}`,
        showCancelButton: true,
        confirmButtonColor: '#2d5a27',
        preConfirm: () => {
            const amount = document.getElementById('swal-amount').value;
            const detailElem = document.getElementById('swal-detail');
            const detail = detailElem ? detailElem.value : 'Restock';
            
            if (!amount || Number(amount) <= 0) {
                return Swal.showValidationMessage('Please enter a valid quantity');
            }
            return { amount: Number(amount), detail };
        }
    });

    if (formValues) {
        let currentQty = Number(item.qty);
        let newQty = type === 'in' ? currentQty + formValues.amount : currentQty - formValues.amount;
        
        if (newQty < 0) return Swal.fire('Error', 'Stock limit exceeded!', 'error');

        try {
            
            await fetch(`${API_URL}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...item, qty: newQty })
            });

            await fetch(HISTORY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    Part: item.Part,
                    Manufac: item.Manufac || '-', 
                    remark: item.remark || '-',   
                    type: type.toUpperCase(),
                    amount: formValues.amount,
                    detail: formValues.detail,     
                    timestamp: new Date().toLocaleString('th-TH')

                })
            });

            await Swal.fire({ icon: 'success', title: 'Done!', timer: 800, showConfirmButton: false });
            loadData();
        } catch (err) {
            Swal.fire('Error', 'Save failed', 'error');
        }
    }
}


async function deleteItem(id) {
    if (!id) return;

    const result = await Swal.fire({
        title: 'Confirm Deletion?',
        text: "This data will be permanently removed!",
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#2d5a27',
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`${API_URL}/${id}`, { 
                method: 'DELETE' 
            });
            
            if (response.ok) {
                await Swal.fire({
                    title: 'Successfully Deleted!',
                    timer: 1000,
                    showConfirmButton: false
                });
                loadData(); 
            } else {
                alert('Delete Failed: ' + response.status);
            }
        } catch (err) {
            console.error("Delete error:", err);
        }
    }
}

function filterByStatus(status, btn) {
    const buttons = document.querySelectorAll('.btn-group .btn');
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    let filteredData = [];
    if (status === 'all') {
        filteredData = inventory;
    } else if (status === 'normal') {
        filteredData = inventory.filter(item => Number(item.qty) > Number(item.min));
    } else if (status === 'restock') {
        filteredData = inventory.filter(item => Number(item.qty) <= Number(item.min));
    }

    renderTable(filteredData);
}


async function addNewItem() {
    const { value: v } = await Swal.fire({
        title: 'Add New Item',
        html: `
            <input id="p" class="swal2-input" placeholder="Part">
            <input id="d" class="swal2-input" placeholder="Description">
            <input id="m" class="swal2-input" placeholder="Manufacturer">
            <input id="r" class="swal2-input" placeholder="Remark"> <input id="q" type="number" class="swal2-input" placeholder="Qty">
            <input id="min" type="number" class="swal2-input" placeholder="Min Alert">`,
        preConfirm: () => {
            const data = {
                Part: document.getElementById('p').value,
                Description: document.getElementById('d').value,
                Manufac: document.getElementById('m').value,
                remark: document.getElementById('r').value, 
                qty: Number(document.getElementById('q').value),
                min: Number(document.getElementById('min').value)
            };
            if (!data.Part || isNaN(data.qty)) return Swal.showValidationMessage('All fields are required');
            return data;
        }
    });

    if (v) {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(v)
        });
        loadData();
    }
}

function showHistory() {
    loadHistory();
    const myModal = new bootstrap.Modal(document.getElementById('historyModal'));
    myModal.show();
}

async function loadHistory() {
    const body = document.getElementById('historyBody');
    body.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
    try {
        const res = await fetch(HISTORY_URL);
        const historyData = await res.json();
        body.innerHTML = '';
        
        // เรียงลำดับจากล่าสุดขึ้นก่อน
        historyData.reverse().slice(0, 50).forEach(h => {
            // ปรับลำดับ <td> ให้ตรงกับหัวตาราง: Time, Part, Manufac, Remark, Type, Qty, Detail
            body.innerHTML += `
                <tr>
                    <td style="font-size: 0.8rem;">${h.timestamp || '-'}</td>
                    <td><b>${h.Part || '-'}</b></td>
                    <td>${h.Manufac || '-'}</td>
                    <td class="text-muted small">${h.remark || '-'}</td>
                    <td>
                        <span class="badge ${h.type === 'IN' ? 'bg-success' : 'bg-warning text-dark'}">
                            ${h.type || '-'}
                        </span>
                    </td>
                    <td class="fw-bold">${h.amount || 0}</td>
                    <td class="text-muted small">${h.detail || '-'}</td>
                </tr>`;
        });
    } catch (err) { 
        console.error("Load History Error:", err);
        body.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading history</td></tr>';
    }
}

function searchData() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    const filtered = inventory.filter(i => 
        (i.Part && i.Part.toLowerCase().includes(term)) || 
        (i.Description && i.Description.toLowerCase().includes(term)) ||
        (i.remark && i.remark.toLowerCase().includes(term))
    );
    renderTable(filtered);
}

loadData();
