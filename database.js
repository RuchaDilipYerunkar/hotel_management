const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'hotel.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Failed to connect to SQLite database:', err.message);
    } else {
        console.log('Connected successfully to SQLite database: hotel.db');
    }
});

// Enable SQLite foreign keys and create tables with sample seed data
db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    // 1. Rooms Table
    db.run(`
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_number TEXT UNIQUE NOT NULL,
            room_type TEXT NOT NULL,
            price REAL NOT NULL,
            capacity INTEGER NOT NULL,
            status TEXT DEFAULT 'Available',
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. Bookings Table
    db.run(`
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER NOT NULL,
            guest_name TEXT NOT NULL,
            guest_email TEXT NOT NULL,
            guest_phone TEXT NOT NULL,
            check_in DATE NOT NULL,
            check_out DATE NOT NULL,
            guests INTEGER NOT NULL,
            total_amount REAL NOT NULL,
            booking_status TEXT DEFAULT 'Confirmed',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT
        )
    `);

    // 3. Seed Sample Rooms if table is empty
    db.get('SELECT COUNT(*) AS count FROM rooms', [], (err, row) => {
        if (err) {
            console.error('Error counting rooms:', err.message);
            return;
        }

        if (row.count === 0) {
            console.log('Seeding initial room data...');
            const seedRooms = [
                ['101', 'Single', 2000, 1, 'Available', 'Cozy single room with high-speed Wi-Fi and work desk.'],
                ['102', 'Single', 2200, 1, 'Available', 'Premium single room with balcony garden view.'],
                ['201', 'Double', 2800, 2, 'Available', 'Comfortable double bed room suitable for couples.'],
                ['202', 'Double', 3000, 2, 'Available', 'Spacious double room equipped with mini-bar and TV.'],
                ['301', 'Deluxe', 3500, 2, 'Available', 'Deluxe room with panoramic city view and king-size bed.'],
                ['302', 'Deluxe', 3800, 3, 'Available', 'Spacious deluxe room with extra sofa bed and luxury bath.'],
                ['401', 'Suite', 5500, 4, 'Available', 'Executive suite with separate living room and luxury amenities.'],
                ['402', 'Suite', 6500, 4, 'Available', 'Presidential suite featuring master bedroom, Jacuzzi, and dining lounge.']
            ];

            const stmt = db.prepare(`
                INSERT INTO rooms (room_number, room_type, price, capacity, status, description)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            seedRooms.forEach((room) => {
                stmt.run(room);
            });
            stmt.finalize();
            console.log('Sample rooms initialized successfully.');
        }
    });
});

module.exports = db;