import { InternalStateManager } from "motia";
import { Instrument, Order, OrderSide } from "../types";

export class OrderBook{
    constructor (private state:InternalStateManager){}

    async addOrder(order: Order): Promise<void> {
        const groupId = `orderbook:${order.instrument}:${order.side}`;
        await this.state.set(groupId,order.id,order);

    }

    async getBuyOrders(instrument:Instrument): Promise<Order[]>{
        const groupId = `orderbook:${instrument}:BUY`;
        const orders = await this.state.getGroup<Order>(groupId);

        orders.sort((a,b)=>{
            if (a.price !== b.price) {
                return b.price! - a.price!;
            }
            return a.timestamp - b.timestamp;
        });

    return orders;
    }

    async getSellOrders(instrument: Instrument): Promise<Order[]> {
    const groupId = `orderbook:${instrument}:SELL`;
    const orders = await this.state.getGroup<Order>(groupId);

    orders.sort((a,b)=>{
            if (a.price !== b.price) {
                return a.price! - b.price!;
            }
            return a.timestamp - b.timestamp;
        });

    return orders;
    }

    async removeOrder(orderId: string, instrument: Instrument, side: OrderSide): Promise<void> {
    const groupId = `orderbook:${instrument}:${side}`;
    await this.state.delete(groupId, orderId);
  }
}