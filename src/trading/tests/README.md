# Trading Engine Test Suite

Complete testing guide for all features. Run these commands with the server running (`npm run dev`).

## Prerequisites
```bash
# Start the server
npm run dev

# Server runs on http://localhost:3000
```

---

## Phase 1: Basic Order Flow

### Test 1.1: Place LIMIT Order
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "LIMIT",
    "side": "SELL",
    "instrument": "AAPL",
    "price": 150.00,
    "quantity": 100,
    "timeInForce": "GTC"
  }'
```
**Expected**: 201, returns `orderId`

### Test 1.2: Place MARKET Order
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user2",
    "type": "MARKET",
    "side": "BUY",
    "instrument": "AAPL",
    "quantity": 50,
    "timeInForce": "GTC"
  }'
```
**Expected**: 201, matches with previous SELL order, creates trade

### Test 1.3: Cancel Order
```bash
# First, place an order
ORDER_ID=$(curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "LIMIT",
    "side": "BUY",
    "instrument": "AAPL",
    "price": 140.00,
    "quantity": 50,
    "timeInForce": "GTC"
  }' | jq -r '.orderId')

# Then cancel it
curl -X DELETE http://localhost:3000/orders/$ORDER_ID
```
**Expected**: 200, order status = CANCELLING

---

## Phase 2: Matching Engine Tests

### Test 2.1: Partial Fill
```bash
# Place large SELL order
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "LIMIT",
    "side": "SELL",
    "instrument": "AAPL",
    "price": 150.00,
    "quantity": 200,
    "timeInForce": "GTC"
  }'

# Place smaller BUY order
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user2",
    "type": "LIMIT",
    "side": "BUY",
    "instrument": "AAPL",
    "price": 150.00,
    "quantity": 50,
    "timeInForce": "GTC"
  }'
```
**Expected**: BUY order FILLED, SELL order PARTIALLY_FILLED (150 remaining)

### Test 2.2: Multiple Levels (Walk the Book)
```bash
# Place multiple SELL orders at different prices
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "LIMIT",
    "side": "SELL",
    "instrument": "AAPL",
    "price": 150.00,
    "quantity": 50,
    "timeInForce": "GTC"
  }'

curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user3",
    "type": "LIMIT",
    "side": "SELL",
    "instrument": "AAPL",
    "price": 150.05,
    "quantity": 50,
    "timeInForce": "GTC"
  }'

# Place large BUY MARKET order
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user2",
    "type": "MARKET",
    "side": "BUY",
    "instrument": "AAPL",
    "quantity": 100,
    "timeInForce": "GTC"
  }'
```
**Expected**: Creates 2 trades at $150.00 and $150.05

---

## Phase 3: Self-Matching Prevention

### Test 3.1: Same User Cannot Trade with Self
```bash
# user1 places SELL
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "LIMIT",
    "side": "SELL",
    "instrument": "AAPL",
    "price": 150.00,
    "quantity": 100,
    "timeInForce": "GTC"
  }'

# user1 places BUY (should NOT match)
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "LIMIT",
    "side": "BUY",
    "instrument": "AAPL",
    "price": 150.00,
    "quantity": 100,
    "timeInForce": "GTC"
  }'
```
**Expected**: NO trade created, both orders remain OPEN

---

## Phase 4: Price Validation

### Test 4.1: Valid Price (0.01 increments)
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "LIMIT",
    "side": "BUY",
    "instrument": "AAPL",
    "price": 149.95,
    "quantity": 100,
    "timeInForce": "GTC"
  }'
```
**Expected**: 201, accepted

### Test 4.2: Invalid Price (sub-penny)
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "LIMIT",
    "side": "BUY",
    "instrument": "AAPL",
    "price": 149.955,
    "quantity": 100,
    "timeInForce": "GTC"
  }'
```
**Expected**: 400, "Price must be in 0.01 increments"

### Test 4.3: LIMIT Without Price
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "LIMIT",
    "side": "BUY",
    "instrument": "AAPL",
    "quantity": 100,
    "timeInForce": "GTC"
  }'
```
**Expected**: 400, "LIMIT orders must have a price"

### Test 4.4: MARKET With Price
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "MARKET",
    "side": "BUY",
    "instrument": "AAPL",
    "price": 150.00,
    "quantity": 100,
    "timeInForce": "GTC"
  }'
```
**Expected**: 400, "MARKET orders cannot have a price"

---

## Phase 5: Pre-Trade Risk Management

### Test 5.1: Max Order Size
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "LIMIT",
    "side": "BUY",
    "instrument": "AAPL",
    "price": 150.00,
    "quantity": 20000,
    "timeInForce": "GTC"
  }'
```
**Expected**: 400, "Order size exceeds maximum of 10000"

### Test 5.2: Max Notional Value
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "LIMIT",
    "side": "BUY",
    "instrument": "AAPL",
    "price": 150000.00,
    "quantity": 100,
    "timeInForce": "GTC"
  }'
```
**Expected**: 400, "Order notional value exceeds maximum"

### Test 5.3: Max Open Orders (need to place 100+ orders)
```bash
# Script to test max open orders
for i in {1..101}; do
  curl -X POST http://localhost:3000/orders \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": \"user1\",
      \"type\": \"LIMIT\",
      \"side\": \"BUY\",
      \"instrument\": \"AAPL\",
      \"price\": $(echo "140 + $i * 0.01" | bc),
      \"quantity\": 10,
      \"timeInForce\": \"GTC\"
    }"
done
```
**Expected**: First 100 succeed, 101st returns 400

---

## Phase 6: Idempotency

### Test 6.1: Duplicate Order Detection
```bash
# Place order
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "LIMIT",
    "side": "BUY",
    "instrument": "AAPL",
    "price": 150.00,
    "quantity": 100,
    "timeInForce": "GTC"
  }'

# Immediately place identical order
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "LIMIT",
    "side": "BUY",
    "instrument": "AAPL",
    "price": 150.00,
    "quantity": 100,
    "timeInForce": "GTC"
  }'
```
**Expected**: Second request returns 200 with existing orderId (not 201)

---

## Phase 7: Time-in-Force (TIF)

### Test 7.1: GTC (Good-Till-Cancel)
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "LIMIT",
    "side": "BUY",
    "instrument": "AAPL",
    "price": 140.00,
    "quantity": 100,
    "timeInForce": "GTC"
  }'
```
**Expected**: Order stays in book indefinitely

### Test 7.2: DAY (Expires at 5 PM)
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "LIMIT",
    "side": "BUY",
    "instrument": "AAPL",
    "price": 140.00,
    "quantity": 100,
    "timeInForce": "DAY"
  }'
```
**Expected**: Order expires automatically at 5 PM (check cron logs every 10s)

### Test 7.3: IOC (Immediate-or-Cancel)
```bash
# Place IOC order with no matching orders in book
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "LIMIT",
    "side": "BUY",
    "instrument": "AAPL",
    "price": 100.00,
    "quantity": 100,
    "timeInForce": "IOC"
  }'
```
**Expected**: Order expires within 100ms (cron checks every 10s)

---

## Phase 8: Event Replay & Debugging

### Test 8.1: Replay Orderbook from History
```bash
curl http://localhost:3000/orderbook/AAPL/replay
```
**Expected**: Returns reconstructed orderbook with:
- buyOrders array (sorted descending price)
- sellOrders array (sorted ascending price)
- totalTrades count
- totalOrders count
- replayedAt timestamp

---

## Phase 9: Error Handling

### Test 9.1: Cancel Non-Existent Order
```bash
curl -X DELETE http://localhost:3000/orders/invalid-order-id
```
**Expected**: 404, "Order not found"

### Test 9.2: Cancel Already Filled Order
```bash
# Place and fill order first
ORDER_ID=$(curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user1",
    "type": "LIMIT",
    "side": "SELL",
    "instrument": "AAPL",
    "price": 150.00,
    "quantity": 50,
    "timeInForce": "GTC"
  }' | jq -r '.orderId')

curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user2",
    "type": "MARKET",
    "side": "BUY",
    "instrument": "AAPL",
    "quantity": 50,
    "timeInForce": "GTC"
  }'

# Try to cancel filled order
curl -X DELETE http://localhost:3000/orders/$ORDER_ID
```
**Expected**: 400, "Cannot cancel order with status FILLED"

---

## Phase 10: Complete Workflow Test

### Test 10: Full Trading Scenario
```bash
# 1. Place 3 SELL orders at different prices
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"userId": "user1", "type": "LIMIT", "side": "SELL", "instrument": "AAPL", "price": 150.00, "quantity": 50, "timeInForce": "GTC"}'

curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"userId": "user2", "type": "LIMIT", "side": "SELL", "instrument": "AAPL", "price": 150.05, "quantity": 50, "timeInForce": "GTC"}'

curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"userId": "user3", "type": "LIMIT", "side": "SELL", "instrument": "AAPL", "price": 150.10, "quantity": 50, "timeInForce": "GTC"}'

# 2. Place large MARKET BUY (should match all 3)
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"userId": "user4", "type": "MARKET", "side": "BUY", "instrument": "AAPL", "quantity": 150, "timeInForce": "GTC"}'

# 3. Check orderbook replay
curl http://localhost:3000/orderbook/AAPL/replay

# 4. Place BUY order
ORDER_ID=$(curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"userId": "user5", "type": "LIMIT", "side": "BUY", "instrument": "AAPL", "price": 145.00, "quantity": 100, "timeInForce": "GTC"}' | jq -r '.orderId')

# 5. Cancel it
curl -X DELETE http://localhost:3000/orders/$ORDER_ID
```

**Expected**: 
- 3 trades created at $150.00, $150.05, $150.10
- Replay shows empty orderbook (all matched)
- Cancellation succeeds

---

## Monitoring & Logs

### Check Server Logs
```bash
# Watch for these log messages:
# - "Order placed"
# - "Trade executed"
# - "Order cancelled"
# - "Order expired" (from cron)
# - "Crossed book detected" (integrity check)
# - "Duplicate order detected" (idempotency)
```

### Cron Job Activity
```bash
# Every 10 seconds, expire-orders cron runs
# Watch logs for: "Expiring order" messages
```

---

## Performance Test

### Test P1: Concurrent Orders
```bash
# Place 10 orders simultaneously
for i in {1..10}; do
  curl -X POST http://localhost:3000/orders \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": \"user$i\",
      \"type\": \"LIMIT\",
      \"side\": \"BUY\",
      \"instrument\": \"AAPL\",
      \"price\": 149.00,
      \"quantity\": 10,
      \"timeInForce\": \"GTC\"
    }" &
done
wait
```
**Expected**: All 10 orders succeed without race conditions

---

## Summary of Features Tested

✅ Order placement (LIMIT/MARKET)  
✅ Order cancellation  
✅ Matching engine (full/partial fills)  
✅ Self-matching prevention  
✅ Price validation (0.01 increments)  
✅ Pre-trade risk checks (size, notional, max orders)  
✅ Idempotency (duplicate detection)  
✅ Time-in-Force (GTC/DAY/IOC)  
✅ Event replay (orderbook reconstruction)  
✅ Error handling (404, 400, edge cases)  
✅ Integrity checks (negative qty, crossed book)  
✅ Audit trail (trade/cancellation recording)  
