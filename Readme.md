# 🏨 Smart Hotel Room Booking & Management System

A full-stack, lightweight hotel reservation and inventory management web application built with **Node.js**, **Express.js**, **SQLite**, and **Vanilla JavaScript**. The project features real-time occupancy and revenue analytics, date-interval double-booking protection, server-side tariff recalculation, and seamless integration with real-world booking logs from the **Kaggle Hotel Booking Demand** dataset.

---

## 🌟 Key Features

- **Double-Booking Prevention Algorithm**: Employs rigorous mathematical date-overlap validation on the database level to eliminate conflicting reservations across overlapping date intervals.
- **Server-Side Financial Security**: Re-verifies date spans and computes nightly tariffs independently on the server to prevent client-side payment and amount tampering.
- **Real-Time Operational Dashboard**: Dynamic analytics tracking Total Rooms, Available Today, Currently Booked, Upcoming Bookings, and Total Revenue.
- **Kaggle Dataset Ingestion**: Custom asynchronous streaming importer script that maps standard room configurations and reservation histories from Kaggle's *Hotel Booking Demand* dataset into SQLite.
- **Soft Deletion & Audit Trail**: Cancelled reservations update status to `'Cancelled'`, maintaining audit records and financial logs while immediately freeing up room availability.
- **Debounced Search & Filtering**: Instant client-side and server-side search across guest details, room numbers, and reservation statuses with zero page flickers.
- **Zero Heavy Frontend Dependencies**: Built entirely with Vanilla JavaScript (ES6+), modern CSS Grid/Flexbox, and the Fetch API.

---

## 🏗️ Architecture & Technology Stack

```text
[ Browser Client ]  <--->  [ REST API Layer ]  <--->  [ Relational Storage ]
Vanilla HTML/CSS/JS          Express.js (Node.js)          SQLite3 (hotel.db)
```

- **Runtime**: [Node.js](https://nodejs.org/) (Asynchronous, event-driven I/O)
- **Backend Framework**: [Express.js](https://expressjs.com/) (RESTful routing, static file serving, validation middleware)
- **Database Engine**: [SQLite3](https://www.sqlite.org/) (Serverless, file-based ACID-compliant relational DB with Foreign Key enforcement)
- **Dataset Parsing**: `csv-parser` with Node.js readable streams
- **Frontend**: Semantic HTML5, CSS3 Custom Properties (Variables), Vanilla JavaScript (ES6+), Fetch API

---

## 🗄️ Database Design & Schema

The relational database (`hotel.db`) enforces relational integrity via `PRAGMA foreign_keys = ON;`.

### 1. `rooms` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique room identifier |
| `room_number` | TEXT | UNIQUE, NOT NULL | Distinct room number (e.g., 101, 201) |
| `room_type` | TEXT | NOT NULL | Single, Double, Deluxe, Suite |
| `price` | REAL | NOT NULL | Base nightly tariff (₹) |
| `capacity` | INTEGER | NOT NULL | Maximum permitted guest capacity |
| `status` | TEXT | DEFAULT 'Available' | Current operational status ('Available', 'Maintenance') |
| `description` | TEXT | NULL | Room amenities and overview |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |

### 2. `bookings` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique booking reference |
| `room_id` | INTEGER | NOT NULL, FK $\rightarrow$ `rooms(id)` | Associated room reference |
| `guest_name` | TEXT | NOT NULL | Guest full name |
| `guest_email` | TEXT | NOT NULL | Guest email address |
| `guest_phone` | TEXT | NOT NULL | Contact telephone number |
| `check_in` | DATE | NOT NULL | Check-in date (`YYYY-MM-DD`) |
| `check_out` | DATE | NOT NULL | Check-out date (`YYYY-MM-DD`) |
| `guests` | INTEGER | NOT NULL | Total guest count |
| `total_amount` | REAL | NOT NULL | Backend-computed total tariff |
| `booking_status` | TEXT | DEFAULT 'Confirmed' | Reservation status ('Confirmed', 'Cancelled') |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Timestamp of reservation |

### Relationship:
$$\text{rooms } (1) \longleftrightarrow (N) \text{ bookings}$$

---

## 📊 Kaggle Dataset Integration

This system replaces dummy seed data with authentic industry data from Kaggle:
* **Dataset**: [Hotel Booking Demand Dataset (Jesse Mostipak)](https://www.kaggle.com/datasets/jessemostipak/hotel-booking-demand)
* **Ingestion Script**: `import-kaggle.js`
* **Mechanism**:
  1. Streams CSV rows using `fs.createReadStream` and `csv-parser` to avoid Node.js memory overflow.
  2. Maps standard Kaggle room tiers (`A`, `B`, `D`, `E`, `F`, `G`) to hotel room inventory.
  3. Translates arrival dates, weekend/weekday stays, guest counts, and average daily rates (ADR).
  4. Wraps insertions within an atomic SQLite transaction (`BEGIN TRANSACTION` / `COMMIT`) for rapid disk writes.

---

## 📡 REST API Reference

### Rooms Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/rooms` | Retrieve complete room inventory |
| `GET` | `/api/rooms/search` | Search rooms by dates, guest capacity, and room type |
| `GET` | `/api/rooms/:id` | Fetch specific room details |
| `POST` | `/api/rooms` | Add a new room to inventory |
| `PUT` | `/api/rooms/:id` | Update room tariff, capacity, or maintenance status |
| `DELETE` | `/api/rooms/:id` | Delete room (blocked if active bookings exist) |

### Bookings Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/bookings` | List all reservations with room details |
| `GET` | `/api/bookings/search?q=` | Search bookings by guest name, email, or room number |
| `GET` | `/api/bookings/:id` | Fetch single booking by ID |
| `POST` | `/api/bookings` | Reserve room (validates date overlaps & computes tariff) |
| `DELETE` | `/api/bookings/:id` | Soft cancellation (switches status to `'Cancelled'`) |

### Dashboard & Analytics Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/statistics` | Aggregates room occupancy, active counts, and revenue |
| `GET` | `/api/upcoming-bookings`| Fetches upcoming confirmed stays |

---

## ⚙️ Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v16.0.0 or higher)
- `npm` (Node Package Manager)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/hotel-room-booking-system.git
cd hotel-room-booking-system
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Ingest Kaggle Dataset
Place `hotel_bookings.csv` in the root folder (or use the built-in streamer) and run:
```bash
node import-kaggle.js
```

### 4. Start the Application
```bash
npm start
```
The application will launch at:
```text
http://localhost:3000
```

---

## 📂 Project Directory Structure

```text
hotel-room-booking-system/
├── public/                     # Static client-side assets
│   ├── css/
│   │   └── style.css           # Responsive UI styling & design tokens
│   ├── js/
│   │   ├── app.js              # Dashboard & quick availability logic
│   │   ├── rooms.js            # Room inventory & modal handling
│   │   └── bookings.js         # Reservations table, search, & cancellations
│   ├── index.html              # Hotel Operations Dashboard
│   ├── rooms.html              # Room Inventory view
│   └── bookings.html           # Guest Reservations view
├── database.js                 # SQLite database connection & schema definition
├── hotel.db                    # SQLite relational database storage
├── hotel_bookings.csv          # Kaggle dataset source file
├── import-kaggle.js            # Transaction-based CSV ingestion script
├── server.js                   # Express application & REST API routes
├── package.json                # Project dependencies & npm scripts
└── README.md                   # Documentation
```

---

## 🔒 Double-Booking Overlap Prevention Formula

To ensure zero booking collisions, the query verifies:
$$\text{Existing Check-In} < \text{Requested Check-Out} \quad \text{AND} \quad \text{Existing Check-Out} > \text{Requested Check-In}$$

Implemented via SQL:
```sql
SELECT room_id FROM bookings
WHERE booking_status = 'Confirmed'
  AND check_in < :requestedCheckOut
  AND check_out > :requestedCheckIn
```

---

## 📄 License
This project is open-source and available under the [ISC License](LICENSE).
