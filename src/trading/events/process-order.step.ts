import { EventConfig, Handlers, InternalStateManager } from "motia";
import { Order, OrderPlacedPayloadSchema, Position, Trade } from "../services/types";
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
    
    if (order.remainingQuantity < 0) {
        logger.error('CRITICAL: Negative remaining quantity detected', {
            orderId: order.id,
            remainingQuantity: order.remainingQuantity,
        });
        order.remainingQuantity = 0;
    }
    
    if (order.remainingQuantity === 0) {
        order.status = 'FILLED';
    } else if (order.remainingQuantity < order.quantity) {
        order.status = 'PARTIALLY_FILLED';
    }
    
    await state.set('orders', order.id, order);
    
    for (const trade of trades) {
        await state.set('trades', trade.id, trade);
        
        await updatePosition(state, trade, 'buy');
        await updatePosition(state, trade, 'sell');
        
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
        const buyOrders = await orderBook.getBuyOrders(instrument);
        const sellOrders = await orderBook.getSellOrders(instrument);
        
        const bestBid = buyOrders.length > 0 ? buyOrders[0].price : undefined;
        const bestAsk = sellOrders.length > 0 ? sellOrders[0].price : undefined;
        
        if (order.side === 'BUY' && bestAsk !== undefined && order.price! >= bestAsk) {
            logger.error('CRITICAL: Crossed book detected - BUY order price >= best ASK', {
                orderId: order.id,
                buyPrice: order.price,
                bestAsk,
            });
        } else if (order.side === 'SELL' && bestBid !== undefined && order.price! <= bestBid) {
            logger.error('CRITICAL: Crossed book detected - SELL order price <= best BID', {
                orderId: order.id,
                sellPrice: order.price,
                bestBid,
            });
        } else {
            await orderBook.addOrder(order);
            logger.info('Order added to book', {
                orderId: order.id,
                side: order.side,
                remainingQuantity: order.remainingQuantity
            });
        }
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

async function updatePosition(state: InternalStateManager, trade: Trade, side: 'buy' | 'sell') {
    const buyOrder = await state.get<Order>('orders', trade.buyOrderId);
    const sellOrder = await state.get<Order>('orders', trade.sellOrderId);
    
    if (!buyOrder || !sellOrder) return;
    
    const userId = side === 'buy' ? buyOrder.userId : sellOrder.userId;
    const positionKey = `${userId}:${trade.instrument}`;
    
    let position = await state.get<Position>('positions', positionKey);
    
    if (!position) {
        position = {
            userId,
            instrument: trade.instrument,
            quantity: 0,
            averagePrice: 0,
            realizedPnL: 0,
            unrealizedPnL: 0,
            lastUpdated: Date.now(),
        };
    }
    
    const quantityChange = side === 'buy' ? trade.quantity : -trade.quantity;
    const oldQuantity = position.quantity;
    const newQuantity = oldQuantity + quantityChange;
    
    if (newQuantity !== 0) {
        const oldValue = oldQuantity * position.averagePrice;
        const newValue = quantityChange * trade.price;
        position.averagePrice = Math.abs((oldValue + newValue) / newQuantity);
    }
    
    if (Math.sign(oldQuantity) !== Math.sign(newQuantity) && oldQuantity !== 0) {
        const closedQuantity = Math.min(Math.abs(oldQuantity), Math.abs(quantityChange));
        const pnlPerUnit = side === 'buy' 
            ? position.averagePrice - trade.price 
            : trade.price - position.averagePrice;
        position.realizedPnL += closedQuantity * pnlPerUnit;
    }
    
    position.quantity = newQuantity;
    position.lastUpdated = Date.now();
    
    await state.set('positions', positionKey, position);
}