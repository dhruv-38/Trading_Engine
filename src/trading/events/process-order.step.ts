import { EventConfig, Handlers } from "motia";
import { Order, OrderPlacedPayloadSchema } from "../services/types";
import { OrderBook } from "../services/order-book";
import { MatchingEngine } from "../services/matching-engine";

export const config: EventConfig = {
    type: 'event',
    name: 'ProcessOrder',
    description: 'Here, Process new orders',
    flows: ['order-management'],
    subscribes: ['order.placed'],
    emits: ['trade.executed'],
    input: OrderPlacedPayloadSchema,
};

export const handler: Handlers['ProcessOrder'] = async (input, { state, logger, emit }) => {
    const { orderId, instrument } = input;
    
    try {
        const order = await state.get<Order>('orders', orderId);
        if (!order) {
            logger.error('Order not found', { orderId });
            return;
        }
    order.status = 'OPEN';
    await state.set('orders', orderId, order);
    const orderBook = new OrderBook(state);
    const matchingEngine = new MatchingEngine();

    const oppositeOrders = order.side === 'BUY'
        ? await orderBook.getSellOrders(instrument)
        : await orderBook.getBuyOrders(instrument);

    const trades = matchingEngine.matchOrder(order, oppositeOrders);
    if (order.remainingQuantity === 0) {
        order.status = 'FILLED';
    } else if (order.remainingQuantity < order.quantity) {
        order.status = 'PARTIALLY_FILLED';
    }
    
    await state.set('orders', order.id, order);
    
    for (const trade of trades) {
        await state.set('trades', trade.id, trade);
        await emit({
            topic: 'trade.executed',
            data: {
                tradeId: trade.id,
                buyOrderId: trade.buyOrderId,
                sellOrderId: trade.sellOrderId,
                instrument: trade.instrument,
            }
        });

        logger.info('Trade executed', {
            tradeId: trade.id,
            instrument: trade.instrument,
            price: trade.price,
            quantity: trade.quantity
        });
    }
    
    for (const bookOrder of oppositeOrders) {
        if (bookOrder.remainingQuantity !== bookOrder.quantity) {
            bookOrder.status = bookOrder.remainingQuantity === 0 ? 'FILLED' : 'PARTIALLY_FILLED';
            await state.set('orders', bookOrder.id, bookOrder);
            if (bookOrder.remainingQuantity === 0) {
                await orderBook.removeOrder(bookOrder.id, bookOrder.instrument, bookOrder.side);
            }
        }
    }

    if (order.remainingQuantity > 0 && order.type === 'LIMIT') {
        await orderBook.addOrder(order);
        logger.info('Order added to book', {
            orderId: order.id,
            side: order.side,
            remainingQuantity: order.remainingQuantity
        });
    }

    logger.info('Order processing complete', {
        orderId,
        tradesCreated: trades.length,
        finalStatus: order.status
    });
    } catch (error) {
        logger.error('Order processing failed', { error, orderId, instrument });
        try {
            const failedOrder = await state.get<Order>('orders', orderId);
            if (failedOrder && failedOrder.status !== 'FILLED') {
                failedOrder.status = 'CANCELLED';
                await state.set('orders', orderId, failedOrder);
            }
        } catch (cleanupError) {
            logger.error('Cleanup failed', { cleanupError, orderId });
        }
    }
}