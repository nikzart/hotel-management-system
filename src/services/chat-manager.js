const db = require('../config/database');

class ChatManager {
    constructor(io) {
        this.io = io;
        this.connectedUsers = new Map(); // Map of userId -> socket
        this.initializeSocketHandlers();
    }

    initializeSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('New client connected');

            // Handle user authentication
            socket.on('authenticate', async (data) => {
                try {
                    const { userId, userType, token } = data;
                    // Verify token here if needed
                    
                    // Store user connection
                    this.connectedUsers.set(userId, {
                        socket,
                        userType,
                        rooms: new Set()
                    });

                    // Join user to their specific room
                    const roomId = `${userType}_${userId}`;
                    socket.join(roomId);
                    this.connectedUsers.get(userId).rooms.add(roomId);

                    // Send connection acknowledgment
                    socket.emit('authenticated', { status: 'success' });

                    // Load user's chat history
                    const history = await this.getChatHistory(userId, userType);
                    socket.emit('chat_history', history);
                } catch (error) {
                    socket.emit('error', { message: 'Authentication failed' });
                }
            });

            // Handle private messages
            socket.on('private_message', async (data) => {
                try {
                    const { senderId, senderType, receiverId, receiverType, message, messageType } = data;
                    
                    // Store message in database
                    const sql = `
                        INSERT INTO chat_messages (
                            sender_id, sender_type, receiver_id, 
                            receiver_type, message, message_type
                        )
                        VALUES (?, ?, ?, ?, ?, ?)
                    `;

                    db.run(
                        sql,
                        [senderId, senderType, receiverId, receiverType, message, messageType],
                        function(err) {
                            if (err) {
                                socket.emit('error', { message: 'Failed to save message' });
                                return;
                            }

                            const messageData = {
                                messageId: this.lastID,
                                senderId,
                                senderType,
                                receiverId,
                                receiverType,
                                message,
                                messageType,
                                timestamp: new Date().toISOString()
                            };

                            // Send to receiver if online
                            const receiverRoom = `${receiverType}_${receiverId}`;
                            this.io.to(receiverRoom).emit('new_message', messageData);

                            // Send confirmation to sender
                            socket.emit('message_sent', messageData);
                        }
                    );
                } catch (error) {
                    socket.emit('error', { message: 'Failed to send message' });
                }
            });

            // Handle service requests
            socket.on('service_request', async (data) => {
                try {
                    const { senderId, serviceType, notes } = data;
                    
                    // Create service request message
                    const message = JSON.stringify({
                        type: 'service_request',
                        serviceType,
                        notes
                    });

                    // Store in chat_messages and chat_service_requests
                    db.run('BEGIN TRANSACTION');

                    db.run(
                        `INSERT INTO chat_messages (
                            sender_id, sender_type, receiver_id, 
                            receiver_type, message, message_type
                        )
                        VALUES (?, 'guest', 0, 'staff', ?, 'service_request')`,
                        [senderId, message],
                        function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                socket.emit('error', { message: 'Failed to create service request' });
                                return;
                            }

                            const messageId = this.lastID;

                            db.run(
                                `INSERT INTO chat_service_requests (
                                    message_id, service_type, notes
                                )
                                VALUES (?, ?, ?)`,
                                [messageId, serviceType, notes],
                                (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        socket.emit('error', { message: 'Failed to create service request' });
                                        return;
                                    }

                                    db.run('COMMIT');

                                    // Notify all staff members
                                    this.io.to('staff').emit('new_service_request', {
                                        messageId,
                                        senderId,
                                        serviceType,
                                        notes,
                                        timestamp: new Date().toISOString()
                                    });

                                    // Confirm to sender
                                    socket.emit('service_request_created', {
                                        messageId,
                                        serviceType,
                                        status: 'pending'
                                    });
                                }
                            );
                        }
                    );
                } catch (error) {
                    socket.emit('error', { message: 'Failed to create service request' });
                }
            });

            // Handle food orders
            socket.on('food_order', async (data) => {
                try {
                    const { bookingId, guestId, roomId, items, notes } = data;
                    
                    // Calculate total amount
                    let totalAmount = 0;
                    const itemPromises = items.map(item => {
                        return new Promise((resolve, reject) => {
                            db.get(
                                'SELECT price FROM food_menu WHERE item_id = ? AND availability = 1',
                                [item.itemId],
                                (err, row) => {
                                    if (err) reject(err);
                                    if (!row) reject(new Error('Item not available'));
                                    totalAmount += row.price * item.quantity;
                                    resolve({ ...item, price: row.price });
                                }
                            );
                        });
                    });

                    const validatedItems = await Promise.all(itemPromises);

                    // Create order
                    db.run('BEGIN TRANSACTION');

                    db.run(
                        `INSERT INTO food_orders (
                            booking_id, guest_id, room_id, 
                            total_amount, notes
                        )
                        VALUES (?, ?, ?, ?, ?)`,
                        [bookingId, guestId, roomId, totalAmount, notes],
                        function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                socket.emit('error', { message: 'Failed to create food order' });
                                return;
                            }

                            const orderId = this.lastID;

                            // Insert order items
                            const itemValues = validatedItems.map(item => 
                                `(${orderId}, ${item.itemId}, ${item.quantity}, ${item.price}, ${item.notes || null})`
                            ).join(',');

                            db.run(
                                `INSERT INTO food_order_items (
                                    order_id, item_id, quantity, price, notes
                                ) 
                                VALUES ${itemValues}`,
                                [],
                                (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        socket.emit('error', { message: 'Failed to create food order' });
                                        return;
                                    }

                                    db.run('COMMIT');

                                    // Notify staff
                                    this.io.to('staff').emit('new_food_order', {
                                        orderId,
                                        bookingId,
                                        guestId,
                                        roomId,
                                        items: validatedItems,
                                        totalAmount,
                                        notes,
                                        timestamp: new Date().toISOString()
                                    });

                                    // Confirm to guest
                                    socket.emit('food_order_created', {
                                        orderId,
                                        status: 'pending',
                                        totalAmount
                                    });
                                }
                            );
                        }
                    );
                } catch (error) {
                    socket.emit('error', { message: 'Failed to create food order' });
                }
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                // Remove user from connected users
                for (const [userId, userData] of this.connectedUsers.entries()) {
                    if (userData.socket === socket) {
                        this.connectedUsers.delete(userId);
                        break;
                    }
                }
                console.log('Client disconnected');
            });
        });
    }

    async getChatHistory(userId, userType) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM chat_messages 
                WHERE (sender_id = ? AND sender_type = ?)
                OR (receiver_id = ? AND receiver_type = ?)
                ORDER BY created_at DESC LIMIT 50
            `;

            db.all(sql, [userId, userType, userId, userType], (err, messages) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(messages);
            });
        });
    }

    // Utility method to broadcast to all staff members
    broadcastToStaff(event, data) {
        this.io.to('staff').emit(event, data);
    }

    // Utility method to send message to specific user
    sendToUser(userId, userType, event, data) {
        const roomId = `${userType}_${userId}`;
        this.io.to(roomId).emit(event, data);
    }
}

module.exports = ChatManager;