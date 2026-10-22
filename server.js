const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Calculate difference in nights between two YYYY-MM-DD dates
function calculateNights(checkInStr, checkOutStr) {
    const inDate = new Date(checkInStr);
    const outDate = new Date(checkOutStr);
    const diffTime = outDate.getTime() - inDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Helper: Get formatted today date string in YYYY-MM-DD
function getTodayString() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().split('T')[0];
}

// Helper: Standard email regex validator
function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// ==========================================
// ROOMS APIs
// ==========================================

// 1. GET /api/rooms - List all rooms
app.get('/api/rooms', (req, res) => {
    const query = 'SELECT * FROM rooms ORDER BY room_number ASC';
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error fetching rooms', error: err.message });
        }
        res.status(200).json({ success: true, data: rows });
    });
});

// 2. GET /api/rooms/search - Search available rooms with date overlap check
app.get('/api/rooms/search', (req, res) => {
    const { type, check_in, check_out, guests } = req.query;

    let conditions = [];
    let params = [];

    // Filter by room_type if provided and not "All"
    if (type && type.toLowerCase() !== 'all') {
        conditions.push('r.room_type = ?');
        params.push(type);
    }

    // Filter by minimum capacity if guests provided
    if (guests) {
        const guestCount = parseInt(guests, 10);
        if (!isNaN(guestCount) && guestCount > 0) {
            conditions.push('r.capacity >= ?');
            params.push(guestCount);
        }
    }

    // Only exclude maintenance rooms when searching availability
    conditions.push("r.status != 'Maintenance'");

    // Check availability logic against overlapping confirmed bookings
    if (check_in && check_out) {
        if (check_out <= check_in) {
            return res.status(400).json({ success: false, message: 'Check-out date must be strictly after Check-in date.' });
        }

        // Subquery: Exclude rooms that have overlapping confirmed bookings
        // Overlap formula: (existing.check_in < new.check_out) AND (existing.check_out > new.check_in)
        conditions.push(`
            r.id NOT IN (
                SELECT room_id FROM bookings
                WHERE booking_status = 'Confirmed'
                AND check_in < ?
                AND check_out > ?
            )
        `);
        params.push(check_out, check_in);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const sql = `SELECT r.* FROM rooms r ${whereClause} ORDER BY r.room_number ASC`;

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error searching available rooms', error: err.message });
        }
        res.status(200).json({ success: true, data: rows });
    });
});

// 3. GET /api/rooms/:id - Get a single room
app.get('/api/rooms/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM rooms WHERE id = ?', [id], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        }
        if (!row) {
            return res.status(404).json({ success: false, message: 'Room not found' });
        }
        res.status(200).json({ success: true, data: row });
    });
});

// 4. POST /api/rooms - Create a room
app.post('/api/rooms', (req, res) => {
    const { room_number, room_type, price, capacity, description, status } = req.body;

    if (!room_number || !room_number.toString().trim()) {
        return res.status(400).json({ success: false, message: 'Room number is required.' });
    }
    if (!room_type || !room_type.trim()) {
        return res.status(400).json({ success: false, message: 'Room type is required.' });
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
        return res.status(400).json({ success: false, message: 'Price must be a number greater than 0.' });
    }
    const numCapacity = parseInt(capacity, 10);
    if (isNaN(numCapacity) || numCapacity <= 0) {
        return res.status(400).json({ success: false, message: 'Capacity must be an integer greater than 0.' });
    }

    const roomStatus = status || 'Available';
    const roomDesc = description ? description.trim() : '';

    const sql = `
        INSERT INTO rooms (room_number, room_type, price, capacity, status, description)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [room_number.toString().trim(), room_type.trim(), numPrice, numCapacity, roomStatus, roomDesc], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ success: false, message: 'Room number already exists. Choose a unique number.' });
            }
            return res.status(500).json({ success: false, message: 'Failed to create room', error: err.message });
        }
        res.status(201).json({
            success: true,
            message: 'Room created successfully',
            data: { id: this.lastID, room_number, room_type, price: numPrice, capacity: numCapacity, status: roomStatus, description: roomDesc }
        });
    });
});

// 5. PUT /api/rooms/:id - Update an existing room
app.put('/api/rooms/:id', (req, res) => {
    const { id } = req.params;
    const { room_number, room_type, price, capacity, status, description } = req.body;

    if (!room_number || !room_number.toString().trim()) {
        return res.status(400).json({ success: false, message: 'Room number is required.' });
    }
    if (!room_type || !room_type.trim()) {
        return res.status(400).json({ success: false, message: 'Room type is required.' });
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
        return res.status(400).json({ success: false, message: 'Price must be a number greater than 0.' });
    }
    const numCapacity = parseInt(capacity, 10);
    if (isNaN(numCapacity) || numCapacity <= 0) {
        return res.status(400).json({ success: false, message: 'Capacity must be an integer greater than 0.' });
    }

    const sql = `
        UPDATE rooms
        SET room_number = ?, room_type = ?, price = ?, capacity = ?, status = ?, description = ?
        WHERE id = ?
    `;

    db.run(sql, [room_number.toString().trim(), room_type.trim(), numPrice, numCapacity, status || 'Available', description || '', id], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ success: false, message: 'Another room with this room number already exists.' });
            }
            return res.status(500).json({ success: false, message: 'Failed to update room', error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'Room not found' });
        }
        res.status(200).json({ success: true, message: 'Room updated successfully' });
    });
});

// 6. DELETE /api/rooms/:id - Delete a room (blocked if active/upcoming bookings exist)
app.delete('/api/rooms/:id', (req, res) => {
    const { id } = req.params;

    const checkBookingsQuery = `
        SELECT COUNT(*) AS activeCount
        FROM bookings
        WHERE room_id = ?
        AND booking_status = 'Confirmed'
        AND check_out >= ?
    `;

    const todayStr = getTodayString();

    db.get(checkBookingsQuery, [id, todayStr], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        }

        if (row && row.activeCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete room. There are active or upcoming confirmed bookings associated with it.'
            });
        }

        db.run('DELETE FROM rooms WHERE id = ?', [id], function (deleteErr) {
            if (deleteErr) {
                return res.status(500).json({ success: false, message: 'Failed to delete room', error: deleteErr.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ success: false, message: 'Room not found' });
            }
            res.status(200).json({ success: true, message: 'Room deleted successfully' });
        });
    });
});

// ==========================================
// BOOKINGS APIs
// ==========================================

// 7. GET /api/bookings/search - Search bookings by guest name, email, or room number
app.get('/api/bookings/search', (req, res) => {
    const q = req.query.q ? req.query.q.trim().toLowerCase() : '';
    const sql = `
        SELECT b.*, r.room_number, r.room_type, r.price AS room_price
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        WHERE LOWER(b.guest_name) LIKE ?
           OR LOWER(b.guest_email) LIKE ?
           OR LOWER(r.room_number) LIKE ?
        ORDER BY b.created_at DESC
    `;
    const wildcard = `%${q}%`;

    db.all(sql, [wildcard, wildcard, wildcard], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error searching bookings', error: err.message });
        }
        res.status(200).json({ success: true, data: rows });
    });
});

// 8. GET /api/bookings - List all bookings with room details
app.get('/api/bookings', (req, res) => {
    const sql = `
        SELECT b.id, b.room_id, r.room_number, r.room_type,
               b.guest_name, b.guest_email, b.guest_phone,
               b.check_in, b.check_out, b.guests, b.total_amount,
               b.booking_status, b.created_at
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        ORDER BY b.id DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error fetching bookings', error: err.message });
        }
        res.status(200).json({ success: true, data: rows });
    });
});

// 9. GET /api/bookings/:id - Single booking
app.get('/api/bookings/:id', (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT b.*, r.room_number, r.room_type, r.price AS room_price
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        WHERE b.id = ?
    `;
    db.get(sql, [id], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        }
        if (!row) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        res.status(200).json({ success: true, data: row });
    });
});

// 10. POST /api/bookings - Create new booking with strict double-booking protection & server-side pricing
app.post('/api/bookings', (req, res) => {
    const { room_id, guest_name, guest_email, guest_phone, check_in, check_out, guests } = req.body;

    // 1. Field presence validations
    if (!room_id) return res.status(400).json({ success: false, message: 'Room selection is required.' });
    if (!guest_name || guest_name.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Guest name must be at least 2 characters.' });
    }
    if (!guest_email || !isValidEmail(guest_email.trim())) {
        return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }
    if (!guest_phone || guest_phone.trim().length < 7) {
        return res.status(400).json({ success: false, message: 'A valid phone number is required.' });
    }
    if (!check_in || !check_out) {
        return res.status(400).json({ success: false, message: 'Both check-in and check-out dates are required.' });
    }

    // 2. Date logical validation
    const todayStr = getTodayString();
    if (check_in < todayStr) {
        return res.status(400).json({ success: false, message: 'Check-in date cannot be in the past.' });
    }
    if (check_out <= check_in) {
        return res.status(400).json({ success: false, message: 'Check-out date must be later than check-in date.' });
    }

    const guestCount = parseInt(guests, 10);
    if (isNaN(guestCount) || guestCount <= 0) {
        return res.status(400).json({ success: false, message: 'Guest count must be at least 1.' });
    }

    // 3. Room verification
    db.get('SELECT * FROM rooms WHERE id = ?', [room_id], (err, room) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        }
        if (!room) {
            return res.status(404).json({ success: false, message: 'Selected room does not exist.' });
        }
        if (room.status === 'Maintenance') {
            return res.status(400).json({ success: false, message: 'Selected room is currently under maintenance.' });
        }
        if (guestCount > room.capacity) {
            return res.status(400).json({
                success: false,
                message: `Number of guests (${guestCount}) exceeds the room capacity of ${room.capacity}.`
            });
        }

        // 4. Double booking overlap check
        // Rule: Existing check_in < New check_out AND Existing check_out > New check_in
        const overlapQuery = `
            SELECT * FROM bookings
            WHERE room_id = ?
              AND booking_status = 'Confirmed'
              AND check_in < ?
              AND check_out > ?
        `;

        db.all(overlapQuery, [room_id, check_out, check_in], (overlapErr, overlappingRows) => {
            if (overlapErr) {
                return res.status(500).json({ success: false, message: 'Error checking availability', error: overlapErr.message });
            }

            if (overlappingRows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Double Booking Conflict: Room is already booked for the selected dates.'
                });
            }

            // 5. Backend price calculation
            const nights = calculateNights(check_in, check_out);
            const totalAmount = nights * room.price;

            // 6. Insert booking record
            const insertSql = `
                INSERT INTO bookings (room_id, guest_name, guest_email, guest_phone, check_in, check_out, guests, total_amount, booking_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed')
            `;

            db.run(
                insertSql,
                [room_id, guest_name.trim(), guest_email.trim(), guest_phone.trim(), check_in, check_out, guestCount, totalAmount],
                function (insErr) {
                    if (insErr) {
                        return res.status(500).json({ success: false, message: 'Failed to complete booking', error: insErr.message });
                    }

                    res.status(201).json({
                        success: true,
                        message: 'Booking confirmed successfully!',
                        data: {
                            id: this.lastID,
                            room_id,
                            room_number: room.room_number,
                            guest_name: guest_name.trim(),
                            check_in,
                            check_out,
                            nights,
                            total_amount: totalAmount,
                            booking_status: 'Confirmed'
                        }
                    });
                }
            );
        });
    });
});

// 11. DELETE /api/bookings/:id - Soft cancellation (updates booking_status to 'Cancelled')
app.delete('/api/bookings/:id', (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM bookings WHERE id = ?', [id], (err, booking) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        }
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        if (booking.booking_status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Booking is already cancelled.' });
        }

        db.run("UPDATE bookings SET booking_status = 'Cancelled' WHERE id = ?", [id], function (updateErr) {
            if (updateErr) {
                return res.status(500).json({ success: false, message: 'Failed to cancel booking', error: updateErr.message });
            }
            res.status(200).json({
                success: true,
                message: 'Booking cancelled successfully. The room is now available for these dates.'
            });
        });
    });
});

// ==========================================
// DASHBOARD & STATISTICS API
// ==========================================

// 12. GET /api/statistics - Real-time stats calculated purely from database
app.get('/api/statistics', (req, res) => {
    const todayStr = getTodayString();

    const sqlTotalRooms = 'SELECT COUNT(*) AS total FROM rooms';
    const sqlMaintenance = "SELECT COUNT(*) AS maintenance FROM rooms WHERE status = 'Maintenance'";
    const sqlCurrentlyBooked = `
        SELECT COUNT(DISTINCT room_id) AS bookedToday
        FROM bookings
        WHERE booking_status = 'Confirmed'
        AND check_in <= ?
        AND check_out > ?
    `;
    const sqlUpcoming = `
        SELECT COUNT(*) AS upcoming
        FROM bookings
        WHERE booking_status = 'Confirmed'
        AND check_in >= ?
    `;
    const sqlRevenue = `
        SELECT COALESCE(SUM(total_amount), 0) AS revenue
        FROM bookings
        WHERE booking_status = 'Confirmed'
    `;

    db.get(sqlTotalRooms, [], (err1, rowTotal) => {
        if (err1) return res.status(500).json({ success: false, message: err1.message });

        db.get(sqlMaintenance, [], (err2, rowMaint) => {
            if (err2) return res.status(500).json({ success: false, message: err2.message });

            db.get(sqlCurrentlyBooked, [todayStr, todayStr], (err3, rowBooked) => {
                if (err3) return res.status(500).json({ success: false, message: err3.message });

                db.get(sqlUpcoming, [todayStr], (err4, rowUp) => {
                    if (err4) return res.status(500).json({ success: false, message: err4.message });

                    db.get(sqlRevenue, [], (err5, rowRev) => {
                        if (err5) return res.status(500).json({ success: false, message: err5.message });

                        const totalRooms = rowTotal.total || 0;
                        const maintenanceRooms = rowMaint.maintenance || 0;
                        const bookedRooms = rowBooked.bookedToday || 0;
                        const availableRooms = Math.max(0, totalRooms - maintenanceRooms - bookedRooms);

                        res.status(200).json({
                            success: true,
                            data: {
                                totalRooms,
                                availableRooms,
                                bookedRooms,
                                maintenanceRooms,
                                upcomingBookings: rowUp.upcoming || 0,
                                totalRevenue: rowRev.revenue || 0
                            }
                        });
                    });
                });
            });
        });
    });
});

// 13. GET /api/upcoming-bookings - Retrieve upcoming confirmed bookings for Dashboard display
app.get('/api/upcoming-bookings', (req, res) => {
    const todayStr = getTodayString();
    const sql = `
        SELECT b.id, b.guest_name, b.check_in, b.check_out, b.guests, b.total_amount,
               r.room_number, r.room_type
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        WHERE b.booking_status = 'Confirmed'
          AND b.check_in >= ?
        ORDER BY b.check_in ASC
        LIMIT 6
    `;

    db.all(sql, [todayStr], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        }
        res.status(200).json({ success: true, data: rows });
    });
});

// Fallback error handler for invalid JSON bodies
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ success: false, message: 'Malformed JSON payload.' });
    }
    next();
});

// Start Server
app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`Smart Hotel Room Booking Management System is Running!`);
    console.log(`Server URL: http://localhost:${PORT}`);
    console.log(`Database  : hotel.db (SQLite)`);
    console.log(`=======================================================`);
});