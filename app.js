// Utility: Toast notification system
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

// Global active room reference for the booking modal
let activeSelectedRoom = null;

// DOM Initialization on Page Load
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    initAvailabilitySearch();
    initBookingModal();
});

// Load statistics and upcoming bookings on Dashboard
async function initDashboard() {
    await loadStatistics();
    await loadUpcomingBookings();

    // Default dates for the instant availability search (Today & Tomorrow)
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const checkInInput = document.getElementById('search-check-in');
    const checkOutInput = document.getElementById('search-check-out');

    if (checkInInput && checkOutInput) {
        checkInInput.min = today.toISOString().split('T')[0];
        checkInInput.value = today.toISOString().split('T')[0];

        checkOutInput.min = tomorrow.toISOString().split('T')[0];
        checkOutInput.value = tomorrow.toISOString().split('T')[0];

        checkInInput.addEventListener('change', () => {
            const nextDay = new Date(checkInInput.value);
            nextDay.setDate(nextDay.getDate() + 1);
            checkOutInput.min = nextDay.toISOString().split('T')[0];
            if (checkOutInput.value <= checkInInput.value) {
                checkOutInput.value = nextDay.toISOString().split('T')[0];
            }
        });
    }
}

// Fetch dashboard statistics from SQLite backend
async function loadStatistics() {
    try {
        const response = await fetch('/api/statistics');
        const result = await response.json();

        if (result.success) {
            const data = result.data;
            document.getElementById('stat-total-rooms').textContent = data.totalRooms;
            document.getElementById('stat-available-rooms').textContent = data.availableRooms;
            document.getElementById('stat-booked-rooms').textContent = data.bookedRooms;
            document.getElementById('stat-upcoming-bookings').textContent = data.upcomingBookings;
            document.getElementById('stat-revenue').textContent = `₹${data.totalRevenue.toLocaleString('en-IN')}`;
        }
    } catch (err) {
        console.error('Failed to fetch statistics:', err);
    }
}

// Fetch upcoming confirmed bookings
async function loadUpcomingBookings() {
    const tableBody = document.getElementById('upcoming-bookings-table');
    if (!tableBody) return;

    try {
        const response = await fetch('/api/upcoming-bookings');
        const result = await response.json();

        if (!result.success || result.data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            <div class="empty-state-icon">📅</div>
                            <h3>No Upcoming Reservations</h3>
                            <p>Upcoming confirmed bookings will appear here.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = result.data.map(b => `
            <tr>
                <td><strong>#BK-${String(b.id).padStart(3, '0')}</strong></td>
                <td><strong>Room ${b.room_number}</strong> (${b.room_type})</td>
                <td>${b.guest_name}</td>
                <td>${b.check_in}</td>
                <td>${b.check_out}</td>
                <td>${b.guests} guest(s)</td>
                <td><strong>₹${b.total_amount.toLocaleString('en-IN')}</strong></td>
            </tr>
        `).join('');
    } catch (err) {
        tableBody.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Failed to load bookings.</td></tr>';
    }
}

// Handle Room Search Section
function initAvailabilitySearch() {
    const form = document.getElementById('search-form');
    const clearBtn = document.getElementById('btn-clear-search');
    const resultsSection = document.getElementById('search-results-section');
    const resultsContainer = document.getElementById('available-rooms-container');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const checkIn = document.getElementById('search-check-in').value;
        const checkOut = document.getElementById('search-check-out').value;
        const guests = document.getElementById('search-guests').value;
        const roomType = document.getElementById('search-room-type').value;

        if (checkOut <= checkIn) {
            showToast('Check-out date must be strictly after Check-in date.', 'error');
            return;
        }

        resultsContainer.innerHTML = '<p style="padding: 1rem;">Searching available rooms...</p>';
        resultsSection.style.display = 'block';

        try {
            const url = `/api/rooms/search?type=${encodeURIComponent(roomType)}&check_in=${checkIn}&check_out=${checkOut}&guests=${guests}`;
            const response = await fetch(url);
            const result = await response.json();

            if (!result.success) {
                showToast(result.message || 'Error searching rooms', 'error');
                return;
            }

            if (result.data.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <div class="empty-state-icon">🔍</div>
                        <h3>No Rooms Available</h3>
                        <p>No rooms match your selected criteria or dates. Try different dates or room types.</p>
                    </div>
                `;
                return;
            }

            resultsContainer.innerHTML = result.data.map(room => `
                <div class="room-card">
                    <div>
                        <div class="room-header">
                            <span class="room-title">Room ${room.room_number}</span>
                            <span class="badge badge-available">Available</span>
                        </div>
                        <div class="room-details">
                            <div class="room-type-text">${room.room_type} Room</div>
                            <div class="room-price">₹${room.price.toLocaleString('en-IN')} <span>/ night</span></div>
                            <div class="room-meta">👤 Capacity: ${room.capacity} Guests</div>
                            <p class="room-desc">${room.description || 'Modern and comfortable room.'}</p>
                        </div>
                    </div>
                    <div class="room-actions">
                        <button class="btn btn-primary" onclick="openBookingFromSearch(${room.id}, '${room.room_number}', ${room.price}, ${room.capacity}, '${checkIn}', '${checkOut}', ${guests})">
                            Book Now
                        </button>
                    </div>
                </div>
            `).join('');

        } catch (err) {
            showToast('Unable to connect to server.', 'error');
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            resultsSection.style.display = 'none';
            resultsContainer.innerHTML = '';
        });
    }
}

// Handler when user clicks Book Now from the search cards
window.openBookingFromSearch = function(roomId, roomNumber, price, capacity, checkIn, checkOut, guests) {
    activeSelectedRoom = { id: roomId, room_number: roomNumber, price, capacity };

    document.getElementById('booking-room-id').value = roomId;
    document.getElementById('modal-room-number').textContent = roomNumber;
    document.getElementById('modal-price-per-night').textContent = `₹${price.toLocaleString('en-IN')}`;
    document.getElementById('modal-check-in').value = checkIn;
    document.getElementById('modal-check-out').value = checkOut;
    document.getElementById('modal-guests').value = guests;
    document.getElementById('modal-guests').max = capacity;

    updateModalPricing();

    document.getElementById('booking-modal').classList.add('active');
};

// Booking Modal Controls & Dynamic Calculation
function initBookingModal() {
    const modal = document.getElementById('booking-modal');
    const closeBtn = document.getElementById('btn-close-booking-modal');
    const cancelBtn = document.getElementById('btn-cancel-booking-modal');
    const bookingForm = document.getElementById('booking-form');
    const checkInInput = document.getElementById('modal-check-in');
    const checkOutInput = document.getElementById('modal-check-out');

    if (!modal) return;

    const closeModal = () => modal.classList.remove('active');

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    if (checkInInput && checkOutInput) {
        checkInInput.addEventListener('change', updateModalPricing);
        checkOutInput.addEventListener('change', updateModalPricing);
    }

    // Submit Booking Form
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const roomId = document.getElementById('booking-room-id').value;
        const guestName = document.getElementById('modal-guest-name').value.trim();
        const guestEmail = document.getElementById('modal-guest-email').value.trim();
        const guestPhone = document.getElementById('modal-guest-phone').value.trim();
        const checkIn = document.getElementById('modal-check-in').value;
        const checkOut = document.getElementById('modal-check-out').value;
        const guests = parseInt(document.getElementById('modal-guests').value, 10);

        if (!guestName || guestName.length < 2) {
            showToast('Please enter a valid guest name.', 'error');
            return;
        }

        if (checkOut <= checkIn) {
            showToast('Check-out must be strictly after Check-in.', 'error');
            return;
        }

        if (activeSelectedRoom && guests > activeSelectedRoom.capacity) {
            showToast(`Guest count exceeds room capacity of ${activeSelectedRoom.capacity}.`, 'error');
            return;
        }

        const confirmBtn = document.getElementById('btn-confirm-booking');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Confirming...';

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
                showToast(`✓ Booking confirmed for ${guestName}!`, 'success');
                bookingForm.reset();
                closeModal();
                // Refresh dashboard counters & upcoming bookings without reload
                initDashboard();
                const searchSection = document.getElementById('search-results-section');
                if (searchSection) searchSection.style.display = 'none';
            } else {
                showToast(`❌ ${result.message}`, 'error');
            }
        } catch (err) {
            showToast('Failed to connect to server.', 'error');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm Booking';
        }
    });
}

// Client-side visual price estimation (Backend re-verifies and calculates final charge)
function updateModalPricing() {
    if (!activeSelectedRoom) return;

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
    const estimatedTotal = nights * activeSelectedRoom.price;
    totalDiv.textContent = `₹${estimatedTotal.toLocaleString('en-IN')}`;
}