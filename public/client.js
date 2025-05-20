document.addEventListener('DOMContentLoaded', function() {
    // 소켓 연결
    const socket = io('https://jcch-kiosk.onrender.com');
    
    // DOM 요소
    const customerNameInput = document.getElementById('customer-name');
    const cartItems = document.querySelector('.cart-items');
    const totalAmount = document.getElementById('total-amount');
    const orderBtn = document.getElementById('order-btn');
    const orderComplete = document.getElementById('order-complete');
    const orderNumber = document.getElementById('order-number');
    const closeModal = document.getElementById('close-modal');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const menuContainers = document.querySelectorAll('.menu-container');
    const menuItems = document.querySelectorAll('.menu-item');

    // 장바구니 데이터
    let cart = [];

    // 탭 전환 이벤트
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 모든 탭 비활성화
            tabBtns.forEach(b => b.classList.remove('active'));
            // 클릭한 탭 활성화
            btn.classList.add('active');
            
            // 모든 메뉴 컨테이너 숨기기
            menuContainers.forEach(container => {
                container.style.display = 'none';
            });
            
            // 선택한 카테고리의 메뉴 컨테이너 표시
            const category = btn.dataset.category;
            document.getElementById(category).style.display = 'grid';
        });
    });

    // 수량 증가 및 감소 이벤트 처리
    menuItems.forEach(item => {
        const decreaseBtn = item.querySelector('.decrease');
        const increaseBtn = item.querySelector('.increase');
        const quantitySpan = item.querySelector('.quantity');
        
        decreaseBtn.addEventListener('click', () => {
            let quantity = parseInt(quantitySpan.textContent);
            if (quantity > 0) {
                quantity--;
                quantitySpan.textContent = quantity;
                updateCart(item, quantity);
            }
        });
        
        increaseBtn.addEventListener('click', () => {
            let quantity = parseInt(quantitySpan.textContent);
            quantity++;
            quantitySpan.textContent = quantity;
            updateCart(item, quantity);
        });
    });

    // 장바구니 업데이트
    function updateCart(item, quantity) {
        const id = item.dataset.id;
        const name = item.dataset.name;
        const price = parseInt(item.dataset.price);
        const tempOption = item.dataset.tempOption === "true";
        
        // 온도 옵션 가져오기
        let temperature = "기본";
        if (tempOption) {
            const tempRadio = item.querySelector('input[type="radio"]:checked');
            if (tempRadio) {
                temperature = tempRadio.value === "hot" ? "HOT" : "ICE";
            }
        } else if (item.querySelector('.ice-only')) {
            temperature = "ICE";
        }
        
        // 고유 식별자 생성 (상품ID + 온도옵션)
        const cartItemId = `${id}-${temperature}`;
        
        const existingItemIndex = cart.findIndex(cartItem => cartItem.cartItemId === cartItemId);
        
        if (existingItemIndex !== -1) {
            if (quantity === 0) {
                cart.splice(existingItemIndex, 1);
            } else {
                cart[existingItemIndex].quantity = quantity;
            }
        } else if (quantity > 0) {
            cart.push({ 
                cartItemId,
                id, 
                name, 
                price, 
                temperature,
                quantity,
                canChangeTemp: tempOption
            });
        }
        
        renderCart();
    }

    // 장바구니 렌더링
    function renderCart() {
        cartItems.innerHTML = '';
        let total = 0;
        
        cart.forEach(item => {
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            
            // 온도 옵션이 있는 경우 표시
            const tempDisplay = item.temperature !== "기본" ? `(${item.temperature})` : "";
            
            // 장바구니 아이템 내용
            let cartItemHTML = `
                <span>${item.name} ${tempDisplay}</span>
                <div class="cart-item-controls">
                    <button class="cart-decrease" data-id="${item.cartItemId}">-</button>
                    <span class="cart-quantity">${item.quantity}</span>
                    <button class="cart-increase" data-id="${item.cartItemId}">+</button>
                </div>
                <span class="cart-price">${(item.price * item.quantity).toLocaleString()}원</span>
                <button class="remove-btn" data-id="${item.cartItemId}">삭제</button>
            `;
            
            // 온도 변경 가능한 상품인 경우 드롭다운 추가
            if (item.canChangeTemp) {
                cartItemHTML += `
                    <select class="temp-select" data-id="${item.cartItemId}">
                        <option value="hot" ${item.temperature === "HOT" ? "selected" : ""}>HOT</option>
                        <option value="ice" ${item.temperature === "ICE" ? "selected" : ""}>ICE</option>
                    </select>
                `;
            }
            
            cartItem.innerHTML = cartItemHTML;
            cartItems.appendChild(cartItem);
            
            total += item.price * item.quantity;
        });
        
        totalAmount.textContent = total.toLocaleString();
        
        // 장바구니 내 삭제 버튼 이벤트 리스너
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const index = cart.findIndex(item => item.cartItemId === id);
                if (index !== -1) {
                    cart.splice(index, 1);
                    renderCart();
                }
            });
        });
        
        // 장바구니 내 수량 증가/감소 버튼 이벤트 리스너
        document.querySelectorAll('.cart-decrease').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const index = cart.findIndex(item => item.cartItemId === id);
                if (index !== -1) {
                    if (cart[index].quantity > 1) {
                        cart[index].quantity--;
                    } else {
                        cart.splice(index, 1);
                    }
                    renderCart();
                }
            });
        });
        
        document.querySelectorAll('.cart-increase').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const index = cart.findIndex(item => item.cartItemId === id);
                if (index !== -1) {
                    cart[index].quantity++;
                    renderCart();
                }
            });
        });
        
        // 온도 선택 드롭다운 이벤트 리스너
        document.querySelectorAll('.temp-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                const newTemp = e.target.value.toUpperCase();
                const index = cart.findIndex(item => item.cartItemId === id);
                
                if (index !== -1) {
                    const item = cart[index];
                    // 새로운 cartItemId 생성
                    const newCartItemId = `${item.id}-${newTemp}`;
                    
                    // 이미 같은 상품+온도 조합이 있는지 확인
                    const existingIndex = cart.findIndex(ci => ci.cartItemId === newCartItemId);
                    
                    if (existingIndex !== -1 && existingIndex !== index) {
                        // 이미 같은 상품+온도 조합이 있으면 수량 합치기
                        cart[existingIndex].quantity += item.quantity;
                        cart.splice(index, 1);
                    } else {
                        // 없으면 온도만 변경
                        item.temperature = newTemp;
                        item.cartItemId = newCartItemId;
                    }
                    
                    renderCart();
                }
            });
        });
    }

    // 주문 버튼 클릭 이벤트
    orderBtn.addEventListener('click', () => {
        const customerName = customerNameInput.value.trim();
        
        if (!customerName) {
            alert('주문자 이름을 입력해주세요.');
            return;
        }
        
        if (cart.length === 0) {
            alert('메뉴를 선택해주세요.');
            return;
        }
        
        // 주문 데이터 생성
        const orderData = {
            customerName,
            items: cart,
            totalAmount: parseInt(totalAmount.textContent.replace(/,/g, '')),
            orderTime: new Date().toISOString()
        };
        
        // 소켓으로 주문 데이터 전송
        socket.emit('new-order', orderData);
        
        // 주문 완료 모달 표시
        const randomOrderNumber = Math.floor(Math.random() * 1000) + 1;
        orderNumber.textContent = randomOrderNumber;
        orderComplete.style.display = 'flex';
        
        // 장바구니 초기화
        cart = [];
        renderCart();
        
        // 메뉴 수량 초기화
        menuItems.forEach(item => {
            item.querySelector('.quantity').textContent = '0';
        });
    });

    // 모달 닫기 버튼 클릭 이벤트
    closeModal.addEventListener('click', () => {
        orderComplete.style.display = 'none';
        customerNameInput.value = '';
    });
    
    // 온도 옵션 변경 이벤트
    document.querySelectorAll('.temp-option input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const menuItem = this.closest('.menu-item');
            const quantity = parseInt(menuItem.querySelector('.quantity').textContent);
            
            if (quantity > 0) {
                updateCart(menuItem, quantity);
            }
        });
    });

    // 소켓 연결 확인
    socket.on('connect', () => {
        console.log('소켓 서버에 연결되었습니다.');
    });

    socket.on('connect_error', (error) => {
        console.error('소켓 서버 연결 오류:', error);
    });
});
