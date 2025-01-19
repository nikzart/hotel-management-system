const express = require('express');
const db = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Get all payments
router.get('/', authenticateToken, (req, res) => {
    const sql = `
        SELECT p.*, 
            b.check_in_date, b.check_out_date,
            g.first_name, g.last_name,
            r.room_number
        FROM payments p
        JOIN bookings b ON p.booking_id = b.booking_id
        JOIN guests g ON b.guest_id = g.guest_id
        JOIN rooms r ON b.room_id = r.room_id
        ORDER BY p.payment_date DESC
    `;

    db.all(sql, [], (err, payments) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching payments' });
        }
        res.json(payments);
    });
});

// Get payments for a specific booking
router.get('/booking/:bookingId', authenticateToken, (req, res) => {
    const sql = `
        SELECT p.*, b.total_amount as booking_total_amount
        FROM payments p
        JOIN bookings b ON p.booking_id = b.booking_id
        WHERE p.booking_id = ?
        ORDER BY p.payment_date DESC
    `;

    db.all(sql, [req.params.bookingId], (err, payments) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching payments' });
        }

        // Calculate total paid amount
        const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

        res.json({
            payments,
            summary: {
                totalPaid,
                bookingAmount: payments[0]?.booking_total_amount || 0,
                remainingAmount: (payments[0]?.booking_total_amount || 0) - totalPaid
            }
        });
    });
});

// Record new payment
router.post('/', authenticateToken, (req, res) => {
    const { booking_id, amount, payment_method, transaction_id } = req.body;

    if (!booking_id || !amount || !payment_method) {
        return res.status(400).json({ error: 'Booking ID, amount, and payment method are required' });
    }

    // First check if booking exists and get total amount
    db.get(
        'SELECT total_amount, payment_status FROM bookings WHERE booking_id = ?',
        [booking_id],
        (err, booking) => {
            if (err) {
                return res.status(500).json({ error: 'Error checking booking details' });
            }

            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            // Get total paid amount so far
            db.get(
                'SELECT SUM(amount) as paid_amount FROM payments WHERE booking_id = ?',
                [booking_id],
                (err, result) => {
                    if (err) {
                        return res.status(500).json({ error: 'Error calculating paid amount' });
                    }

                    const paidAmount = result.paid_amount || 0;
                    const newTotalPaid = paidAmount + amount;

                    // Check if payment would exceed total amount
                    if (newTotalPaid > booking.total_amount) {
                        return res.status(400).json({ 
                            error: 'Payment amount would exceed booking total amount' 
                        });
                    }

                    // Record payment
                    const sql = `
                        INSERT INTO payments (
                            booking_id, amount, payment_method, 
                            transaction_id, payment_status
                        )
                        VALUES (?, ?, ?, ?, 'completed')
                    `;

                    db.run(
                        sql,
                        [booking_id, amount, payment_method, transaction_id],
                        function(err) {
                            if (err) {
                                return res.status(500).json({ error: 'Error recording payment' });
                            }

                            // Update booking payment status
                            let newPaymentStatus = 'partial';
                            if (newTotalPaid >= booking.total_amount) {
                                newPaymentStatus = 'completed';
                            }

                            db.run(
                                'UPDATE bookings SET payment_status = ? WHERE booking_id = ?',
                                [newPaymentStatus, booking_id]
                            );

                            res.status(201).json({
                                message: 'Payment recorded successfully',
                                paymentId: this.lastID,
                                paymentStatus: newPaymentStatus
                            });
                        }
                    );
                }
            );
        }
    );
});

// Get payment details
router.get('/:id', authenticateToken, (req, res) => {
    const sql = `
        SELECT p.*, 
            b.check_in_date, b.check_out_date, b.total_amount as booking_total_amount,
            g.first_name, g.last_name,
            r.room_number
        FROM payments p
        JOIN bookings b ON p.booking_id = b.booking_id
        JOIN guests g ON b.guest_id = g.guest_id
        JOIN rooms r ON b.room_id = r.room_id
        WHERE p.payment_id = ?
    `;

    db.get(sql, [req.params.id], (err, payment) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching payment details' });
        }
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        res.json(payment);
    });
});

// Update payment status (admin only)
router.put('/:id/status', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const { status } = req.body;
    const validStatuses = ['completed', 'pending', 'failed', 'refunded'];

    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid payment status' });
    }

    const sql = 'UPDATE payments SET payment_status = ? WHERE payment_id = ?';

    db.run(sql, [status, req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error updating payment status' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        // Update booking payment status
        db.get(
            'SELECT booking_id FROM payments WHERE payment_id = ?',
            [req.params.id],
            (err, payment) => {
                if (!err && payment) {
                    // Recalculate total paid amount for booking
                    db.get(
                        `SELECT 
                            b.total_amount,
                            SUM(CASE WHEN p.payment_status = 'completed' THEN p.amount ELSE 0 END) as paid_amount
                        FROM bookings b
                        LEFT JOIN payments p ON b.booking_id = p.booking_id
                        WHERE b.booking_id = ?
                        GROUP BY b.booking_id`,
                        [payment.booking_id],
                        (err, result) => {
                            if (!err && result) {
                                const newStatus = result.paid_amount >= result.total_amount 
                                    ? 'completed' 
                                    : result.paid_amount > 0 ? 'partial' : 'pending';
                                
                                db.run(
                                    'UPDATE bookings SET payment_status = ? WHERE booking_id = ?',
                                    [newStatus, payment.booking_id]
                                );
                            }
                        }
                    );
                }
            }
        );

        res.json({ message: 'Payment status updated successfully' });
    });
});

// Get payment statistics (admin only)
router.get('/stats/summary', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const sql = `
        SELECT 
            COUNT(*) as total_payments,
            SUM(amount) as total_amount,
            AVG(amount) as average_amount,
            COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as completed_payments,
            COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payments,
            COUNT(CASE WHEN payment_status = 'failed' THEN 1 END) as failed_payments,
            SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END) as total_completed_amount
        FROM payments
        WHERE payment_date >= date('now', '-30 days')
    `;

    db.get(sql, [], (err, stats) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching payment statistics' });
        }
        res.json(stats);
    });
});

module.exports = router;