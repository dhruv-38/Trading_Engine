import { Order, Trade } from "../types";

export class MatchingEngine{
    matchOrder(incomingOrder:Order,bookOrders: Order[]): Trade[]{
        const trades: Trade[]= [];

        for(const bookOrder of bookOrders){
            if (incomingOrder.side === 'BUY'){
                if(incomingOrder.price! < bookOrder.price!){
                    break;
                }
            }
            if (incomingOrder.side === 'SELL'){
                if(incomingOrder.price! > bookOrder.price!){
                    break;
                }
            }
            const tradeQty = Math.min(incomingOrder.remainingQuantity, bookOrder.remainingQuantity);

            trades.push({
            id: crypto.randomUUID(),
            price: bookOrder.price!,
            quantity: tradeQty,
            instrument: incomingOrder.instrument,
            buyOrderId: incomingOrder.side === 'BUY'? incomingOrder.id : bookOrder.id,
            sellOrderId: incomingOrder.side === 'SELL'? incomingOrder.id : bookOrder.id,
            timestamp: Date.now(),
        })
        
        incomingOrder.remainingQuantity -= tradeQty
        bookOrder.remainingQuantity -= tradeQty
        
        if (incomingOrder.remainingQuantity === 0){
            break;
        }
        };
        return trades;
    }
}