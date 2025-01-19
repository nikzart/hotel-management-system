const express = require('express');
const db = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Get all services
router.get('/', authenticateToken, (req, res) => {
    const sql = 'SELECT * FROM services WHERE status = "active" ORDER BY service_name';
    db.all(sql, [], (err, services) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching services' });
        }
        res.json(services);
    });
});

// Get single service
router.get('/:id', authenticateToken, (req, res) => {
    const sql = 'SELECT * FROM services WHERE service_id = ?';
    db.get(sql, [req.params.id], (err, service) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching service' });
        }
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }
        res.json(service);
    });
});

// Create new service (admin only)
router.post('/', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const { service_name, description, rate } = req.body;

    if (!service_name || !rate) {
        return res.status(400).json({ error: 'Service name and rate are required' });
    }

    const sql = `
        INSERT INTO services (service_name, description, rate)
        VALUES (?, ?, ?)
    `;

    db.run(sql, [service_name, description, rate], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error creating service' });
        }

        res.status(201).json({
            message: 'Service created successfully',
            serviceId: this.lastID
        });
    });
});

// Update service (admin only)
router.put('/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const { service_name, description, rate, status } = req.body;

    const updates = [];
    const values = [];

    if (service_name) {
        updates.push('service_name = ?');
        values.push(service_name);
    }
    if (description) {
        updates.push('description = ?');
        values.push(description);
    }
    if (rate) {
        updates.push('rate = ?');
        values.push(rate);
    }
    if (status) {
        updates.push('status = ?');
        values.push(status);
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No update data provided' });
    }

    const sql = `UPDATE services SET ${updates.join(', ')} WHERE service_id = ?`;
    values.push(req.params.id);

    db.run(sql, values, function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error updating service' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }

        res.json({ message: 'Service updated successfully' });
    });
});

// Create service request
router.post('/request', authenticateToken, (req, res) => {
    const { booking_id, service_id, notes } = req.body;

    if (!booking_id || !service_id) {
        return res.status(400).json({ error: 'Booking ID and service ID are required' });
    }

    // Verify booking exists and is active
    db.get(
        'SELECT booking_status FROM bookings WHERE booking_id = ?',
        [booking_id],
        (err, booking) => {
            if (err) {
                return res.status(500).json({ error: 'Error checking booking status' });
            }

            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            if (booking.booking_status !== 'checked_in') {
                return res.status(400).json({ 
                    error: 'Service requests can only be made for checked-in bookings' 
                });
            }

            // Create service request
            const sql = `
                INSERT INTO service_requests (booking_id, service_id, notes)
                VALUES (?, ?, ?)
            `;

            db.run(sql, [booking_id, service_id, notes], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Error creating service request' });
                }

                res.status(201).json({
                    message: 'Service request created successfully',
                    requestId: this.lastID
                });
            });
        }
    );
});

// Get service requests for a booking
router.get('/requests/booking/:bookingId', authenticateToken, (req, res) => {
    const sql = `
        SELECT sr.*, s.service_name, s.rate
        FROM service_requests sr
        JOIN services s ON sr.service_id = s.service_id
        WHERE sr.booking_id = ?
        ORDER BY sr.request_date DESC
    `;

    db.all(sql, [req.params.bookingId], (err, requests) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching service requests' });
        }
        res.json(requests);
    });
});

// Update service request status
router.put('/request/:id/status', authenticateToken, (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const sql = 'UPDATE service_requests SET status = ? WHERE request_id = ?';

    db.run(sql, [status, req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error updating service request status' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Service request not found' });
        }

        res.json({ message: 'Service request status updated successfully' });
    });
});

// Get all pending service requests (staff only)
router.get('/requests/pending', authenticateToken, authorizeRole(['admin', 'staff']), (req, res) => {
    const sql = `
        SELECT sr.*, 
            s.service_name,
            b.room_id,
            r.room_number,
            g.first_name, g.last_name
        FROM service_requests sr
        JOIN services s ON sr.service_id = s.service_id
        JOIN bookings b ON sr.booking_id = b.booking_id
        JOIN rooms r ON b.room_id = r.room_id
        JOIN guests g ON b.guest_id = g.guest_id
        WHERE sr.status = 'pending'
        ORDER BY sr.request_date ASC
    `;

    db.all(sql, [], (err, requests) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching pending service requests' });
        }
        res.json(requests);
    });
});

// Delete service (admin only)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
    // Check if service has any requests
    db.get(
        'SELECT COUNT(*) as count FROM service_requests WHERE service_id = ?',
        [req.params.id],
        (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Error checking service requests' });
            }

            if (result.count > 0) {
                // Instead of deleting, mark as inactive
                db.run(
                    'UPDATE services SET status = "inactive" WHERE service_id = ?',
                    [req.params.id],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ error: 'Error updating service status' });
                        }

                        if (this.changes === 0) {
                            return res.status(404).json({ error: 'Service not found' });
                        }

                        res.json({ 
                            message: 'Service marked as inactive due to existing requests' 
                        });
                    }
                );
            } else {
                // If no requests, proceed with deletion
                const sql = 'DELETE FROM services WHERE service_id = ?';
                db.run(sql, [req.params.id], function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Error deleting service' });
                    }

                    if (this.changes === 0) {
                        return res.status(404).json({ error: 'Service not found' });
                    }

                    res.json({ message: 'Service deleted successfully' });
                });
            }
        }
    );
});

module.exports = router;