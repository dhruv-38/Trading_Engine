import { CronConfig, Handlers } from "motia";
import { Order } from "../services/types";
import { OrderBook } from "../services/order-book";

export const config: CronConfig = {
    type: 'cron',
    name: 'ExpireOrders',
    description: 'Expire orders based on Time-in-Force',
    flows: ['order-management'],
    cron: '*/10 * * * * *',
    emits: [],
};

export const handler: Handlers['ExpireOrders'] = async ({ state, logger }) => {
    const now = Date.now();
    const orderBook = new OrderBook(state);
    
    try {
        const allOrders = await state.getGroup<Order>('orders');
        
        const expiredOrders = allOrders.filter(o => 
            o.expiresAt && 
            o.expiresAt <= now &&
            (o.status === 'OPEN' || o.status === 'PARTIALLY_FILLED')
        );

        for (const order of expiredOrders) {
            logger.info('Expiring order', {
                orderId: order.id,
                timeInForce: order.timeInForce,
                expiresAt: order.expiresAt,
            });

            order.status = 'EXPIRED';
            await state.set('orders', order.id, order);

            await orderBook.removeOrder(order.id, order.instrument, order.side);
        }

        if (expiredOrders.length > 0) {
            logger.info('Order expiry check complete', {
                expiredCount: expiredOrders.length,
            });
        }
    } catch (error) {
        logger.error('Order expiry check failed', { error });
    }
};
