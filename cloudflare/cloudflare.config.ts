import { bindings, defineConfig, defineContainer, exports, triggers } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

const appContainer = defineContainer({
  name: "eng-mail-app",
  schedulingPolicy: "durable-object",
  images: {
    base: { dockerfile: "../Dockerfile", buildContext: ".." },
  },
});

const sendContainer = defineContainer({
  name: "eng-mail-worker",
  schedulingPolicy: "durable-object",
  images: {
    base: { dockerfile: "../Dockerfile.worker", buildContext: ".." },
  },
});

export default defineConfig({
  accountId: "2b486676e1cdce2f4103487aa3fd4ed4",
  containers: [appContainer, sendContainer],
  worker: {
    name: "eng-email-automation",
    compatibilityDate: "2026-10-29",
    entrypoint,
    observability: { enabled: true },
    triggers: [triggers.scheduled({ schedule: "*/2 * * * *" })],
    exports: {
      AppContainer: exports.durableObject({
        storage: "sqlite",
        container: appContainer,
      }),
      SendWorkerContainer: exports.durableObject({
        storage: "sqlite",
        container: sendContainer,
      }),
    },
    env: {
      APP: bindings.durableObject({
        worker: "eng-email-automation",
        exportName: "AppContainer",
      }),
      SEND_WORKER: bindings.durableObject({
        worker: "eng-email-automation",
        exportName: "SendWorkerContainer",
      }),
      NODE_ENV: bindings.text("production"),
      STORAGE_DRIVER: bindings.text("r2"),
      R2_ACCOUNT_ID: bindings.text("2b486676e1cdce2f4103487aa3fd4ed4"),
      R2_BUCKET: bindings.text("eng-email-imports"),
    },
  },
});
