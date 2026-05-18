import { adminMessages } from "./admin-messages";
import { adminResourceMessages } from "./admin-resource-messages";
import { agentMessages } from "./agent-messages";
import { applicationMessages } from "./application-messages";
import { sharedMessages } from "./shared-messages";

export const messages = {
  en: {
    ...sharedMessages.en,
    ...adminMessages.en,
    ...adminResourceMessages.en,
    ...applicationMessages.en,
    ...agentMessages.en
  },
  "zh-CN": {
    ...sharedMessages["zh-CN"],
    ...adminMessages["zh-CN"],
    ...adminResourceMessages["zh-CN"],
    ...applicationMessages["zh-CN"],
    ...agentMessages["zh-CN"]
  }
} as const;

export type MessageKey = keyof typeof messages.en;
