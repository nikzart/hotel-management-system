const express = require('express');
const db = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Get all bookings
router.get('/', authenticateToken, (req, res) => {
    const sql = `
        SELECT b.*, 
            g.first_name, g.last_name, g.email, g.phone,
            r.room_number, r.room_type
        FROM bookings b
        JOIN guests g ON b.guest_id = g.guest_id
        JOIN rooms r ON b.room_id = r.room_id
        ORDER BY b.created_at DESC
    `;

    db.all(sql, [], (err, bookings) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching bookings' });
        }
        res.json(bookings);
    });
});

// Get single booking
router.get('/:id', authenticateToken, (req, res) => {
    const sql = `
        SELECT b.*, 
            g.first_name, g.last_name, g.email, g.phone,
            r.room_number, r.room_type,
            json_group_array(
                json_object(
                    'payment_id', p.payment_id,
                    'amount', p.amount,
                    'payment_method', p.payment_method,
                    'payment_date', p.payment_date,
                    'payment_status', p.payment_status,
                    'transaction_id', p.transaction_id
                )
            ) as payments
        FROM bookings b
        JOIN guests g ON b.guest_id = g.guest_id
        JOIN rooms r ON b.room_id = r.room_id
        LEFT JOIN payments p ON b.booking_id = p.booking_id
        WHERE b.booking_id = ?
        GROUP BY b.booking_id
    `;

    db.get(sql, [req.params.id], (err, booking) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching booking details' });
        }
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Parse payments from string to array
        booking.payments = JSON.parse(booking.payments);
        // Remove null payment if no payments exist
        if (booking.payments.length === 1 && !booking.payments[0].payment_id) {
            booking.payments = [];
        }

        res.json(booking);
    });
});

// Create new booking
router.post('/', authenticateToken, async (req, res) => {
    const {
        guest_id,
        room_id,
        check_in_date,
        check_out_date,
        total_amount
    } = req.body;

    if (!guest_id || !room_id || !check_in_date || !check_out_date || !total_amount) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if room is available for the given dates
    const availabilityCheck = `
        SELECT COUNT(*) as count 
        FROM bookings 
        WHERE room_id = ? 
        AND booking_status NOT IN ('cancelled', 'checked_out')
        AND (
            (check_in_date <= ? AND check_out_date >= ?) 
            OR (check_in_date <= ? AND check_out_date >= ?)
            OR (check_in_date >= ? AND check_out_date <= ?)
        )
    `;

    db.get(
        availabilityCheck,
        [
            room_id,
            check_out_date, check_in_date,
            check_in_date, check_in_date,
            check_in_date, check_out_date
        ],
        (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Error checking room availability' });
            }

            if (result.count > 0) {
                return res.status(400).json({ error: 'Room is not available for the selected dates' });
            }

            // Create booking
            const sql = `
                INSERT INTO bookings (
                    guest_id, room_id, check_in_date, 
                    check_out_date, total_amount
                )
                VALUES (?, ?, ?, ?, ?)
            `;

            db.run(
                sql,
                [guest_id, room_id, check_in_date, check_out_date, total_amount],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Error creating booking' });
                    }

                    res.status(201).json({
                        message: 'Booking created successfully',
                        bookingId: this.lastID
                    });
                }
            );
        }
    );
});

// Update booking status (check-in, check-out, cancel)
router.put('/:id/status', authenticateToken, (req, res) => {
    const { status } = req.body;
    const validStatuses = ['confirmed', 'checked_in', 'checked_out', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid booking status' });
    }

    const sql = 'UPDATE bookings SET booking_status = ? WHERE booking_id = ?';

    db.run(sql, [status, req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error updating booking status' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // If checking in or out, update room status
        if (status === 'checked_in') {
            db.run(
                'UPDATE rooms SET status = ? WHERE room_id = (SELECT room_id FROM bookings WHERE booking_id = ?)',
                ['occupied', req.params.id]
            );
        } else if (status === 'checked_out') {
            db.run(
                'UPDATE rooms SET status = ? WHERE room_id = (SELECT room_id FROM bookings WHERE booking_id = ?)',
                ['available', req.params.id]
            );
        }

        res.json({ message: 'Booking status updated successfully' });
    });
});

// Update booking details
router.put('/:id', authenticateToken, (req, res) => {
    const {
        check_in_date,
        check_out_date,
        total_amount,
        payment_status
    } = req.body;

    const updates = [];
    const values = [];

    if (check_in_date) {
        updates.push('check_in_date = ?');
        values.push(check_in_date);
    }
    if (check_out_date) {
        updates.push('check_out_date = ?');
        values.push(check_out_date);
    }
    if (total_amount) {
        updates.push('total_amount = ?');
        values.push(total_amount);
    }
    if (payment_status) {
        updates.push('payment_status = ?');
        values.push(payment_status);
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No update data provided' });
    }

    const sql = `UPDATE bookings SET ${updates.join(', ')} WHERE booking_id = ?`;
    values.push(req.params.id);

    db.run(sql, values, function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error updating booking' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        res.json({ message: 'Booking updated successfully' });
    });
});

// Get bookings by date range
router.get('/range/:start/:end', authenticateToken, (req, res) => {
    const { start, end } = req.params;

    const sql = `
        SELECT b.*, 
            g.first_name, g.last_name,
            r.room_number, r.room_type
        FROM bookings b
        JOIN guests g ON b.guest_id = g.guest_id
        JOIN rooms r ON b.room_id = r.room_id
        WHERE (check_in_date BETWEEN ? AND ?)
        OR (check_out_date BETWEEN ? AND ?)
        ORDER BY check_in_date
    `;

    db.all(sql, [start, end, start, end], (err, bookings) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching bookings' });
        }
        res.json(bookings);
    });
});

// Delete booking (admin only)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
    // Check if booking has any payments
    db.get('SELECT COUNT(*) as count FROM payments WHERE booking_id = ?', [req.params.id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error checking booking payments' });
        }

        if (result.count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete booking with existing payments' 
            });
        }

        // If no payments, proceed with deletion
        const sql = 'DELETE FROM bookings WHERE booking_id = ?';
        db.run(sql, [req.params.id], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error deleting booking' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            res.json({ message: 'Booking deleted successfully' });
        });
    });
});

module.exports = router;