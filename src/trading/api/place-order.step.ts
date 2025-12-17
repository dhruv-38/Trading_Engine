import { ApiRouteConfig, Handlers } from "motia";
import { Order, OrderSchema, PlaceOrderInputSchema } from "../types";
import {z} from "zod";
import {randomUUID} from "crypto";

export const config: ApiRouteConfig = {
    type: 'api',
    name: 'PlaceOrder',
    description: 'Place new order api trigger',
    flows:['orders'],
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
const orderId = randomUUID();
const order: Order ={
    id: orderId,
    ...req.body,
    status: 'PENDING',
    remainingQuantity: req.body.quantity,
    timestamp: Date.now(),

};
OrderSchema.parse(order);
await state.set('orders', orderId, order);
await emit({topic: 'order.placed', data:{orderId:order.id,instrument:order.instrument}});

return {
    status: 201,
    body: { orderId: order.id, status: order.status }
};
};