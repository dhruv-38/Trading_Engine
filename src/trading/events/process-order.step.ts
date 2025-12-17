import { EventConfig, Handlers } from "motia";
import { OrderPlacedPayloadSchema } from "../types";

export const config: EventConfig = {
    type: 'event',
    name: 'ProcessOrder',
    description: 'Here, Process new orders',
    flows: ['order-management'],
    subscribes: ['order.placed'],
    emits: [],
    input: OrderPlacedPayloadSchema,
};

export const handler: Handlers['ProcessOrder'] = async (input, { state, logger }) => {
    const { orderId, instrument } = input;
    const order = await state.get('orders', orderId);
    if (!order) {
        logger.warn('Order not found', { orderId });
        return;
    }
    order.status = 'OPEN';
    await state.set('orders', orderId, order);
    logger.info('Order processed', {
        orderId,
        instrument: order.instrument,
        status: order.status
    });

}