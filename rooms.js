// Utility: Toast notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

let allRoomsList = [];
let activeBookingRoom = null;

document.addEventListener('DOMContentLoaded', () => {
    loadRooms();
    initRoomFilters();
    initRoomModal();
    initBookingModal();
});

// Fetch all rooms from Express API
async function loadRooms() {
    const grid = document.getElementById('rooms-grid-container');
    grid.innerHTML = '<p>Loading rooms...</p>';

    try {
        const response = await fetch('/api/rooms');
        const result = await response.json();

        if (result.success) {
            allRoomsList = result.data;
            renderRooms(allRoomsList);
        } else {
            grid.innerHTML = '<p style="color:red;">Error loading rooms</p>';
        }
    } catch (err) {
        grid.innerHTML = '<p style="color:red;">Failed to connect to backend server</p>';
    }
}

// Render room cards dynamically
function renderRooms(rooms) {
    const grid = document.getElementById('rooms-grid-container');
    if (!grid) return;

    if (rooms.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">🏨</div>
                <h3>No Rooms Available</h3>
                <p>Add your first room or adjust filter criteria.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = rooms.map(room => {
        let badgeClass = 'badge-available';
        if (room.status === 'Maintenance') badgeClass = 'badge-maintenance';

        return `
            <div class="room-card" id="room-card-${room.id}">
                <div>
                    <div class="room-header">
                        <span class="room-title">Room ${room.room_number}</span>
                        <span class="badge ${badgeClass}">${room.status}</span>
                    </div>
                    <div class="room-details">
                        <div class="room-type-text">${room.room_type} Room</div>
                        <div class="room-price">₹${room.price.toLocaleString('en-IN')} <span>/ night</span></div>
                        <div class="room-meta">👤 Capacity: ${room.capacity} Guests</div>
                        <p class="room-desc">${room.description || 'No description provided.'}</p>
                    </div>
                </div>
                <div class="room-actions">
                    <button class="btn btn-primary btn-sm" 
                        ${room.status === 'Maintenance' ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} 
                        onclick="triggerBookingModal(${room.id})">
                        Book Now
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="editRoom(${room.id})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteRoom(${room.id}, '${room.room_number}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// Client-side real-time filter logic
function initRoomFilters() {
    const searchInput = document.getElementById('filter-search-room');
    const typeSelect = document.getElementById('filter-room-type');
    const statusSelect = document.getElementById('filter-room-status');
    const resetBtn = document.getElementById('btn-reset-room-filters');

    function applyFilters() {
        const query = searchInput.value.toLowerCase().trim();
        const type = typeSelect.value;
        const status = statusSelect.value;

        const filtered = allRoomsList.filter(room => {
            const matchesQuery = room.room_number.toLowerCase().includes(query) ||
                                 room.room_type.toLowerCase().includes(query) ||
                                 (room.description && room.description.toLowerCase().includes(query));
            const matchesType = (type === 'All') || (room.room_type === type);
            const matchesStatus = (status === 'All') || (room.status === status);

            return matchesQuery && matchesType && matchesStatus;
        });

        renderRooms(filtered);
    }

    searchInput.addEventListener('input', applyFilters);
    typeSelect.addEventListener('change', applyFilters);
    statusSelect.addEventListener('change', applyFilters);

    resetBtn.addEventListener('click', () => {
        searchInput.value = '';
        typeSelect.value = 'All';
        statusSelect.value = 'All';
        renderRooms(allRoomsList);
    });
}

// Add / Edit Room Modal Setup
function initRoomModal() {
    const modal = document.getElementById('room-modal');
    const openBtn = document.getElementById('btn-open-add-room');
    const closeBtn = document.getElementById('btn-close-room-modal');
    const cancelBtn = document.getElementById('btn-cancel-room-modal');
    const form = document.getElementById('room-form');

    const closeModal = () => {
        modal.classList.remove('active');
        form.reset();
        document.getElementById('room-id').value = '';
    };

    openBtn.addEventListener('click', () => {
        document.getElementById('room-modal-title').textContent = 'Add New Room';
        document.getElementById('room-id').value = '';
        form.reset();
        modal.classList.add('active');
    });

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('room-id').value;
        const room_number = document.getElementById('form-room-number').value.trim();
        const room_type = document.getElementById('form-room-type').value;
        const price = parseFloat(document.getElementById('form-room-price').value);
        const capacity = parseInt(document.getElementById('form-room-capacity').value, 10);
        const status = document.getElementById('form-room-status').value;
        const description = document.getElementById('form-room-description').value.trim();

        if (price <= 0 || capacity <= 0) {
            showToast('Price and capacity must be positive numbers.', 'error');
            return;
        }

        const payload = { room_number, room_type, price, capacity, status, description };
        const isEdit = !!id;
        const url = isEdit ? `/api/rooms/${id}` : '/api/rooms';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showToast(isEdit ? '✓ Room updated successfully' : '✓ Room added successfully', 'success');
                closeModal();
                loadRooms();
            } else {
                showToast(`❌ ${result.message}`, 'error');
            }
        } catch (err) {
            showToast('Failed to save room.', 'error');
        }
    });
}

// Pre-fill form for Editing a Room
window.editRoom = async function(id) {
    try {
        const response = await fetch(`/api/rooms/${id}`);
        const result = await response.json();

        if (result.success) {
            const r = result.data;
            document.getElementById('room-id').value = r.id;
            document.getElementById('form-room-number').value = r.room_number;
            document.getElementById('form-room-type').value = r.room_type;
            document.getElementById('form-room-price').value = r.price;
            document.getElementById('form-room-capacity').value = r.capacity;
            document.getElementById('form-room-status').value = r.status;
            document.getElementById('form-room-description').value = r.description || '';

            document.getElementById('room-modal-title').textContent = `Edit Room ${r.room_number}`;
            document.getElementById('room-modal').classList.add('active');
        }
    } catch (err) {
        showToast('Error loading room data', 'error');
    }
};

// Delete a room with confirmation dialog
window.deleteRoom = async function(id, roomNumber) {
    const confirmed = confirm(`Are you sure you want to delete Room ${roomNumber}?`);
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/rooms/${id}`, { method: 'DELETE' });
        const result = await response.json();

        if (response.ok && result.success) {
            showToast(`✓ Room ${roomNumber} deleted successfully`, 'success');
            loadRooms();
        } else {
            showToast(`❌ ${result.message}`, 'error');
        }
    } catch (err) {
        showToast('Failed to connect to server', 'error');
    }
};

// Open Booking Modal for a specific room card
window.triggerBookingModal = function(id) {
    const room = allRoomsList.find(r => r.id === id);
    if (!room) return;

    activeBookingRoom = room;

    document.getElementById('booking-room-id').value = room.id;
    document.getElementById('modal-room-number').textContent = room.room_number;
    document.getElementById('modal-price-per-night').textContent = `₹${room.price.toLocaleString('en-IN')}`;

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const checkInInput = document.getElementById('modal-check-in');
    const checkOutInput = document.getElementById('modal-check-out');

    checkInInput.min = today.toISOString().split('T')[0];
    checkInInput.value = today.toISOString().split('T')[0];

    checkOutInput.min = tomorrow.toISOString().split('T')[0];
    checkOutInput.value = tomorrow.toISOString().split('T')[0];

    document.getElementById('modal-guests').max = room.capacity;
    document.getElementById('modal-guests').value = 1;

    updatePricingCalculations();
    document.getElementById('booking-modal').classList.add('active');
};

// Handle Booking Modal Submission on Rooms Page
function initBookingModal() {
    const modal = document.getElementById('booking-modal');
    const closeBtn = document.getElementById('btn-close-booking-modal');
    const cancelBtn = document.getElementById('btn-cancel-booking-modal');
    const form = document.getElementById('booking-form');
    const checkInInput = document.getElementById('modal-check-in');
    const checkOutInput = document.getElementById('modal-check-out');

    if (!modal) return;

    const closeModal = () => modal.classList.remove('active');
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    checkInInput.addEventListener('change', updatePricingCalculations);
    checkOutInput.addEventListener('change', updatePricingCalculations);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const roomId = document.getElementById('booking-room-id').value;
        const guestName = document.getElementById('modal-guest-name').value.trim();
        const guestEmail = document.getElementById('modal-guest-email').value.trim();
        const guestPhone = document.getElementById('modal-guest-phone').value.trim();
        const checkIn = document.getElementById('modal-check-in').value;
        const checkOut = document.getElementById('modal-check-out').value;
        const guests = parseInt(document.getElementById('modal-guests').value, 10);

        if (checkOut <= checkIn) {
            showToast('Check-out must be after check-in date.', 'error');
            return;
        }

        const btn = document.getElementById('btn-confirm-booking');
        btn.disabled = true;
        btn.textContent = 'Booking...';

        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    room_id: parseInt(roomId, 10),
                    guest_name: guestName,
                    guest_email: guestEmail,
                    guest_phone: guestPhone,
                    check_in: checkIn,
                    check_out: checkOut,
                    guests
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showToast(`✓ Booking confirmed for Room ${activeBookingRoom.room_number}!`, 'success');
                form.reset();
                closeModal();
            } else {
                showToast(`❌ ${result.message}`, 'error');
            }
        } catch (err) {
            showToast('Unable to reach server', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Confirm Booking';
        }
    });
}

function updatePricingCalculations() {
    if (!activeBookingRoom) return;

    const inStr = document.getElementById('modal-check-in').value;
    const outStr = document.getElementById('modal-check-out').value;
    const nightsSpan = document.getElementById('modal-duration-nights');
    const totalDiv = document.getElementById('modal-estimated-total');

    if (!inStr || !outStr || outStr <= inStr) {
        nightsSpan.textContent = '0';
        totalDiv.textContent = '₹0';
        return;
    }

    const dIn = new Date(inStr);
    const dOut = new Date(outStr);
    const nights = Math.max(0, Math.ceil((dOut - dIn) / (1000 * 60 * 60 * 24)));

    nightsSpan.textContent = nights;
    const estimated = nights * activeBookingRoom.price;
    totalDiv.textContent = `₹${estimated.toLocaleString('en-IN')}`;
}