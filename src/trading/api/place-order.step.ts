import { ApiRouteConfig, Handlers } from "motia";
import { Order, OrderSchema, PlaceOrderInputSchema } from "../services/types";
import {z} from "zod";
import {randomUUID} from "crypto";

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
        201: z.object({orderId: z.string()}),
        400: z.object({error: z.string()}),
    },

};

export const handler: Handlers['PlaceOrder'] = async (req,{emit,state,logger}) =>{
logger.info('Order placed',{body: req.body})

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
const order: Order ={
    id: orderId,
    ...req.body,
    status: 'PENDING',
    remainingQuantity: req.body.quantity,
    timestamp: Date.now(),

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