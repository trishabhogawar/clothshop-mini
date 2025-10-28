let PRODUCTS = [];
let CART = []; // {id, name, price, size, qty, img}

function addToCart(p, size){
  const key = p.id + "::" + size;
  const found = CART.find(i => (i.id+"::"+i.size)===key);
  if(found){ found.qty += 1; }
  else{
    CART.push({id:p.id, name:p.name, price:p.price, size, qty:1, img:p.img});
  }
  renderCart();
}

function removeFromCart(key){
  CART = CART.filter(i => (i.id+"::"+i.size)!==key);
  renderCart();
}

function renderProducts(){
  const grid = document.getElementById('product-grid');
  grid.innerHTML = PRODUCTS.map(p => `
    <div class="card product">
      <img src="${p.img}" alt="${p.name}">
      <h4>${p.name}</h4>
      <div class="muted">${p.brand}</div>
      <div>₹${p.price}</div>
      <div>
        <select id="size-${p.id}">
          ${p.size.map(s=>`<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
      <button onclick="addToCart(PRODUCTS.find(x=>x.id===${p.id}), document.getElementById('size-${p.id}').value)">Add to cart</button>
    </div>
  `).join('');
}

function renderCart(){
  const box = document.getElementById('cart-items');
  const total = CART.reduce((s,i)=> s + (i.price * i.qty), 0);
  document.getElementById('total').innerText = "₹"+total;
  if(CART.length===0){
    box.innerHTML = '<p class="muted">Your cart is empty.</p>';
    return;
  }
  box.innerHTML = CART.map(i=>{
    const key = i.id+"::"+i.size;
    return `<div class="row">
      <div>${i.name} (${i.size}) × ${i.qty}</div>
      <div>₹${i.price * i.qty}</div>
      <a href="#" onclick="removeFromCart('${key}')">x</a>
    </div>`;
  }).join('');
}

async function loadProducts(){
  const res = await fetch('/api/products');
  PRODUCTS = await res.json();
  renderProducts();
  renderCart();
}

async function checkout(){
  if(CART.length===0){ alert('Cart empty'); return; }
  const address = document.getElementById('address').value.trim();
  const payment = document.getElementById('payment').value;
  const total = CART.reduce((s,i)=> s + (i.price * i.qty), 0);

  const body = {
    items: CART,
    total: total,
    address: address,
    payment: payment
  };
  const res = await fetch('/api/checkout', {
    method:'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  const out = await res.json();
  if(out.ok){
    alert('Order placed: '+ out.order_id);
    CART = [];
    renderCart();
    window.location = '/orders';
  }else{
    alert('Failed: '+ (out.error||'unknown'));
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  loadProducts();
  const btn = document.getElementById('checkout-btn');
  if(btn) btn.addEventListener('click', checkout);
});
// --- Toast ---
function showToast(msg){
  const el = document.getElementById('toast');
  if(!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(()=> el.classList.remove('show'), 1200);
}

// Hook your existing "add to cart" buttons (delegated)
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('.btn-add, .btn');
  if(!btn) return;
  showToast('Added to cart ✓');
});

// --- Search + chips filter (works if each product element has data-brand + data-name) ---
const search = document.getElementById('search');
const grid = document.getElementById('product-grid');
function applyFilters(){
  const q = (search?.value || '').toLowerCase();
  const activeChip = document.querySelector('.chip.active')?.dataset.chip || 'all';
  [...(grid?.children || [])].forEach(card=>{
    const name = (card.dataset.name || '').toLowerCase();
    const brand = (card.dataset.brand || '').toLowerCase();
    const chipOK = (activeChip==='all') || (brand === activeChip.toLowerCase());
    const searchOK = !q || name.includes(q) || brand.includes(q);
    card.style.display = (chipOK && searchOK) ? '' : 'none';
  });
}
search?.addEventListener('input', applyFilters);
document.addEventListener('click', (e)=>{
  const c = e.target.closest('.chip'); if(!c) return;
  document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));
  c.classList.add('active'); applyFilters();
});

// --- Optional: Skeleton while loading (use if you render via fetch/timeout) ---
function mountSkeletons(n=8){
  if(!grid) return;
  grid.innerHTML = '';
  for(let i=0;i<n;i++){
    const s = document.createElement('div');
    s.className = 'skeleton';
    s.style.height = '340px';
    s.style.borderRadius = '18px';
    grid.appendChild(s);
  }
}
// Example usage before your data render:
// mountSkeletons();  // then replace with real cards once products are ready

// --- Improve checkout enable/disable on cart changes ---
const itemsEl = document.getElementById('cart-items');
const emptyEl = document.getElementById('cart-empty');
const checkoutBtn = document.getElementById('checkout-btn');
function refreshCheckoutState(){
  if(!itemsEl || !checkoutBtn || !emptyEl) return;
  const hasItems = itemsEl.children.length > 0;
  emptyEl.style.display = hasItems ? 'none' : '';
  checkoutBtn.disabled = !hasItems;
}
const mo = itemsEl ? new MutationObserver(refreshCheckoutState) : null;
mo?.observe(itemsEl, { childList:true });
refreshCheckoutState();
