const db = require('./database');

// Create tables for chat and food menu
const createChatTables = () => {
    const schema = `
        CREATE TABLE IF NOT EXISTS chat_messages (
            message_id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            sender_type TEXT NOT NULL,  -- 'guest' or 'staff'
            receiver_id INTEGER NOT NULL,
            receiver_type TEXT NOT NULL,  -- 'guest' or 'staff'
            message TEXT NOT NULL,
            message_type TEXT DEFAULT 'text',  -- 'text', 'service_request', 'food_order'
            status TEXT DEFAULT 'sent',  -- 'sent', 'delivered', 'read'
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS food_menu (
            item_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price DECIMAL NOT NULL,
            category TEXT NOT NULL,
            availability BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS food_orders (
            order_id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER NOT NULL,
            guest_id INTEGER NOT NULL,
            room_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',  -- 'pending', 'confirmed', 'preparing', 'delivered', 'cancelled'
            total_amount DECIMAL NOT NULL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
            FOREIGN KEY (guest_id) REFERENCES guests(guest_id),
            FOREIGN KEY (room_id) REFERENCES rooms(room_id)
        );

        CREATE TABLE IF NOT EXISTS food_order_items (
            order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            price DECIMAL NOT NULL,
            notes TEXT,
            FOREIGN KEY (order_id) REFERENCES food_orders(order_id),
            FOREIGN KEY (item_id) REFERENCES food_menu(item_id)
        );

        CREATE TABLE IF NOT EXISTS chat_service_requests (
            request_id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            service_type TEXT NOT NULL,  -- 'room_cleaning', 'maintenance', 'amenities', etc.
            status TEXT DEFAULT 'pending',  -- 'pending', 'accepted', 'completed', 'cancelled'
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES chat_messages(message_id)
        );
    `;

    db.exec(schema, (err) => {
        if (err) {
            console.error('Error creating chat tables:', err);
            return;
        }
        console.log('Chat and food menu tables created successfully');
    });
};

module.exports = createChatTables;