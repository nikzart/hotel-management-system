const express = require('express');
const db = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Get all rooms
router.get('/', authenticateToken, (req, res) => {
    const sql = 'SELECT * FROM rooms ORDER BY room_number';
    db.all(sql, [], (err, rooms) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching rooms' });
        }
        res.json(rooms);
    });
});

// Get available rooms
router.get('/available', authenticateToken, (req, res) => {
    const { check_in_date, check_out_date } = req.query;

    if (!check_in_date || !check_out_date) {
        return res.status(400).json({ error: 'Check-in and check-out dates are required' });
    }

    const sql = `
        SELECT * FROM rooms 
        WHERE room_id NOT IN (
            SELECT room_id FROM bookings 
            WHERE (check_in_date <= ? AND check_out_date >= ?)
            AND booking_status NOT IN ('cancelled', 'checked_out')
        )
        AND status = 'available'
        ORDER BY room_number
    `;

    db.all(sql, [check_out_date, check_in_date], (err, rooms) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching available rooms' });
        }
        res.json(rooms);
    });
});

// Get single room
router.get('/:id', authenticateToken, (req, res) => {
    const sql = 'SELECT * FROM rooms WHERE room_id = ?';
    db.get(sql, [req.params.id], (err, room) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching room' });
        }
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        res.json(room);
    });
});

// Create new room (admin only)
router.post('/', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const { room_number, room_type, rate_per_night, amenities } = req.body;

    if (!room_number || !room_type || !rate_per_night) {
        return res.status(400).json({ error: 'Room number, type, and rate are required' });
    }

    const sql = `
        INSERT INTO rooms (room_number, room_type, rate_per_night, amenities)
        VALUES (?, ?, ?, ?)
    `;

    db.run(sql, [room_number, room_type, rate_per_night, JSON.stringify(amenities)], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Room number already exists' });
            }
            return res.status(500).json({ error: 'Error creating room' });
        }

        res.status(201).json({
            message: 'Room created successfully',
            roomId: this.lastID
        });
    });
});

// Update room
router.put('/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const { room_number, room_type, rate_per_night, status, amenities } = req.body;
    const roomId = req.params.id;

    const updates = [];
    const values = [];

    if (room_number) {
        updates.push('room_number = ?');
        values.push(room_number);
    }
    if (room_type) {
        updates.push('room_type = ?');
        values.push(room_type);
    }
    if (rate_per_night) {
        updates.push('rate_per_night = ?');
        values.push(rate_per_night);
    }
    if (status) {
        updates.push('status = ?');
        values.push(status);
    }
    if (amenities) {
        updates.push('amenities = ?');
        values.push(JSON.stringify(amenities));
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No update data provided' });
    }

    const sql = `UPDATE rooms SET ${updates.join(', ')} WHERE room_id = ?`;
    values.push(roomId);

    db.run(sql, values, function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Room number already exists' });
            }
            return res.status(500).json({ error: 'Error updating room' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.json({ message: 'Room updated successfully' });
    });
});

// Delete room (admin only)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const sql = 'DELETE FROM rooms WHERE room_id = ?';
    
    db.run(sql, [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error deleting room' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.json({ message: 'Room deleted successfully' });
    });
});

module.exports = router;