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
