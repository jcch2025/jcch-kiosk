const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 주문 데이터 저장 (서버 메모리에 저장)
let orders = [];

io.on('connection', (socket) => {
    console.log('클라이언트가 연결되었습니다:', socket.id);
    
    // 연결된 클라이언트에게 현재 모든 주문 데이터 전송
    socket.emit('all-orders', orders);
    
    // 새 주문 처리
    socket.on('new-order', (orderData) => {
        console.log('새 주문이 접수되었습니다:', orderData);
        
        // 주문 ID 생성
        orderData.id = Date.now().toString();
        orderData.status = 'pending';
        
        // 주문 데이터 저장
        orders.unshift(orderData);
        
        // 주문 데이터가 너무 많아지면 오래된 주문 삭제 (선택사항)
        if (orders.length > 1000) {
            orders = orders.slice(0, 1000);
        }
        
        // 모든 클라이언트에 새 주문 알림
        io.emit('new-order', orderData);
    });
    
    // 주문 상태 업데이트 처리
    socket.on('update-order-status', ({ orderId, status }) => {
        console.log(`주문 ${orderId}의 상태가 ${status}로 변경되었습니다.`);
        
        const order = orders.find(order => order.id === orderId);
        if (order) {
            order.status = status;
            
            // 모든 클라이언트에 상태 변경 알림
            io.emit('order-status-updated', { orderId, status });
        }
    });
    
    // 연결 해제 처리
    socket.on('disconnect', () => {
        console.log('클라이언트 연결이 해제되었습니다:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});
