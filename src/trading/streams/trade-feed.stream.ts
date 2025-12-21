import { StreamConfig } from "motia";
import { TradeSchema } from "../services/types";

export const config: StreamConfig = {
    name: 'tradeFeed',
    schema: TradeSchema,
    baseConfig: { storageType: 'default' },
};
