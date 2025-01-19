const express = require('express');
const db = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Get all guests
router.get('/', authenticateToken, (req, res) => {
    const sql = 'SELECT * FROM guests ORDER BY created_at DESC';
    db.all(sql, [], (err, guests) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching guests' });
        }
        res.json(guests);
    });
});

// Get single guest
router.get('/:id', authenticateToken, (req, res) => {
    const sql = `
        SELECT g.*, 
            json_group_array(
                json_object(
                    'booking_id', b.booking_id,
                    'room_id', b.room_id,
                    'check_in_date', b.check_in_date,
                    'check_out_date', b.check_out_date,
                    'booking_status', b.booking_status,
                    'payment_status', b.payment_status
                )
            ) as bookings
        FROM guests g
        LEFT JOIN bookings b ON g.guest_id = b.guest_id
        WHERE g.guest_id = ?
        GROUP BY g.guest_id
    `;

    db.get(sql, [req.params.id], (err, guest) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching guest details' });
        }
        if (!guest) {
            return res.status(404).json({ error: 'Guest not found' });
        }

        // Parse bookings from string to array
        guest.bookings = JSON.parse(guest.bookings);
        // Remove null booking if no bookings exist
        if (guest.bookings.length === 1 && !guest.bookings[0].booking_id) {
            guest.bookings = [];
        }

        res.json(guest);
    });
});

// Create new guest
router.post('/', authenticateToken, (req, res) => {
    const {
        first_name,
        last_name,
        email,
        phone,
        address,
        id_proof_type,
        id_proof_number
    } = req.body;

    if (!first_name || !last_name) {
        return res.status(400).json({ error: 'First name and last name are required' });
    }

    const sql = `
        INSERT INTO guests (
            first_name, last_name, email, phone, 
            address, id_proof_type, id_proof_number
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
        sql,
        [first_name, last_name, email, phone, address, id_proof_type, id_proof_number],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Email already registered' });
                }
                return res.status(500).json({ error: 'Error creating guest profile' });
            }

            res.status(201).json({
                message: 'Guest registered successfully',
                guestId: this.lastID
            });
        }
    );
});

// Update guest
router.put('/:id', authenticateToken, (req, res) => {
    const {
        first_name,
        last_name,
        email,
        phone,
        address,
        id_proof_type,
        id_proof_number
    } = req.body;

    const updates = [];
    const values = [];

    if (first_name) {
        updates.push('first_name = ?');
        values.push(first_name);
    }
    if (last_name) {
        updates.push('last_name = ?');
        values.push(last_name);
    }
    if (email) {
        updates.push('email = ?');
        values.push(email);
    }
    if (phone) {
        updates.push('phone = ?');
        values.push(phone);
    }
    if (address) {
        updates.push('address = ?');
        values.push(address);
    }
    if (id_proof_type) {
        updates.push('id_proof_type = ?');
        values.push(id_proof_type);
    }
    if (id_proof_number) {
        updates.push('id_proof_number = ?');
        values.push(id_proof_number);
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No update data provided' });
    }

    const sql = `UPDATE guests SET ${updates.join(', ')} WHERE guest_id = ?`;
    values.push(req.params.id);

    db.run(sql, values, function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            return res.status(500).json({ error: 'Error updating guest profile' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Guest not found' });
        }

        res.json({ message: 'Guest profile updated successfully' });
    });
});

// Search guests
router.get('/search/query', authenticateToken, (req, res) => {
    const { term } = req.query;

    if (!term) {
        return res.status(400).json({ error: 'Search term is required' });
    }

    const searchTerm = `%${term}%`;
    const sql = `
        SELECT * FROM guests 
        WHERE first_name LIKE ? 
        OR last_name LIKE ? 
        OR email LIKE ? 
        OR phone LIKE ?
        ORDER BY created_at DESC
    `;

    db.all(sql, [searchTerm, searchTerm, searchTerm, searchTerm], (err, guests) => {
        if (err) {
            return res.status(500).json({ error: 'Error searching guests' });
        }
        res.json(guests);
    });
});

// Delete guest (admin only)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
    // First check if guest has any bookings
    db.get('SELECT COUNT(*) as count FROM bookings WHERE guest_id = ?', [req.params.id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error checking guest bookings' });
        }

        if (result.count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete guest with existing bookings' 
            });
        }

        // If no bookings, proceed with deletion
        const sql = 'DELETE FROM guests WHERE guest_id = ?';
        db.run(sql, [req.params.id], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error deleting guest' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Guest not found' });
            }

            res.json({ message: 'Guest deleted successfully' });
        });
    });
});

module.exports = router;