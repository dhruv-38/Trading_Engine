import { EventConfig, Handlers } from "motia";
import { OrderCancelledPayloadSchema, Order } from "../services/types";
import { OrderBook } from "../services/order-book";

export const config: EventConfig = {
    type: 'event',
    name: 'ProcessCancellation',
    description: 'Process order cancellation',
    flows: ['order-management'],
    subscribes: ['order.cancelled'],
    emits: ['cancellation.recorded'],
    input: OrderCancelledPayloadSchema,
};

export const handler: Handlers['ProcessCancellation'] = async (input, { state, logger, emit }) => {
    const { orderId, instrument, side } = input;

    try {
        const order = await state.get<Order>('orders', orderId);

        if (!order) {
            logger.error('Order not found for cancellation', { orderId });
            return;
        }

        order.status = 'CANCELLED';
        await state.set('orders', orderId, order);

        const orderBook = new OrderBook(state);
        await orderBook.removeOrder(orderId, instrument, side);

        await emit({ topic: 'cancellation.recorded', data: { orderId, instrument, side } });

        logger.info('Order cancelled successfully', {
            orderId,
            instrument,
            side,
        });
    } catch (error) {
        logger.error('Cancellation processing failed', { error, orderId, instrument });
    }
};
