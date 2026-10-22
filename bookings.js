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

let allBookingsList = [];

document.addEventListener('DOMContentLoaded', () => {
    loadBookings();
    initBookingFilters();
});

// Load all bookings
async function loadBookings() {
    const tbody = document.getElementById('bookings-table-body');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Loading reservations...</td></tr>';

    try {
        const response = await fetch('/api/bookings');
        const result = await response.json();

        if (result.success) {
            allBookingsList = result.data;
            renderBookingsTable(allBookingsList);
        } else {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:red;">Failed to load bookings.</td></tr>';
        }
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:red;">Error connecting to server.</td></tr>';
    }
}

// Render Bookings Table
function renderBookingsTable(bookings) {
    const tbody = document.getElementById('bookings-table-body');
    if (!tbody) return;

    if (bookings.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <div class="empty-state-icon">📅</div>
                        <h3>No Bookings Found</h3>
                        <p>No reservations recorded yet or none matching your search criteria.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = bookings.map(b => {
        const isCancelled = b.booking_status === 'Cancelled';
        const badgeClass = isCancelled ? 'badge-cancelled' : 'badge-confirmed';

        return `
            <tr>
                <td><strong>#BK-${String(b.id).padStart(3, '0')}</strong></td>
                <td>
                    <strong>Room ${b.room_number}</strong>
                    <div style="font-size:0.78rem; color:var(--text-muted);">${b.room_type}</div>
                </td>
                <td>
                    <div><strong>${b.guest_name}</strong></div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${b.guest_email}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${b.guest_phone}</div>
                </td>
                <td>${b.check_in}</td>
                <td>${b.check_out}</td>
                <td>${b.guests}</td>
                <td><strong>₹${b.total_amount.toLocaleString('en-IN')}</strong></td>
                <td><span class="badge ${badgeClass}">${b.booking_status}</span></td>
                <td>
                    ${isCancelled 
                        ? `<span style="font-size:0.8rem; color:var(--text-muted);">Cancelled</span>`
                        : `<button class="btn btn-danger btn-sm" onclick="cancelBooking(${b.id}, '${b.room_number}', '${b.guest_name}')">Cancel</button>`
                    }
                </td>
            </tr>
        `;
    }).join('');
}

// Search and Filter controls
function initBookingFilters() {
    const searchInput = document.getElementById('booking-search-input');
    const statusSelect = document.getElementById('booking-filter-status');
    const resetBtn = document.getElementById('btn-reset-booking-search');

    async function applySearch() {
        const q = searchInput.value.trim();
        const status = statusSelect.value;

        if (q.length > 0) {
            try {
                const res = await fetch(`/api/bookings/search?q=${encodeURIComponent(q)}`);
                const result = await res.json();
                if (result.success) {
                    let filtered = result.data;
                    if (status !== 'All') {
                        filtered = filtered.filter(b => b.booking_status === status);
                    }
                    renderBookingsTable(filtered);
                }
            } catch (err) {
                showToast('Failed to perform search query', 'error');
            }
        } else {
            let filtered = allBookingsList;
            if (status !== 'All') {
                filtered = filtered.filter(b => b.booking_status === status);
            }
            renderBookingsTable(filtered);
        }
    }

    // Debounce search input
    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(applySearch, 250);
    });

    statusSelect.addEventListener('change', applySearch);

    resetBtn.addEventListener('click', () => {
        searchInput.value = '';
        statusSelect.value = 'All';
        renderBookingsTable(allBookingsList);
    });
}

// Cancel Booking with confirmation dialog
window.cancelBooking = async function(bookingId, roomNumber, guestName) {
    const confirmCancellation = confirm(`Are you sure you want to cancel the booking for ${guestName} (Room ${roomNumber})?`);
    if (!confirmCancellation) return;

    try {
        const response = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' });
        const result = await response.json();

        if (response.ok && result.success) {
            showToast(`✓ Booking cancelled successfully. Room ${roomNumber} is now freed!`, 'success');
            // Refresh table dynamically without page reload
            loadBookings();
        } else {
            showToast(`❌ ${result.message}`, 'error');
        }
    } catch (err) {
        showToast('Error communicating with server.', 'error');
    }
};