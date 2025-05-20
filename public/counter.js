document.addEventListener('DOMContentLoaded', function() {
    // 로그인 확인
    if (!isLoggedIn()) {
        // 로그인되지 않은 경우 로그인 페이지로 리디렉션
        window.location.href = 'counter-login.html';
        return;
    }
    
    // 현재 날짜 표시
    const currentDate = new Date();
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    document.getElementById('current-date').textContent = currentDate.toLocaleDateString('ko-KR', dateOptions);
    
    // 소켓 연결
    const socket = io('https://jcch-kiosk.onrender.com');
    
    // DOM 요소
    const ordersList = document.getElementById('orders-list');
    const exportCsvBtn = document.getElementById('export-csv');
    const statusFilter = document.getElementById('status-filter');
    const searchInput = document.getElementById('search-orders');
    const noOrdersMessage = document.querySelector('.no-orders-message');
    const orderDetailsModal = document.getElementById('order-details-modal');
    
    // 주문 데이터 저장
    let orders = [];
    
    // 소켓 이벤트 리스너
    socket.on('connect', () => {
        console.log('소켓 서버에 연결되었습니다.');
        // 기존 주문 데이터 요청
        socket.emit('get-orders');
    });
    
    socket.on('all-orders', (data) => {
        orders = data;
        renderOrders();
    });
    
    socket.on('new-order', (order) => {
        // 새 주문 추가
        orders.unshift(order);
        renderOrders();
        
        // 알림 소리 재생
        playNotificationSound();
    });
    
    socket.on('order-status-updated', ({ orderId, status }) => {
        // 주문 상태 업데이트
        const order = orders.find(order => order.id === orderId);
        if (order) {
            order.status = status;
            renderOrders();
        }
    });
    
    // 주문 목록 렌더링
    function renderOrders(filteredOrders = null) {
        const ordersToRender = filteredOrders || orders;
        ordersList.innerHTML = '';
        
        if (ordersToRender.length === 0) {
            noOrdersMessage.style.display = 'block';
        } else {
            noOrdersMessage.style.display = 'none';
            
            ordersToRender.forEach(order => {
                const tr = document.createElement('tr');
                
                // 주문 시간 포맷팅
                const orderTime = new Date(order.orderTime);
                const formattedTime = orderTime.toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                // 주문 항목 포맷팅
                const orderItems = order.items.map(item => {
                    const tempDisplay = item.temperature ? `(${item.temperature})` : "";
                    return `${item.name} ${tempDisplay} x ${item.quantity}`;
                }).join(', ');
                
                tr.innerHTML = `
                    <td>${order.id}</td>
                    <td>${order.customerName}</td>
                    <td>${formattedTime}</td>
                    <td>${orderItems}</td>
                    <td>${order.totalAmount.toLocaleString()}원</td>
                    <td><span class="status status-${order.status}">${getStatusText(order.status)}</span></td>
                    <td class="order-actions">
                        <button class="view-btn" data-id="${order.id}">
                            <i class="fas fa-eye"></i> 상세
                        </button>
                        ${order.status === 'pending' ? `
                            <button class="complete-btn" data-id="${order.id}">
                                <i class="fas fa-check"></i> 완료
                            </button>
                            <button class="cancel-btn" data-id="${order.id}">
                                <i class="fas fa-times"></i> 취소
                            </button>
                        ` : ''}
                    </td>
                `;
                
                ordersList.appendChild(tr);
            });
            
            // 상세 보기 버튼 이벤트 리스너
            document.querySelectorAll('.view-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const orderId = btn.dataset.id;
                    showOrderDetails(orderId);
                });
            });
            
            // 완료 및 취소 버튼 이벤트 리스너
            document.querySelectorAll('.complete-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const orderId = btn.dataset.id;
                    updateOrderStatus(orderId, 'completed');
                });
            });
            
            document.querySelectorAll('.cancel-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const orderId = btn.dataset.id;
                    updateOrderStatus(orderId, 'cancelled');
                });
            });
        }
    }
    
    // 주문 상태 업데이트
    function updateOrderStatus(orderId, status) {
        const order = orders.find(order => order.id === orderId);
        if (order) {
            order.status = status;
            
            // 서버에 상태 업데이트 알림
            socket.emit('update-order-status', { orderId, status });
            
            renderOrders();
        }
    }
    
    // 주문 상태 텍스트 반환
    function getStatusText(status) {
        switch (status) {
            case 'pending': return '대기중';
            case 'completed': return '완료';
            case 'cancelled': return '취소';
            default: return status;
        }
    }
    
    // 주문 상세 정보 표시
    function showOrderDetails(orderId) {
        const order = orders.find(order => order.id === orderId);
        if (!order) return;
        
        // 주문 기본 정보 설정
        document.getElementById('detail-order-id').textContent = order.id;
        document.getElementById('detail-customer-name').textContent = order.customerName;
        
        const orderTime = new Date(order.orderTime);
        document.getElementById('detail-order-time').textContent = orderTime.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const statusElement = document.getElementById('detail-status');
        statusElement.textContent = getStatusText(order.status);
        statusElement.className = `value status status-${order.status}`;
        
        // 주문 항목 설정
        const itemsList = document.getElementById('detail-items-list');
        itemsList.innerHTML = '';
        
        order.items.forEach(item => {
            const tr = document.createElement('tr');
            const tempDisplay = item.temperature ? item.temperature : "-";
            
            tr.innerHTML = `
                <td>${item.name}</td>
                <td>${tempDisplay}</td>
                <td>${item.quantity}</td>
                <td>${(item.price * item.quantity).toLocaleString()}원</td>
            `;
            
            itemsList.appendChild(tr);
        });
        
        document.getElementById('detail-total-amount').textContent = `${order.totalAmount.toLocaleString()}원`;
        
        // 버튼 상태 설정
        const completeBtn = document.getElementById('detail-complete-btn');
        const cancelBtn = document.getElementById('detail-cancel-btn');
        
        if (order.status === 'pending') {
            completeBtn.style.display = 'block';
            cancelBtn.style.display = 'block';
            
            completeBtn.onclick = () => {
                updateOrderStatus(order.id, 'completed');
                orderDetailsModal.style.display = 'none';
            };
            
            cancelBtn.onclick = () => {
                updateOrderStatus(order.id, 'cancelled');
                orderDetailsModal.style.display = 'none';
            };
        } else {
            completeBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
        }
        
        // 모달 표시
        orderDetailsModal.style.display = 'flex';
    }
    
    // 모달 닫기 버튼
    document.querySelector('.close-modal').addEventListener('click', () => {
        orderDetailsModal.style.display = 'none';
    });
    
    // 모달 외부 클릭 시 닫기
    window.addEventListener('click', (e) => {
        if (e.target === orderDetailsModal) {
            orderDetailsModal.style.display = 'none';
        }
    });
    
    // 상태 필터링
    statusFilter.addEventListener('change', () => {
        const selectedStatus = statusFilter.value;
        if (selectedStatus === 'all') {
            renderOrders();
        } else {
            const filteredOrders = orders.filter(order => order.status === selectedStatus);
            renderOrders(filteredOrders);
        }
    });
    
    // 주문 검색
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        if (searchTerm === '') {
            renderOrders();
        } else {
            const filteredOrders = orders.filter(order => 
                order.id.toLowerCase().includes(searchTerm) ||
                order.customerName.toLowerCase().includes(searchTerm) ||
                order.items.some(item => item.name.toLowerCase().includes(searchTerm))
            );
            renderOrders(filteredOrders);
        }
    });
    
    // CSV 내보내기
    exportCsvBtn.addEventListener('click', () => {
        if (orders.length === 0) {
            alert('내보낼 주문 내역이 없습니다.');
            return;
        }
        
        // CSV 헤더
        let csvContent = '주문번호,주문자,주문시각,주문내역,총액,상태\n';
        
        // CSV 데이터 행
        orders.forEach(order => {
            const orderTime = new Date(order.orderTime);
            const formattedTime = orderTime.toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const orderItems = order.items.map(item => {
                const tempDisplay = item.temperature ? `(${item.temperature})` : "";
                return `${item.name} ${tempDisplay} x ${item.quantity}`;
            }).join(', ');
            
            const statusText = getStatusText(order.status);
            
            // CSV 행 추가
            csvContent += `${order.id},${order.customerName},${formattedTime},"${orderItems}",${order.totalAmount},${statusText}\n`;
        });
        
        // CSV 파일 다운로드
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `주문내역_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
    
    // 알림 소리 재생
    function playNotificationSound() {
        const audio = new Audio('notification.mp3');
        audio.play().catch(error => {
            console.warn('알림 소리 재생 실패:', error);
        });
    }
    
    // 로그인 상태 확인
    function isLoggedIn() {
        return sessionStorage.getItem('counterLoggedIn') === 'true';
    }
    
    // 로그아웃 기능 추가
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('counterLoggedIn');
            window.location.href = 'counter-login.html';
        });
    }
});
