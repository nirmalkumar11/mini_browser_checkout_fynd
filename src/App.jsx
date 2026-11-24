import { useEffect, useRef, useState } from 'react';
import { ApiError, createOrder, fetchProducts } from './api.js';
import { formatCents } from './money.js';
import QuantityInput from './components/QuantityInput.jsx';
import Confirmation from './components/Confirmation.jsx';

const EMPTY_CART_MESSAGE = 'Your cart is empty. Add at least one item to place an order.';
const NAME_REQUIRED_MESSAGE = 'Full name is required.';

export default function App() {
  const [catalog, setCatalog] = useState(null); // { products, maxQuantity }
  const [catalogError, setCatalogError] = useState(false);
  const [cart, setCart] = useState({}); // productId -> quantity (integer, 1..max)
  const [name, setName] = useState('');
  const [nameInvalid, setNameInvalid] = useState(false);
  const [cartInvalid, setCartInvalid] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState(null); // the server's confirmation

  // True while a request is in flight and after an order is confirmed. A ref (not state)
  // so two submits fired inside one task, e.g. a fast Enter repeat, cannot both get through.
  const locked = useRef(false);
  const nameInput = useRef(null);
  const pendingFocus = useRef(false);

  const loadCatalog = () => {
    setCatalogError(false);
    fetchProducts().then(setCatalog, () => setCatalogError(true));
  };
  useEffect(loadCatalog, []);

  // When the focused cart line disappears (or a new order starts), hand focus to the
  // first Remove button, or the first Add button, so keyboard users keep their place.
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    (document.querySelector('[data-remove]') ?? document.querySelector('[data-add]'))?.focus();
  });

  const products = catalog?.products ?? [];
  const maxQuantity = catalog?.maxQuantity ?? 99;
  const cartLines = products.filter((p) => cart[p.id]);
  // Display estimate only. The amount charged is the total the server returns.
  const totalCents = cartLines.reduce((sum, p) => sum + p.priceCents * cart[p.id], 0);

  const addProduct = (id) => {
    setCart((c) => ({ ...c, [id]: Math.min((c[id] ?? 0) + 1, maxQuantity) }));
    setCartInvalid(false); // the "empty cart" problem is now fixed
  };

  const setQuantity = (id, qty) => {
    setCart((c) => {
      const next = { ...c };
      if (qty === 0) delete next[id];
      else next[id] = qty;
      return next;
    });
    if (qty === 0) pendingFocus.current = true;
  };

  const removeProduct = (id) => {
    setQuantity(id, 0);
  };

  const handleNameChange = (e) => {
    setName(e.target.value);
    if (e.target.value.trim()) setNameInvalid(false); // clear the stale message once fixed
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (locked.current) return; // guards double-click, repeated Enter, anything after success

    const trimmed = name.trim();
    const cartEmpty = cartLines.length === 0;
    setNameInvalid(!trimmed);
    setCartInvalid(cartEmpty);
    setSubmitError('');
    if (!trimmed) return nameInput.current.focus();
    if (cartEmpty) return document.querySelector('[data-add]')?.focus();

    locked.current = true;
    setSubmitting(true);
    try {
      const items = cartLines.map((p) => ({ productId: p.id, quantity: cart[p.id] }));
      setOrder(await createOrder({ name: trimmed, items }));
    } catch (err) {
      locked.current = false; // nothing was confirmed, so the customer may try again
      setSubmitError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const startNewOrder = () => {
    locked.current = false;
    setCart({});
    setName('');
    setNameInvalid(false);
    setCartInvalid(false);
    setSubmitError('');
    setOrder(null);
    pendingFocus.current = true;
  };

  return (
    <main>
      <h1>Mini Store</h1>

      {/* Everything the customer interacts with; hidden (not unmounted) once an order is confirmed */}
      <div id="shop" hidden={Boolean(order)}>
        <section aria-labelledby="products-heading">
          <h2 id="products-heading">Products</h2>
          {catalogError ? (
            <p className="error" role="alert" data-testid="products-error">
              Products could not be loaded.{' '}
              <button type="button" data-testid="products-retry" onClick={loadCatalog}>Try again</button>
            </p>
          ) : !catalog ? (
            <p role="status">Loading products&hellip;</p>
          ) : (
            <ul className="products">
              {products.map((p) => (
                <li key={p.id}>
                  <span>{p.name} &ndash; <span data-price={p.id}>{formatCents(p.priceCents)}</span></span>
                  <button type="button" data-testid={`add-${p.id}`} data-add={p.id} onClick={() => addProduct(p.id)}>
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="cart-heading">
          <h2 id="cart-heading">Your cart</h2>
          <p data-testid="cart-empty-message" id="cart-empty" hidden={cartLines.length > 0}>Your cart is empty</p>
          <ul id="cart-lines" className="cart">
            {cartLines.map((p) => (
              <li key={p.id} data-testid={`cart-line-${p.id}`}>
                <span>{p.name} &ndash; {formatCents(p.priceCents)}</span>
                <QuantityInput
                  productId={p.id}
                  productName={p.name}
                  quantity={cart[p.id]}
                  maxQuantity={maxQuantity}
                  onChange={setQuantity}
                />
                <span data-testid={`line-total-${p.id}`}>{formatCents(p.priceCents * cart[p.id])}</span>
                <button type="button" data-testid={`remove-${p.id}`} data-remove={p.id} onClick={() => removeProduct(p.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <p className="total">Order total: <strong data-testid="order-total" id="order-total">{formatCents(totalCents)}</strong></p>
        </section>

        <form id="checkout-form" noValidate onSubmit={handleSubmit}>
          <h2>Customer details</h2>
          <label htmlFor="customer-name">Full name</label>
          <input
            id="customer-name"
            ref={nameInput}
            name="name"
            type="text"
            maxLength={100}
            autoComplete="name"
            data-testid="customer-name"
            value={name}
            onChange={handleNameChange}
            aria-invalid={nameInvalid ? 'true' : undefined}
            aria-describedby={nameInvalid ? 'name-error' : undefined}
          />
          <p className="error" id="name-error" role="alert" data-testid="name-error" hidden={!nameInvalid}>
            {nameInvalid ? NAME_REQUIRED_MESSAGE : ''}
          </p>

          <p className="error" id="cart-error" role="alert" data-testid="cart-error" hidden={!cartInvalid}>
            {cartInvalid ? EMPTY_CART_MESSAGE : ''}
          </p>
          <p className="error" id="submit-error" role="alert" data-testid="submit-error" hidden={!submitError}>
            {submitError}
          </p>
          <button type="submit" id="place-order" data-testid="place-order" disabled={submitting}>Place Order</button>
        </form>
      </div>

      {order && <Confirmation order={order} onNewOrder={startNewOrder} />}
    </main>
  );
}
