import { EventConfig, Handlers } from "motia";
import { OrderCancelledPayloadSchema, Order } from "../services/types";

export const config: EventConfig = {
    type: 'event',
    name: 'RecordCancellation',
    description: 'Record cancelled orders for audit and analytics',
    flows: ['order-management'],
    subscribes: ['cancellation.recorded'],
    emits: [],
    input: OrderCancelledPayloadSchema,
};

export const handler: Handlers['RecordCancellation'] = async (input, { state, logger }) => {
    const { orderId, instrument, side } = input;
    
    try {
        const order = await state.get<Order>('orders', orderId);
        
        if (!order) {
            logger.error('Order not found for cancellation recording', { orderId });
            return;
        }

        logger.info('Cancellation recorded', {
            orderId,
            instrument,
            side,
            status: order.status,
        });
    } catch (error) {
        logger.error('Cancellation recording failed', { error, orderId });
    }
};
