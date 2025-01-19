const express = require('express');
const db = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Get all menu items
router.get('/menu', authenticateToken, (req, res) => {
    const sql = 'SELECT * FROM food_menu WHERE availability = 1 ORDER BY category, name';
    db.all(sql, [], (err, items) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching menu items' });
        }
        res.json(items);
    });
});

// Add menu item (admin/staff only)
router.post('/menu', authenticateToken, authorizeRole(['admin', 'staff']), (req, res) => {
    const { name, description, price, category } = req.body;

    if (!name || !price || !category) {
        return res.status(400).json({ error: 'Name, price, and category are required' });
    }

    const sql = `
        INSERT INTO food_menu (name, description, price, category)
        VALUES (?, ?, ?, ?)
    `;

    db.run(sql, [name, description, price, category], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error creating menu item' });
        }

        res.status(201).json({
            message: 'Menu item created successfully',
            itemId: this.lastID
        });
    });
});

// Update menu item (admin/staff only)
router.put('/menu/:id', authenticateToken, authorizeRole(['admin', 'staff']), (req, res) => {
    const { name, description, price, category, availability } = req.body;

    const updates = [];
    const values = [];

    if (name) {
        updates.push('name = ?');
        values.push(name);
    }
    if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
    }
    if (price) {
        updates.push('price = ?');
        values.push(price);
    }
    if (category) {
        updates.push('category = ?');
        values.push(category);
    }
    if (availability !== undefined) {
        updates.push('availability = ?');
        values.push(availability);
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No update data provided' });
    }

    const sql = `UPDATE food_menu SET ${updates.join(', ')} WHERE item_id = ?`;
    values.push(req.params.id);

    db.run(sql, values, function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error updating menu item' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        res.json({ message: 'Menu item updated successfully' });
    });
});

// Get food orders
router.get('/orders', authenticateToken, (req, res) => {
    const sql = `
        SELECT fo.*,
            json_group_array(
                json_object(
                    'item_id', foi.item_id,
                    'name', fm.name,
                    'quantity', foi.quantity,
                    'price', foi.price,
                    'notes', foi.notes
                )
            ) as items,
            g.first_name, g.last_name,
            r.room_number
        FROM food_orders fo
        JOIN food_order_items foi ON fo.order_id = foi.order_id
        JOIN food_menu fm ON foi.item_id = fm.item_id
        JOIN guests g ON fo.guest_id = g.guest_id
        JOIN rooms r ON fo.room_id = r.room_id
        GROUP BY fo.order_id
        ORDER BY fo.created_at DESC
    `;

    db.all(sql, [], (err, orders) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching orders' });
        }

        // Parse items from JSON string to array
        orders.forEach(order => {
            order.items = JSON.parse(order.items);
        });

        res.json(orders);
    });
});

// Get single order
router.get('/orders/:id', authenticateToken, (req, res) => {
    const sql = `
        SELECT fo.*,
            json_group_array(
                json_object(
                    'item_id', foi.item_id,
                    'name', fm.name,
                    'quantity', foi.quantity,
                    'price', foi.price,
                    'notes', foi.notes
                )
            ) as items,
            g.first_name, g.last_name,
            r.room_number
        FROM food_orders fo
        JOIN food_order_items foi ON fo.order_id = foi.order_id
        JOIN food_menu fm ON foi.item_id = fm.item_id
        JOIN guests g ON fo.guest_id = g.guest_id
        JOIN rooms r ON fo.room_id = r.room_id
        WHERE fo.order_id = ?
        GROUP BY fo.order_id
    `;

    db.get(sql, [req.params.id], (err, order) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching order' });
        }

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Parse items from JSON string to array
        order.items = JSON.parse(order.items);

        res.json(order);
    });
});

// Update order status (staff only)
router.put('/orders/:id/status', authenticateToken, authorizeRole(['admin', 'staff']), (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'delivered', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const sql = 'UPDATE food_orders SET status = ? WHERE order_id = ?';

    db.run(sql, [status, req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error updating order status' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Notify through Socket.IO if needed
        // This will be handled by the chat manager

        res.json({ message: 'Order status updated successfully' });
    });
});

// Get menu categories (for filtering)
router.get('/menu/categories', authenticateToken, (req, res) => {
    const sql = 'SELECT DISTINCT category FROM food_menu ORDER BY category';
    db.all(sql, [], (err, categories) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching categories' });
        }
        res.json(categories.map(cat => cat.category));
    });
});

module.exports = router;