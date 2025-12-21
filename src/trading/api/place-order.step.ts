import { ApiRouteConfig, Handlers } from "motia";
import { Order, OrderSchema, PlaceOrderInputSchema } from "../services/types";
import {z} from "zod";
import {randomUUID} from "crypto";
import { errorHandler } from "../middlewares/error-handler.middleware";

export const config: ApiRouteConfig = {
    type: 'api',
    name: 'PlaceOrder',
    description: 'Place new order api trigger',
    flows:['order-management'],
    method: 'POST',
    path: '/orders',
    bodySchema: PlaceOrderInputSchema,
    emits:['order.placed'],
    responseSchema:{
        200: z.object({orderId: z.string(), status: z.string()}),
        201: z.object({orderId: z.string()}),
        400: z.object({error: z.string()}),
    },
    middleware:[errorHandler],

};

const RISK_LIMITS = {
    MAX_ORDER_SIZE: 10000,
    MAX_OPEN_ORDERS_PER_USER: 100,
    MAX_NOTIONAL_PER_ORDER: 1000000,
};

export const handler: Handlers['PlaceOrder'] = async (req,{emit,state,logger}) =>{
logger.info('Order placed',{body: req.body})

if (req.body.quantity > RISK_LIMITS.MAX_ORDER_SIZE) {
    return {
        status: 400,
        body: { error: `Order size exceeds maximum of ${RISK_LIMITS.MAX_ORDER_SIZE}` }
    };
}


if (req.body.type === 'LIMIT' && req.body.price) {
    const notional = req.body.price * req.body.quantity;
    if (notional > RISK_LIMITS.MAX_NOTIONAL_PER_ORDER) {
        return {
            status: 400,
            body: { error: `Order notional value $${notional} exceeds maximum of $${RISK_LIMITS.MAX_NOTIONAL_PER_ORDER}` }
        };
    }
}


const userOrders = await state.getGroup<Order>('orders');
const userOpenOrders = userOrders.filter(o => 
    o.userId === req.body.userId && 
    (o.status === 'PENDING' || o.status === 'OPEN' || o.status === 'PARTIALLY_FILLED')
);
if (userOpenOrders.length >= RISK_LIMITS.MAX_OPEN_ORDERS_PER_USER) {
    return {
        status: 400,
        body: { error: `User has ${userOpenOrders.length} open orders, maximum is ${RISK_LIMITS.MAX_OPEN_ORDERS_PER_USER}` }
    };
}

if (req.body.type === 'LIMIT' && !req.body.price) {
    return {
        status: 400,
        body: { error: 'LIMIT orders must have a price' }
    };
}
if (req.body.type === 'MARKET' && req.body.price) {
    return {
        status: 400,
        body: { error: 'MARKET orders cannot have a price' }
    };
}


const orderId = randomUUID();

const existingOrders = await state.getGroup<Order>('orders');
const duplicateOrder = existingOrders.find(o => 
    o.userId === req.body.userId &&
    o.instrument === req.body.instrument &&
    o.side === req.body.side &&
    o.type === req.body.type &&
    o.price === req.body.price &&
    o.quantity === req.body.quantity &&
    o.status !== 'CANCELLED' &&
    o.status !== 'FILLED' &&
    (Date.now() - o.timestamp) < 5000 
);

if (duplicateOrder) {
    logger.warn('Duplicate order detected', { orderId: duplicateOrder.id, userId: req.body.userId });
    return {
        status: 200, 
        body: { orderId: duplicateOrder.id, status: duplicateOrder.status }
    };
}


const timeInForce = req.body.timeInForce || 'GTC';
let expiresAt: number | undefined;

if (timeInForce === 'DAY') {
    
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(17, 0, 0, 0); 
    if (now.getHours() >= 17) {
        endOfDay.setDate(endOfDay.getDate() + 1);
    }
    expiresAt = endOfDay.getTime();
} else if (timeInForce === 'IOC') {
    expiresAt = Date.now() + 100;
}

const order: Order ={
    id: orderId,
    ...req.body,
    status: 'PENDING',
    remainingQuantity: req.body.quantity,
    timestamp: Date.now(),
    timeInForce,
    expiresAt,

};

try {
    OrderSchema.parse(order);
} catch (error) {
    logger.error('Order validation failed', { error, orderId });
    const zodError = error as any;
    const errorMessage = zodError.issues?.[0]?.message || zodError.message || 'Invalid order data';
    return {
        status: 400,
        body: { error: errorMessage }
    };
}

await state.set('orders', orderId, order);
await emit({topic: 'order.placed', data:{orderId:order.id,instrument:order.instrument}});

return {
    status: 201,
    body: { orderId: order.id, status: order.status }
};
};